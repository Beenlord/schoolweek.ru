<?php

namespace App\Http\Controllers\Auth;

use App\Auth\DeviceTokens;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Login');
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Запоминаем всегда: это личный дневник на своём устройстве, и выбрасывать человека из
        // сессии по таймауту здесь незачем — тем более что приложение ставится как PWA и должно
        // открываться сразу рабочим. Отдельной галочки в интерфейсе поэтому нет.
        if (!Auth::attempt($credentials, true)) {
            throw ValidationException::withMessages([
                'email' => 'Неверный email или пароль.',
            ]);
        }

        $request->session()->regenerate();

        return redirect()->route('now');
    }

    public function destroy(Request $request): RedirectResponse
    {
        // Пользователя и токен этого устройства забираем до logout() — после него $request->user()
        // уже пуст. Сам logout() серверную запись не трогает (см. DeviceRememberUserProvider),
        // он только забывает cookie в этом браузере, поэтому гасим её здесь явно — и только её:
        // на остальных устройствах вход сохраняется.
        $user = $request->user();

        if ($user !== null) {
            DeviceTokens::revokeCurrent($user, $request);
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('home');
    }
}
