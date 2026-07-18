export const config = {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST ?? 'localhost',
    mongoUri: process.env.MONGO_URI ?? 'mongodb://localhost:27017/schoolweek',
    admin: {
        email: 'admin@admin.ru',
        password: 'admin',
    },
    session: {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
    },
    auth: {
        passwordMinLength: 8,
    },
} as const;
