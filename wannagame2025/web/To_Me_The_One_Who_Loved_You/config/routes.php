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
use Hyperf\HttpServer\Router\Router;

Router::addRoute(['GET', 'POST', 'HEAD'], '/', 'App\Controller\IndexController@index');
Router::addRoute(['GET', 'HEAD'], '/login', 'App\Controller\IndexController@index');
Router::addRoute(['GET', 'HEAD'], '/register', 'App\Controller\IndexController@index');
Router::addRoute(['GET', 'HEAD'], '/dashboard', 'App\Controller\IndexController@index');
Router::addRoute(['GET', 'HEAD'], '/app.js', 'App\Controller\IndexController@index');
Router::addRoute(['GET', 'HEAD'], '/style.css', 'App\Controller\IndexController@index');
Router::post('/api/encrypt', 'App\Controller\CryptoController@encrypt');
Router::post('/api/decrypt', 'App\Controller\CryptoController@decrypt');
Router::post('/api/register', 'App\Controller\AuthController@register');
Router::post('/api/login', 'App\Controller\AuthController@login');
Router::get('/api/messages', 'App\Controller\MessageController@index');
Router::get('/api/messages/received', 'App\Controller\MessageController@received');
Router::get('/api/messages/sent', 'App\Controller\MessageController@sent');
Router::post('/api/messages', 'App\Controller\MessageController@store');

Router::get('/favicon.ico', function () {
    return '';
});
