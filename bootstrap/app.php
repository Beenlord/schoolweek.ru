<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: routes_path('web.php'),
        api: routes_path('api.php'),
    )
    ->withMiddleware(function (Middleware $middleware) {
        // За приложением на проде стоит nginx (см. /etc/nginx/sites-*/lemon.vfomin.com),
        // который терминирует HTTPS и проксирует на контейнер по обычному HTTP, выставляя
        // X-Forwarded-*. Запрос до контейнера идёт через Docker NAT (port mapping), поэтому
        // реальный IP nginx на месте "доверенного прокси" заранее не известен — доверяем
        // всем источникам (at: '*').
        $middleware->trustProxies(at: '*', headers: Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_HOST
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO);

        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        // Нужно, чтобы auth:sanctum на API-роутах (routes/api.php) работал по сессии для
        // внутренних AJAX-вызовов самого приложения, а не только по bearer-токену (см. README).
        $middleware->api(prepend: [
            \Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class,
        ]);

        $middleware->alias([
        ]);

        // По ТЗ (README, «Страницы»): гостя с /now и /me — на /login, авторизованного
        // с /register, /login, /forgot-password — на /now (иначе гостевой редирект по
        // умолчанию целится в несуществующий route('dashboard') и падает на '/').
        $middleware->redirectGuestsTo('/login');
        $middleware->redirectUsersTo('/now');
    })
    ->withCommands([
    ])
    ->withExceptions(function (Exceptions $exceptions) {
    })
    ->create();
