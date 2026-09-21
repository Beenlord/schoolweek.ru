<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { progress, usePage } from '@inertiajs/vue3';
import debounce from 'lodash/debounce';
import keyBy from 'lodash/keyBy';
import { guessTimezone } from '@/dayjs.js';
import { xsrfToken } from '@/csrf.js';
import { getDaysInRange, isWeekCached, markSynced, markWeekCached, putCleanDays, putDirtyDay } from '@/offline/db.js';
import { syncNow } from '@/offline/sync.js';
import { addDays, formatDate, isValidDate, isoWeekday, parseDate, todayIn, weekDates, weekInfo, weekStart } from '@/week.js';
import AppLayout from '@/Layouts/AppLayout.vue';
import DayModal from '@/Components/DayModal.vue';
import RichText from '@/Components/RichText.vue';
import WeekPickerButton from '@/Components/WeekPickerButton.vue';

const props = defineProps({
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    week: { type: Number, required: true },
    weekStart: { type: String, required: true },
    days: { type: Array, required: true }, // { date, weekday, content, updatedAt, isToday }
});

const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Пояс профиля (может отличаться от пояса устройства — см. ТЗ, «Пользователи»); приезжает
// шареным пропсом Inertia. Офлайн он приходит из закэшированной страницы, поэтому может слегка
// отстать от профиля — на определение «сегодня» это влияет только сразу после смены пояса.
const page = usePage();
const timezone = page.props.auth?.user?.timezone || guessTimezone();

const isOnline = ref(navigator.onLine);
const currentWeekStart = ref(props.weekStart);
// Показываемая неделя. Первое значение — серверное (props), дальше считается на клиенте
// в week.js: две реализации одного правила из ТЗ, см. комментарий в начале week.js.
const viewYear = ref(props.year);
const viewMonth = ref(props.month);
const viewWeek = ref(props.week);
const editableDays = ref(props.days.map((day) => ({ ...day })));
const pendingSaves = reactive({});
const editingDate = ref(null);

// Знаем ли мы содержимое показываемой недели наверняка. false — неделю ни разу не выкачивали
// с сервера, а сети сейчас нет: показывать её как пачку пустых дней нельзя (и тем более нельзя
// давать поверх них писать — см. комментарий у WEEKS_STORE в offline/db.js).
const weekLoaded = ref(true);
// Не «нет данных офлайн»: неделя остаётся незагруженной и при живой сети, если запрос к серверу
// не удался. Причину, когда она известна, объясняет баннер наверху страницы.
const emptyLabel = computed(() => (weekLoaded.value ? 'пусто…' : 'нет данных'));

// Направление анимации переворота. Раньше передавалось через sessionStorage, потому что
// Inertia-переход на /now?date= пересоздавал компонент страницы; теперь неделя переключается
// на месте, и достаточно обычного состояния. flipToken меняет :key створок — это перезапускает
// CSS-анимацию, которая иначе проигралась бы только один раз, при первом появлении класса.
const flipSide = ref('');
const flipToken = ref(0);

// Летит и накрывает соседнюю половину только та половина, В КОТОРУЮ СТОРОНУ идёт переключение:
// «вперёд» (и свайп влево) — левая половина (Пн–Ср) складывается и накрывает правую,
// «назад» (свайп вправо) — наоборот, правая накрывает левую.
const leftFlipClass = computed(() => (flipSide.value === 'next' ? 'flip-page-cover' : ''));
const rightFlipClass = computed(() => (flipSide.value === 'prev' ? 'flip-page-cover' : ''));

function goOnline() {
    isOnline.value = true;
    // Вернулась сеть — дотягиваем неделю, которую могли показывать по неполным локальным данным.
    loadWeek(currentWeekStart.value);
}

function goOffline() {
    isOnline.value = false;
}

window.addEventListener('online', goOnline);
window.addEventListener('offline', goOffline);
window.addEventListener('popstate', onPopState);

onUnmounted(() => {
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('popstate', onPopState);
    // Страница уходит — недописанная правка не должна уехать вместе с ней.
    saveSoon.flush();
    clearHighlight();
});

/** Понедельник недели, которую просит адресная строка (или текущей, если даты в адресе нет). */
function wantedWeekStart() {
    const requested = new URLSearchParams(window.location.search).get('date');
    const base = isValidDate(requested) ? requested : todayIn(timezone);

    return formatDate(weekStart(parseDate(base)));
}

onMounted(async () => {
    const wanted = wantedWeekStart();

    if (navigator.onLine && wanted === props.weekStart) {
        // Пропсы пришли живыми с сервера и описывают именно нужную неделю — кэшируем их как
        // «чистые» на случай, если она понадобится офлайн, и заодно пробуем отправить любые
        // старые неотправленные правки.
        await putCleanDays(props.days.map((day) => ({ date: day.date, content: day.content, updatedAt: day.updatedAt })));
        await markWeekCached(props.weekStart);
        syncNow();
        return;
    }

    // Либо офлайн — и тогда пропсы могли прийти из закэшированной service worker'ом страницы
    // (снимок на момент последнего онлайн-визита, а не текущее состояние), либо кэш вообще отдал
    // страницу другой недели: при поиске в кэше строка запроса игнорируется, поэтому под
    // /now?date=X может прийти снимок совсем другой недели (matchOptions.ignoreSearch в
    // runtimeCaching, vite.config.js). В обоих случаях источник истины — IndexedDB, не пропсы.
    await loadWeek(wanted);
    syncNow();
});

// Гонка «пользователь листает быстрее, чем отвечает сеть»: каждый заход в loadWeek получает
// номер, и любой асинхронный шаг устаревшего захода молча обрывается, не трогая экран.
let loadToken = 0;

// Полоса загрузки Inertia сама показывается только на её собственных визитах, а неделя тянется
// обычным fetch — запускаем вручную. Счётчик нужен из-за быстрого листания: когда два запроса
// идут внахлёст, завершение первого не должно гасить полосу, пока второй ещё в пути.
let weekRequests = 0;

function startWeekProgress() {
    weekRequests += 1;

    if (weekRequests === 1) {
        progress.start();
    }
}

function finishWeekProgress() {
    weekRequests = Math.max(0, weekRequests - 1);

    if (weekRequests === 0) {
        progress.finish();
    }
}

function applyLocalDays(rows) {
    const byDate = keyBy(rows, 'date');

    editableDays.value.forEach((day) => {
        // Клетку, в которой сейчас печатают, не трогаем. Её содержимое свежее всего, что может
        // прийти из базы или с сервера (последний автосейв мог ещё не сработать), и подмена
        // прямо под курсором стёрла бы набранное.
        if (day.date === editingDate.value) {
            return;
        }

        const local = byDate[day.date];

        if (local) {
            day.content = local.content;
            day.updatedAt = local.updatedAt;
        }
    });
}

/**
 * Показывает неделю, начинающуюся с startStr. Каркас (даты, дни недели, «сегодня») строится
 * синхронно и локально, поэтому переключение мгновенно и не зависит от сети; содержимое
 * подставляется сначала из IndexedDB, затем — если есть сеть — из ответа сервера.
 */
async function loadWeek(startStr, { fromServer = true } = {}) {
    const token = ++loadToken;
    const info = weekInfo(parseDate(startStr));
    const today = todayIn(timezone);
    const dates = weekDates(info.weekStart);

    // Каркас пересобираем только если неделя действительно меняется. Повторная загрузка той же
    // недели — это возврат сети (см. goOnline), и она не должна ни закрывать открытую клетку,
    // ни начинать её содержимое с чистого листа под курсором у пишущего человека.
    if (startStr !== currentWeekStart.value || editableDays.value.length !== dates.length) {
        // Свайп на соседнюю неделю может случиться и без blur текущей клетки (палец по сетке,
        // фокус остался в textarea) — не даём отложенному автосохранению потеряться вместе с
        // уходящей неделей.
        saveSoon.flush();
        editingDate.value = null;

        editableDays.value = dates.map((date) => ({
            date: formatDate(date),
            weekday: isoWeekday(date),
            content: null,
            updatedAt: null,
            isToday: false,
        }));
    }

    currentWeekStart.value = startStr;
    viewYear.value = info.year;
    viewMonth.value = info.month;
    viewWeek.value = info.week;
    // Отдельно от каркаса: страница может быть открыта и через полночь, когда «сегодня» уже
    // другой день, а неделя та же.
    editableDays.value.forEach((day) => { day.isToday = day.date === today; });

    const from = formatDate(dates[0]);
    const to = formatDate(dates[6]);

    const local = await getDaysInRange(from, to);
    const cached = await isWeekCached(startStr);

    if (token !== loadToken) {
        return;
    }

    applyLocalDays(local);

    // Пока запрос к серверу в пути, считаем неделю загруженной авансом: иначе каждый переход на
    // ещё не выкачанную неделю в онлайне на долю секунды показывал бы «нет данных» и запрещал
    // редактирование. Если сервер не ответит — в catch ниже вернёмся к честному значению.
    const willFetch = fromServer && navigator.onLine;
    weekLoaded.value = cached || willFetch;

    if (!willFetch) {
        return;
    }

    startWeekProgress();

    try {
        const response = await fetch(`/api/weeks/${startStr}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
            throw new Error('week load failed');
        }

        const data = await response.json();

        await putCleanDays(data.days);
        await markWeekCached(startStr);

        const fresh = await getDaysInRange(from, to);

        if (token !== loadToken) {
            return;
        }

        // На экран кладём не ответ сервера, а перечитанную IndexedDB: putCleanDays намеренно не
        // перетирает дни с неотправленной локальной правкой, и показывать надо ровно то же самое.
        applyLocalDays(fresh);
        weekLoaded.value = true;
    } catch (e) {
        // Сеть отвалилась по дороге (или сервер ответил ошибкой) — остаёмся на локальной копии,
        // и аванс, выданный выше, забираем обратно: доверять можно только тому, что уже лежало
        // в IndexedDB.
        if (token === loadToken) {
            weekLoaded.value = cached;
        }
    } finally {
        // Именно finally: внутри try есть ранний return по устаревшему токену, и без него
        // полоса осталась бы висеть.
        finishWeekProgress();
    }
}

function dayByWeekday(n) {
    return editableDays.value.find((d) => d.weekday === n);
}

const monday = computed(() => dayByWeekday(1));
const tuesday = computed(() => dayByWeekday(2));
const wednesday = computed(() => dayByWeekday(3));
const thursday = computed(() => dayByWeekday(4));
const friday = computed(() => dayByWeekday(5));
const saturday = computed(() => dayByWeekday(6));
const sunday = computed(() => dayByWeekday(7));

// День, открытый в модалке. Держим не сам объект, а дату: editableDays пересобирается при
// переключении недели, и ссылка на старый объект пережила бы свою неделю.
const editingDay = computed(() => editableDays.value.find((day) => day.date === editingDate.value) ?? null);

const WEEKDAY_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// Родительный падеж — отдельным списком от MONTHS выше: в шапке недели месяц стоит сам по себе
// («Сентябрь 2026»), а в дате — при числе («22 сентября 2026»), и форма у него другая.
const MONTHS_GENITIVE = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const editingTitle = computed(() => {
    const day = editingDay.value;

    if (!day) {
        return '';
    }

    // Дата целиком, включая год: окно открывается и на соседние недели, и по календарю, так что
    // «22.09» без года оставляло бы вопрос, какой именно это день.
    const year = Number(day.date.slice(0, 4));
    const month = Number(day.date.slice(5, 7));
    const date = Number(day.date.slice(8, 10));

    return `${WEEKDAY_FULL[day.weekday - 1]}, ${date} ${MONTHS_GENITIVE[month - 1]} ${year}`;
});

// Правка из редактора: кладём в тот же объект дня, что показывает сетка, и отправляем через уже
// существующее отложенное сохранение — ни IndexedDB, ни синхронизация об этом ничего не знают,
// для них содержимое как было строкой, так и осталось.
function onEditorInput(value) {
    const day = editingDay.value;

    if (!day) {
        return;
    }

    day.content = value;
    saveSoon(day);
}

async function saveDay(day) {
    // Снимок содержимого на момент запуска: автосохранение срабатывает по ходу набора, и к
    // моменту ответа сервера пользователь вполне может дописать ещё. Всё дальше — про этот
    // конкретный снимок, а не про «текущее состояние клетки».
    const content = day.content;
    const updatedAt = new Date().toISOString();
    pendingSaves[day.date] = true;

    // Пишем локально первым делом и всегда — так правка не теряется, даже если запрос ниже не
    // дойдёт до сервера.
    await putDirtyDay(day.date, content, updatedAt);

    try {
        const response = await fetch(`/api/days/${day.date}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            body: JSON.stringify({ content }),
        });

        if (!response.ok) {
            throw new Error('save failed');
        }

        const data = await response.json();

        // Пока запрос летел, пользователь мог дописать ещё (или успел сработать следующий
        // автосейв) — markSynced сверится с меткой отправленной правки и в этом случае не
        // тронет строку, оставив её dirty до собственного сохранения.
        await markSynced(day.date, data.content, data.updatedAt, updatedAt);

        if (day.content === content) {
            day.updatedAt = data.updatedAt;
        }
    } catch (e) {
        // Нет сети или сервер недоступен — правка остаётся в IndexedDB помеченной dirty, её отправит
        // фоновая синхронизация при восстановлении связи (см. offline/sync.js).
    } finally {
        delete pendingSaves[day.date];
    }
}

function openDay(day) {
    // Незагруженную неделю не даём редактировать: правка поверх дня, содержимого которого
    // пользователь не видел, при следующей синхронизации просто затрёт его (batch сравнивает
    // время правки, а не содержимое — см. DayController::batch).
    if (!weekLoaded.value) {
        return;
    }

    editingDate.value = day.date;
}

// Автосохранение по ходу набора. Раньше правка уезжала в IndexedDB только по blur — то есть
// закрытая вкладка или разряженный телефон посреди записи означали потерю всего, что набрано.
// debounce, чтобы при этом не дёргать PUT на каждое нажатие клавиши: пишем через паузу в наборе.
const AUTOSAVE_DELAY = 700;
// maxWait обязателен: без него пауза в наборе так и не наступает у того, кто печатает без
// остановки, и «автосохранение» не срабатывает ни разу — ровно в том случае, ради которого оно
// и заводилось (длинная запись, которую жалко потерять).
const AUTOSAVE_MAX_WAIT = 5000;
const saveSoon = debounce((day) => saveDay(day), AUTOSAVE_DELAY, { maxWait: AUTOSAVE_MAX_WAIT });

function closeDay() {
    const day = editingDay.value;

    editingDate.value = null;

    if (!day) {
        return;
    }

    // Закрытие модалки — это уже не пауза в наборе, а конец правки: отменяем отложенный вызов и
    // сохраняем сразу, иначе получилось бы два запроса подряд с одним и тем же содержимым.
    saveSoon.cancel();
    saveDay(day);
}

// Переключение недели происходит целиком на клиенте: раньше здесь был Inertia-переход на
// /now?date=, то есть поход на сервер — и офлайн листание просто не работало. Теперь адрес
// правится через history.pushState (чтобы перезагрузка и «назад» в браузере вели себя как
// раньше), а данные приходят из IndexedDB и, если есть сеть, из /api/weeks/{date}.
/**
 * Переход на неделю, начинающуюся с startStr: направление анимации, запись в историю, загрузка.
 *
 * @returns {boolean} false, если мы уже на этой неделе и делать нечего.
 */
function navigateToWeek(startStr) {
    if (startStr === currentWeekStart.value) {
        return false;
    }

    // Направление считаем сравнением дат, а не знаком смещения: сюда приходят и соседние недели
    // от кнопок, и произвольно далёкая текущая неделя от кнопки «домой».
    flipSide.value = startStr > currentWeekStart.value ? 'next' : 'prev';
    flipToken.value++;

    window.history.pushState({ date: startStr }, '', `/now?date=${startStr}`);
    loadWeek(startStr);

    return true;
}

function goToWeek(offsetDays) {
    navigateToWeek(formatDate(addDays(parseDate(currentWeekStart.value), offsetDays)));
}

// Быстрый переход по дате из шапки. В ТЗ на этом месте описан свой календарь с ячейками-
// диапазонами «[дата–дата]»; вместо него системный выбор даты — он привычнее, умеет листать годы
// и не требует своей вёрстки. Неделя вычисляется из выбранного дня, попадать ровно в понедельник
// пользователю не нужно.
// Выделение выбранного дня после перехода по дате. Без него переход «в никуда»: неделя сменилась,
// а какой именно день просили — на сетке ничем не отмечено.
//
// Здесь хранится нужный день, но класс по нему получают ОСТАЛЬНЫЕ клетки: выделение сделано от
// обратного — соседи ненадолго приглушаются, а нужный день остаётся единственным в полную силу
// (см. .day-dimmed в app.css).
const HIGHLIGHT_DURATION = 2000;
// Должно совпадать с длительностью анимации переворота в app.css (.flip-page-cover): подсветка
// начинается, когда створка уже легла, иначе её половину не видно за летящей страницей.
const FLIP_DURATION = 620;

const highlightedDate = ref(null);
let highlightTimers = [];

function clearHighlight() {
    highlightTimers.forEach((timer) => clearTimeout(timer));
    highlightTimers = [];
    highlightedDate.value = null;
}

function highlightDay(date, delay) {
    clearHighlight();

    const show = () => {
        highlightedDate.value = date;
        highlightTimers.push(setTimeout(() => { highlightedDate.value = null; }, HIGHLIGHT_DURATION));
    };

    if (delay > 0) {
        highlightTimers.push(setTimeout(show, delay));
    } else {
        show();
    }
}

function onWeekPicked(value) {
    // Поле даты можно очистить — тогда менять нечего.
    if (!isValidDate(value)) {
        return;
    }

    const picked = formatDate(parseDate(value));
    // navigateToWeek вернёт false, если неделя та же — тогда переворота не будет и ждать нечего.
    const flipping = navigateToWeek(formatDate(weekStart(parseDate(value))));

    highlightDay(picked, flipping ? FLIP_DURATION : 0);
}

// Кнопка «домой» в нижней панели. На /now это не переход по ссылке, а перелистывание к текущей
// неделе: перезагрузка здесь сбрасывала бы состояние страницы и офлайн-вид, да ещё и не сработала
// бы без сети.
function goToToday() {
    const target = formatDate(weekStart(parseDate(todayIn(timezone))));

    if (!navigateToWeek(target)) {
        // Уже на текущей неделе — листать некуда, но адрес стоит подчистить от ?date=,
        // чтобы перезагрузка открыла просто /now.
        window.history.replaceState({}, '', '/now');
    }
}

// Кнопки «назад/вперёд» в браузере: pushState выше складывает недели в историю, значит их надо
// уметь и разворачивать обратно.
function onPopState() {
    const wanted = wantedWeekStart();

    if (wanted === currentWeekStart.value) {
        return;
    }

    flipSide.value = wanted > currentWeekStart.value ? 'next' : 'prev';
    flipToken.value++;

    loadWeek(wanted);
}

// Свайп «неделя назад/вперёд» — основной способ навигации на телефоне (см. README, «Адаптивность»).
const touchStartX = ref(null);
const touchStartY = ref(null);

function onTouchStart(e) {
    touchStartX.value = e.touches[0].clientX;
    touchStartY.value = e.touches[0].clientY;
}

function onTouchEnd(e) {
    if (touchStartX.value === null) return;

    const dx = e.changedTouches[0].clientX - touchStartX.value;
    const dy = e.changedTouches[0].clientY - touchStartY.value;
    touchStartX.value = null;

    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy)) return;

    goToWeek(dx < 0 ? 7 : -7);
}
</script>

<template>
    <AppLayout fit :home-handler="goToToday" home-label="К текущей неделе">
        <div class="Now NowPage flex h-full min-h-0 flex-col">
            <p
                v-if="!isOnline"
                class="mb-4 shrink-0 rounded-lg border border-accent-dark bg-today px-4 py-2 text-sm font-semibold text-ink"
            >
                <template v-if="weekLoaded">
                    Офлайн — показаны последние сохранённые данные, правки отправятся при восстановлении сети.
                </template>
                <template v-else>
                    Офлайн — эта неделя не была загружена заранее, её содержимое неизвестно. Редактирование
                    недоступно, чтобы не затереть записи при синхронизации.
                </template>
            </p>

            <h1 class="mb-2 shrink-0 text-base font-bold text-ink sm:text-xl">
                <WeekPickerButton
                    :value="currentWeekStart"
                    class="-mx-1 inline-flex items-center gap-1.5 rounded-lg px-1 text-ink transition-colors hover:bg-today/60"
                    @pick="onWeekPicked"
                >
                    {{ MONTHS[viewMonth - 1] }} {{ viewYear }}
                    <span class="font-normal text-ink-muted">— неделя {{ viewWeek }}</span>
                </WeekPickerButton>
            </h1>

            <!-- Никакого overflow здесь: во время переворота створка выходит за пределы сетки,
                 и любой клиппинг по дороге режет анимацию. Полос прокрутки при этом не будет —
                 обрежет корень layout'а (h-dvh overflow-hidden), уже по краю экрана. -->
            <!-- touch-action: обработчики свайпа пассивные и отменить прокрутку не могут, поэтому
                 горизонтальную панораму запрещаем браузеру декларативно: иначе на iPadOS движение
                 пальцем поперёк страницы уводит её в отскок и «съедает» жест переключения недели.
                 pan-y оставлен, чтобы клетки дня по-прежнему прокручивались, pinch-zoom — чтобы не
                 отбирать у пользователя масштабирование (голый touch-pan-y запретил бы и его). -->
            <div
                class="grid min-h-0 flex-1 grid-cols-2 gap-1.5 bg-paper [touch-action:pan-y_pinch-zoom] sm:gap-3 md:gap-4"
                @touchstart.passive="onTouchStart"
                @touchend.passive="onTouchEnd"
            >
                <div class="relative min-h-0">
                <!-- Пустой разворот-заглушка: пока створка отвёрнута, её колонка иначе зияет
                     фоном страницы. Повторяет форму клеток, кликов не перехватывает.
                     Приглушается вместе с клетками: иначе сквозь полупрозрачную клетку проступала
                     бы эта заглушка, и гасло бы будто одно содержимое, а рамка и бумага оставались
                     на месте. Под выбранным днём она тоже приглушена, но этого не видно — он
                     непрозрачный и накрывает её целиком. -->
                <div
                    class="pointer-events-none absolute inset-0 z-0 grid grid-rows-3 gap-1.5 sm:gap-3 md:gap-4"
                    :class="{ 'day-dimmed': highlightedDate }"
                    aria-hidden="true"
                >
                    <div
                        v-for="n in 3"
                        :key="n"
                        class="ruled-paper ruled-margin rounded-lg bg-paper ring-1 ring-paper-line/50 [--line-h:1rem] sm:[--line-h:1.5rem]"
                    ></div>
                </div>

                <div :key="flipToken" class="flip-left h-full min-h-0" :class="leftFlipClass">
                <div class="flip-page-face grid h-full min-h-0 grid-rows-3 gap-1.5 sm:gap-3 md:gap-4">
                <template v-for="day in [monday, tuesday, wednesday]" :key="day.date">
                    <article
                        class="ruled-margin flex min-h-0 flex-col overflow-hidden rounded-lg bg-paper p-1.5 shadow-sm ring-1 ring-paper-line/70 sm:p-3"
                        :class="[{ 'ring-2 ring-accent-dark bg-today': day.isToday, 'day-dimmed': highlightedDate && day.date !== highlightedDate }, weekLoaded ? 'cursor-pointer' : 'cursor-default']"
                        @click="!editingDate && openDay(day)"
                    >
                        <header class="mb-0.5 flex items-baseline justify-between text-xs font-bold text-ink sm:mb-1 sm:text-sm">
                            <span>{{ WEEKDAY_LABELS[day.weekday - 1] }}</span>
                            <span class="font-normal text-ink-muted">{{ day.date.slice(8, 10) }}.{{ day.date.slice(5, 7) }}</span>
                        </header>

                        <div class="ruled-paper no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [--line-h:1rem] sm:[--line-h:1.5rem]">
                            <div class="text-xs text-ink-muted sm:text-sm">
                                <div v-if="!day.content" class="italic leading-4 text-ink-muted/60 sm:leading-6">{{ emptyLabel }}</div>
                                <RichText v-else :content="day.content" class="leading-4 sm:leading-6" />
                            </div>
                        </div>

                        <span v-if="pendingSaves[day.date]" class="mt-1 text-xs text-ink-muted">Сохранение…</span>
                    </article>
                </template>
                </div>
                </div>
                </div>

                <div class="relative min-h-0">
                <div
                    class="pointer-events-none absolute inset-0 z-0 grid grid-rows-3 gap-1.5 sm:gap-3 md:gap-4"
                    :class="{ 'day-dimmed': highlightedDate }"
                    aria-hidden="true"
                >
                    <div
                        v-for="n in 2"
                        :key="n"
                        class="ruled-paper ruled-margin rounded-lg bg-paper ring-1 ring-paper-line/50 [--line-h:1rem] sm:[--line-h:1.5rem]"
                    ></div>
                    <div class="grid grid-rows-2 gap-1.5 sm:gap-3 md:gap-4">
                        <div
                            v-for="n in 2"
                            :key="n"
                            class="ruled-paper ruled-margin rounded-lg bg-paper ring-1 ring-paper-line/50 [--line-h:1rem] sm:[--line-h:1.5rem]"
                        ></div>
                    </div>
                </div>

                <div :key="flipToken" class="flip-right h-full min-h-0" :class="rightFlipClass">
                <div class="flip-page-face grid h-full min-h-0 grid-rows-3 gap-1.5 sm:gap-3 md:gap-4">
                <template v-for="day in [thursday, friday]" :key="day.date">
                    <article
                        class="ruled-margin flex min-h-0 flex-col overflow-hidden rounded-lg bg-paper p-1.5 shadow-sm ring-1 ring-paper-line/70 sm:p-3"
                        :class="[{ 'ring-2 ring-accent-dark bg-today': day.isToday, 'day-dimmed': highlightedDate && day.date !== highlightedDate }, weekLoaded ? 'cursor-pointer' : 'cursor-default']"
                        @click="!editingDate && openDay(day)"
                    >
                        <header class="mb-0.5 flex items-baseline justify-between text-xs font-bold text-ink sm:mb-1 sm:text-sm">
                            <span>{{ WEEKDAY_LABELS[day.weekday - 1] }}</span>
                            <span class="font-normal text-ink-muted">{{ day.date.slice(8, 10) }}.{{ day.date.slice(5, 7) }}</span>
                        </header>

                        <div class="ruled-paper no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [--line-h:1rem] sm:[--line-h:1.5rem]">
                            <div class="text-xs text-ink-muted sm:text-sm">
                                <div v-if="!day.content" class="italic leading-4 text-ink-muted/60 sm:leading-6">{{ emptyLabel }}</div>
                                <RichText v-else :content="day.content" class="leading-4 sm:leading-6" />
                            </div>
                        </div>

                        <span v-if="pendingSaves[day.date]" class="mt-1 text-xs text-ink-muted">Сохранение…</span>
                    </article>
                </template>

                <!-- Сб/Вс: визуально одна клетка, как в бумажном дневнике, но фактически два
                     независимых поля вдвое меньшей высоты (см. README, «Концепция»). -->
                <div class="grid min-h-0 grid-rows-2 gap-1.5 sm:gap-3 md:gap-4">
                    <article
                        v-for="day in [saturday, sunday]"
                        :key="day.date"
                        class="ruled-margin flex min-h-0 flex-col overflow-hidden rounded-lg bg-paper p-1 shadow-sm ring-1 ring-paper-line/70 sm:p-2.5"
                        :class="[{ 'ring-2 ring-accent-dark bg-today': day.isToday, 'day-dimmed': highlightedDate && day.date !== highlightedDate }, weekLoaded ? 'cursor-pointer' : 'cursor-default']"
                        @click="!editingDate && openDay(day)"
                    >
                        <header class="mb-0.5 flex items-baseline justify-between text-xs font-bold text-ink sm:text-sm">
                            <span>{{ WEEKDAY_LABELS[day.weekday - 1] }}</span>
                            <span class="font-normal text-ink-muted">{{ day.date.slice(8, 10) }}.{{ day.date.slice(5, 7) }}</span>
                        </header>

                        <div class="ruled-paper no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [--line-h:1rem] sm:[--line-h:1.5rem]">
                            <div class="text-xs text-ink-muted sm:text-sm">
                                <div v-if="!day.content" class="italic leading-4 text-ink-muted/60 sm:leading-6">{{ emptyLabel }}</div>
                                <RichText v-else :content="day.content" class="leading-4 sm:leading-6" />
                            </div>
                        </div>

                        <span v-if="pendingSaves[day.date]" class="mt-1 text-xs text-ink-muted">Сохранение…</span>
                    </article>
                </div>
                </div>
                </div>
                </div>
            </div>
        </div>

        <!-- Редактор дня — модальный, как в ТЗ («Редактирование дня»). Рисуется один на страницу,
             а не по одному в каждой клетке: клетка слишком мала, чтобы писать в ней, и на телефоне
             её вдобавок наполовину закрывает клавиатура. :key заставляет пересоздать редактор при
             переходе на другой день — Tiptap задаёт документ один раз, при создании. -->
        <DayModal
            v-if="editingDay"
            :key="editingDay.date"
            :title="editingTitle"
            :model-value="editingDay.content ?? ''"
            @update:model-value="onEditorInput"
            @close="closeDay"
        />

        <template #bottom-bar>
            <button
                type="button"
                aria-label="Предыдущая неделя"
                class="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-today/60 hover:text-ink"
                @click="goToWeek(-7)"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                    <path d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <!-- Тот же выбор даты, что и в шапке, но под большим пальцем: между стрелками, с
                 которыми он и образует один блок навигации по неделям. -->
            <WeekPickerButton
                :value="currentWeekStart"
                icon-class="h-6 w-6"
                class="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-today/60 hover:text-ink"
                @pick="onWeekPicked"
            />

            <button
                type="button"
                aria-label="Следующая неделя"
                class="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-today/60 hover:text-ink"
                @click="goToWeek(7)"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                    <path d="M9 5l7 7-7 7" />
                </svg>
            </button>
        </template>
    </AppLayout>
</template>
