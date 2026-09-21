<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Событие дня — пометка рядом с текстом дня (см. README, «События»).
 *
 * Хранит правило, а не занятия. Раскрытие правила в конкретные даты живёт на клиенте
 * (resources/js/events.js): сервер не знает и не должен знать, на какие дни оно попадает.
 *
 * Имя совпадает с фасадом Illuminate\Support\Facades\Event. Конфликт возникает только там, где оба
 * импортируются в один файл, — в таком случае импортируется фасад под псевдонимом, а не эта модель:
 * «Event» в приложении про дневник значит именно событие календаря.
 */
class Event extends Model
{
    use SoftDeletes;

    public const FREQUENCIES = ['once', 'daily', 'weekly', 'monthly', 'yearly'];

    /**
     * Ключи палитры. Произвольный цвет пользователь не выбирает: на тёплом бумажном фоне случайный
     * hex легко оказывается нечитаемым, а полоска события должна оставаться разборчивой. Сами
     * цвета — в дизайн-токенах, см. resources/css/app.css.
     */
    public const COLORS = ['lemon', 'mint', 'sky', 'rose', 'lilac', 'sand'];

    /** За сколько минут предупредить. Значения совпадают с вариантами в форме. */
    public const REMIND_OFFSETS = [0, 15, 60, 1440];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'title',
        'color',
        'starts_on',
        'time',
        'frequency',
        'repeat_on',
        'ends_on',
        'remind',
        'remind_minutes_before',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'repeat_on' => 'array',
            'remind' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Представление для клиента. Даты — строками 'YYYY-MM-DD', время — 'HH:MM': клиент работает с
     * ними через dayjs, и о часовых поясах на этом уровне думать не должен.
     *
     * @return array<string, mixed>
     */
    public function toClientArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'color' => $this->color,
            'startsOn' => $this->starts_on->toDateString(),
            // В базе time хранится как HH:MM:SS, клиенту секунды не нужны — он их и не показывает,
            // и не отправляет обратно.
            'time' => $this->time ? substr($this->time, 0, 5) : null,
            'frequency' => $this->frequency,
            'repeatOn' => $this->repeat_on,
            'endsOn' => $this->ends_on?->toDateString(),
            'remind' => $this->remind,
            'remindMinutesBefore' => $this->remind_minutes_before,
            'updatedAt' => $this->updated_at->toIso8601String(),
            // Клиент по этому признаку вычищает событие у себя (см. EventController::sync).
            'deleted' => $this->trashed(),
        ];
    }
}
