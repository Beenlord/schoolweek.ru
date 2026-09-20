import '@css/app.scss';
import { createApp, h } from 'vue';
import { createInertiaApp } from '@inertiajs/vue3';
import { registerSW } from 'virtual:pwa-register';
import { syncNow } from '@/offline/sync.js';

// injectRegister: false в vite.config.js — Laravel не даёт Vite HTML-страницу для автоинжекта регистрации,
// поэтому регистрируем service worker сами. registerType: 'autoUpdate' — новую версию применяем без вопросов
// пользователю, отдельный UI "доступно обновление" не нужен.
if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
}

// Синхронизация офлайн-правок по дням (см. README, «Offline и PWA»): на старте, если есть сеть, и
// при каждом восстановлении соединения. Страница /now дополнительно читает свежие данные из
// IndexedDB сама (см. Pages/Now.vue) — здесь только фоновая отправка/приём.
syncNow();
window.addEventListener('online', syncNow);

createInertiaApp({
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.vue', { eager: true });
        return pages[`./Pages/${name}.vue`];
    },
    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .mount(el);
    },
});
