<?php

use App\Http\Controllers\Api\DayController;
use App\Http\Controllers\Auth\PasswordRecoveryController;

// Восстановление пароля — пошаговые AJAX-вызовы со страницы /forgot-password (email → секретный вопрос →
// новый пароль), без авторизации.
Route::post('/password/question', [PasswordRecoveryController::class, 'question'])->name('api.password.question');
Route::post('/password/verify', [PasswordRecoveryController::class, 'verify'])->name('api.password.verify');
Route::post('/password/reset', [PasswordRecoveryController::class, 'reset'])->name('api.password.reset');

// Данные дневника — AJAX поверх сессии внутри уже авторизованного приложения (см. README, «Пользователи и
// аутентификация»), не самостоятельный публичный API.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/weeks/{date}', [DayController::class, 'week'])->name('api.weeks.show');
    Route::get('/days/{date}', [DayController::class, 'show'])->name('api.days.show');
    Route::put('/days/{date}', [DayController::class, 'update'])->name('api.days.update');
});