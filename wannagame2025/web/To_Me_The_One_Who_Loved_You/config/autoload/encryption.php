<?php

declare(strict_types=1);
/**
 * This file is part of Hyperf.
 *
 * @link     https://www.hyperf.io
 * @document https://hyperf.wiki
 * @contact  group@hyperf.io
 * @license  https://github.com/hyperf/hyperf/blob/master/LICENSE
 */

use function Hyperf\Support\env;

// HyperfExt/encryption expects a base64-encoded key; fall back to APP_KEY if AES_KEY is not set.
$aesKey = env('AES_KEY');
if (! $aesKey) {
    $appKey = (string) env('APP_KEY', '');
    $rawKey = str_starts_with($appKey, 'base64:') ? base64_decode(substr($appKey, 7), true) : $appKey;
    $aesKey = $rawKey ? base64_encode($rawKey) : '';
}

return [
    'default' => 'aes',
    'driver' => [
        'aes' => [
            'class' => \HyperfExt\Encryption\Driver\AesDriver::class,
            'options' => [
                'key' => $aesKey,
                'cipher' => env('AES_CIPHER', 'AES-256-CBC'),
            ],
        ],
    ],
];
