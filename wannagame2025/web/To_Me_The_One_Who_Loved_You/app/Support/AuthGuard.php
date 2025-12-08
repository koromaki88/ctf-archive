<?php

declare(strict_types=1);

namespace App\Support;

use App\Model\User;
use Hyperf\HttpServer\Contract\RequestInterface;

class AuthGuard
{
    public static function user(RequestInterface $request): ?User
    {
        $token = static::extractToken($request);
        $data = AuthToken::parse($token);
        if (! $data || ! $data['id']) {
            return null;
        }

        return User::query()->find($data['id']);
    }

    private static function extractToken(RequestInterface $request): ?string
    {
        $header = $request->header('authorization', '');
        if (preg_match('/Bearer\\s+(.*)/i', $header, $m)) {
            return trim($m[1]);
        }

        return $request->input('token');
    }
}
