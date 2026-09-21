import countBy from 'lodash/countBy';
import maxBy from 'lodash/maxBy';
import toPairs from 'lodash/toPairs';
import dayjs from '@/dayjs.js';

/**
 * Клиентский порт app/Support/WeekCalculator.php.
 *
 * Нужен, потому что переключение недели больше не ходит на сервер (иначе оно не работало бы
 * офлайн — см. Pages/Now.vue): границы недели, её номер внутри месяца и ISO-день недели теперь
 * считаются на клиенте. Это вторая независимая реализация одного и того же правила из ТЗ
 * («неделя принадлежит тому месяцу, где лежит большинство её дней»), поэтому структура намеренно
 * повторяет PHP-версию один в один — расходиться им нельзя, а поймать расхождение можно только
 * глазами при сверке двух файлов.
 *
 * Все функции принимают и возвращают dayjs-объекты (или строки 'YYYY-MM-DD'), а не Date: dayjs
 * иммутабелен, поэтому добавление дней не может случайно изменить исходную дату, и умеет ISO-неделю
 * и IANA-пояса, которые тут как раз и нужны. Плагины (utc/timezone/isoWeek) подключены в
 * resources/js/dayjs.js — оттуда же импортируется и сам dayjs.
 */

export const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * 'YYYY-MM-DD' → локальная полночь. Именно так dayjs разбирает такие строки по умолчанию —
 * в отличие от new Date(str), который по спецификации трактует их как UTC, из-за чего для поясов
 * западнее Гринвича дата съезжает на сутки назад.
 */
export function parseDate(value) {
    return dayjs(value);
}

const WEEKDAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// Родительный падеж — отдельным списком от названий месяцев в шапке недели: там месяц стоит сам
// по себе («Сентябрь 2026»), а в дате — при числе («22 сентября 2026»), и форма у него другая.
const MONTHS_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

/**
 * «Понедельник, 22 сентября 2026» — подпись дня целиком, с годом.
 *
 * Год нужен: и модалка дня, и список результатов поиска показывают дни из произвольных недель,
 * и «22.09» без года оставляло бы вопрос, какой именно это день.
 *
 * @param {string|import('dayjs').Dayjs|Date} date
 * @returns {string}
 */
export function formatFullDate(date) {
    const value = dayjs(date);

    return `${WEEKDAY_FULL[isoWeekday(value) - 1]}, ${value.date()} ${MONTHS_GENITIVE[value.month()]} ${value.year()}`;
}

/**
 * Годится ли строка как дата. Проверки формата регуляркой мало: '2026-13-45' ей соответствует,
 * а датой не является — и дальше по коду превращается в Invalid Date, от которого weekInfo()
 * уходит в бесконечный цикл (сравнения с NaN никогда не истинны).
 */
export function isValidDate(value) {
    return typeof value === 'string' && dayjs(value).isValid();
}

export function formatDate(date) {
    return dayjs(date).format(DATE_FORMAT);
}

export function addDays(date, days) {
    return dayjs(date).add(days, 'day');
}

/** ISO-номер дня недели: 1 = Пн … 7 = Вс (аналог dayOfWeekIso у Carbon). */
export function isoWeekday(date) {
    return dayjs(date).isoWeekday();
}

/** Понедельник недели, содержащей date (аналог startOfWeek(MONDAY)). */
export function weekStart(date) {
    return dayjs(date).isoWeekday(1);
}

/** @returns {import('dayjs').Dayjs[]} семь дат недели, Пн..Вс. */
export function weekDates(start) {
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/**
 * Сегодняшняя дата в часовом поясе пользователя (он может отличаться от пояса устройства — см.
 * ТЗ, «Пользователи»).
 *
 * @returns {string} 'YYYY-MM-DD'
 */
export function todayIn(timeZone) {
    try {
        return dayjs().tz(timeZone).format(DATE_FORMAT);
    } catch {
        // Пояс в профиле битый или не поддерживается движком — откатываемся на пояс устройства.
        return dayjs().format(DATE_FORMAT);
    }
}

/**
 * Год и месяц, в котором лежит большинство дней недели.
 *
 * @returns {{year: number, month: number}}
 */
function owningMonth(start) {
    const counts = countBy(weekDates(start), (date) => date.format('YYYY-MM'));

    // Ничья невозможна: семь дней делятся максимум между двумя месяцами, то есть как 7/0, 6/1,
    // 5/2 или 4/3 — поэтому достаточно взять максимум, доопределять порядок при равенстве не надо.
    const [key] = maxBy(toPairs(counts), ([, count]) => count);
    const [year, month] = key.split('-').map(Number);

    return { year, month };
}

/**
 * Номер недели считается от начала месяца-владельца, а не по ISO-номеру недели года.
 *
 * @returns {{year: number, month: number, week: number, weekStart: import('dayjs').Dayjs}}
 */
export function weekInfo(date) {
    const start = weekStart(date);

    // Оба цикла ниже ищут совпадение перебором и на невалидной дате не сойдутся никогда —
    // лучше упасть с внятной ошибкой, чем подвесить вкладку. Вызывающий обязан фильтровать
    // ввод через isValidDate().
    if (!start.isValid()) {
        throw new Error(`weekInfo(): некорректная дата ${String(date)}`);
    }

    const owner = owningMonth(start);

    // Первая неделя месяца по тому же правилу большинства не обязательно начинается 1-го числа
    // (неделя с 1-м числом может принадлежать предыдущему месяцу), поэтому ищем её перебором,
    // а не считаем от начала месяца напрямую.
    let cursor = weekStart(dayjs(new Date(owner.year, owner.month - 1, 1)));

    for (;;) {
        const cursorOwner = owningMonth(cursor);

        if (cursorOwner.year === owner.year && cursorOwner.month === owner.month) {
            break;
        }

        cursor = addDays(cursor, 7);
    }

    let week = 1;

    while (!cursor.isSame(start, 'day')) {
        cursor = addDays(cursor, 7);
        week++;
    }

    return { year: owner.year, month: owner.month, week, weekStart: start };
}
