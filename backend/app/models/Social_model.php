<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Social Model — follows, connections and two-way star ratings
 * ------------------------------------------------------------------
 * A follow is one-way. When both people follow each other they are a
 * "connection": they show up in each other's Messages contact list and
 * on each other's profile.
 *
 * Ratings live in two mirror tables:
 *   employer_reviews  a worker rating the employer / client who hired them (migration 017)
 *   worker_reviews    an employer / client rating the worker they hired    (migration 018)
 * rating_for() answers with whichever one applies to that account type.
 */
class Social_model extends Model
{
    protected $table = 'follows';

    /** Columns a profile card needs; never email or phone. */
    public const CARD = 'id, full_name, account_type, location, picture, bio, is_verified, avatar_color, created_at';

    private function has(string $table): bool
    {
        static $cache = [];
        if (!isset($cache[$table])) {
            $cache[$table] = (bool) $this->db->raw(
                'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
                [$table]
            )->fetchColumn();
        }
        return $cache[$table];
    }

    public function ready(): bool
    {
        return $this->has('follows');
    }

    /** Only the columns this database actually has (avatar_color arrives with migration 018). */
    private function card_columns(string $alias = 'u'): string
    {
        static $cols = null;
        if ($cols === null) {
            $have = $this->db->raw(
                "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
            )->fetchAll(PDO::FETCH_COLUMN) ?: [];
            $have = array_map('strtolower', $have);
            $cols = array_values(array_filter(array_map('trim', explode(',', self::CARD)), fn($c) => in_array($c, $have, true)));
        }
        return implode(', ', array_map(fn($c) => "{$alias}.{$c}", $cols));
    }

    /* ── follows ─────────────────────────────────────────── */

    public function is_following(int $me, int $other): bool
    {
        if (!$this->ready()) return false;
        return (bool) $this->db->raw(
            'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1', [$me, $other]
        )->fetchColumn();
    }

    public function follow(int $me, int $other): bool
    {
        if (!$this->ready() || $me === $other) return false;
        $this->db->raw(
            'INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE created_at = created_at',
            [$me, $other, date('Y-m-d H:i:s')]
        );
        return true;
    }

    public function unfollow(int $me, int $other): bool
    {
        if (!$this->ready()) return false;
        $this->db->raw('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [$me, $other]);
        return true;
    }

    /** [following, followers, connections] counts for one account. */
    public function counts(int $uid): array
    {
        if (!$this->ready()) return ['following' => 0, 'followers' => 0, 'connections' => 0];
        $row = $this->db->raw(
            'SELECT
               (SELECT COUNT(*) FROM follows WHERE follower_id = ?)  AS following,
               (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followers,
               (SELECT COUNT(*) FROM follows a JOIN follows b ON b.follower_id = a.following_id AND b.following_id = a.follower_id
                 WHERE a.follower_id = ?) AS connections',
            [$uid, $uid, $uid]
        )->fetch(PDO::FETCH_ASSOC) ?: [];
        return [
            'following'   => (int) ($row['following'] ?? 0),
            'followers'   => (int) ($row['followers'] ?? 0),
            'connections' => (int) ($row['connections'] ?? 0),
        ];
    }

    /**
     * People linked to this account.
     * $kind: following | followers | connections (mutual)
     */
    public function people(int $uid, string $kind = 'following', int $limit = 100): array
    {
        if (!$this->ready()) return [];
        $cols = $this->card_columns('u');
        if ($kind === 'followers') {
            $sql = "SELECT {$cols}, f.created_at AS linked_at,
                           EXISTS(SELECT 1 FROM follows b WHERE b.follower_id = ? AND b.following_id = u.id) AS i_follow
                    FROM follows f JOIN users u ON u.id = f.follower_id
                    WHERE f.following_id = ? AND u.is_active = 1 ORDER BY f.created_at DESC LIMIT {$limit}";
            $args = [$uid, $uid];
        } elseif ($kind === 'connections') {
            $sql = "SELECT {$cols}, a.created_at AS linked_at, 1 AS i_follow
                    FROM follows a
                    JOIN follows b ON b.follower_id = a.following_id AND b.following_id = a.follower_id
                    JOIN users u ON u.id = a.following_id
                    WHERE a.follower_id = ? AND u.is_active = 1 ORDER BY a.created_at DESC LIMIT {$limit}";
            $args = [$uid];
        } else {
            $sql = "SELECT {$cols}, f.created_at AS linked_at, 1 AS i_follow
                    FROM follows f JOIN users u ON u.id = f.following_id
                    WHERE f.follower_id = ? AND u.is_active = 1 ORDER BY f.created_at DESC LIMIT {$limit}";
            $args = [$uid];
        }
        return $this->db->raw($sql, $args)->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /** Ids this user already follows, as a lookup. */
    public function following_ids(int $uid): array
    {
        if (!$this->ready()) return [];
        $rows = $this->db->raw('SELECT following_id FROM follows WHERE follower_id = ?', [$uid])->fetchAll(PDO::FETCH_COLUMN) ?: [];
        return array_map('intval', $rows);
    }

    /* ── ratings ─────────────────────────────────────────── */

    /** Which table holds ratings about this kind of account. */
    public function rating_table(?string $accountType): ?string
    {
        if ($accountType === 'worker') return $this->has('worker_reviews') ? 'worker_reviews' : null;
        return $this->has('employer_reviews') ? 'employer_reviews' : null;
    }

    private function rating_column(string $table): string
    {
        return $table === 'worker_reviews' ? 'worker_id' : 'employer_id';
    }

    /** ['count' => n, 'average' => 4.6, 'stars' => [5=>…]] for one account. */
    public function rating_for(int $uid, ?string $accountType): array
    {
        $out = ['count' => 0, 'average' => null, 'stars' => [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0]];
        $table = $this->rating_table($accountType);
        if (!$table) return $out;
        $col = $this->rating_column($table);
        $rows = $this->db->raw(
            "SELECT rating, COUNT(*) AS n FROM {$table} WHERE {$col} = ? AND is_hidden = 0 GROUP BY rating", [$uid]
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        foreach ($rows as $r) $out['stars'][(int) $r['rating']] = (int) $r['n'];
        $out['count'] = array_sum($out['stars']);
        if ($out['count']) {
            $sum = 0;
            foreach ($out['stars'] as $star => $n) $sum += $star * $n;
            $out['average'] = round($sum / $out['count'], 1);
        }
        return $out;
    }

    /** Averages for many accounts at once: [user_id => ['count'=>, 'average'=>]]. */
    public function ratings_for_many(array $ids, ?string $accountType): array
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        $table = $this->rating_table($accountType);
        if (!$ids || !$table) return [];
        $col = $this->rating_column($table);
        $in = implode(',', array_fill(0, count($ids), '?'));
        $rows = $this->db->raw(
            "SELECT {$col} AS uid, COUNT(*) AS n, AVG(rating) AS avg FROM {$table}
             WHERE {$col} IN ({$in}) AND is_hidden = 0 GROUP BY {$col}", $ids
        )->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $out = [];
        foreach ($rows as $r) $out[(int) $r['uid']] = ['count' => (int) $r['n'], 'average' => round((float) $r['avg'], 1)];
        return $out;
    }
}
