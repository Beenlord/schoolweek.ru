<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { xsrfToken } from '@/csrf.js';
import { EVENT_COLORS, eventColorClass } from '@/events.js';
import { putEvents } from '@/offline/db.js';
import { useKeyboardInset } from '@/composables/useKeyboardInset.js';

/**
 * Создание и правка одного события (см. README, «События»).
 *
 * Списка всех событий в приложении нет намеренно: событие ищут там, где оно видно, — в календаре.
 * Сюда попадают либо по кнопке в панели (создание), либо кликом по полоске события (правка).
 *
 * Требует сети: это редкое действие, и очередь офлайн-изменений со своим разрешением конфликтов
 * ради него не заводилась. Когда сети нет, форма закрыта и об этом сказано прямо.
 */

const props = defineProps({
    /** Событие для правки либо null — тогда создаём новое. */
    event: { type: Object, default: null },
    /** Дата по умолчанию для нового события — сегодняшняя, 'YYYY-MM-DD'. */
    defaultDate: { type: String, required: true },
});

const emit = defineEmits(['saved', 'close']);

const WEEKDAYS = [
    { value: 1, label: 'Пн' },
    { value: 2, label: 'Вт' },
    { value: 3, label: 'Ср' },
    { value: 4, label: 'Чт' },
    { value: 5, label: 'Пт' },
    { value: 6, label: 'Сб' },
    { value: 7, label: 'Вс' },
];

const FREQUENCIES = [
    { value: 'once', label: 'Не повторяется' },
    { value: 'daily', label: 'Каждый день' },
    { value: 'weekly', label: 'Каждую неделю' },
    { value: 'monthly', label: 'Каждый месяц' },
    { value: 'yearly', label: 'Каждый год' },
];

const REMIND_OFFSETS = [
    { value: 0, label: 'В момент события' },
    { value: 15, label: 'За 15 минут' },
    { value: 60, label: 'За час' },
    { value: 1440, label: 'За день' },
];

const { inset, offsetTop } = useKeyboardInset();

const isOnline = ref(navigator.onLine);
const saving = ref(false);
const error = ref('');

const form = ref(props.event
    ? {
        title: props.event.title,
        color: props.event.color,
        startsOn: props.event.startsOn,
        time: props.event.time ?? '',
        frequency: props.event.frequency,
        repeatOn: [...(props.event.repeatOn ?? [])],
        endsOn: props.event.endsOn ?? '',
        forever: props.event.endsOn === null,
        remind: props.event.remind,
        remindMinutesBefore: props.event.remindMinutesBefore ?? 0,
    }
    : {
        title: '',
        color: EVENT_COLORS[0],
        startsOn: props.defaultDate,
        time: '',
        frequency: 'once',
        repeatOn: [],
        endsOn: '',
        forever: true,
        // Выключено по умолчанию: большинство событий — просто пометки, и push по каждой быстро
        // стал бы шумом, от которого отписываются целиком.
        remind: false,
        remindMinutesBefore: 0,
    });

const repeats = computed(() => form.value.frequency !== 'once');
const needsWeekdays = computed(() => form.value.frequency === 'weekly');
const needsMonthDays = computed(() => form.value.frequency === 'monthly');
// «За сколько» имеет смысл только у события со временем: событие на весь день напоминает о себе
// накануне вечером, и смещение к нему неприменимо.
const hasTime = computed(() => form.value.time !== '');

function toggleDay(list, value) {
    const index = list.indexOf(value);

    if (index === -1) {
        list.push(value);
    } else {
        list.splice(index, 1);
    }
}

const canSave = computed(() => {
    if (!form.value.title.trim()) {
        return false;
    }

    // Недельное без единого дня и месячное без единого числа раскрыть не во что — такое событие
    // просто не появилось бы в календаре, и сохранять его бессмысленно.
    if ((needsWeekdays.value || needsMonthDays.value) && form.value.repeatOn.length === 0) {
        return false;
    }

    return true;
});

async function submit() {
    saving.value = true;
    error.value = '';

    try {
        const payload = {
            title: form.value.title,
            color: form.value.color,
            starts_on: form.value.startsOn,
            time: form.value.time || null,
            frequency: form.value.frequency,
            repeat_on: needsWeekdays.value || needsMonthDays.value ? form.value.repeatOn : null,
            ends_on: repeats.value && !form.value.forever ? (form.value.endsOn || null) : null,
            remind: form.value.remind,
            remind_minutes_before: form.value.remind && hasTime.value ? form.value.remindMinutesBefore : null,
        };

        const saved = await request(
            props.event ? `/api/events/${props.event.id}` : '/api/events',
            props.event ? 'PUT' : 'POST',
            payload,
        );

        // Кладём в локальную копию сразу, не дожидаясь следующей синхронизации: иначе только что
        // созданное событие не появилось бы в сетке до перезагрузки.
        await putEvents([saved]);
        emit('saved');
    } catch (e) {
        error.value = e.message;
    } finally {
        saving.value = false;
    }
}

async function remove() {
    saving.value = true;
    error.value = '';

    try {
        const deleted = await request(`/api/events/${props.event.id}`, 'DELETE');

        // Ответ приходит с признаком deleted — putEvents по нему вычистит строку.
        await putEvents([deleted]);
        emit('saved');
    } catch (e) {
        error.value = e.message;
    } finally {
        saving.value = false;
    }
}

async function request(url, method, body) {
    const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(Object.values(data.errors ?? {}).flat().join(' ') || 'Не удалось сохранить.');
    }

    return data;
}

function onKeydown(event) {
    if (event.key === 'Escape') {
        emit('close');
    }
}

function goOnline() {
    isOnline.value = true;
}

function goOffline() {
    isOnline.value = false;
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
});

onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
});
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            :aria-label="event ? 'Изменить событие' : 'Новое событие'"
            :style="{ paddingTop: `${offsetTop}px`, paddingBottom: `${inset}px` }"
            @click.self="emit('close')"
        >
            <div class="flex h-full w-full flex-col bg-paper shadow-xl sm:h-auto sm:max-h-[85dvh] sm:max-w-lg sm:rounded-xl sm:ring-1 sm:ring-paper-line/70">
                <header class="flex shrink-0 items-center justify-between border-b border-paper-line/50 px-4 py-2">
                    <div class="flex min-w-0 items-center gap-2">
                        <h2 class="truncate text-sm font-bold text-ink">{{ event ? 'Событие' : 'Новое событие' }}</h2>

                        <!-- Функционал помечен как бета: он новый, и часть обещанного ещё не
                             работает — напоминания сохраняются, но уведомления пока не приходят
                             (доставка push не построена, см. README). Метка честнее, чем молча
                             оставить переключатель, который ничего не делает. -->
                        <span class="shrink-0 rounded-full bg-paper-line/40 px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-ink-muted uppercase">
                            beta
                        </span>
                    </div>

                    <button
                        type="button"
                        aria-label="Закрыть"
                        class="flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-today hover:text-ink"
                        @click="emit('close')"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </header>

                <form class="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-3 sm:grow-0 sm:basis-auto" @submit.prevent="submit">
                    <p v-if="!isOnline" class="rounded-lg border border-accent-dark bg-today px-3 py-2 text-xs text-ink">
                        Офлайн — создавать и менять события пока нельзя. Появится сеть — снова можно.
                    </p>

                    <p v-if="error" class="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{{ error }}</p>

                    <div>
                        <label class="mb-1 block text-xs font-semibold text-ink">Название</label>
                        <input
                            v-model="form.title"
                            type="text"
                            placeholder="Например, тренировка"
                            class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-base text-ink outline-none focus:border-accent-dark"
                        >
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <div>
                            <label class="mb-1 block text-xs font-semibold text-ink">Дата</label>
                            <input
                                v-model="form.startsOn"
                                type="date"
                                class="rounded-lg border border-paper-line bg-paper px-3 py-2 text-base text-ink outline-none focus:border-accent-dark"
                            >
                        </div>

                        <div>
                            <label class="mb-1 block text-xs font-semibold text-ink">Время</label>
                            <input
                                v-model="form.time"
                                type="time"
                                class="rounded-lg border border-paper-line bg-paper px-3 py-2 text-base text-ink outline-none focus:border-accent-dark"
                            >
                            <p class="mt-1 text-xs text-ink-muted">Пусто — событие на весь день</p>
                        </div>
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-semibold text-ink">Повторение</label>
                        <div class="flex flex-wrap gap-1">
                            <button
                                v-for="item in FREQUENCIES"
                                :key="item.value"
                                type="button"
                                class="rounded-full px-3 py-1.5 text-sm transition-colors"
                                :class="form.frequency === item.value ? 'bg-accent text-ink' : 'bg-paper text-ink-muted ring-1 ring-paper-line hover:text-ink'"
                                @click="form.frequency = item.value"
                            >
                                {{ item.label }}
                            </button>
                        </div>
                    </div>

                    <div v-if="needsWeekdays">
                        <label class="mb-1 block text-xs font-semibold text-ink">По каким дням</label>
                        <div class="flex flex-wrap gap-1">
                            <button
                                v-for="day in WEEKDAYS"
                                :key="day.value"
                                type="button"
                                class="h-10 w-10 rounded-full text-sm transition-colors"
                                :class="form.repeatOn.includes(day.value) ? 'bg-accent text-ink' : 'bg-paper text-ink-muted ring-1 ring-paper-line hover:text-ink'"
                                @click="toggleDay(form.repeatOn, day.value)"
                            >
                                {{ day.label }}
                            </button>
                        </div>
                    </div>

                    <div v-if="needsMonthDays">
                        <label class="mb-1 block text-xs font-semibold text-ink">По каким числам</label>
                        <div class="flex flex-wrap gap-1">
                            <button
                                v-for="n in 31"
                                :key="n"
                                type="button"
                                class="h-9 w-9 rounded-full text-xs transition-colors"
                                :class="form.repeatOn.includes(n) ? 'bg-accent text-ink' : 'bg-paper text-ink-muted ring-1 ring-paper-line hover:text-ink'"
                                @click="toggleDay(form.repeatOn, n)"
                            >
                                {{ n }}
                            </button>
                        </div>
                        <p class="mt-1 text-xs text-ink-muted">
                            В коротких месяцах лишние числа сдвигаются на последний день. Выбрав 31-е,
                            получите «последний день месяца» для любого месяца.
                        </p>
                    </div>

                    <div v-if="repeats">
                        <label class="flex items-center gap-2 text-sm text-ink">
                            <input v-model="form.forever" type="checkbox" class="accent-accent-dark">
                            Бессрочно
                        </label>

                        <div v-if="!form.forever" class="mt-2">
                            <label class="mb-1 block text-xs font-semibold text-ink">Заканчивается</label>
                            <input
                                v-model="form.endsOn"
                                type="date"
                                class="rounded-lg border border-paper-line bg-paper px-3 py-2 text-base text-ink outline-none focus:border-accent-dark"
                            >
                        </div>
                    </div>

                    <div>
                        <label class="mb-1 block text-xs font-semibold text-ink">Цвет</label>
                        <div class="flex flex-wrap gap-2">
                            <button
                                v-for="color in EVENT_COLORS"
                                :key="color"
                                type="button"
                                :aria-label="color"
                                class="h-8 w-8 rounded-full transition-transform"
                                :class="[eventColorClass(color), form.color === color ? 'ring-2 ring-ink scale-110' : 'ring-1 ring-paper-line']"
                                @click="form.color = color"
                            ></button>
                        </div>
                    </div>

                    <div class="border-t border-paper-line/50 pt-3">
                        <label class="flex items-center gap-2 text-sm text-ink">
                            <input v-model="form.remind" type="checkbox" class="accent-accent-dark">
                            Напомнить
                        </label>

                        <!-- «За сколько» показываем только у события со временем: у события на весь
                             день предупреждать не от чего, оно напомнит о себе накануне в 20:00. -->
                        <div v-if="form.remind && hasTime" class="mt-2 flex flex-wrap gap-1">
                            <button
                                v-for="item in REMIND_OFFSETS"
                                :key="item.value"
                                type="button"
                                class="rounded-full px-3 py-1.5 text-sm transition-colors"
                                :class="form.remindMinutesBefore === item.value ? 'bg-accent text-ink' : 'bg-paper text-ink-muted ring-1 ring-paper-line hover:text-ink'"
                                @click="form.remindMinutesBefore = item.value"
                            >
                                {{ item.label }}
                            </button>
                        </div>

                        <p v-else-if="form.remind" class="mt-1 text-xs text-ink-muted">
                            У события на весь день напоминание приходит накануне в 20:00.
                        </p>

                        <p class="mt-2 text-xs text-ink-muted">
                            Уведомления приходят только в приложении, добавленном на домашний экран,
                            и не гарантируют точность до минуты.
                        </p>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-1">
                        <button
                            v-if="event && isOnline"
                            type="button"
                            :disabled="saving"
                            class="rounded-full px-3 py-2 text-sm text-error hover:underline disabled:opacity-60"
                            @click="remove"
                        >
                            Удалить
                        </button>
                        <span v-else></span>

                        <button
                            type="submit"
                            :disabled="saving || !canSave || !isOnline"
                            class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
                        >
                            Сохранить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Teleport>
</template>
