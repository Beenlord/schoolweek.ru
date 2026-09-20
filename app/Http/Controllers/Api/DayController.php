<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Day;
use App\Support\WeekCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * AJAX поверх сессии для уже авторизованного Inertia-приложения (см. README) — не отдельный
 * публичный API.
 */
class DayController extends Controller
{
    public function __construct(private readonly WeekCalculator $weeks)
    {
    }

    /**
     * Все дни недели, содержащей $date, включая ещё не созданные — как пустые заготовки.
     */
    public function week(Request $request, string $date): JsonResponse
    {
        $weekStart = $this->weeks->weekStart(CarbonImmutable::parse($date));
        $dates = $this->weeks->weekDates($weekStart);

        $existing = $request->user()->days()
            ->whereBetween('date', [$dates->first()->toDateString(), $dates->last()->toDateString()])
            ->get()
            ->keyBy(fn (Day $day) => $day->date->toDateString());

        $days = $dates->map(fn (CarbonImmutable $d) => [
            'date' => $d->toDateString(),
            'content' => $existing->get($d->toDateString())?->content,
        ])->all();

        return response()->json([
            'weekStart' => $weekStart->toDateString(),
            'days' => $days,
        ]);
    }

    public function show(Request $request, string $date): JsonResponse
    {
        $day = $request->user()->days()->whereDate('date', $date)->first();

        return response()->json([
            'date' => $date,
            'content' => $day?->content,
        ]);
    }

    public function update(Request $request, string $date): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['nullable', 'string'],
        ]);

        $day = $request->user()->days()->updateOrCreate(
            ['date' => $date],
            ['content' => $validated['content'] ?? null],
        );

        return response()->json([
            'date' => $day->date->toDateString(),
            'content' => $day->content,
            'updatedAt' => $day->updated_at->toIso8601String(),
        ]);
    }

    /**
     * Дни, изменённые после $since (или все дни, если $since не передан) — для подтягивания на
     * клиент правок, сделанных с других устройств/вкладок, пока офлайн-клиент был не в сети.
     */
    public function sync(Request $request): JsonResponse
    {
        $since = $request->query('since') ? CarbonImmutable::parse($request->query('since')) : null;

        $query = $request->user()->days();

        if ($since) {
            $query->where('updated_at', '>', $since);
        }

        $days = $query->get()->map(fn (Day $day) => [
            'date' => $day->date->toDateString(),
            'content' => $day->content,
            'updatedAt' => $day->updated_at->toIso8601String(),
        ])->all();

        return response()->json([
            // Клиент сохраняет это как курсор для следующего sync?since= — не берём время с его часов,
            // чтобы рассинхронизация локальных часов устройства не ломала инкрементальную синхронизацию.
            'serverTime' => CarbonImmutable::now()->toIso8601String(),
            'days' => $days,
        ]);
    }

    /**
     * Приём пакета офлайн-правок сразу по нескольким дням. Конфликт (день параллельно менялся не
     * с этого устройства) разрешается по принципу «последняя правка побеждает»: сравниваем не
     * серверное время получения запроса, а заявленное клиентом время правки — иначе правка,
     * которая просто долго добиралась до сервера из офлайна, могла бы неправомерно перезаписать
     * более свежую правку с другого устройства.
     */
    public function batch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days' => ['required', 'array'],
            'days.*.date' => ['required', 'date_format:Y-m-d'],
            'days.*.content' => ['nullable', 'string'],
            'days.*.updatedAt' => ['required', 'date'],
        ]);

        $applied = [];
        $skipped = [];

        foreach ($validated['days'] as $entry) {
            $clientUpdatedAt = CarbonImmutable::parse($entry['updatedAt']);

            /** @var Day $day */
            $day = $request->user()->days()->firstOrNew(['date' => $entry['date']]);

            if ($day->exists && $day->updated_at?->greaterThan($clientUpdatedAt)) {
                // Сервер побеждает — сразу отдаём клиенту актуальные данные, чтобы он мог заменить
                // ими свою (проигравшую) офлайн-правку, а не держать её вечно помеченной dirty.
                $skipped[] = [
                    'date' => $day->date->toDateString(),
                    'content' => $day->content,
                    'updatedAt' => $day->updated_at->toIso8601String(),
                ];
                continue;
            }

            $day->content = $entry['content'] ?? null;
            $day->created_at ??= $clientUpdatedAt;
            // Отключаем автообновление updated_at текущим временем: значение должно остаться
            // временем самой правки, а не временем синхронизации — иначе следующее сравнение
            // last-write-wins будет сверяться не с тем моментом.
            $day->timestamps = false;
            $day->updated_at = $clientUpdatedAt;
            $day->save();

            $applied[] = [
                'date' => $day->date->toDateString(),
                'updatedAt' => $day->updated_at->toIso8601String(),
            ];
        }

        return response()->json([
            'applied' => $applied,
            'skipped' => $skipped,
        ]);
    }
}
