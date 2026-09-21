import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/js/app.js'],
            refresh: true,
        }),
        vue(),
        tailwindcss(),
        VitePWA({
            registerType: 'autoUpdate',
            // 'inline'/'script' инжектят регистрацию SW и <link rel="manifest"> в HTML-страницу, которую
            // обрабатывает сам Vite — а в Laravel Vite видит только resources/js/app.js (через @vite()), саму
            // resources/views/app.blade.php он не трогает. Поэтому регистрация — вручную в app.js
            // (import { registerSW } from 'virtual:pwa-register'), а <link rel="manifest"> — руками в app.blade.php.
            injectRegister: false,
            // Vite-база здесь — /build/ (туда Laravel складывает сборку), и по умолчанию SW
            // регистрировался бы как /build/sw.js. Скоуп service worker'а не может быть шире
            // каталога, из которого он отдан, поэтому такой SW физически не в состоянии
            // контролировать /now — офлайн не работал. buildBase + scope переносят регистрацию
            // в корень сайта (сам файл по-прежнему собирается в public/build/sw.js, наружу его
            // отдаёт роут /sw.js — см. routes/web.php).
            buildBase: '/',
            scope: '/',
            devOptions: {
                // Иначе манифест и service worker собираются только при `vite build`, а через `npm run dev`
                // (как обычно ведётся разработка) PWA-функциональность проверить будет нельзя.
                enabled: true,
            },
            workbox: {
                // По умолчанию плагин ставит navigateFallback: 'index.html', но в Laravel нет
                // HTML-энтрипоинта и index.html в precache-манифест не попадает. Workbox на
                // верхнем уровне звал createHandlerBoundToURL('index.html'), тот бросал
                // non-precached-url — и service worker падал при выполнении, то есть не
                // устанавливался вообще. Навигации у нас закрывает runtimeCaching ниже.
                navigateFallback: null,
                // Плагин включает их сам только при injectRegister: 'auto', а у нас регистрация
                // ручная (Laravel не даёт Vite HTML-страницу), поэтому выставляем явно: иначе
                // новый SW висит в waiting до закрытия всех вкладок и не берёт страницу под
                // контроль сразу после активации.
                skipWaiting: true,
                clientsClaim: true,
                // SW отдаётся из корня, а не из /build/, поэтому относительные пути внутри него
                // (и precache-записи вида assets/app-*.js, и отдельный workbox-*.js) резолвились
                // бы от корня и давали 404. Рантайм инлайним, precache-пути делаем абсолютными.
                inlineWorkboxRuntime: true,
                modifyURLPrefix: { '': '/build/' },
                runtimeCaching: [
                    {
                        // Единственная страница, которая должна открываться офлайн (см. README,
                        // «Offline и PWA») — /now, не всё приложение целиком. NetworkFirst: пока есть
                        // сеть, всегда отдаём свежий рендер с сервера (и обновляем кэш); если сеть за
                        // networkTimeoutSeconds не ответила — отдаём последнюю закэшированную копию.
                        // Сами данные дня при этом на странице подменяются на IndexedDB-кэш
                        // (см. Pages/Now.vue) — эта закэшированная HTML/JSON-копия нужна только чтобы
                        // вообще запустить JS-приложение офлайн, а не как источник актуальных данных.
                        urlPattern: ({ request, url }) => request.mode === 'navigate' && url.pathname === '/now',
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'now-page',
                            networkTimeoutSeconds: 3,
                            cacheableResponse: { statuses: [200] },
                        },
                    },
                ],
            },
            manifest: {
                name: 'Lemonade — школьный дневник',
                short_name: 'Lemonade',
                description: 'Электронный школьный дневник: расписание в формате «неделя на одном листе» с ' +
                    'ностальгическими нотками бумажного дневника.',
                lang: 'ru',
                categories: ['productivity', 'lifestyle'],
                // Цвета — временные, под лимонную тему проекта; подставить финальные при дизайне интерфейса.
                theme_color: '#fbc02d',
                background_color: '#fffdf5',
                display: 'standalone',
                // Авторизованного пользователя, открывшего установленное приложение, сразу на экран недели;
                // гостя оттуда уже редиректит на /login серверный middleware (см. bootstrap/app.php).
                start_url: '/now',
                scope: '/',
                // Иконки лежат в public/favicon/ — это готовый экспорт иконки приложения (easyappicon),
                // поэтому берём из него подходящие по размеру файлы, а не плодим копии в корне public/.
                // Пути абсолютные: манифест собирается в public/build/manifest.webmanifest, и относительный
                // src резолвился бы от /build/, а не от корня сайта.
                icons: [
                    {
                        // Android-бакеты плотности фиксированы спекой: mdpi 48 → xxxhdpi 192.
                        src: '/favicon/android/mipmap-xxxhdpi/lemonade.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        src: '/favicon/android/ic_launcher-web.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any',
                    },
                    {
                        // Единственный вариант, годный под maskable: непрозрачный белый квадрат во всю
                        // канву, рисунок — в центральной safe zone. ic_launcher-web.png для этой роли не
                        // подходит: у него скруглённые углы прозрачные, и маска-квадрат их обнажит.
                        src: '/favicon/android/playstore-icon.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./resources/js', import.meta.url)),
            '@css': fileURLToPath(new URL('./resources/css', import.meta.url)),
        },
    },
});
