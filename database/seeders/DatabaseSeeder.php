<?php

namespace Database\Seeders;

use App\Models\Day;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $user = User::updateOrCreate(
            ['email' => 'test@schoolweek.ru'],
            [
                'name' => 'Тест Тестов',
                'password' => 'password',
                'timezone' => 'Europe/Moscow',
                'secret_question' => 'Любимое домашнее животное?',
                'secret_answer' => 'собака',
            ],
        );

        $sampleContent = [
            "## Дела\n\n- Позвонить маме\n- Купить продукты",
            "## Работа\n\n- Встреча в 10:00\n- Отправить отчёт\n\n**Важно:** не забыть черновик",
            "## Учёба\n\n- Дочитать главу 5\n- Сделать домашку",
            "## Сегодня\n\n- Тренировка\n- Забрать посылку\n- Погулять с собакой",
            "## Планы\n\n- Приготовить ужин\n- Посмотреть фильм",
            "## Дела\n\n- Убраться в комнате\n- Полить цветы",
            "## Отдых\n\n- Съездить за город\n- Почитать книгу",
        ];

        for ($offset = -3; $offset <= 3; $offset++) {
            $date = now($user->timezone)->addDays($offset)->toDateString();

            Day::updateOrCreate(
                ['user_id' => $user->id, 'date' => $date],
                ['content' => $sampleContent[$offset + 3]],
            );
        }
    }
}
