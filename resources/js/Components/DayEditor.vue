<script setup>
import { onBeforeUnmount } from 'vue';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { parseMarkdown, serializeDoc } from '@/markdown.js';
import EventStrips from '@/Components/EventStrips.vue';

const props = defineProps({
    /** Содержимое дня в markdown — то же, что лежит в days.content. */
    modelValue: { type: String, default: '' },
    /** Повторяющиеся события этого дня — показываются над текстом, но не являются его частью. */
    events: { type: Array, default: () => [] },
});

const emit = defineEmits(['update:modelValue', 'pickEvent']);

const editor = useEditor({
    // Документ задаётся один раз, при создании. Следить за внешними изменениями пропса не нужно:
    // пока модалка открыта, Now.vue намеренно не трогает редактируемый день (см. applyLocalDays),
    // а на другой день модалка пересоздаётся по :key.
    content: parseMarkdown(props.modelValue),
    extensions: [
        // Выключено всё, чего нет в нашем подмножестве markdown (см. resources/js/markdown.js и
        // «Вне рамок MVP» в README). Это не про вкусы: сериализатор такие узлы не знает и при
        // сохранении молча превратил бы их в обычный текст — то есть потерял бы оформление,
        // которое пользователь только что поставил. Чего нельзя сохранить — того нельзя и создать.
        StarterKit.configure({
            heading: false,
            blockquote: false,
            codeBlock: false,
            code: false,
            horizontalRule: false,
            strike: false,
            underline: false,
            link: false,
            // Перенос по Shift+Enter — отдельный узел, которого в markdown-подмножестве нет.
            // Обычного Enter достаточно.
            hardBreak: false,
        }),
        TaskList,
        // nested: вложенность списков поддержана и в сериализаторе, так что Tab не потеряется.
        TaskItem.configure({ nested: true }),
    ],
    onUpdate({ editor: instance }) {
        emit('update:modelValue', serializeDoc(instance.getJSON()));
    },
});

// Редактор ProseMirror живёт вне реактивности Vue, его нужно погасить руками.
onBeforeUnmount(() => editor.value?.destroy());

defineExpose({ focus: () => editor.value?.commands.focus('end') });
</script>

<template>
    <!-- min-w-0 обязателен: это флекс-элемент, а у них min-width по умолчанию auto — без явного
         нуля содержимое не даёт колонке ужаться, и длинная строка раздвигает окно вместо переноса. -->
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
        <!-- Вертикальные отступы обязаны быть кратны --line-h: разлиновка рисуется от верха padding
             box, поэтому произвольный отступ (был py-3 при шаге 24px) сдвигает линии относительно
             строк на полстроки. py-6 — ровно один шаг. Горизонтальные на ритм не влияют.
             leading-6 закрепляет высоту строки за --line-h, а не оставляет её на усмотрение
             унаследованного значения; text-base заодно убирает автозум iOS при фокусе, который
             срабатывает на поле со шрифтом мельче 16px.

             basis в десять строк, а не min-height: на большом экране окно подстраивается под
             содержимое (sm:h-auto у карточки), и у пустого дня это была всего пара строк — писать
             неудобно. Но именно предпочитаемый размер, а не минимальный: когда высоты мало
             (телефон в альбомной ориентации с открытой клавиатурой), поле обязано ужаться, иначе
             оно выдавило бы панель форматирования за нижний край окна. grow/shrink по отдельности,
             а не flex-1 — иначе сокращение flex перебило бы basis собственным нулём. -->
        <!-- Прокручивается вся область целиком, вместе с полосками событий: в окне редактирования
             они привязаны к тексту и уезжают вместе с ним — в отличие от клетки недели, где стоят
             неподвижно вне прокрутки. Поэтому overflow переехал с самого редактора на эту обёртку.
             EditorContent внутри — grow shrink-0: при короткой записи разлинованный лист всё равно
             заполняет окно, при длинной не сжимается, а прокручивается. -->
        <div class="no-scrollbar flex min-h-0 min-w-0 shrink grow basis-[calc(10*var(--line-h))] flex-col overflow-y-auto overscroll-contain [--line-h:1.5rem]">
            <EventStrips v-if="events.length" :events="events" class="shrink-0 px-4 pt-3" @pick="emit('pickEvent', $event)" />

            <EditorContent
                v-if="editor"
                :editor="editor"
                class="day-editor ruled-paper shrink-0 grow px-4 py-6 text-base leading-6"
            />
        </div>

        <!-- Подвал собирает вызывающий: там рядом стоят и кнопки форматирования, и «Готово»,
             которое принадлежит окну, а не редактору. Экземпляр редактора отдаём слоту — панели
             он нужен, чтобы выполнять команды и подсвечивать активное начертание.
             Отдельно позиционировать подвал не нужно: над клавиатурой он оказывается сам, потому
             что окно ужимается до видимой области экрана (см. DayModal). -->
        <slot v-if="editor" name="footer" :editor="editor" />
    </div>
</template>
