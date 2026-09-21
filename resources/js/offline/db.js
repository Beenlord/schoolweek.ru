import { openDB } from 'idb';
import escapeRegExp from 'lodash/escapeRegExp';
import { LATEST_VERSION, migrations } from '@/offline/migrations.js';

/**
 * Минимальная длина поискового запроса. По одной букве совпадает почти всё: и перебор получается
 * полный, и список бессмысленный. Живёт здесь, потому что нужна и выборке, и интерфейсу поиска —
 * чтобы подсказка «введите хотя бы столько-то» не разошлась с тем, что на самом деле фильтруется.
 */
export const SEARCH_MIN_LENGTH = 2;

// Локальное зеркало дней пользователя для офлайн-показа/редактирования /now (см. README, «Offline и
// PWA»). Хранит и уже синхронизированные дни (dirty: 0), и ещё не отправленные офлайн-правки
// (dirty: 1) — последние не должна перезатирать ни одна pull-синхронизация, пока не отправлены.
const DB_NAME = 'lemonade';
const STORE = 'days';
// Отметки «эту неделю мы целиком выкачивали с сервера». Без них офлайн невозможно отличить
// «день пустой» от «день ни разу не загружался»: в store days отсутствующий день выглядит
// одинаково в обоих случаях. Разница принципиальная — поверх незагруженного дня нельзя давать
// писать, иначе при синхронизации правка затрёт содержимое, которого пользователь не видел
// (батч разрешает конфликт по времени правки, см. DayController::batch).
const WEEKS_STORE = 'weeks';

let dbPromise = null;

/**
 * Прогоняет по порядку все миграции новее текущей версии базы. Схема описана в
 * offline/migrations.js — здесь только исполнение.
 */
async function migrate(db, oldVersion, tx) {
    try {
        for (const migration of migrations) {
            if (migration.version <= oldVersion) {
                continue;
            }

            const result = migration.up(db, tx);

            // Ждём только если миграция и правда асинхронная. Транзакция versionchange
            // закрывается, как только управление возвращается в событийный цикл, и лишний
            // await на уже готовом значении — ровно тот случай, когда её можно потерять
            // посреди списка. У миграций, меняющих только схему, up() синхронный.
            if (result !== undefined) {
                await result;
            }
        }
    } catch (error) {
        // Не оставляем схему на полпути: abort откатывает все миграции этого запуска целиком,
        // и при следующем открытии базы они начнутся заново с той же oldVersion.
        try {
            tx.abort();
        } catch {
            // Транзакция уже свалилась сама — тогда откат и так произошёл.
        }

        throw error;
    }
}

function getDb() {
    if (!dbPromise) {
        dbPromise = openDB(DB_NAME, LATEST_VERSION, {
            upgrade: (db, oldVersion, newVersion, tx) => migrate(db, oldVersion, tx),

            // Приложение вполне может быть открыто в нескольких вкладках (а как PWA — ещё и
            // отдельным окном). Соединение со старой версией схемы блокирует апгрейд во всех
            // остальных, поэтому по первому требованию отпускаем базу: иначе свежая вкладка
            // просто зависнет на openDB, пока пользователь не закроет старую.
            blocking() {
                const closing = dbPromise;
                dbPromise = null;
                closing?.then((db) => db.close()).catch(() => {});
            },

            // Обратная ситуация — апгрейд ждём мы. Дальше idb сам продолжит, когда другая
            // вкладка отпустит базу; здесь только не молчим, чтобы такое зависание было видно.
            blocked() {
                console.warn('[offline] Обновление схемы IndexedDB ждёт другую вкладку приложения.');
            },

            // Браузер закрыл соединение сам (вытеснил вкладку, освободил память) — сбрасываем
            // кэш промиса, чтобы следующий запрос открыл базу заново, а не переиспользовал труп.
            terminated() {
                dbPromise = null;
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
 * Дни за отрезок [from, to] включительно — ровно то, что нужно, чтобы показать одну неделю
 * (ключ store'а — дата в формате YYYY-MM-DD, он же лексикографически упорядочен по времени).
 *
 * @returns {Promise<Array<{date: string, content: string|null, updatedAt: string|null, dirty: number}>>}
 */
export async function getDaysInRange(from, to) {
    const db = await getDb();

    return db.getAll(STORE, IDBKeyRange.bound(from, to));
}

/**
 * Поиск по содержимому дней — подстрокой, без учёта регистра.
 *
 * Идёт целиком по локальной копии, и онлайн тоже: серверный поиск не нужен, потому что в
 * IndexedDB и так лежит весь корпус записей пользователя, а не только просмотренные недели —
 * первый sync (без курсора) отдаёт все дни разом, см. DayController::sync. Одно следствие:
 * офлайн поиск работает ровно так же, без отдельной ветки логики.
 *
 * Подстрокой, а не по словам: для русского это заметно полезнее — «маникюр» находит и
 * «маникюра», и «маникюрный», чего словарный поиск без морфологии не умеет.
 *
 * Курсором, а не getAll + фильтр: обход идёт по убыванию ключа (ключ — дата), поэтому свежие дни
 * попадаются первыми и на limit можно остановиться, не вычитывая базу целиком. У пользователя с
 * многолетней историей это и есть основная экономия: типичный запрос («что я писал недавно»)
 * завершается, не дочитав базу до конца.
 *
 * Сравнение — заранее скомпилированной регуляркой, а не content.toLowerCase().includes(): второе
 * выделяет копию всего текста дня на каждой строке, то есть мегабайты мусора за один запрос,
 * причём запрос идёт на каждое нажатие клавиши. Регулярка компилируется один раз и работает по
 * исходной строке.
 *
 * @param {string} query
 * @param {number} limit
 * @returns {Promise<Array<{date: string, content: string|null, updatedAt: string|null, dirty: number}>>}
 */
export async function searchDays(query, limit = 100) {
    const needle = query.trim();

    if (needle.length < SEARCH_MIN_LENGTH) {
        return [];
    }

    // escapeRegExp обязателен: строку вводит пользователь, и символы вроде «(» или «*» иначе либо
    // сломали бы выражение, либо — что хуже — сделали бы его неожиданно широким.
    const matcher = new RegExp(escapeRegExp(needle), 'iu');

    const db = await getDb();
    const found = [];
    let cursor = await db.transaction(STORE).store.openCursor(null, 'prev');

    while (cursor && found.length < limit) {
        const day = cursor.value;

        if (day.content && matcher.test(day.content)) {
            found.push(day);
        }

        cursor = await cursor.continue();
    }

    return found;
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
    await putCleanDays([day]);
}

/**
 * Всё одной транзакцией — и потому, что это на порядок дешевле семи отдельных при загрузке
 * недели, и потому, что проверка «а не dirty ли он» обязана быть неразрывна с записью: иначе
 * между ними успевает вклиниться автосохранение, и мы затираем правку, которую как раз и
 * договаривались не трогать.
 */
export async function putCleanDays(days) {
    if (days.length === 0) {
        return;
    }

    const db = await getDb();
    const tx = db.transaction(STORE, 'readwrite');

    await Promise.all(days.map(async (day) => {
        const existing = await tx.store.get(day.date);

        if (existing?.dirty) {
            return;
        }

        await tx.store.put({
            date: day.date,
            content: day.content ?? null,
            updatedAt: day.updatedAt ?? null,
            dirty: 0,
        });
    }));

    await tx.done;
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
 * Подтверждение сервером конкретной правки (успешный PUT /api/days/{date} или запись из ответа
 * /api/days/batch) — снимает флаг dirty.
 *
 * @param {string} sentUpdatedAt метка времени той самой правки, которую отправляли на сервер.
 *   Пока запрос летел, пользователь мог дописать ещё — putDirtyDay поставил бы при этом новую
 *   метку. Несовпадение означает, что в базе лежит более свежая правка, и снимать с неё dirty
 *   нельзя: она молча пропала бы, так и не уехав на сервер.
 */
export async function markSynced(date, content, updatedAt, sentUpdatedAt) {
    const db = await getDb();
    // Чтение и запись — одной транзакцией: между ними не должно вклиниться сохранение,
    // которое мы тогда бы и затёрли.
    const tx = db.transaction(STORE, 'readwrite');
    const existing = await tx.store.get(date);

    if (!existing || !existing.dirty || existing.updatedAt === sentUpdatedAt) {
        await tx.store.put({ date, content, updatedAt, dirty: 0 });
    }

    await tx.done;
}

/**
 * Неделя целиком получена с сервера — значит, отсутствие дня в store'е days теперь однозначно
 * означает «день пустой», а не «не загружали». См. комментарий у WEEKS_STORE.
 *
 * @param {string} weekStart понедельник недели, 'YYYY-MM-DD'
 */
export async function markWeekCached(weekStart) {
    const db = await getDb();
    await db.put(WEEKS_STORE, { weekStart, fetchedAt: new Date().toISOString() });
}

/**
 * @param {string} weekStart понедельник недели, 'YYYY-MM-DD'
 * @returns {Promise<boolean>}
 */
export async function isWeekCached(weekStart) {
    const db = await getDb();

    return (await db.get(WEEKS_STORE, weekStart)) !== undefined;
}
