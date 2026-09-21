<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import DayEditor from '@/Components/DayEditor.vue';
import EditorToolbar from '@/Components/EditorToolbar.vue';
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
                 половину высоты. На большом экране — лист по центру.
                 h-full, а не h-dvh: высоту задаёт обёртка выше, уже с вычтенной клавиатурой. -->
            <div class="flex h-full w-full flex-col bg-paper shadow-xl sm:h-auto sm:max-h-[80dvh] sm:max-w-xl sm:rounded-xl sm:ring-1 sm:ring-paper-line/70">
                <!-- Шапка только подписывает день. Кнопка закрытия переехала в подвал, поэтому
                     высоту здесь больше не задаёт 44-пиксельная зона нажатия — остаётся одна
                     строка текста. -->
                <header class="shrink-0 border-b border-paper-line/50 px-4 py-2">
                    <h2 class="text-sm font-bold text-ink">{{ title }}</h2>
                </header>

                <!-- Без отступов: их держит сам редактор, а панель внизу должна идти во всю
                     ширину окна, вровень с шапкой. -->
                <div class="flex min-h-0 flex-1">
                    <DayEditor
                        ref="editorRef"
                        :model-value="modelValue"
                        @update:model-value="emit('update:modelValue', $event)"
                    >
                        <template #footer="{ editor }">
                            <div class="flex shrink-0 items-center gap-2 border-t border-paper-line/50 px-2 py-1">
                                <!-- «Готово», а не «Закрыть»: закрытие окна и есть завершение
                                     правки — Now.vue на него досохраняет день. Отсюда галочка,
                                     а не крестик.
                                     Заливки намеренно нет: акцентным фоном у кнопок панели
                                     помечается включённое начертание, и залитая кнопка читалась
                                     бы как нажатая. Достаточно тонкого контура — он отделяет её
                                     от кнопок форматирования, не притворяясь состоянием. -->
                                <button
                                    type="button"
                                    aria-label="Готово"
                                    title="Готово"
                                    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted ring-1 ring-paper-line/70 transition-colors hover:bg-today hover:text-ink"
                                    @click="emit('close')"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5">
                                        <path d="M5 12.5l4.5 4.5L19 7" />
                                    </svg>
                                </button>

                                <span class="h-6 w-px shrink-0 bg-paper-line/60" aria-hidden="true"></span>

                                <!-- overflow-x: на совсем узком экране шесть зон нажатия по 44px
                                     могут не поместиться в строку — пусть тогда прокручиваются,
                                     а не выдавливают друг друга. -->
                                <EditorToolbar :editor="editor" class="no-scrollbar min-w-0 flex-1 overflow-x-auto" />
                            </div>
                        </template>
                    </DayEditor>
                </div>
            </div>
        </div>
    </Teleport>
</template>
