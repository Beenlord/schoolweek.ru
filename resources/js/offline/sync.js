import { xsrfToken } from '@/csrf.js';
import { getDirtyDays, markSynced, putCleanDays } from '@/offline/db.js';

// Курсор для инкрементального sync?since= — серверное время из прошлого ответа, не часы клиента
// (см. комментарий в DayController::sync).
const LAST_SYNC_KEY = 'lemonade.lastSyncAt';

function getLastSyncAt() {
    try {
        return localStorage.getItem(LAST_SYNC_KEY);
    } catch {
        return null;
    }
}

function setLastSyncAt(value) {
    try {
        localStorage.setItem(LAST_SYNC_KEY, value);
    } catch {
        // приватный режим/заблокированное хранилище — просто не запоминаем курсор, следующий sync
        // заново заберёт все дни.
    }
}

async function push() {
    const dirty = await getDirtyDays();

    if (dirty.length === 0) {
        return;
    }

    const response = await fetch('/api/days/batch', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-XSRF-TOKEN': xsrfToken(),
        },
        body: JSON.stringify({
            days: dirty.map((day) => ({ date: day.date, content: day.content, updatedAt: day.updatedAt })),
        }),
    });

    if (!response.ok) {
        throw new Error('sync push failed');
    }

    const data = await response.json();

    await Promise.all([
        ...data.applied.map((day) => markSynced(day.date, dirty.find((d) => d.date === day.date)?.content ?? null, day.updatedAt)),
        ...data.skipped.map((day) => markSynced(day.date, day.content, day.updatedAt)),
    ]);
}

async function pull() {
    const since = getLastSyncAt();
    const url = since ? `/api/days/sync?since=${encodeURIComponent(since)}` : '/api/days/sync';

    const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        throw new Error('sync pull failed');
    }

    const data = await response.json();

    await putCleanDays(data.days);
    setLastSyncAt(data.serverTime);
}

let syncing = null;

/**
 * Отправляет накопленные локально правки, затем подтягивает чужие. Идемпотентно вызывается на
 * старте приложения (если есть сеть) и по событию 'online' — см. resources/js/app.js.
 */
export function syncNow() {
    if (!navigator.onLine) {
        return Promise.resolve();
    }

    // Не запускаем параллельно несколько синхронизаций (например, быстрый offline→online→offline).
    if (!syncing) {
        syncing = (async () => {
            await push();
            await pull();
        })().catch(() => {
            // Офлайн/упавший запрос — не критично, попробуем на следующий triggер (событие 'online'
            // или следующая загрузка приложения).
        }).finally(() => {
            syncing = null;
        });
    }

    return syncing;
}
