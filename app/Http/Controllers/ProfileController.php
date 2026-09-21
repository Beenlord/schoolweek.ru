<?php

namespace App\Http\Controllers;

use App\Auth\DeviceTokens;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        return Inertia::render('Me', [
            'user' => $request->user()->only(['name', 'email', 'timezone', 'secret_question']),
            'secretQuestions' => config('secret_questions.list'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'timezone' => ['required', 'timezone'],
            'secret_question' => ['required', 'string', Rule::in(config('secret_questions.list'))],
            'secret_answer' => ['nullable', 'string'],
            'current_password' => ['nullable', 'required_with:password', 'current_password'],
            'password' => ['nullable', 'confirmed', 'min:8'],
        ]);

        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'timezone' => $validated['timezone'],
            'secret_question' => $validated['secret_question'],
        ]);

        if (!empty($validated['secret_answer'])) {
            $user->secret_answer = $validated['secret_answer'];
        }

        $passwordChanged = !empty($validated['password']);

        if ($passwordChanged) {
            $user->password = $validated['password'];
        }

        $user->save();

        // Смена пароля должна прекращать чужие «запомненные» входы — иначе пароль, сменённый
        // именно потому, что его могли узнать, ничего не меняет: старый cookie продолжал бы
        // пускать в аккаунт. Текущее устройство не трогаем, выбрасывать самого себя сразу после
        // смены пароля незачем.
        if ($passwordChanged) {
            DeviceTokens::revokeOthers($user, $request);
        }

        return back();
    }
}
