import keyBy from 'lodash/keyBy';
import { xsrfToken } from '@/csrf.js';
import { getDirtyDays, markSynced, putCleanDays, putEvents } from '@/offline/db.js';

// Курсор для инкрементального sync?since= — серверное время из прошлого ответа, не часы клиента
// (см. комментарий в DayController::sync).
const LAST_SYNC_KEY = 'lemonade.lastSyncAt';
// Отдельный курсор: события и дни меняются независимо, и общий заставлял бы перекачивать одно
// из-за изменений в другом.
const LAST_EVENTS_SYNC_KEY = 'lemonade.lastEventsSyncAt';

function getCursor(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function setCursor(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // приватный режим/заблокированное хранилище — просто не запоминаем курсор, следующая
        // синхронизация заново заберёт всё.
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

    // applied-ответ содержит только date/updatedAt (содержимое сервер не пересылает — оно и так
    // наше), поэтому content берём из отправленного пакета.
    const sent = keyBy(dirty, 'date');

    await Promise.all([
        ...data.applied.map((day) => markSynced(day.date, sent[day.date]?.content ?? null, day.updatedAt, sent[day.date]?.updatedAt)),
        // skipped — сервер победил по времени правки, забираем его содержимое себе. Если
        // пользователь успел дописать, пока летел запрос, markSynced это увидит и не тронет
        // строку: его правка новее и той, что мы отправили, и серверной, поэтому должна уехать
        // следующим push'ем, а не быть перезаписанной прямо сейчас.
        ...data.skipped.map((day) => markSynced(day.date, day.content, day.updatedAt, sent[day.date]?.updatedAt)),
    ]);
}

async function fetchSince(path, cursorKey) {
    const since = getCursor(cursorKey);
    const url = since ? `${path}?since=${encodeURIComponent(since)}` : path;

    const response = await fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
        throw new Error(`sync pull failed: ${path}`);
    }

    return response.json();
}

async function pull() {
    const data = await fetchSince('/api/days/sync', LAST_SYNC_KEY);

    await putCleanDays(data.days);
    setCursor(LAST_SYNC_KEY, data.serverTime);
}

/**
 * Правила событий. Только приём: создавать и править их офлайн нельзя (см. README), поэтому
 * отправлять отсюда нечего. Удалённые приходят в том же списке с признаком deleted — putEvents по
 * нему вычищает их локально.
 */
async function pullEvents() {
    const data = await fetchSince('/api/events/sync', LAST_EVENTS_SYNC_KEY);

    await putEvents(data.events);
    setCursor(LAST_EVENTS_SYNC_KEY, data.serverTime);
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
            await pullEvents();
        })().catch(() => {
            // Офлайн/упавший запрос — не критично, попробуем на следующий triggер (событие 'online'
            // или следующая загрузка приложения).
        }).finally(() => {
            syncing = null;
        });
    }

    return syncing;
}
