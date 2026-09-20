<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
    }

    public function boot(): void
    {
        // Подстраховка поверх trustProxies (bootstrap/app.php): если APP_URL явно
        // задан по https, ссылки (asset()/@vite и т.д.) всегда генерируются как https,
        // даже если заголовок X-Forwarded-Proto от прокси по какой-то причине не дошёл.
        if (str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}