<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Восстановление пароля без email — три AJAX-шага со страницы /forgot-password
 * (см. README, «Пользователи и аутентификация»): email → секретный вопрос → новый пароль.
 */
class PasswordRecoveryController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('ForgotPassword');
    }

    /**
     * Шаг 1: по email вернуть секретный вопрос пользователя.
     */
    public function question(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            throw ValidationException::withMessages([
                'email' => 'Пользователь с таким email не найден.',
            ]);
        }

        return response()->json([
            'secretQuestion' => $user->secret_question,
        ]);
    }

    /**
     * Шаг 2: проверить ответ на секретный вопрос, отметить в сессии, что можно перейти к шагу 3.
     */
    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'secret_answer' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['secret_answer'], $user->secret_answer)) {
            throw ValidationException::withMessages([
                'secret_answer' => 'Неверный ответ на секретный вопрос.',
            ]);
        }

        $request->session()->put('password_recovery.verified_email', $user->email);

        return response()->json(['verified' => true]);
    }

    /**
     * Шаг 3: задать новый пароль — только если шаг 2 пройден в этой же сессии для того же email.
     */
    public function reset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ]);

        if ($request->session()->get('password_recovery.verified_email') !== $validated['email']) {
            throw ValidationException::withMessages([
                'email' => 'Сначала подтвердите ответ на секретный вопрос.',
            ]);
        }

        User::where('email', $validated['email'])->firstOrFail()
            ->update(['password' => $validated['password']]);

        $request->session()->forget('password_recovery.verified_email');

        return response()->json(['reset' => true]);
    }
}
