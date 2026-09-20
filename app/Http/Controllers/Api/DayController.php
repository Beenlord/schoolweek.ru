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
        ]);
    }
}
