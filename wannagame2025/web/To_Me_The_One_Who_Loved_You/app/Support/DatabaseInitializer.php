<?php

declare(strict_types=1);
/**
 * Minimal schema bootstrapper to keep the CTF image self-contained.
 */

namespace App\Support;

use Hyperf\Database\Schema\Blueprint;
use Hyperf\Database\Schema\Schema;

use function Hyperf\Support\env;
use function mkdir;
use function dirname;
use function file_exists;

class DatabaseInitializer
{
    private static bool $booted = false;

    public static function ensure(): void
    {
        if (static::$booted) {
            return;
        }

        static::prepareSqliteFile();

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->increments('id');
                $table->string('username')->unique();
                $table->string('password');
                $table->unsignedBigInteger('created_at');
            });
        }

        if (! Schema::hasTable('messages')) {
            Schema::create('messages', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('sender_id');
                $table->string('recipient');
                $table->text('body');
                $table->boolean('encrypted')->default(false);
                $table->unsignedBigInteger('created_at');
                $table->index('recipient');
            });
        }

        static::$booted = true;
    }

    private static function prepareSqliteFile(): void
    {
        $driver = env('DB_DRIVER', 'mysql');
        if ($driver !== 'sqlite') {
            return;
        }

        $path = env('DB_DATABASE', BASE_PATH . '/runtime/database.sqlite');
        $dir = dirname($path);
        if (! file_exists($dir)) {
            mkdir($dir, 0777, true);
        }
        if (! file_exists($path)) {
            touch($path);
        }
    }
}
