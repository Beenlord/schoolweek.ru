<?php

use App\Http\Controllers\Api\DayController;
use App\Http\Controllers\Api\EventController;
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

    // Офлайн-синхронизация (см. README, «Offline и PWA»): sync — подтянуть чужие правки, batch —
    // отправить накопленные локально. Должны идти раньше /days/{date} — иначе wildcard-роут
    // перехватит /days/sync, приняв «sync» за значение {date}.
    Route::get('/days/sync', [DayController::class, 'sync'])->name('api.days.sync');
    Route::post('/days/batch', [DayController::class, 'batch'])->name('api.days.batch');

    Route::get('/days/{date}', [DayController::class, 'show'])->name('api.days.show');
    Route::put('/days/{date}', [DayController::class, 'update'])->name('api.days.update');

    // События дня. Эндпоинта «события на неделю» нет намеренно: сервер хранит правила, а раскрывает
    // их в конкретные дни клиент (см. EventController). sync — раньше wildcard-роутов, иначе
    // {event} перехватил бы «sync».
    Route::get('/events/sync', [EventController::class, 'sync'])->name('api.events.sync');
    Route::post('/events', [EventController::class, 'store'])->name('api.events.store');
    Route::put('/events/{event}', [EventController::class, 'update'])->name('api.events.update');
    Route::delete('/events/{event}', [EventController::class, 'destroy'])->name('api.events.destroy');
});