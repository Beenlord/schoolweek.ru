<?php

namespace App\Http\Controllers;

use App\Models\Day;
use App\Support\WeekCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NowController extends Controller
{
    public function __construct(private readonly WeekCalculator $weeks)
    {
    }

    public function index(Request $request): Response
    {
        $user = $request->user();

        $date = $request->query('date')
            ? CarbonImmutable::parse($request->query('date'), $user->timezone)
            : CarbonImmutable::now($user->timezone);

        $info = $this->weeks->weekInfo($date);
        $dates = $this->weeks->weekDates($info['weekStart']);
        $today = CarbonImmutable::now($user->timezone)->toDateString();

        $existing = $user->days()
            ->whereBetween('date', [$dates->first()->toDateString(), $dates->last()->toDateString()])
            ->get()
            ->keyBy(fn (Day $day) => $day->date->toDateString());

        $days = $dates->map(fn (CarbonImmutable $d) => [
            'date' => $d->toDateString(),
            'weekday' => $d->dayOfWeekIso, // 1 = Пн ... 7 = Вс
            'content' => $existing->get($d->toDateString())?->content,
            'isToday' => $d->toDateString() === $today,
        ])->all();

        return Inertia::render('Now', [
            'year' => $info['year'],
            'month' => $info['month'],
            'week' => $info['week'],
            'weekStart' => $info['weekStart']->toDateString(),
            'days' => $days,
        ]);
    }
}
