<script setup>
import { onMounted, reactive, ref } from 'vue';
import { router } from '@inertiajs/vue3';
import { xsrfToken } from '@/csrf.js';
import { getAllDays, markSynced, putCleanDays, putDirtyDay } from '@/offline/db.js';
import { syncNow } from '@/offline/sync.js';

const props = defineProps({
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    week: { type: Number, required: true },
    weekStart: { type: String, required: true },
    days: { type: Array, required: true }, // { date, weekday, content, updatedAt, isToday }
});

const isOnline = ref(navigator.onLine);
const editableDays = reactive(props.days.map((day) => ({ ...day })));
const pendingSaves = reactive({});

window.addEventListener('online', () => { isOnline.value = true; });
window.addEventListener('offline', () => { isOnline.value = false; });

onMounted(async () => {
    if (navigator.onLine) {
        // Пропсы пришли живыми с сервера — кэшируем их как «чистые» на случай, если именно эта
        // неделя понадобится офлайн, и заодно пробуем отправить любые старые неотправленные правки.
        await putCleanDays(props.days.map((day) => ({ date: day.date, content: day.content, updatedAt: day.updatedAt })));
        syncNow();
        return;
    }

    // Офлайн: эти пропсы могли прийти из закэшированной service worker'ом HTML-страницы
    // (см. runtimeCaching в vite.config.js) — то есть это снимок на момент последнего успешного
    // онлайн-визита, а не текущее состояние. Настоящее последнее известное состояние (включая ещё
    // не отправленные правки) лежит в IndexedDB — подменяем им отображаемые данные.
    const cached = await getAllDays();
    const byDate = new Map(cached.map((day) => [day.date, day]));

    editableDays.forEach((day) => {
        const local = byDate.get(day.date);
        if (local) {
            day.content = local.content;
            day.updatedAt = local.updatedAt;
        }
    });
});

async function saveDay(day) {
    const updatedAt = new Date().toISOString();
    pendingSaves[day.date] = true;

    // Пишем локально первым делом и всегда — так правка не теряется, даже если запрос ниже не
    // дойдёт до сервера.
    await putDirtyDay(day.date, day.content, updatedAt);

    try {
        const response = await fetch(`/api/days/${day.date}`, {
            method: 'PUT',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            body: JSON.stringify({ content: day.content }),
        });

        if (!response.ok) {
            throw new Error('save failed');
        }

        const data = await response.json();
        await markSynced(day.date, data.content, data.updatedAt);
        day.updatedAt = data.updatedAt;
    } catch (e) {
        // Нет сети или сервер недоступен — правка остаётся в IndexedDB помеченной dirty, её отправит
        // фоновая синхронизация при восстановлении связи (см. offline/sync.js).
    } finally {
        delete pendingSaves[day.date];
    }
}

function logout() {
    router.post('/logout');
}
</script>

<template>
    <div class="Now NowPage">
        <p v-if="!isOnline">
            Офлайн — показаны последние сохранённые данные, правки отправятся при восстановлении сети.
        </p>

        <h1>{{ year }} / месяц {{ month }} / неделя {{ week }} (с {{ weekStart }})</h1>

        <ul>
            <li v-for="day in editableDays" :key="day.date">
                <strong>{{ day.date }} (день недели {{ day.weekday }}){{ day.isToday ? ' — сегодня' : '' }}</strong>
                <textarea v-model="day.content" @blur="saveDay(day)"></textarea>
                <span v-if="pendingSaves[day.date]">Сохранение…</span>
            </li>
        </ul>

        <a href="/me">Профиль</a>
        <button type="button" @click="logout">Выйти</button>
    </div>
</template>
