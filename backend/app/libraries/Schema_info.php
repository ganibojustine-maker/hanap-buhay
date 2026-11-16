<?php
defined('PREVENT_DIRECT_ACCESS') OR exit('No direct script access allowed');

/**
 * Which optional tables/columns exist, so a feature added by a migration can stay hidden
 * (instead of failing) on a database where that migration hasn't been run yet.
 * One information_schema query per table per request.
 *
 *   $this->call->library('schema_info');
 *   if ($this->schema_info->has_table('employer_reviews')) …
 */
class Schema_info
{
    private static array $columns = [];

    /** Column names of a table ([] when the table doesn't exist). */
    public function columns(string $table): array
    {
        if (!isset(self::$columns[$table])) {
            try {
                $rows = lava_instance()->db->raw(
                    'SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
                    [$table]
                )->fetchAll(\PDO::FETCH_COLUMN);
                self::$columns[$table] = array_map('strtolower', $rows ?: []);
            } catch (\Throwable $e) {
                self::$columns[$table] = [];
            }
        }
        return self::$columns[$table];
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
