<?php

namespace App\Models;

use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Токен «запомнить меня» — по одной записи на устройство (см. миграцию
 * move_remember_tokens_to_own_table). Штатный users.remember_token один на пользователя, из-за
 * чего выход на телефоне выбрасывал и компьютер; здесь каждая запись гасится отдельно.
 *
 * Выпуск и проверку дёргает App\Auth\DeviceRememberUserProvider — сам SessionGuard про эту
 * таблицу не знает и продолжает работать со своим обычным recaller-cookie.
 */
class RememberToken extends Model
{
    /**
     * Сколько живёт запись без использования. Срок скользящий: каждое успешное восстановление
     * сессии отодвигает его (см. touchUsage), поэтому устройство, которым пользуются, не
     * разлогинится никогда, а забытое — само отвалится через год.
     */
    public const LIFETIME_DAYS = 365;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'token',
        'user_agent',
        'last_used_at',
        'expires_at',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * В базе лежит хеш, а не токен. Сравнение идёт хеш-с-хешем обычным WHERE — это не уязвимо
     * к атаке по времени в практическом смысле: подбирать нечего, токен случайный и длинный,
     * а сам хеш секретом не является.
     */
    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Новая запись под очередной вход. Заодно подчищает протухшие записи этого пользователя —
     * заводить отдельную задачу по расписанию ради одной таблицы избыточно, а вход и так
     * происходит редко и является естественным моментом для уборки.
     */
    public static function issue(Authenticatable $user, string $token, ?string $userAgent = null): self
    {
        static::query()
            ->where('user_id', $user->getAuthIdentifier())
            ->where('expires_at', '<=', Carbon::now())
            ->delete();

        return static::query()->create([
            'user_id' => $user->getAuthIdentifier(),
            'token' => static::hashToken($token),
            'user_agent' => $userAgent === null ? null : Str::limit($userAgent, 255, ''),
            'last_used_at' => Carbon::now(),
            'expires_at' => Carbon::now()->addDays(static::LIFETIME_DAYS),
        ]);
    }

    public static function findValid(Authenticatable $user, string $token): ?self
    {
        return static::query()
            ->where('user_id', $user->getAuthIdentifier())
            ->where('token', static::hashToken($token))
            ->where('expires_at', '>', Carbon::now())
            ->first();
    }

    /** Продлевает срок жизни записи — устройство только что использовали. */
    public function touchUsage(): void
    {
        $this->forceFill([
            'last_used_at' => Carbon::now(),
            'expires_at' => Carbon::now()->addDays(static::LIFETIME_DAYS),
        ])->save();
    }
}
