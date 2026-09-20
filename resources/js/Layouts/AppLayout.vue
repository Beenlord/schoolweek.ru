<script setup>
import { router } from '@inertiajs/vue3';

function logout() {
    router.post('/logout');
}
</script>

<template>
    <div class="min-h-screen bg-paper">
        <header class="sticky top-0 z-10 border-b-2 border-paper-line bg-paper/95 backdrop-blur">
            <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
                <a href="/now" class="font-hand text-3xl leading-none text-ink">Lemonade 🍹</a>

                <nav class="flex items-center gap-4 text-sm font-semibold text-ink-muted">
                    <a href="/me" class="transition-colors hover:text-ink">Профиль</a>
                    <button
                        type="button"
                        class="rounded-full border border-paper-line px-3 py-1.5 transition-colors hover:border-accent-dark hover:text-ink"
                        @click="logout"
                    >
                        Выйти
                    </button>
                </nav>
            </div>
        </header>

        <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
            <slot />
        </main>
    </div>
</template>
