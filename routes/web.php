<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\PasswordRecoveryController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\NowController;
use App\Http\Controllers\ProfileController;

Route::get('/', HomeController::class)->name('home');

// Service worker собирается в public/build/sw.js, но отдавать его нужно из корня: скоуп SW не
// может быть шире каталога, из которого он отдан, а контролировать ему нужно /now (см. buildBase
// и scope в vite.config.js). Файл появляется после `npm run build`.
Route::get('/sw.js', function () {
    abort_unless(is_file(public_path('build/sw.js')), 404);

    return response()->file(public_path('build/sw.js'), [
        'Content-Type' => 'application/javascript',
        'Service-Worker-Allowed' => '/',
    ]);
})->name('sw');

Route::middleware('guest')->group(function () {
    Route::get('/register', [RegisteredUserController::class, 'create'])->name('register');
    Route::post('/register', [RegisteredUserController::class, 'store']);

    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store']);

    Route::get('/forgot-password', [PasswordRecoveryController::class, 'create'])->name('password.request');
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::get('/now', [NowController::class, 'index'])->name('now');

    Route::get('/me', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/me', [ProfileController::class, 'update'])->name('profile.update');
});