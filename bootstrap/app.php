<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: __DIR__)
    ->withRouting(
        api: routes_path('api.php'),
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [
        ]);

        $middleware->alias([
        ]);
    })
    ->withCommands([
    ])
    ->withExceptions(function (Exceptions $exceptions) {
    })
    ->create();
