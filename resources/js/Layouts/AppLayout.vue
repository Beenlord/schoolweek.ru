<script setup>
import { usePage } from '@inertiajs/vue3';

defineProps({
    // Страница сама помещается в экран и ей нужен overflow: visible (например, /now: во время
    // переворота створка выходит за пределы своего блока, и любой клиппинг по дороге режет
    // анимацию). Прокрутки при этом всё равно не будет — обрежет корень layout'а по краю
    // экрана. Для обычных страниц (/me) оставляем собственный скролл внутри main.
    fit: { type: Boolean, default: false },

    // Что делает кнопка «домой». Если обработчика нет, она остаётся обычной ссылкой на /now —
    // именно этого и ждёшь от неё на других страницах. Если есть, страница берёт переход на
    // себя и кнопка становится <button>: на /now «домой» означает не перезагрузку, а
    // перелистывание к текущей неделе, и подменять это ссылкой было бы враньём — ссылка
    // открывалась бы в новой вкладке по Ctrl+клику и рвала бы состояние страницы.
    homeHandler: { type: Function, default: null },
    homeLabel: { type: String, default: 'На главную' },
});

const page = usePage();
const isProfileActive = () => page.url.startsWith('/me');
</script>

<template>
    <div class="relative flex h-dvh flex-col overflow-hidden bg-paper">
        <!-- flex-1/min-h-0: страница (например, /now) может отдать эту высоту целиком под свою
             сетку без скролла; страницам подлиннее (например, /me) просто достаётся внутренний
             overflow-y-auto вместо прокрутки всей страницы целиком.
             pb-20 — место под плавающий остров навигации ниже. Панель вынута из потока, поэтому
             своей высоты больше не занимает, и без этого отступа содержимое уходило бы под неё. -->
        <main
            class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pt-4 pb-20 sm:px-6 sm:pt-6"
            :class="fit ? 'overflow-visible' : 'overflow-y-auto overscroll-contain'"
        >
            <slot />
        </main>

        <!-- Навигация: логотип слева — он же кнопка «домой» (на /now, текущая неделя, с любой
             страницы), место действий конкретной страницы (например, переключение недель на /now)
             посередине, вкладка «Профиль» — всегда справа.
             Не полоса во всю ширину, а плавающий остров поверх содержимого. Лежать поверх —
             обязательное условие, а не вкус: backdrop-blur размывает то, что за элементом, и
             панели в общем потоке размывать было бы нечего, стекло просто не читалось бы.
             Обёртка растянута на всю ширину только чтобы отцентровать остров, поэтому кликов она
             не перехватывает (pointer-events-none), а сам остров их возвращает.
             z-40: во время переворота страницы её створка (z-30) проезжает под островом. -->
        <nav class="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3">
            <!-- Середина между двумя школами оформления: от Apple — размытие подложки и тонкий
                 контур в волос, от Material — форма и плотность. Поэтому не капсула (rounded-full),
                 а прямоугольник с крупным скруглением: при высоте 56px радиус 24px читается именно
                 как скруглённый прямоугольник, тогда как капсула сразу отсылала бы к iOS.
                 Подложка чуть плотнее чисто эппловской: у Material поверхность тональная, а не
                 почти прозрачная. -->
            <div class="pointer-events-auto flex items-center gap-1 rounded-3xl bg-paper/75 px-2 py-1.5 shadow-[0_8px_28px_-12px_rgba(58,50,38,0.45)] ring-1 ring-paper-line/50 backdrop-blur-xl">
                <component
                    :is="homeHandler ? 'button' : 'a'"
                    :type="homeHandler ? 'button' : null"
                    :href="homeHandler ? null : '/now'"
                    :aria-label="homeLabel"
                    :title="homeLabel"
                    class="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none transition-colors hover:bg-today/60"
                    @click="homeHandler && homeHandler()"
                >
                    🍹
                </component>

                <slot name="bottom-bar" />

                <!-- Активная вкладка помечается заливкой-«таблеткой» под иконкой, как индикатор
                     в Material 3: одного изменения цвета мало — на размытой подложке разница
                     между двумя оттенками почти не читается. -->
                <a
                    href="/me"
                    aria-label="Профиль"
                    class="flex h-11 items-center justify-center rounded-full transition-colors"
                    :class="isProfileActive() ? 'w-14 bg-today text-accent-dark' : 'w-11 text-ink-muted hover:bg-today/60'"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                </a>
            </div>
        </nav>
    </div>
</template>
