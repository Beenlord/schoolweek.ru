<template>
    <div class="Home HomePage flex min-h-dvh flex-col items-center justify-center bg-paper px-4 py-16 text-center">
        <h1 class="font-hand text-6xl leading-none text-ink sm:text-7xl">Lemonade 🍹</h1>

        <p class="mt-6 max-w-lg text-2xl font-bold leading-snug text-ink sm:text-3xl">
            Наслаждайся расписанием<br class="hidden sm:block"> в удобном формате
        </p>

        <p class="mt-4 max-w-xl text-base text-ink-muted sm:text-lg">
            Это так же необходимо, как глоток прохладного лимонада в знойный летний день.
        </p>

        <div class="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
                href="/register"
                class="rounded-full bg-accent px-6 py-2.5 font-semibold text-ink transition-colors hover:bg-accent-dark"
            >
                Завести дневник
            </a>
            <a
                href="/login"
                class="rounded-full border border-paper-line px-6 py-2.5 font-semibold text-ink transition-colors hover:border-accent-dark"
            >
                Войти
            </a>
        </div>
    </div>
</template>
