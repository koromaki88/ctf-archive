<?php

declare(strict_types=1);
/**
 * Centralized key handling for cryptography.
 */

namespace App\Support;

use RuntimeException;

class KeyManager
{
    public static function get(): string
    {
        $key = getenv('APP_KEY') ?: '';

        if (! is_string($key) || $key === '') {
            throw new RuntimeException('APP_KEY is missing.');
        }

        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);
            if ($decoded === false) {
                throw new RuntimeException('Invalid base64 APP_KEY.');
            }
            $key = $decoded;
        }

        if (strlen($key) !== 32) {
            throw new RuntimeException('APP_KEY must be 32 bytes for cryptography.');
        }

        return $key;
    }
}
