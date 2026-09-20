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
            devOptions: {
                // Иначе манифест и service worker собираются только при `vite build`, а через `npm run dev`
                // (как обычно ведётся разработка) PWA-функциональность проверить будет нельзя.
                enabled: true,
            },
            workbox: {
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
                icons: [
                    {
                        src: '/pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '/pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
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
