/**
 * Преобразование markdown ↔ документ редактора (ProseMirror/Tiptap JSON).
 *
 * В базе (`days.content`) лежит markdown — так решено в ТЗ: строка остаётся читаемой глазами,
 * переносимой и пригодной для показа даже без редактора. Tiptap же работает со своим деревом,
 * поэтому нужна пара функций на границе.
 *
 * Поддерживается ровно то, что описано в ТЗ («списки, выделения»), плюс чекбоксы по просьбе
 * пользователей: абзац, **жирный**, *курсив*, маркированный и нумерованный списки, список задач
 * `- [ ]` / `- [x]`. Вложенность списков поддержана, потому что редактор позволяет сделать её
 * клавишей Tab, и молча терять её при сохранении нельзя. Всё остальное (заголовки, таблицы,
 * цитаты, ссылки) намеренно не разбирается и остаётся обычным текстом — см. «Вне рамок MVP».
 *
 * Круговой оборот обязан быть устойчивым: parseMarkdown(serializeDoc(doc)) должен давать тот же
 * документ. Ради этого при сериализации экранируются символы, которые иначе при обратном разборе
 * превратились бы в разметку (см. escapeText и escapeParagraph).
 *
 * Курсив пишется только через `*`, вариант через `_` намеренно не поддержан ни в ту, ни в другую
 * сторону: иначе пришлось бы экранировать подчёркивания внутри слов, и любая строка вроде
 * `файл_имя` обрастала бы обратными слэшами в базе.
 */

const INDENT = '  ';

const TASK_RE = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*]\s+(.*)$/;
const ORDERED_RE = /^(\s*)\d+[.)]\s+(.*)$/;

function textNode(text, marks) {
    const node = { type: 'text', text };

    if (marks.length > 0) {
        node.marks = marks.map((type) => ({ type }));
    }

    return node;
}

/**
 * Разбирает выделения внутри строки. Вложенные выделения (жирный внутри курсива) намеренно не
 * поддерживаются — содержимое пары считается обычным текстом. Это заметно упрощает разбор, а в
 * дневнике такая разметка и не встречается.
 */
function parseInline(text) {
    const nodes = [];
    let buffer = '';
    let i = 0;

    const flush = () => {
        if (buffer !== '') {
            nodes.push(textNode(buffer, []));
            buffer = '';
        }
    };

    while (i < text.length) {
        // Экранированный символ — берём следующий как есть, разметкой он уже не является.
        if (text[i] === '\\' && i + 1 < text.length) {
            buffer += text[i + 1];
            i += 2;
            continue;
        }

        if (text.startsWith('**', i)) {
            const end = text.indexOf('**', i + 2);

            if (end > i + 2) {
                flush();
                nodes.push(textNode(text.slice(i + 2, end), ['bold']));
                i = end + 2;
                continue;
            }
        }

        if (text[i] === '*') {
            const end = text.indexOf('*', i + 1);

            if (end > i + 1) {
                flush();
                nodes.push(textNode(text.slice(i + 1, end), ['italic']));
                i = end + 1;
                continue;
            }
        }

        buffer += text[i];
        i += 1;
    }

    flush();

    return nodes;
}

function paragraph(text) {
    const content = parseInline(text);

    // Пустой абзац в ProseMirror — узел вообще без content, а не с пустым текстовым узлом.
    return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

/** Тип списка и разобранные части строки, либо null, если это не пункт списка. */
function matchListItem(line) {
    // Задачи проверяются первыми: `- [ ] дело` подходит и под обычный маркер тоже.
    const task = TASK_RE.exec(line);

    if (task) {
        return {
            listType: 'taskList',
            itemType: 'taskItem',
            indent: task[1].length,
            attrs: { checked: task[2].toLowerCase() === 'x' },
            text: task[3],
        };
    }

    const bullet = BULLET_RE.exec(line);

    if (bullet) {
        return { listType: 'bulletList', itemType: 'listItem', indent: bullet[1].length, attrs: null, text: bullet[2] };
    }

    const ordered = ORDERED_RE.exec(line);

    if (ordered) {
        return { listType: 'orderedList', itemType: 'listItem', indent: ordered[1].length, attrs: null, text: ordered[2] };
    }

    return null;
}

/**
 * markdown → документ редактора.
 *
 * @param {string|null|undefined} markdown
 * @returns {{type: 'doc', content: Array<object>}}
 */
export function parseMarkdown(markdown) {
    const lines = (markdown ?? '').split('\n');
    const content = [];
    // Стек открытых списков: каждый уровень вложенности — своя запись.
    const stack = [];

    const closeTo = (depth) => {
        while (stack.length > depth) {
            stack.pop();
        }
    };

    for (const line of lines) {
        // Ведущий обратный слэш — метка «это обычный абзац, а не разметка», её ставит
        // escapeParagraph при сериализации. Сам слэш снимет parseInline.
        const item = line.startsWith('\\') ? null : matchListItem(line);

        if (item === null) {
            closeTo(0);
            content.push(paragraph(line));
            continue;
        }

        // Уровень вложенности считаем по отступу в единицах INDENT, а не по абсолютному числу
        // пробелов: чужой markdown бывает свёрстан и в четыре пробела. Глубже, чем на один
        // уровень за раз, не проваливаемся — «дырявый» отступ подтягивается к ближайшему.
        let depth = Math.min(Math.floor(item.indent / INDENT.length), stack.length);

        // Вложенный список обязан лежать внутри пункта родителя. Если пункта ещё нет (файл
        // начинается с отступа), вложенности просто не получится — разбираем как верхний уровень.
        if (depth > 0 && !stack[depth - 1]?.lastItem) {
            depth = 0;
        }

        closeTo(depth);

        if (stack.length !== depth + 1 || stack[depth].listType !== item.listType) {
            closeTo(depth);

            const list = { type: item.listType, content: [] };

            if (depth === 0) {
                content.push(list);
            } else {
                stack[depth - 1].lastItem.content.push(list);
            }

            stack.push({ listType: item.listType, list, lastItem: null });
        }

        const itemNode = { type: item.itemType, content: [paragraph(item.text)] };

        if (item.attrs) {
            itemNode.attrs = item.attrs;
        }

        const level = stack[stack.length - 1];
        level.list.content.push(itemNode);
        level.lastItem = itemNode;
    }

    return { type: 'doc', content };
}

/** Экранирует символы, которые при обратном разборе стали бы разметкой. */
function escapeText(text) {
    return text.replace(/([\\*])/g, '\\$1');
}

function serializeInline(nodes) {
    return (nodes ?? []).map((node) => {
        if (node.type !== 'text') {
            return '';
        }

        const marks = new Set((node.marks ?? []).map((mark) => mark.type));
        let text = escapeText(node.text ?? '');

        if (marks.has('italic')) {
            text = `*${text}*`;
        }

        if (marks.has('bold')) {
            text = `**${text}**`;
        }

        return text;
    }).join('');
}

/**
 * Абзац, который сам по себе выглядит как пункт списка (`- купить хлеб` набрано текстом),
 * помечается ведущим слэшем — иначе при следующем открытии он превратился бы в список.
 */
function escapeParagraph(line) {
    return /^\s*(?:[-*+]\s|\d+[.)]\s)/.test(line) ? `\\${line}` : line;
}

function serializeBlock(node, depth, out) {
    const indent = INDENT.repeat(depth);

    if (node.type === 'paragraph') {
        out.push(escapeParagraph(serializeInline(node.content)));
        return;
    }

    if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
        (node.content ?? []).forEach((item, index) => {
            const blocks = item.content ?? [];
            const [first, ...rest] = blocks;
            const text = first && first.type === 'paragraph' ? serializeInline(first.content) : '';

            let marker = '- ';

            if (node.type === 'orderedList') {
                // Нумерацию всегда пишем подряд от единицы: редактор её и так пересчитывает.
                marker = `${index + 1}. `;
            } else if (node.type === 'taskList') {
                marker = item.attrs?.checked ? '- [x] ' : '- [ ] ';
            }

            out.push(`${indent}${marker}${text}`);

            // Вложенные списки лежат внутри пункта, следом за его абзацем.
            rest.forEach((child) => serializeBlock(child, depth + 1, out));
        });

        return;
    }

    // Незнакомый узел — вытаскиваем хотя бы его текст, чтобы содержимое не пропало.
    out.push(serializeInline(node.content));
}

/**
 * Документ редактора → markdown.
 *
 * @param {{content?: Array<object>}|null|undefined} doc
 * @returns {string}
 */
export function serializeDoc(doc) {
    const out = [];

    (doc?.content ?? []).forEach((node) => serializeBlock(node, 0, out));

    return out.join('\n');
}