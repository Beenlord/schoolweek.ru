<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Границы недели и её номер внутри месяца по правилу ТЗ: неделя целиком принадлежит
 * тому месяцу, в котором лежит большинство её дней — а не ISO-номеру недели года.
 */
class WeekCalculator
{
    public function weekStart(CarbonImmutable $date): CarbonImmutable
    {
        return $date->startOfWeek(CarbonInterface::MONDAY);
    }

    /**
     * @return Collection<int, CarbonImmutable> семь дат недели, Пн..Вс.
     */
    public function weekDates(CarbonImmutable $weekStart): Collection
    {
        return collect(range(0, 6))->map(fn (int $i) => $weekStart->addDays($i));
    }

    /**
     * @return array{year: int, month: int, week: int, weekStart: CarbonImmutable}
     */
    public function weekInfo(CarbonImmutable $date): array
    {
        $weekStart = $this->weekStart($date);
        [$owningYear, $owningMonth] = $this->owningMonth($weekStart);

        // Первая неделя месяца по тому же правилу большинства не обязательно начинается
        // 1-го числа, поэтому ищем её, а не считаем от начала месяца напрямую.
        $cursor = CarbonImmutable::create($owningYear, $owningMonth, 1)->startOfWeek(CarbonInterface::MONDAY);
        while ($this->owningMonth($cursor) !== [$owningYear, $owningMonth]) {
            $cursor = $cursor->addWeek();
        }

        $week = 1;
        while (!$cursor->isSameDay($weekStart)) {
            $cursor = $cursor->addWeek();
            $week++;
        }

        return [
            'year' => $owningYear,
            'month' => $owningMonth,
            'week' => $week,
            'weekStart' => $weekStart,
        ];
    }

    /**
     * @return array{0: int, 1: int} год и месяц, в котором лежит большинство дней недели.
     */
    private function owningMonth(CarbonImmutable $weekStart): array
    {
        $counts = $this->weekDates($weekStart)
            ->groupBy(fn (CarbonImmutable $d) => $d->format('Y-m'))
            ->map->count()
            ->sortDesc();

        [$year, $month] = explode('-', $counts->keys()->first());

        return [(int) $year, (int) $month];
    }
}
