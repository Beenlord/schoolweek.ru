import dayjs from '@/dayjs.js';
import { isoWeekday, parseDate } from '@/week.js';

/**
 * Раскрытие событий в конкретные даты.
 *
 * Живёт только на клиенте, и это осознанно: сервер хранит правила, но не знает, на какие дни они
 * попадают. Иначе пришлось бы держать вторую реализацию этого календаря на PHP и следить, чтобы они
 * не разошлись — как уже приходится с WeekCalculator и его портом в week.js. Одной такой пары
 * достаточно.
 *
 * Правила (см. README, «События»):
 *  - once    — только сама дата;
 *  - daily   — каждый день внутри срока;
 *  - weekly  — выбранные дни недели (repeatOn: 1 = Пн … 7 = Вс);
 *  - monthly — выбранные числа месяца (repeatOn: 1–31);
 *  - yearly  — день и месяц из даты начала.
 */

/** Ключи палитры — те же, что в Event::COLORS на сервере. */
export const EVENT_COLORS = ['lemon', 'mint', 'sky', 'rose', 'lilac', 'sand'];

/**
 * Классы записаны целиком, а не собраны из строк: Tailwind ищет имена классов по исходникам
 * текстом, и `bg-event-${color}` он бы не нашёл — цвета просто не попали бы в сборку.
 */
const COLOR_CLASSES = {
    lemon: 'bg-event-lemon',
    mint: 'bg-event-mint',
    sky: 'bg-event-sky',
    rose: 'bg-event-rose',
    lilac: 'bg-event-lilac',
    sand: 'bg-event-sand',
};

/**
 * @param {string} color ключ палитры
 * @returns {string} класс фона; для незнакомого ключа — нейтральный, чтобы полоска не пропала
 */
export function eventColorClass(color) {
    return COLOR_CLASSES[color] ?? 'bg-paper-line';
}

/**
 * Число месяца, на которое фактически попадает выбранное число в конкретном месяце.
 *
 * 31-е в коротких месяцах сдвигается на последний день, а не пропускается: так «платёж в конце
 * месяца» не исчезает в феврале. Полезное следствие — выбрав 31-е, получаешь «последний день
 * месяца» для любого месяца. Решение владельца проекта, см. README.
 */
function clampDayOfMonth(day, date) {
    return Math.min(day, date.daysInMonth());
}

/**
 * Попадает ли событие на дату.
 *
 * @param {object} event
 * @param {import('dayjs').Dayjs} date
 * @returns {boolean}
 */
export function occursOn(event, date) {
    const startsOn = parseDate(event.startsOn);

    if (date.isBefore(startsOn, 'day')) {
        return false;
    }

    // Разовое ограничено самой датой, срок к нему неприменим.
    if (event.frequency === 'once') {
        return date.isSame(startsOn, 'day');
    }

    if (event.endsOn && date.isAfter(parseDate(event.endsOn), 'day')) {
        return false;
    }

    if (event.frequency === 'daily') {
        return true;
    }

    if (event.frequency === 'weekly') {
        return (event.repeatOn ?? []).includes(isoWeekday(date));
    }

    if (event.frequency === 'monthly') {
        // Сравниваем со сдвинутыми числами, а не с исходными: в феврале и 30-е, и 31-е дают 28-е,
        // и такое событие должно сработать один раз, а не ни разу.
        return (event.repeatOn ?? []).some((day) => clampDayOfMonth(day, date) === date.date());
    }

    if (event.frequency === 'yearly') {
        return date.month() === startsOn.month()
            // То же правило сдвига — ради дня рождения 29 февраля в невисокосный год.
            && date.date() === clampDayOfMonth(startsOn.date(), date);
    }

    // Незнакомая частота — не показываем ничего, чем угадывать. Так новое значение с сервера
    // (или из локальной копии постарше) даёт пустоту, а не случайные дни в сетке.
    return false;
}

/**
 * Порядок внутри дня: сначала события на весь день, затем остальные по возрастанию времени.
 * Сверху вниз, то есть в том же порядке, в каком читают.
 */
function byTime(a, b) {
    if (!a.time && !b.time) {
        return 0;
    }

    if (!a.time) {
        return -1;
    }

    if (!b.time) {
        return 1;
    }

    // Время приходит как 'HH:MM', поэтому строковое сравнение совпадает с хронологическим.
    return a.time.localeCompare(b.time);
}

/**
 * События, попадающие на дату, в порядке показа.
 *
 * @param {Array<object>} events
 * @param {string|import('dayjs').Dayjs} date
 * @returns {Array<object>}
 */
export function eventsOn(events, date) {
    const value = dayjs(date);

    return (events ?? []).filter((event) => occursOn(event, value)).sort(byTime);
}

/**
 * Раскладка событий по датам недели — за один проход, а не по вызову на клетку.
 *
 * @param {Array<object>} events
 * @param {Array<string>} dates даты в формате 'YYYY-MM-DD'
 * @returns {Record<string, Array<object>>}
 */
export function eventsByDate(events, dates) {
    const map = {};

    dates.forEach((date) => {
        map[date] = eventsOn(events, date);
    });

    return map;
}
