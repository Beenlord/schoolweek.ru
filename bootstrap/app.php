<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: routes_path('web.php'),
        api: routes_path('api.php'),
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);

        $middleware->alias([
        ]);
    })
    ->withCommands([
    ])
    ->withExceptions(function (Exceptions $exceptions) {
    })
    ->create();
