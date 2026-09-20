<template>
    <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
        <div class="w-full max-w-sm">
            <div class="mb-6 text-center">
                <a href="/" class="font-hand text-4xl leading-none text-ink">Lemonade 🍹</a>
            </div>

            <div class="ruled-paper rounded-xl bg-paper p-6 shadow-sm ring-1 ring-paper-line/70">
                <h1 class="mb-5 text-xl font-bold text-ink"><slot name="title" /></h1>
                <slot />
            </div>

            <div class="mt-4 flex flex-col items-center gap-1 text-center text-sm text-ink-muted">
                <slot name="footer" />
            </div>
        </div>
    </div>
</template>
