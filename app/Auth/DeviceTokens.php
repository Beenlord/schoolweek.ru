<?php

namespace App\Auth;

use App\Models\RememberToken;
use Illuminate\Auth\Recaller;
use Illuminate\Auth\SessionGuard;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Погашение токенов «запомнить меня» — то, ради чего они и разнесены по устройствам
 * (см. App\Auth\DeviceRememberUserProvider).
 *
 * Отдельным классом, потому что нужно в трёх местах сразу: выход, смена пароля в профиле и
 * восстановление пароля по секретному вопросу — и в каждом правило своё.
 */
class DeviceTokens
{
    /**
     * Токен, которым представилось текущее устройство. Достаётся из того же recaller-cookie,
     * которым пользуется SessionGuard: cookie есть и после входа по сессии, поэтому определить
     * «это устройство» можно не только в момент восстановления сессии.
     *
     * Вернёт null, если в этом браузере «запомнить меня» не выдавалось (или cookie испорчен).
     */
    public static function presented(Request $request): ?string
    {
        /** @var SessionGuard $guard */
        $guard = Auth::guard('web');

        $cookie = $request->cookie($guard->getRecallerName());

        if (!is_string($cookie) || $cookie === '') {
            return null;
        }

        $recaller = new Recaller($cookie);

        return $recaller->valid() ? $recaller->token() : null;
    }

    /**
     * Выход на этом устройстве. Остальные продолжают работать — ровно то поведение, которого
     * не было у штатного users.remember_token.
     */
    public static function revokeCurrent(Authenticatable $user, Request $request): void
    {
        $token = static::presented($request);

        if ($token === null) {
            return;
        }

        RememberToken::query()
            ->where('user_id', $user->getAuthIdentifier())
            ->where('token', RememberToken::hashToken($token))
            ->delete();
    }

    /**
     * Все устройства, кроме текущего — смена пароля из профиля. Выбрасывать заодно и того, кто
     * пароль меняет, незачем, а вот чужие сессии после смены пароля жить не должны.
     *
     * Если cookie этого устройства почему-то нет (стёрли вручную, сессия старше перехода на
     * потокенное хранение), исключать нечего и удалятся все записи. Это неприятно, но безопасно:
     * текущий пользователь остаётся в системе на своей сессии, просто перестанет запоминаться.
     */
    public static function revokeOthers(Authenticatable $user, Request $request): void
    {
        $token = static::presented($request);

        $query = RememberToken::query()->where('user_id', $user->getAuthIdentifier());

        if ($token !== null) {
            $query->where('token', '!=', RememberToken::hashToken($token));
        }

        $query->delete();
    }

    /**
     * Все устройства без исключения — восстановление пароля по секретному вопросу. Там пароль
     * меняет тот, кто в аккаунт ещё не вошёл, и исходить надо из того, что доступ мог быть
     * потерян: ни одна старая «запомненная» сессия продолжаться не должна.
     */
    public static function revokeAll(Authenticatable $user): void
    {
        RememberToken::query()
            ->where('user_id', $user->getAuthIdentifier())
            ->delete();
    }
}
