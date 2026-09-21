<script setup>
defineProps({
    /** Экземпляр редактора Tiptap. */
    editor: { type: Object, required: true },
});

// Набор ровно тот, что описан в ТЗ («списки, выделения»), плюс чекбоксы по просьбе пользователей.
// Отмену/повтор не выносим: их закрывают сочетания клавиш и системное меню, а место на полосе
// над клавиатурой дорогое.
const ACTIONS = [
    { name: 'bold', label: 'Полужирный', glyph: 'Ж', glyphClass: 'font-bold' },
    { name: 'italic', label: 'Курсив', glyph: 'К', glyphClass: 'italic' },
    { name: 'bulletList', label: 'Маркированный список' },
    { name: 'orderedList', label: 'Нумерованный список' },
    { name: 'taskList', label: 'Список задач' },
];

// toggleBold, toggleBulletList и т.д. — имена команд Tiptap собираются из имени действия.
function toggle(editor, name) {
    const command = `toggle${name.charAt(0).toUpperCase()}${name.slice(1)}`;

    editor.chain().focus()[command]().run();
}
</script>

<template>
    <div class="flex flex-row justify-center gap-1" role="toolbar" aria-label="Форматирование">
        <button
            v-for="action in ACTIONS"
            :key="action.name"
            type="button"
            :aria-label="action.label"
            :title="action.label"
            :aria-pressed="editor.isActive(action.name)"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-today hover:text-ink"
            :class="editor.isActive(action.name) ? 'bg-accent text-ink' : ''"
            @mousedown.prevent
            @click="toggle(editor, action.name)"
        >
            <!-- mousedown.prevent выше обязателен: без него нажатие уводит фокус из редактора,
                 а на телефоне вместе с фокусом закрывается клавиатура — панель «прыгала» бы вниз
                 при каждом нажатии. -->
            <span v-if="action.glyph" class="text-lg leading-none" :class="action.glyphClass">{{ action.glyph }}</span>

            <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="h-5 w-5"
            >
                <template v-if="action.name === 'bulletList'">
                    <circle cx="4" cy="7" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="4" cy="17" r="1.2" fill="currentColor" stroke="none" />
                    <path d="M9 7h11M9 12h11M9 17h11" />
                </template>

                <template v-else-if="action.name === 'orderedList'">
                    <path d="M9 7h11M9 12h11M9 17h11" />
                    <path d="M3 6.5l1-.5v3M3 16.5h2l-2 2.5h2" stroke-width="1.5" />
                </template>

                <template v-else>
                    <rect x="3" y="4.5" width="6.5" height="6.5" rx="1.5" />
                    <path d="M4.6 7.75l1.3 1.3 2.3-2.5" stroke-width="1.5" />
                    <rect x="3" y="13" width="6.5" height="6.5" rx="1.5" />
                    <path d="M13 8h8M13 16.5h8" />
                </template>
            </svg>
        </button>
    </div>
</template>
