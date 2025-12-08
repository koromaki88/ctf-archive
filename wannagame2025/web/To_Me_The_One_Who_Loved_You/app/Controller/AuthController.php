<?php

declare(strict_types=1);
/**
 * Auth endpoints: register + login.
 */

namespace App\Controller;

use App\Model\User;
use App\Support\AuthToken;
use App\Support\DatabaseInitializer;
use Hyperf\HttpServer\Contract\ResponseInterface;

use function strlen;
use function time;
use function password_hash;
use function password_verify;

class AuthController extends AbstractController
{
    public function register()
    {

        DatabaseInitializer::ensure();

        $username = trim((string) $this->request->input('username', ''));
        $password = (string) $this->request->input('password', '');

        if ($username === '' || strlen($username) > 32) {
            return $this->response->json(['message' => 'Username is required and must be <= 32 chars.'])->withStatus(422);
        }
        if (strlen($password) < 6) {
            return $this->response->json(['message' => 'Password must be at least 6 characters.'])->withStatus(422);
        }

        if (User::query()->where('username', $username)->exists()) {
            return $this->response->json(['message' => 'Username already taken.'])->withStatus(409);
        }

        $user = new User();
        $user->username = $username;
        $user->password = password_hash($password, PASSWORD_BCRYPT);
        $user->created_at = time();
        $user->save();

        $token = AuthToken::issue((int) $user->id, $user->username);

        return $this->response->json(['token' => $token, 'user' => ['id' => $user->id, 'username' => $user->username]]);
    }

    public function login()
    {
        DatabaseInitializer::ensure();

        $username = trim((string) $this->request->input('username', ''));
        $password = (string) $this->request->input('password', '');

        $user = User::query()->where('username', $username)->first();
        if (! $user || ! password_verify($password, $user->password)) {
            return $this->response->json(['message' => 'Invalid credentials.'])->withStatus(401);
        }

        $token = AuthToken::issue((int) $user->id, $user->username);

        return $this->response->json(['token' => $token, 'user' => ['id' => $user->id, 'username' => $user->username]]);
    }
}
