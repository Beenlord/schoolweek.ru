<template>
    <!-- min-h-dvh, а не min-h-screen: 100vh на iOS — это высота экрана БЕЗ учёта адресной строки,
         поэтому страница оказывается заведомо выше видимой области и скроллится, даже когда форма
         помещается целиком. dvh считает по текущему viewport'у. -->
    <div class="flex min-h-dvh items-center justify-center bg-paper px-4 py-10">
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
