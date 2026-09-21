<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'timezone',
        'secret_question',
        'secret_answer',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'secret_answer',
    ];

    /**
     * Токен «запомнить меня» текущего запроса.
     *
     * Живёт только в памяти и намеренно не является атрибутом модели: колонки remember_token
     * в таблице больше нет, токены лежат в remember_tokens по одному на устройство (см.
     * App\Auth\DeviceRememberUserProvider). Если бы значение хранилось атрибутом, любой
     * последующий $user->save() в этом же запросе пытался бы записать несуществующую колонку.
     *
     * Побочный — и нужный — эффект: у пользователя, загруженного из сессии, значение всегда
     * пусто, поэтому SessionGuard::logout() не станет «прокручивать» токен и не создаст строку,
     * которой не соответствует ни один cookie.
     */
    protected ?string $deviceRememberToken = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'secret_answer' => 'hashed',
        ];
    }

    public function getRememberToken(): ?string
    {
        return $this->deviceRememberToken;
    }

    public function setRememberToken($value): void
    {
        $this->deviceRememberToken = $value === null ? null : (string) $value;
    }

    /**
     * Имени колонки нет — значение не хранится в таблице users. Ни один вызывающий во
     * фреймворке не обращается к нему в обход getRememberToken()/setRememberToken() выше,
     * а провайдер, который обращался бы (EloquentUserProvider), у нас подменён.
     */
    public function getRememberTokenName(): ?string
    {
        return null;
    }

    public function days(): HasMany
    {
        return $this->hasMany(Day::class);
    }

    public function rememberTokens(): HasMany
    {
        return $this->hasMany(RememberToken::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }
}