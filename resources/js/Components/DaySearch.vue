<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import debounce from 'lodash/debounce';
import { SEARCH_MIN_LENGTH, searchDays } from '@/offline/db.js';
import { formatFullDate } from '@/week.js';
import { useKeyboardInset } from '@/composables/useKeyboardInset.js';
import RichText from '@/Components/RichText.vue';

/**
 * Поиск по содержимому дней.
 *
 * Ищет по локальной копии в IndexedDB, и онлайн тоже — серверного поиска нет и не нужно: после
 * первой синхронизации там лежит весь корпус записей, а не только просмотренные недели (см.
 * searchDays в offline/db.js). Поэтому офлайн работает ровно так же, без отдельной ветки.
 */

const emit = defineEmits(['pick', 'close']);

const query = ref('');
const results = ref([]);
const searching = ref(false);
const isOnline = ref(navigator.onLine);
const inputRef = ref(null);

// Окно живёт в видимой части экрана, а не во всём viewport — иначе на телефоне клавиатура
// закрывала бы нижнюю половину списка. Тот же приём, что в DayModal.
const { inset, offsetTop } = useKeyboardInset();

// Гонка «пользователь печатает быстрее, чем идёт перебор»: у длинной истории поиск занимает
// заметное время, и ответ на прошлый запрос не должен затереть список более свежего.
let runToken = 0;

const run = debounce(async (value) => {
    const token = ++runToken;
    const found = await searchDays(value);

    if (token !== runToken) {
        return;
    }

    results.value = found;
    searching.value = false;
}, 250);

watch(query, (value) => {
    if (value.trim().length < SEARCH_MIN_LENGTH) {
        run.cancel();
        runToken += 1;
        results.value = [];
        searching.value = false;
        return;
    }

    searching.value = true;
    run(value);
});

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
    inputRef.value?.focus();
});

onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown);
    window.removeEventListener('online', goOnline);
    window.removeEventListener('offline', goOffline);
    run.cancel();
});
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label="Поиск по записям"
            :style="{ paddingTop: `${offsetTop}px`, paddingBottom: `${inset}px` }"
            @click.self="emit('close')"
        >
            <div class="flex h-full w-full flex-col bg-paper shadow-xl sm:h-auto sm:max-h-[75dvh] sm:max-w-xl sm:rounded-xl sm:ring-1 sm:ring-paper-line/70">
                <header class="flex shrink-0 items-center gap-2 border-b border-paper-line/50 px-3 py-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 shrink-0 text-ink-muted">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20l-4-4" />
                    </svg>

                    <!-- text-base, а не мельче: iOS увеличивает масштаб при фокусе на поле со
                         шрифтом меньше 16px, и открытие поиска дёргало бы страницу. -->
                    <input
                        ref="inputRef"
                        v-model="query"
                        type="search"
                        placeholder="Сейчас как найдём?"
                        aria-label="Поисковый запрос"
                        class="min-w-0 flex-1 bg-transparent py-1 text-base text-ink outline-none placeholder:text-ink-muted/70"
                    >

                    <button
                        type="button"
                        aria-label="Закрыть поиск"
                        title="Закрыть поиск"
                        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-today hover:text-ink"
                        @click="emit('close')"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="h-5 w-5">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </header>

                <!--
                     Поведение по высоте разное на телефоне и на большом экране, и оба намеренные.

                     Телефон: окно во весь экран, поэтому flex-1 — список занимает всё, что осталось
                     под шапкой.

                     Большой экран: окно растёт под содержимое (у карточки sm:h-auto), поэтому
                     grow-0 + basis-auto — высота списка равна высоте результатов. Пустой поиск даёт
                     компактное окно, результаты его раздвигают, а на sm:max-h-[75dvh] рост
                     упирается, список сжимается (shrink остаётся) и включает прокрутку.

                     Именно basis-auto, а не flex-1: у flex-1 базовый размер ноль, и в контейнере с
                     автоматической высотой он даёт невнятный результат — ровно та ловушка, из-за
                     которой пустой день в редакторе открывался на две строки (см. DayEditor).
                -->
                <div class="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:grow-0 sm:basis-auto">
                    <p v-if="!isOnline" class="mb-3 rounded-lg border border-accent-dark bg-today px-3 py-2 text-xs text-ink">
                        Офлайн — ищем по записям, загруженным на это устройство. Всё, что появилось
                        на других устройствах позже, найдётся после синхронизации.
                    </p>

                    <!-- Состояния вынесены во внешний template не для красоты: без него при пустом
                         поле срабатывала бы ветка «ничего не нашлось», хотя ничего ещё и не искали.
                         У каждого свой текст — пустой экран без объяснения читается как поломка. -->
                    <template v-if="query.trim().length >= SEARCH_MIN_LENGTH">
                        <p v-if="searching" class="text-sm text-ink-muted">Ищем…</p>

                        <p v-else-if="results.length === 0" class="text-sm text-ink-muted">
                            Ничего не нашлось. Попробуйте другое слово или его часть — поиск ищет по
                            кусочку, а не по целому слову.
                        </p>

                        <div v-else class="flex flex-col gap-2">
                            <!-- Результат — та же клетка дня, что и в сетке недели: разлинованная
                                 бумага, поля слева, то же содержимое через RichText. -->
                            <button
                                v-for="day in results"
                                :key="day.date"
                                type="button"
                                class="ruled-margin block w-full cursor-pointer overflow-hidden rounded-lg bg-paper p-2 text-left shadow-sm ring-1 ring-paper-line/70 transition-colors hover:ring-accent-dark sm:p-3"
                                @click="emit('pick', day.date)"
                            >
                                <header class="mb-1 text-xs font-bold text-ink">{{ formatFullDate(day.date) }}</header>

                                <!-- Длинная запись обрезается по высоте: список должен оставаться
                                     списком. Ограничение кратно шагу линовки, иначе последняя
                                     видимая строка резалась бы пополам. -->
                                <div class="ruled-paper max-h-[calc(6*1.5rem)] overflow-hidden [--line-h:1.5rem]">
                                    <RichText :content="day.content" class="text-sm leading-6 text-ink-muted" />
                                </div>
                            </button>
                        </div>
                    </template>

                    <!-- Только когда человек уже начал вводить: при пустом поле подсказка
                         дублировала бы placeholder, а тут объясняет, почему поиск ещё молчит.
                         Число словом согласовано с SEARCH_MIN_LENGTH в offline/db.js. -->
                    <p v-else-if="query.trim().length > 0" class="text-sm text-ink-muted">
                        Введите хотя бы две буквы — по одной совпадений слишком много 🫣
                    </p>
                </div>
            </div>
        </div>
    </Teleport>
</template>
