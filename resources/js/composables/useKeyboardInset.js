import { onMounted, onUnmounted, ref } from 'vue';

/**
 * Сколько снизу занимает экранная клавиатура — чтобы панель редактора вставала над ней, а не
 * пряталась под неё.
 *
 * Зачем вообще: `position: fixed; bottom: 0` для этого не годится. iOS Safari при открытии
 * клавиатуры НЕ уменьшает layout viewport, поэтому прижатый к низу элемент оказывается ровно под
 * клавиатурой. CSS-способ (`env(keyboard-inset-height)` из VirtualKeyboard API) существует, но
 * поддерживается только в Chromium — в Safari его нет, так что опираться на него нельзя.
 *
 * Остаётся visualViewport (есть с iOS 13): его height — это реально видимая область, а offsetTop —
 * насколько она смещена внутри layout viewport. Разница до нижнего края layout viewport и есть
 * высота клавиатуры. Тот же обработчик заодно закрывает давнюю проблему, отмеченную в CLAUDE.md:
 * при открытии клавиатуры Safari сдвигает visual viewport, чтобы показать курсор, и при нашей
 * вёрстке `h-dvh` + `overflow: hidden` страница оставалась смещённой.
 *
 * Отдаёт обе границы видимой области, а не только нижнюю: iOS при фокусе на поле умеет ещё и
 * сдвинуть visual viewport вниз, и тогда одной нижней отбивки мало — верх окна уехал бы за экран.
 *
 * @returns {{inset: import('vue').Ref<number>, offsetTop: import('vue').Ref<number>}}
 *   inset — сколько занято снизу (0, если клавиатуры нет), offsetTop — насколько видимая область
 *   смещена от верха layout viewport. Оба в CSS-пикселях.
 */
export function useKeyboardInset() {
    const inset = ref(0);
    const offsetTop = ref(0);

    function update() {
        const viewport = window.visualViewport;

        if (!viewport) {
            inset.value = 0;
            offsetTop.value = 0;
            return;
        }

        const gap = window.innerHeight - (viewport.height + viewport.offsetTop);

        // Округляем и отсекаем отрицательные значения: во время инерционной прокрутки и «резинки»
        // visualViewport на доли пикселя выходит за пределы layout viewport, и без этого окно
        // подрагивало бы.
        inset.value = Math.max(0, Math.round(gap));
        offsetTop.value = Math.max(0, Math.round(viewport.offsetTop));
    }

    onMounted(() => {
        const viewport = window.visualViewport;

        if (!viewport) {
            return;
        }

        viewport.addEventListener('resize', update);
        // scroll нужен наравне с resize: на iOS при переводе фокуса между полями высота остаётся
        // прежней, а видимая область уезжает — меняется только offsetTop.
        viewport.addEventListener('scroll', update);
        update();
    });

    onUnmounted(() => {
        const viewport = window.visualViewport;

        if (!viewport) {
            return;
        }

        viewport.removeEventListener('resize', update);
        viewport.removeEventListener('scroll', update);
    });

    return { inset, offsetTop };
}
