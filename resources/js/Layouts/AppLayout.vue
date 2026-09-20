<script setup>
import { usePage } from '@inertiajs/vue3';

const page = usePage();
const isProfileActive = () => page.url.startsWith('/me');
</script>

<template>
    <div class="flex h-dvh flex-col overflow-hidden bg-paper">
        <!-- flex-1/min-h-0: страница (например, /now) может отдать эту высоту целиком под свою
             сетку без скролла; страницам подлиннее (например, /me) просто достаётся внутренний
             overflow-y-auto вместо прокрутки всей страницы целиком. -->
        <main class="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
            <slot />
        </main>

        <!-- Нижняя панель в духе Instagram: логотип слева — он же кнопка «домой» (на /now,
             текущая неделя, с любой страницы), место действий конкретной страницы (например,
             переключение недель на /now) посередине, вкладка «Профиль» — всегда справа. -->
        <nav class="z-10 flex shrink-0 items-center justify-around border-t-2 border-paper-line bg-paper/95 py-1.5 backdrop-blur">
            <a
                href="/now"
                aria-label="На главную"
                class="flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none transition-colors hover:bg-today/60"
            >
                🍹
            </a>

            <slot name="bottom-bar" />

            <a
                href="/me"
                aria-label="Профиль"
                class="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-today/60"
                :class="isProfileActive() ? 'text-accent-dark' : 'text-ink-muted'"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            </a>
        </nav>
    </div>
</template>
