<?php

namespace App\Providers;

use App\Auth\DeviceRememberUserProvider;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
    }

    public function boot(): void
    {
        // Драйвер провайдера пользователей из config/auth.php. Отличается от стокового eloquent
        // только хранением токена «запомнить меня»: строка на устройство в remember_tokens
        // вместо одной колонки users.remember_token — см. DeviceRememberUserProvider.
        Auth::provider('eloquent-devices', function ($app, array $config) {
            return new DeviceRememberUserProvider($app['hash'], $config['model']);
        });

        // Подстраховка поверх trustProxies (bootstrap/app.php): если APP_URL явно
        // задан по https, ссылки (asset()/@vite и т.д.) всегда генерируются как https,
        // даже если заголовок X-Forwarded-Proto от прокси по какой-то причине не дошёл.
        if (str_starts_with(config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }
    }
}