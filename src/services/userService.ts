import User from '@/models/User';
import { HttpError } from '@/errors/HttpError';

export async function getUserProfile(userId: string) {
    const user = await User.findById(userId).select('email createdAt');
    if (!user) {
        throw new HttpError(404, 'Пользователь не найден');
    }

    return { id: user.id, email: user.email, createdAt: user.createdAt };
}
