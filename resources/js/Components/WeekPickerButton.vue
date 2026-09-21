<script setup>
import { ref } from 'vue';

/**
 * Кнопка, открывающая системный выбор даты, — быстрый переход к неделе.
 *
 * Системный, а не самописный календарь: на телефоне он привычнее, умеет листать годы и учитывает
 * настройки локали (см. README, «Экран «Неделя»»). Попадать ровно в понедельник пользователю не
 * нужно — неделю из выбранного дня считает вызывающий.
 *
 * Отдельным компонентом, потому что кнопок таких две (в шапке и в нижней панели), а поле даты у
 * каждой должно быть своё: showPicker() показывает календарь рядом с полем, и одно общее поле
 * означало бы, что календарь открывается вверху экрана независимо от того, где нажали.
 */
defineOptions({ inheritAttrs: false });

defineProps({
    /** Дата, на которой открывается календарь, 'YYYY-MM-DD'. */
    value: { type: String, default: '' },
    label: { type: String, default: 'Выбрать неделю по дате' },
    iconClass: { type: String, default: 'h-4 w-4' },
});

const emit = defineEmits(['pick']);

const inputRef = ref(null);

function open() {
    const input = inputRef.value;

    if (!input) {
        return;
    }

    try {
        input.showPicker();
    } catch {
        // Браузер без showPicker (или запретивший вызов) — обычный клик по полю открывает
        // календарь почти везде, это запасной путь, а не ошибка.
        input.click();
    }
}
</script>

<template>
    <span class="relative inline-flex">
        <!-- Атрибуты вызывающего (в первую очередь классы) уходят на саму кнопку, а не на эту
             обёртку: обёртка нужна только как система координат для поля ниже. -->
        <button type="button" :aria-label="label" :title="label" v-bind="$attrs" @click="open">
            <slot />

            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="iconClass" class="shrink-0">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
        </button>

        <!-- Поле скрыто прозрачностью и нулевым размером, а не display:none: showPicker() требует,
             чтобы элемент действительно отрисовывался, иначе бросает исключение.
             tabindex/aria-hidden — чтобы у одного действия не было двух точек фокуса: клавиатурой
             сюда попадают через кнопку выше, Enter по ней считается жестом пользователя. -->
        <input
            ref="inputRef"
            type="date"
            tabindex="-1"
            aria-hidden="true"
            class="pointer-events-none absolute bottom-0 left-1/2 h-px w-px opacity-0"
            :value="value"
            @change="emit('pick', $event.target.value)"
        >
    </span>
</template>
