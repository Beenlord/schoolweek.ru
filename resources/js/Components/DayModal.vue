<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import DayEditor from '@/Components/DayEditor.vue';
import { useKeyboardInset } from '@/composables/useKeyboardInset.js';

defineProps({
    /** Подпись дня в шапке — «Понедельник, 22.09». Собирает вызывающий, модалка остаётся простой. */
    title: { type: String, required: true },
    /** Содержимое дня в markdown. */
    modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'close']);

const editorRef = ref(null);

// Окно живёт не во всём layout viewport, а ровно в видимой его части. Это и ставит панель
// форматирования над клавиатурой: подвал окна совпадает с её верхней кромкой. Отдельного
// `position: fixed` и вычисления сдвигов для самой панели при этом не нужно.
const { inset, offsetTop } = useKeyboardInset();

function onKeydown(event) {
    if (event.key === 'Escape') {
        emit('close');
    }
}

onMounted(() => {
    window.addEventListener('keydown', onKeydown);
    // Открыли день — значит собираются писать. Фокус в конец текста, а не в начало.
    editorRef.value?.focus();
});

onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
    <!-- Teleport в body: модалка не должна зависеть от родительских трансформаций. Сетка недели
         во время перелистывания применяет rotateY к своим половинам, а трансформированный предок
         ломает position: fixed у потомков. -->
    <Teleport to="body">
        <div
            class="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/30 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            :aria-label="title"
            :style="{ paddingTop: `${offsetTop}px`, paddingBottom: `${inset}px` }"
            @click.self="emit('close')"
        >
            <!-- На телефоне лист занимает экран целиком: клетка там мелкая, а клавиатура забирает
                 половину высоты. На большом экране — лист по центру, с местом справа под столбец
                 кнопок (см. DayEditor). -->
            <!-- h-full, а не h-dvh: высоту задаёт обёртка выше, уже с вычтенной клавиатурой. -->
            <div class="flex h-full w-full flex-col bg-paper shadow-xl sm:h-auto sm:max-h-[80dvh] sm:max-w-xl sm:rounded-xl sm:ring-1 sm:ring-paper-line/70">
                <header class="flex shrink-0 items-center justify-between border-b border-paper-line/50 px-4 py-3">
                    <h2 class="text-base font-bold text-ink">{{ title }}</h2>

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

                <!-- Без отступов: их держит сам редактор, а панель внизу должна идти во всю
                     ширину окна, вровень с шапкой. -->
                <div class="flex min-h-0 flex-1">
                    <DayEditor
                        ref="editorRef"
                        :model-value="modelValue"
                        @update:model-value="emit('update:modelValue', $event)"
                    />
                </div>
            </div>
        </div>
    </Teleport>
</template>
