<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { router } from '@inertiajs/vue3';
import { xsrfToken } from '@/csrf.js';
import { getAllDays, markSynced, putCleanDays, putDirtyDay } from '@/offline/db.js';
import { syncNow } from '@/offline/sync.js';
import AppLayout from '@/Layouts/AppLayout.vue';

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

const isOnline = ref(navigator.onLine);
const editableDays = reactive(props.days.map((day) => ({ ...day })));
const pendingSaves = reactive({});
const editingDate = ref(null);

window.addEventListener('online', () => { isOnline.value = true; });
window.addEventListener('offline', () => { isOnline.value = false; });

onMounted(async () => {
    if (navigator.onLine) {
        // Пропсы пришли живыми с сервера — кэшируем их как «чистые» на случай, если именно эта
        // неделя понадобится офлайн, и заодно пробуем отправить любые старые неотправленные правки.
        await putCleanDays(props.days.map((day) => ({ date: day.date, content: day.content, updatedAt: day.updatedAt })));
        syncNow();
        return;
    }

    // Офлайн: эти пропсы могли прийти из закэшированной service worker'ом HTML-страницы
    // (см. runtimeCaching в vite.config.js) — то есть это снимок на момент последнего успешного
    // онлайн-визита, а не текущее состояние. Настоящее последнее известное состояние (включая ещё
    // не отправленные правки) лежит в IndexedDB — подменяем им отображаемые данные.
    const cached = await getAllDays();
    const byDate = new Map(cached.map((day) => [day.date, day]));

    editableDays.forEach((day) => {
        const local = byDate.get(day.date);
        if (local) {
            day.content = local.content;
            day.updatedAt = local.updatedAt;
        }
    });
});

function dayByWeekday(n) {
    return editableDays.find((d) => d.weekday === n);
}

const monday = computed(() => dayByWeekday(1));
const tuesday = computed(() => dayByWeekday(2));
const wednesday = computed(() => dayByWeekday(3));
const thursday = computed(() => dayByWeekday(4));
const friday = computed(() => dayByWeekday(5));
const saturday = computed(() => dayByWeekday(6));
const sunday = computed(() => dayByWeekday(7));

function previewLines(day, max) {
    return (day.content ?? '').split('\n').slice(0, max);
}

async function saveDay(day) {
    const updatedAt = new Date().toISOString();
    pendingSaves[day.date] = true;

    // Пишем локально первым делом и всегда — так правка не теряется, даже если запрос ниже не
    // дойдёт до сервера.
    await putDirtyDay(day.date, day.content, updatedAt);

    try {
        const response = await fetch(`/api/days/${day.date}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            body: JSON.stringify({ content: day.content }),
        });

        if (!response.ok) {
            throw new Error('save failed');
        }

        const data = await response.json();
        await markSynced(day.date, data.content, data.updatedAt);
        day.updatedAt = data.updatedAt;
    } catch (e) {
        // Нет сети или сервер недоступен — правка остаётся в IndexedDB помеченной dirty, её отправит
        // фоновая синхронизация при восстановлении связи (см. offline/sync.js).
    } finally {
        delete pendingSaves[day.date];
    }
}

function openDay(day) {
    editingDate.value = day.date;
}

function closeDay(day) {
    editingDate.value = null;
    saveDay(day);
}

// Переключение недели переиспользует уже готовый /now?date= на бэкенде (см. NowController) —
// достаточно передать любую дату внутри целевой недели, сервер сам посчитает её границы.
function goToWeek(offsetDays) {
    const next = new Date(`${props.weekStart}T00:00:00`);
    next.setDate(next.getDate() + offsetDays);

    // Не toISOString() — он переводит в UTC, а для часовых поясов восточнее UTC (Москва и т.п.)
    // локальная полночь — это ещё предыдущий день по UTC, дата съезжает на сутки назад.
    const y = next.getFullYear();
    const m = String(next.getMonth() + 1).padStart(2, '0');
    const d = String(next.getDate()).padStart(2, '0');
    router.get('/now', { date: `${y}-${m}-${d}` }, { preserveScroll: true });
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
    <AppLayout>
        <div class="Now NowPage flex h-full min-h-0 flex-col">
            <p
                v-if="!isOnline"
                class="mb-4 shrink-0 rounded-lg border border-accent-dark bg-today px-4 py-2 text-sm font-semibold text-ink"
            >
                Офлайн — показаны последние сохранённые данные, правки отправятся при восстановлении сети.
            </p>

            <h1 class="mb-2 shrink-0 text-base font-bold text-ink sm:text-xl">
                {{ MONTHS[month - 1] }} {{ year }}
                <span class="font-normal text-ink-muted">— неделя {{ week }}</span>
            </h1>

            <div
                class="grid min-h-0 flex-1 grid-cols-2 grid-rows-3 grid-flow-col gap-1.5 sm:gap-3 md:gap-4"
                @touchstart.passive="onTouchStart"
                @touchend.passive="onTouchEnd"
            >
                <template v-for="day in [monday, tuesday, wednesday]" :key="day.date">
                    <article
                        class="ruled-margin flex min-h-0 cursor-text flex-col overflow-hidden rounded-lg bg-paper p-1.5 shadow-sm ring-1 ring-paper-line/70 sm:p-3"
                        :class="{ 'ring-2 ring-accent-dark bg-today/60': day.isToday }"
                        @click="!editingDate && openDay(day)"
                    >
                        <header class="mb-0.5 flex items-baseline justify-between text-xs font-bold text-ink sm:mb-1 sm:text-sm">
                            <span>{{ WEEKDAY_LABELS[day.weekday - 1] }}</span>
                            <span class="font-normal text-ink-muted">{{ day.date.slice(8, 10) }}.{{ day.date.slice(5, 7) }}</span>
                        </header>

                        <div class="ruled-paper min-h-0 flex-1 overflow-hidden [--line-h:1rem] sm:[--line-h:1.5rem]">
                            <textarea
                                v-if="editingDate === day.date"
                                v-model="day.content"
                                :ref="(el) => el?.focus()"
                                class="h-full w-full resize-none bg-transparent font-sans text-xs leading-4 text-ink outline-none sm:text-sm sm:leading-6"
                                @click.stop
                                @blur="closeDay(day)"
                            ></textarea>
                            <div v-else class="text-xs text-ink-muted sm:text-sm">
                                <div v-if="!day.content" class="italic leading-4 text-ink-muted/60 sm:leading-6">пусто…</div>
                            <div v-for="(line, i) in previewLines(day, 6)" :key="i" class="truncate leading-4 sm:leading-6">{{ line || ' ' }}</div>
                        </div>
                        </div>

                        <span v-if="pendingSaves[day.date]" class="mt-1 text-xs text-ink-muted">Сохранение…</span>
                    </article>
                </template>

                <template v-for="day in [thursday, friday]" :key="day.date">
                    <article
                        class="ruled-margin flex min-h-0 cursor-text flex-col overflow-hidden rounded-lg bg-paper p-1.5 shadow-sm ring-1 ring-paper-line/70 sm:p-3"
                        :class="{ 'ring-2 ring-accent-dark bg-today/60': day.isToday }"
                        @click="!editingDate && openDay(day)"
                    >
                        <header class="mb-0.5 flex items-baseline justify-between text-xs font-bold text-ink sm:mb-1 sm:text-sm">
                            <span>{{ WEEKDAY_LABELS[day.weekday - 1] }}</span>
                            <span class="font-normal text-ink-muted">{{ day.date.slice(8, 10) }}.{{ day.date.slice(5, 7) }}</span>
                        </header>

                        <div class="ruled-paper min-h-0 flex-1 overflow-hidden [--line-h:1rem] sm:[--line-h:1.5rem]">
                            <textarea
                                v-if="editingDate === day.date"
                                v-model="day.content"
                                :ref="(el) => el?.focus()"
                                class="h-full w-full resize-none bg-transparent font-sans text-xs leading-4 text-ink outline-none sm:text-sm sm:leading-6"
                                @click.stop
                                @blur="closeDay(day)"
                            ></textarea>
                            <div v-else class="text-xs text-ink-muted sm:text-sm">
                                <div v-if="!day.content" class="italic leading-4 text-ink-muted/60 sm:leading-6">пусто…</div>
                            <div v-for="(line, i) in previewLines(day, 6)" :key="i" class="truncate leading-4 sm:leading-6">{{ line || ' ' }}</div>
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
                        class="ruled-margin flex min-h-0 cursor-text flex-col overflow-hidden rounded-lg bg-paper p-1 shadow-sm ring-1 ring-paper-line/70 sm:p-2.5"
                        :class="{ 'ring-2 ring-accent-dark bg-today/60': day.isToday }"
                        @click="!editingDate && openDay(day)"
                    >
                        <header class="mb-0.5 flex items-baseline justify-between text-xs font-bold text-ink sm:text-sm">
                            <span>{{ WEEKDAY_LABELS[day.weekday - 1] }}</span>
                            <span class="font-normal text-ink-muted">{{ day.date.slice(8, 10) }}.{{ day.date.slice(5, 7) }}</span>
                        </header>

                        <div class="ruled-paper min-h-0 flex-1 overflow-hidden [--line-h:1rem] sm:[--line-h:1.5rem]">
                            <textarea
                                v-if="editingDate === day.date"
                                v-model="day.content"
                                :ref="(el) => el?.focus()"
                                class="h-full w-full resize-none bg-transparent font-sans text-xs leading-4 text-ink outline-none sm:text-sm sm:leading-6"
                                @click.stop
                                @blur="closeDay(day)"
                            ></textarea>
                            <div v-else class="text-xs text-ink-muted sm:text-sm">
                                <div v-if="!day.content" class="italic leading-4 text-ink-muted/60 sm:leading-6">пусто…</div>
                            <div v-for="(line, i) in previewLines(day, 3)" :key="i" class="truncate leading-4 sm:leading-6">{{ line || ' ' }}</div>
                        </div>
                        </div>

                        <span v-if="pendingSaves[day.date]" class="mt-1 text-xs text-ink-muted">Сохранение…</span>
                    </article>
                </div>
            </div>
        </div>

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
