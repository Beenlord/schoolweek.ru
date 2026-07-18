import User from '@/models/User';
import { config } from '@/config';

export async function seedAdmin() {
    if (await User.exists({})) return;

    await User.create({ email: config.admin.email, password: config.admin.password });
    console.log(`База данных пуста: создан пользователь по умолчанию ${config.admin.email}`);
}
