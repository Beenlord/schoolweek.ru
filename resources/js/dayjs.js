import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import isoWeek from 'dayjs/plugin/isoWeek';

/**
 * Единственное место, где к dayjs подключаются плагины, и единственное, откуда его следует
 * импортировать. extend() мутирует сам модуль dayjs глобально, поэтому если раскидать вызовы по
 * файлам, работоспособность .tz() или .isoWeekday() начнёт зависеть от того, какой модуль
 * загрузился раньше — а порядок загрузки решает сборщик, и он меняется от правки к правке.
 */

// utc обязан подключаться ДО timezone: плагин часовых поясов построен поверх него.
dayjs.extend(utc);
dayjs.extend(timezone);
// isoWeek даёт isoWeekday() с понедельником как первым днём недели — в отличие от штатного day(),
// у которого первый день зависит от локали.
dayjs.extend(isoWeek);

export default dayjs;

/**
 * Часовой пояс устройства — им предзаполняется профиль при регистрации (см. ТЗ, «Пользователи»)
 * и он же служит запасным вариантом, если в профиле пояса почему-то нет.
 *
 * @returns {string} имя зоны IANA, например 'Europe/Moscow'
 */
export function guessTimezone() {
    return dayjs.tz.guess();
}
