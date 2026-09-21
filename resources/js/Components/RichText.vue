<script>
import { h } from 'vue';
import { parseMarkdown } from '@/markdown.js';

/**
 * Показ содержимого дня только на чтение — превью в сетке недели.
 *
 * Единственный компонент в проекте без <script setup> и без шаблона: дерево документа рекурсивно,
 * а рекурсия render-функцией короче и понятнее, чем компонент, ссылающийся сам на себя.
 *
 * Важное следствие выбранного способа: разметка собирается из vnode'ов через h(), а не через
 * v-html. Пользовательский текст физически не может стать HTML, поэтому отдельная санитизация от
 * XSS здесь не нужна — её нечем обходить. Это же снимает пункт «Санитизация markdown при рендере»
 * из README: задача решена не фильтром, а отсутствием места, куда фильтр был бы нужен.
 *
 * Шаг линовки не ломается: все блоки наследуют line-height контейнера (leading-4/leading-6 у
 * вызывающего), а отступы списков — горизонтальные, на вертикальный ритм они не влияют.
 */

function renderText(node) {
    const marks = new Set((node.marks ?? []).map((mark) => mark.type));
    let vnode = node.text ?? '';

    if (marks.has('italic')) {
        vnode = h('em', vnode);
    }

    if (marks.has('bold')) {
        vnode = h('strong', vnode);
    }

    return vnode;
}

function renderInline(nodes) {
    return (nodes ?? []).map((node) => renderText(node));
}

/** Нарисованный, а не нативный чекбокс: <input> не помещается в шаг линовки 1rem на телефоне. */
function renderCheckbox(checked) {
    return h('span', { class: ['rich-text__check', checked ? 'is-checked' : ''], 'aria-hidden': 'true' });
}

function renderBlock(node) {
    if (node.type === 'paragraph') {
        const content = node.content ?? [];

        // Пустой абзац — неразрывный пробел, иначе строка схлопнётся в нулевую высоту и
        // пустые строки пользователя пропадут из превью.
        return h('p', content.length > 0 ? renderInline(content) : ' ');
    }

    if (node.type === 'bulletList' || node.type === 'orderedList') {
        const tag = node.type === 'bulletList' ? 'ul' : 'ol';

        return h(tag, (node.content ?? []).map((item) => h('li', renderBlocks(item.content))));
    }

    if (node.type === 'taskList') {
        return h('ul', { class: 'rich-text__tasks' }, (node.content ?? []).map((item) => h('li', [
            renderCheckbox(item.attrs?.checked === true),
            h('span', { class: 'rich-text__task-body' }, renderBlocks(item.content)),
        ])));
    }

    // Незнакомый узел — показываем хотя бы его текст, чтобы содержимое не исчезло с экрана.
    return h('p', renderInline(node.content));
}

function renderBlocks(nodes) {
    return (nodes ?? []).map((node) => renderBlock(node));
}

export default {
    name: 'RichText',

    props: {
        /** Содержимое дня в markdown — ровно то, что лежит в days.content. */
        content: { type: String, default: '' },
    },

    computed: {
        doc() {
            return parseMarkdown(this.content);
        },
    },

    render() {
        return h('div', { class: 'rich-text' }, renderBlocks(this.doc.content));
    },
};
</script>
