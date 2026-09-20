<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('Register', [
            'secretQuestions' => config('secret_questions.list'),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'timezone' => ['required', 'timezone'],
            'secret_question' => ['required', 'string', Rule::in(config('secret_questions.list'))],
            'secret_answer' => ['required', 'string'],
        ]);

        $user = User::create($validated);

        Auth::login($user);

        return redirect()->route('now');
    }
}
