<?php

namespace App\Auth;

use App\Models\RememberToken;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Contracts\Auth\Authenticatable;

/**
 * Обычный EloquentUserProvider, у которого подменены только две точки: где берётся и куда
 * пишется токен «запомнить меня». Всё остальное — поиск по email, проверка пароля, перехеширование
 * — остаётся фреймворковым, как и сам механизм recaller-cookie в SessionGuard.
 *
 * Смысл подмены: штатно токен лежит в users.remember_token, один на пользователя, и выход на
 * любом устройстве перевыпускает его для всех сразу. Здесь каждый вход кладёт свою строку в
 * remember_tokens, поэтому гасить их можно поштучно (см. App\Auth\DeviceTokens).
 *
 * Как это стыкуется с SessionGuard:
 *  - при входе guard зовёт ensureRememberTokenIsSet(), тот видит пустой токен (User хранит его
 *    только в памяти и никогда не пишет в базу — см. User::setRememberToken), генерирует новый
 *    и отдаёт сюда, в updateRememberToken();
 *  - при восстановлении сессии из cookie guard зовёт retrieveByToken();
 *  - при выходе guard пропускает cycleRememberToken(), потому что у загруженного из сессии
 *    пользователя токен в памяти пуст — а значит, лишних «ничейных» строк не появляется.
 */
class DeviceRememberUserProvider extends EloquentUserProvider
{
    public function retrieveByToken($identifier, #[\SensitiveParameter] $token)
    {
        $user = $this->retrieveById($identifier);

        if ($user === null) {
            return null;
        }

        $record = RememberToken::findValid($user, (string) $token);

        if ($record === null) {
            return null;
        }

        // Срок жизни скользящий: устройством только что воспользовались.
        $record->touchUsage();

        // Токен намеренно НЕ возвращается в модель через setRememberToken(): иначе
        // SessionGuard::logout() счёл бы нужным «прокрутить» его и создал бы строку, которой не
        // соответствует ни один cookie. Гашение выхода делается явно, в контроллере.
        return $user;
    }

    public function updateRememberToken(Authenticatable $user, #[\SensitiveParameter] $token)
    {
        RememberToken::issue($user, (string) $token, request()->userAgent());
    }
}
