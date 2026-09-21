<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * События дня. AJAX поверх сессии для самого приложения, как и остальной routes/api.php.
 *
 * Сервер здесь только хранилище правил: на какие дни попадает «каждый вторник» — считает клиент
 * (resources/js/events.js). Поэтому эндпоинта «события на такую-то неделю» нет и не нужно.
 */
class EventController extends Controller
{
    /**
     * Правила, изменённые после $since, включая удалённые — по ним клиент вычищает своё локальное
     * зеркало. Без этого удалённое на одном устройстве событие жило бы на втором вечно.
     */
    public function sync(Request $request): JsonResponse
    {
        $since = $request->query('since') ? CarbonImmutable::parse($request->query('since')) : null;

        $query = $request->user()->events()->withTrashed();

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        return response()->json([
            // Как и в синхронизации дней — курсор с часов сервера, а не клиента, чтобы
            // расхождение часов устройства не ломало инкрементальную выборку.
            'serverTime' => CarbonImmutable::now()->toIso8601String(),
            'events' => $query->get()->map->toClientArray()->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $event = $request->user()->events()->create($this->normalized($request));

        return response()->json($event->toClientArray(), 201);
    }

    public function update(Request $request, Event $event): JsonResponse
    {
        $this->authorizeOwnership($request, $event);

        $event->update($this->normalized($request));

        return response()->json($event->toClientArray());
    }

    public function destroy(Request $request, Event $event): JsonResponse
    {
        $this->authorizeOwnership($request, $event);

        // Мягкое удаление: строка остаётся, чтобы следующая синхронизация донесла факт удаления
        // до остальных устройств.
        $event->delete();

        return response()->json($event->fresh()->toClientArray());
    }

    /**
     * Разбор и приведение к согласованному виду.
     *
     * Лишние поля здесь обнуляются, а не сохраняются «на всякий случай»: разовое событие с датой
     * окончания или недельное с числами месяца — это мусор, который потом будет сбивать с толку и
     * при отладке, и при раскрытии правила на клиенте.
     *
     * @return array<string, mixed>
     */
    private function normalized(Request $request): array
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'color' => ['required', Rule::in(Event::COLORS)],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'time' => ['nullable', 'date_format:H:i'],
            'frequency' => ['required', Rule::in(Event::FREQUENCIES)],

            // Набор дней обязателен ровно для двух частот и запрещён для остальных.
            'repeat_on' => [
                Rule::requiredIf(fn () => in_array($request->input('frequency'), ['weekly', 'monthly'], true)),
                'array',
                'min:1',
            ],
            'repeat_on.*' => [
                'integer',
                // Дни недели 1–7 против чисел месяца 1–31 — верхняя граница зависит от частоты.
                'min:1',
                $request->input('frequency') === 'weekly' ? 'max:7' : 'max:31',
            ],

            'ends_on' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:starts_on'],

            'remind' => ['required', 'boolean'],
            'remind_minutes_before' => ['nullable', Rule::in(Event::REMIND_OFFSETS)],
        ]);

        $repeats = $data['frequency'] !== 'once';

        return [
            'title' => $data['title'],
            'color' => $data['color'],
            'starts_on' => $data['starts_on'],
            'time' => $data['time'] ?? null,
            'frequency' => $data['frequency'],
            'repeat_on' => in_array($data['frequency'], ['weekly', 'monthly'], true)
                // Дубли и порядок значения не имеют: клиент проверяет вхождение в набор.
                ? array_values(array_unique($data['repeat_on']))
                : null,
            'ends_on' => $repeats ? ($data['ends_on'] ?? null) : null,
            'remind' => $data['remind'],
            // «За сколько» есть смысл только у события со временем: событие на весь день напоминает
            // о себе накануне вечером, и смещение к нему неприменимо.
            'remind_minutes_before' => $data['remind'] && !empty($data['time'])
                ? ($data['remind_minutes_before'] ?? 0)
                : null,
        ];
    }

    /**
     * Route model binding находит событие по id без оглядки на владельца, поэтому проверяем сами.
     * 404, а не 403: чужое событие для пользователя попросту не существует, и подтверждать сам
     * факт его наличия незачем.
     */
    private function authorizeOwnership(Request $request, Event $event): void
    {
        abort_unless($event->user_id === $request->user()->id, 404);
    }
}
