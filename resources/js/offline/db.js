import { openDB } from 'idb';

// Локальное зеркало дней пользователя для офлайн-показа/редактирования /now (см. README, «Offline и
// PWA»). Хранит и уже синхронизированные дни (dirty: 0), и ещё не отправленные офлайн-правки
// (dirty: 1) — последние не должна перезатирать ни одна pull-синхронизация, пока не отправлены.
const DB_NAME = 'lemonade';
const DB_VERSION = 1;
const STORE = 'days';

let dbPromise = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore(STORE, { keyPath: 'date' });
                store.createIndex('by-dirty', 'dirty');
            },
        });
    }

    return dbPromise;
}

/**
 * @returns {Promise<Array<{date: string, content: string|null, updatedAt: string|null, dirty: number}>>}
 */
export async function getAllDays() {
    const db = await getDb();
    return db.getAll(STORE);
}

/**
 * @returns {Promise<Array<{date: string, content: string|null, updatedAt: string, dirty: number}>>}
 */
export async function getDirtyDays() {
    const db = await getDb();
    return db.getAllFromIndex(STORE, 'by-dirty', 1);
}

/**
 * Записывает день локально как уже синхронизированный (пришёл с сервера или подтверждён им).
 * Не перезаписывает день, если у него сейчас есть неотправленная локальная правка (dirty) —
 * иначе pull-синхронизация могла бы стереть ещё не отправленные изменения пользователя.
 */
export async function putCleanDay(day) {
    const db = await getDb();
    const existing = await db.get(STORE, day.date);

    if (existing?.dirty) {
        return;
    }

    await db.put(STORE, { date: day.date, content: day.content ?? null, updatedAt: day.updatedAt ?? null, dirty: 0 });
}

export async function putCleanDays(days) {
    await Promise.all(days.map((day) => putCleanDay(day)));
}

/**
 * Локальная правка пользователя — сохраняется сразу (оптимистично) и помечается dirty, пока сервер
 * её не подтвердит.
 */
export async function putDirtyDay(date, content, updatedAt) {
    const db = await getDb();
    await db.put(STORE, { date, content, updatedAt, dirty: 1 });
}

/**
 * Подтверждение сервером конкретной правки (успешный PUT /api/days/{date} или запись из
 * applied-списка ответа /api/days/batch) — снимает флаг dirty.
 */
export async function markSynced(date, content, updatedAt) {
    const db = await getDb();
    await db.put(STORE, { date, content, updatedAt, dirty: 0 });
}
