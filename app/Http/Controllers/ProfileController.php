<?php

namespace App\Http\Controllers;

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

        if (!empty($validated['password'])) {
            $user->password = $validated['password'];
        }

        $user->save();

        return back();
    }
}
