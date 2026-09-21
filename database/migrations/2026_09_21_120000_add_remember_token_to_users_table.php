<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Колонки не было с самого начала, а вход всегда просит «запомнить» (см.
     * AuthenticatedSessionController), поэтому Laravel падал на записи токена:
     * SQLSTATE[42S22] Unknown column 'remember_token'.
     *
     * Отдельной миграцией, а не правкой create_users_table: база уже создана и та миграция
     * на ней больше не выполнится.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->rememberToken()->after('secret_answer');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('remember_token');
        });
    }
};
