<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Which optional tables/columns exist, so a feature added by a migration can stay hidden
 * (instead of failing) on a database where that migration hasn't been run yet.
 *
 *   $this->call->library('schema_info');
 *   if ($this->schema_info->has_table('employer_reviews')) …
 *
 * Speed: the whole list of tables and columns is read with ONE information_schema query
 * and kept in runtime/cache/schema.json for 10 minutes. The database is on another
 * server (Aiven), so every query costs a network round trip; asking once per table on
 * every request made pages noticeably slower. A table that is not in the cached list is
 * checked again live, so a migration that just ran is never missed.
 */
class Schema_info
{
    private const TTL = 600;

    /** table => [column, ...] */
    private static ?array $schema = null;

    private static function cache_file(): string
    {
        return ROOT_DIR . 'runtime' . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR . 'schema.json';
    }

    private static function query(?string $table = null): array
    {
        $sql = 'SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()' . ($table ? ' AND TABLE_NAME = ?' : '');
        $out = [];
        try {
            foreach (lava_instance()->db->raw($sql, $table ? [$table] : [])->fetchAll(\PDO::FETCH_ASSOC) ?: [] as $r) {
                $out[strtolower($r['TABLE_NAME'])][] = strtolower($r['COLUMN_NAME']);
            }
        } catch (\Throwable $e) {
            // no database: every optional feature simply stays hidden
        }
        return $out;
    }

    private static function load(): array
    {
        if (self::$schema !== null) return self::$schema;
        $file = self::cache_file();
        if (is_file($file) && time() - (int) @filemtime($file) < self::TTL) {
            $cached = json_decode((string) @file_get_contents($file), true);
            if (is_array($cached) && $cached) return self::$schema = $cached;
        }
        self::$schema = self::query();
        self::save();
        return self::$schema;
    }

    private static function save(): void
    {
        $known = array_filter(self::$schema ?? []);   // only tables that exist; a missing one is asked again next time
        if (!$known) return;
        $file = self::cache_file();
        if (!is_dir(dirname($file))) @mkdir(dirname($file), 0775, true);
        @file_put_contents($file, json_encode($known), LOCK_EX);
    }

    /** Column names of a table ([] when the table doesn't exist). */
    public function columns(string $table): array
    {
        $table = strtolower($table);
        $schema = self::load();
        if (!isset($schema[$table])) {
            // not in the cached list: maybe a migration just created it
            $fresh = self::query($table);
            if (isset($fresh[$table])) {
                self::$schema[$table] = $fresh[$table];
                self::save();
            } else {
                self::$schema[$table] = [];
            }
        }
        return self::$schema[$table];
    }

    public function has_table(string $table): bool
    {
        return $this->columns($table) !== [];
    }

    public function has_column(string $table, string $column): bool
    {
        return in_array(strtolower($column), $this->columns($table), true);
    }
}
