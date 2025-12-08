<?php

declare(strict_types=1);
/**
 * Very small stateless token helper (HMAC signed, no server storage).
 */

namespace App\Support;

use RuntimeException;

use function base64_decode;
use function base64_encode;
use function hash_equals;
use function hash_hmac;
use function json_decode;
use function json_encode;
use function time;

class AuthToken
{
    public static function issue(int $userId, string $username, int $ttlSeconds = 86400): string
    {
        $payload = [
            'uid' => $userId,
            'u' => $username,
            'exp' => time() + $ttlSeconds,
        ];

        $data = base64_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $sig = hash_hmac('sha256', $data, KeyManager::get());

        return $data . '.' . $sig;
    }

    public static function parse(?string $token): ?array
    {
        if (! is_string($token) || $token === '') {
            return null;
        }

        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) {
            return null;
        }

        [$data, $sig] = $parts;
        $expected = hash_hmac('sha256', $data, KeyManager::get());

        if (! hash_equals($expected, $sig)) {
            return null;
        }

        $payload = json_decode(base64_decode($data, true) ?: '', true);
        if (! is_array($payload) || ($payload['exp'] ?? 0) < time()) {
            return null;
        }

        return [
            'id' => (int) ($payload['uid'] ?? 0),
            'username' => (string) ($payload['u'] ?? ''),
        ];
    }
}
