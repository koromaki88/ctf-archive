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

namespace App\Controller;

use Hyperf\HttpMessage\Server\Response;
use HyperfExt\Encryption\Driver\AesDriver;
use Throwable;

class CryptoController extends AbstractController
{
    public function encrypt()
    {
        $plaintext = (string) $this->request->input('text', '');
        $driver = $this->driverFromRequest();
        if ($driver instanceof Response) {
            return $driver;
        }

        if ($plaintext === '') {
            return $this->response->json(['message' => 'Plaintext is required.'])->withStatus(422);
        }

        try {
            $ciphertext = $driver->encrypt($plaintext);
        } catch (Throwable $e) {
            return $this->response->json(['message' => 'Something went wrong'])->withStatus(500);
        }

        return ['ciphertext' => $ciphertext];
    }

    public function decrypt()
    {
        $ciphertext = (string) $this->request->input('ciphertext', $this->request->input('text', ''));
        $driver = $this->driverFromRequest();
        if ($driver instanceof Response) {
            return $driver;
        }

        if ($ciphertext === '') {
            return $this->response->json(['message' => 'Ciphertext is required.'])->withStatus(422);
        }

        try {
            $plaintext = $driver->decrypt($ciphertext);
        } catch (Throwable $e) {
            return $this->response->json(['message' => $e->getMessage()])->withStatus(500);
        }

        return ['plaintext' => $plaintext];
    }

    private function driverFromRequest(): AesDriver|Response
    {
        $keyInput = (string) $this->request->input('key', '');
        if ($keyInput === '') {
            return $this->response->json(['message' => 'Key is required.'])->withStatus(422);
        }

        $rawKey = $this->normalizeKey($keyInput);
        if ($rawKey === null) {
            return $this->response->json(['message' => 'Key must be 16 or 32 bytes (plain or base64:...).'])->withStatus(422);
        }

        $cipher = strlen($rawKey) === 32 ? 'AES-256-CBC' : 'AES-128-CBC';

        return new AesDriver([
            'key' => base64_encode($rawKey),
            'cipher' => $cipher,
        ]);
    }

    private function normalizeKey(string $input): ?string
    {
        if (str_starts_with($input, 'base64:')) {
            $decoded = base64_decode(substr($input, 7), true);
            return $decoded !== false ? $decoded : null;
        }

        $len = strlen($input);
        if ($len === 16 || $len === 32) {
            return $input;
        }

        $decoded = base64_decode($input, true);
        if ($decoded !== false && (strlen($decoded) === 16 || strlen($decoded) === 32)) {
            return $decoded;
        }

        return null;
    }
}
