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

class IndexController extends AbstractController
{
    public function index()
    {
        $uri = $this->request->getUri()->getPath();
        $map = [
            '/' => 'login.html',
            '/login' => 'login.html',
            '/register' => 'register.html',
            '/dashboard' => 'dashboard.html',
        ];
        if (isset($map[$uri])) {
            return $this->sendFile($map[$uri], 'text/html; charset=utf-8');
        }

        if ($uri === '/style.css') {
            return $this->sendFile('style.css', 'text/css; charset=utf-8');
        }
        if ($uri === '/app.js') {
            return $this->sendFile('app.js', 'application/javascript; charset=utf-8');
        }

        return $this->response->withStatus(404)->raw('Not found');
    }

    private function sendFile(string $relative, string $contentType)
    {
        $path = BASE_PATH . '/public/' . $relative;
        if (! file_exists($path)) {
            return $this->response->withStatus(404)->raw('Not found');
        }

        return $this->response
            ->raw(file_get_contents($path))
            ->withHeader('Content-Type', $contentType);
    }
}
