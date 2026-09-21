<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Штатный remember_token — один на пользователя, поэтому выход на любом устройстве
     * перевыпускал его и разлогинивал все остальные. Токен становится записью на устройство:
     * одна строка — один вход, гасится по отдельности.
     */
    public function up(): void
    {
        Schema::create('remember_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // Хранится sha256 от токена, а не он сам: утечка дампа базы не должна отдавать
            // готовые пропуска в аккаунты. Токен длинный и случайный (60 символов от
            // SessionGuard), так что медленный хеш здесь не нужен — перебирать нечего.
            $table->string('token', 64)->unique();
            // Для будущего экрана «мои устройства» — чтобы список был опознаваемым.
            $table->string('user_agent')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        // Колонка из предыдущей миграции больше не нужна: значение теперь живёт только
        // в памяти на время запроса (см. App\Models\User::setRememberToken). hasColumn —
        // на случай, если та миграция на этой базе ещё не выполнялась.
        if (Schema::hasColumn('users', 'remember_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('remember_token');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->rememberToken()->after('secret_answer');
        });

        Schema::dropIfExists('remember_tokens');
    }
};
