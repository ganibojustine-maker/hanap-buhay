<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * ------------------------------------------------------------------
 * Photo Model
 * ------------------------------------------------------------------
 * Photos of a post: a job, a gig (owner_type "job") or a worker's service listing
 * (owner_type "service"), stored in post_photos (migration 022).
 *
 * A job's first photo is its cover and stays in job_images (with jobs.image_v), so every
 * card that already shows it keeps working; post_photos holds slots 1–5. A service keeps
 * all of its photos in post_photos, and its lowest slot is the cover.
 *
 * Photos are kept in the database (as data: URLs), because the server's disk is wiped on
 * every deploy.
 */
class Photo_model extends Model
{
    protected $table = 'post_photos';

    public const MAX = ['job' => 6, 'service' => 6];   // including the cover

    /** [{slot, v, url}] for one post, cover first. */
    public function list_for(string $type, int $id, int $imageV = 0): array
    {
        $out = [];
        if ($type === 'job' && $imageV > 0) {
            $out[] = ['slot' => 0, 'v' => $imageV, 'url' => "/api/jobs/{$id}/image?v={$imageV}"];
        }
        $rows = $this->db->table($this->table)
            ->select('slot, updated_at')
            ->where('owner_type', $type)->where('owner_id', $id)
            ->order_by('slot', 'ASC')->get_all() ?: [];
        foreach ($rows as $r) $out[] = $this->entry($type, $id, $r);
        return $out;
    }

    /** Photo lists for many services at once: [service id => [{slot, v, url}]]. */
    public function lists_for_services(array $ids): array
    {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if (!$ids) return [];
        $rows = $this->db->table($this->table)
            ->select('owner_id, slot, updated_at')
            ->where('owner_type', 'service')->in('owner_id', $ids)
            ->order_by('owner_id, slot')->get_all() ?: [];
        $out = [];
        foreach ($rows as $r) $out[(int) $r['owner_id']][] = $this->entry('service', (int) $r['owner_id'], $r);
        return $out;
    }

    private function entry(string $type, int $id, array $r): array
    {
        $slot = (int) $r['slot'];
        $v = strtotime((string) $r['updated_at']) ?: 1;
        return ['slot' => $slot, 'v' => $v, 'url' => "/api/photos/{$type}/{$id}/{$slot}/file?v={$v}"];
    }

    /** The slots a post already uses in post_photos. */
    public function used_slots(string $type, int $id): array
    {
        $rows = $this->db->table($this->table)->select('slot')
            ->where('owner_type', $type)->where('owner_id', $id)->get_all() ?: [];
        return array_map(fn($r) => (int) $r['slot'], $rows);
    }

    public function add(string $type, int $id, int $slot, string $mime, int $size, string $data): void
    {
        $this->db->table($this->table)->insert([
            'owner_type' => $type, 'owner_id' => $id, 'slot' => $slot,
            'file_mime' => $mime, 'file_size' => $size, 'file_data' => $data,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /** The photo itself (mime + data URL), or null. */
    public function find(string $type, int $id, int $slot): ?array
    {
        return $this->db->table($this->table)->select('slot, file_mime, file_size, file_data')
            ->where('owner_type', $type)->where('owner_id', $id)->where('slot', $slot)->get() ?: null;
    }

    /** The lowest extra photo of a post (the one that becomes a job's new cover). */
    public function first_extra(string $type, int $id): ?array
    {
        return $this->db->table($this->table)->select('slot, file_mime, file_size, file_data')
            ->where('owner_type', $type)->where('owner_id', $id)
            ->order_by('slot', 'ASC')->limit(1)->get() ?: null;
    }

    public function remove(string $type, int $id, int $slot): void
    {
        $this->db->table($this->table)->where('owner_type', $type)->where('owner_id', $id)->where('slot', $slot)->delete();
    }

    /* ── a job's cover (job_images) ─────────────────────────── */

    public function cover(int $jobId): ?array
    {
        return $this->db->table('job_images')->select('file_mime, file_data')->where('job_id', $jobId)->get() ?: null;
    }

    public function save_cover(int $jobId, string $mime, int $size, string $data): void
    {
        $row = ['file_mime' => $mime, 'file_size' => $size, 'file_data' => $data, 'updated_at' => date('Y-m-d H:i:s')];
        if ($this->cover($jobId)) {
            $this->db->table('job_images')->where('job_id', $jobId)->update($row);
        } else {
            $this->db->table('job_images')->insert(['job_id' => $jobId] + $row);
        }
    }

    public function remove_cover(int $jobId): void
    {
        $this->db->table('job_images')->where('job_id', $jobId)->delete();
    }
}
