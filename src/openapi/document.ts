import { z } from 'zod';
import { registerSchema, loginSchema, authResponseSchema, errorResponseSchema } from '@/schemas/auth';
import { userProfileSchema } from '@/schemas/user';
import { healthSchema } from '@/schemas/health';
import {
    scheduleTextSchema,
    scheduleEntrySchema,
    batchRequestSchema,
    batchResponseSchema,
    syncResponseSchema,
} from '@/schemas/schedule';

function jsonSchema(schema: z.ZodType) {
    return z.toJSONSchema(schema, { target: 'openapi-3.0' });
}

function jsonBody(schema: z.ZodType) {
    return {
        required: true,
        content: {
            'application/json': { schema: jsonSchema(schema) },
        },
    };
}

function jsonResponse(description: string, schema: z.ZodType) {
    return {
        description,
        content: {
            'application/json': { schema: jsonSchema(schema) },
        },
    };
}

export function buildOpenApiDocument() {
    return {
        openapi: '3.0.3',
        info: {
            title: 'schoolweek.ru API',
            version: '1.0.0',
        },
        components: {
            securitySchemes: {
                bearerAuth: { type: 'http', scheme: 'bearer' },
            },
        },
        paths: {
            '/up': {
                get: {
                    summary: 'Проверка состояния приложения',
                    responses: {
                        '200': jsonResponse('Приложение работает', healthSchema),
                        '503': jsonResponse('База данных недоступна', healthSchema),
                    },
                },
            },
            '/auth/register': {
                post: {
                    summary: 'Регистрация нового пользователя',
                    requestBody: jsonBody(registerSchema),
                    responses: {
                        '201': jsonResponse('Пользователь создан, сессия открыта', authResponseSchema),
                        '400': jsonResponse('Некорректные данные', errorResponseSchema),
                        '409': jsonResponse('Email уже занят', errorResponseSchema),
                    },
                },
            },
            '/auth/login': {
                post: {
                    summary: 'Вход по email и паролю',
                    requestBody: jsonBody(loginSchema),
                    responses: {
                        '200': jsonResponse('Сессия открыта', authResponseSchema),
                        '400': jsonResponse('Некорректные данные', errorResponseSchema),
                        '401': jsonResponse('Неверный email или пароль', errorResponseSchema),
                    },
                },
            },
            '/auth/logout': {
                post: {
                    summary: 'Завершение текущей сессии',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '204': { description: 'Сессия завершена' },
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                    },
                },
            },
            '/users/me': {
                get: {
                    summary: 'Профиль текущего пользователя',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': jsonResponse('Профиль пользователя', userProfileSchema),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                        '404': jsonResponse('Пользователь не найден', errorResponseSchema),
                    },
                },
            },
            '/schedule': {
                get: {
                    summary: 'Список всех дней расписания пользователя',
                    security: [{ bearerAuth: [] }],
                    responses: {
                        '200': jsonResponse('Дни расписания, отсортированные по дате', z.array(scheduleEntrySchema)),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                    },
                },
            },
            '/schedule/sync': {
                get: {
                    summary: 'Дельта-синхронизация: изменения с момента последнего syncа',
                    description: 'Без параметра since возвращает все активные (неудалённые) дни — полная синхронизация. С since возвращает изменённые и удалённые (deleted: true) дни, произошедшие после указанного момента — для инкрементального обновления локального хранилища PWA.',
                    security: [{ bearerAuth: [] }],
                    parameters: [
                        {
                            name: 'since',
                            in: 'query',
                            required: false,
                            description: 'ISO-момент времени последней успешной синхронизации (значение serverTime из предыдущего ответа)',
                            schema: { type: 'string', format: 'date-time' },
                        },
                    ],
                    responses: {
                        '200': jsonResponse('Изменения с момента since', syncResponseSchema),
                        '400': jsonResponse('Некорректный параметр since', errorResponseSchema),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                    },
                },
            },
            '/schedule/batch': {
                post: {
                    summary: 'Пакетное обновление расписания (upsert + delete одним запросом)',
                    description: 'Применяет несколько изменений за один round-trip через bulkWrite — используется PWA для отправки накопленных офлайн-изменений.',
                    security: [{ bearerAuth: [] }],
                    requestBody: jsonBody(batchRequestSchema),
                    responses: {
                        '200': jsonResponse('Батч применён', batchResponseSchema),
                        '400': jsonResponse('Некорректные данные', errorResponseSchema),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                    },
                },
            },
            '/schedule/{date}': {
                get: {
                    summary: 'Получить дела на конкретный день',
                    security: [{ bearerAuth: [] }],
                    parameters: [dateParam],
                    responses: {
                        '200': jsonResponse('День расписания', scheduleEntrySchema),
                        '400': jsonResponse('Некорректная дата', errorResponseSchema),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                        '404': jsonResponse('На эту дату ничего не запланировано', errorResponseSchema),
                    },
                },
                put: {
                    summary: 'Записать дела на день (создаёт или заменяет)',
                    security: [{ bearerAuth: [] }],
                    parameters: [dateParam],
                    requestBody: jsonBody(scheduleTextSchema),
                    responses: {
                        '200': jsonResponse('День расписания сохранён', scheduleEntrySchema),
                        '400': jsonResponse('Некорректные данные', errorResponseSchema),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                    },
                },
                delete: {
                    summary: 'Удалить дела на день',
                    security: [{ bearerAuth: [] }],
                    parameters: [dateParam],
                    responses: {
                        '204': { description: 'День удалён' },
                        '400': jsonResponse('Некорректная дата', errorResponseSchema),
                        '401': jsonResponse('Не авторизован', errorResponseSchema),
                        '404': jsonResponse('На эту дату ничего не запланировано', errorResponseSchema),
                    },
                },
            },
        },
    };
}

const dateParam = {
    name: 'date',
    in: 'path',
    required: true,
    description: 'Дата в формате YYYY-MM-DD',
    schema: { type: 'string', format: 'date' },
};
