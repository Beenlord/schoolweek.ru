<template>
    <div class="Home HomePage flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-16 text-center">
        <h1 class="font-hand text-6xl leading-none text-ink sm:text-7xl">Lemonade 🍹</h1>

        <p class="mt-6 max-w-xl text-lg text-ink-muted">
            Школьный дневник — гениальное изобретение. Мы сделали его электронную версию для обычной жизни:
            ностальгические нотки школьного прошлого, простота расписания и концепция «неделя на одном листе».
        </p>

        <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
                href="/register"
                class="rounded-full bg-accent px-6 py-2.5 font-semibold text-ink transition-colors hover:bg-accent-dark"
            >
                Начать вести дневник
            </a>
            <a
                href="/login"
                class="rounded-full border border-paper-line px-6 py-2.5 font-semibold text-ink transition-colors hover:border-accent-dark"
            >
                Вход
            </a>
        </div>
    </div>
</template>
