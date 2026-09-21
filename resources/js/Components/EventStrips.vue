<script setup>
import { computed } from 'vue';
import { eventColorClass } from '@/events.js';

/**
 * Полоски повторяющихся событий одного дня.
 *
 * Одним компонентом на два места: в клетке недели полоски прижаты к низу и живут вне прокрутки
 * (жёстко привязаны к клетке), а в окне редактора стоят над текстом и прокручиваются вместе с ним.
 * Само расположение задаёт вызывающий — здесь только сами полоски.
 */
const props = defineProps({
    events: { type: Array, default: () => [] },
    /**
     * Сколько полосок показывать. В клетке недели место жёстко ограничено: полоски вне прокрутки,
     * и каждая отнимает высоту у записи. Поэтому лишние сворачиваются в «ещё N».
     * 0 — показывать все (окно редактора, где места достаточно).
     */
    limit: { type: Number, default: 0 },
    compact: { type: Boolean, default: false },
});

const emit = defineEmits(['pick']);

const visible = computed(() => (props.limit > 0 ? props.events.slice(0, props.limit) : props.events));
const hidden = computed(() => props.events.length - visible.value.length);
</script>

<template>
    <!-- Порядок показа задаёт eventsOn (сначала на весь день, затем по времени), поэтому обычный
         flex-col: сверху вниз — в том же порядке, в каком читают. Блок всё равно растёт вверх,
         потому что прижат к низу клетки. -->
    <div v-if="events.length" class="flex flex-col gap-px">
        <!-- Клик по полоске открывает само событие на правку: отдельного списка событий в
             приложении нет, и это единственный путь к нему. stop обязателен — иначе клик дошёл бы
             до клетки и открыл редактор дня. -->
        <button
            v-for="event in visible"
            :key="event.id"
            type="button"
            :title="event.title"
            class="flex w-full items-baseline gap-1 truncate rounded-sm px-1 text-left font-semibold text-ink transition-opacity hover:opacity-80"
            :class="[eventColorClass(event.color), compact ? 'text-[0.625rem] leading-4' : 'text-xs leading-5']"
            @click.stop="emit('pick', event)"
        >
            <span v-if="event.time" class="shrink-0 font-normal tabular-nums">{{ event.time }}</span>
            <span class="truncate">{{ event.title }}</span>
        </button>

        <span
            v-if="hidden > 0"
            class="truncate px-1 text-ink-muted"
            :class="compact ? 'text-[0.625rem] leading-4' : 'text-xs leading-5'"
        >
            ещё {{ hidden }}
        </span>
    </div>
</template>
