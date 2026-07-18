import User from '@/models/User';
import Session from '@/models/Session';
import { generateToken } from '@/utils/token';
import { HttpError } from '@/errors/HttpError';
import { config } from '@/config';

interface AuthResult {
    token: string;
    expiresAt: Date;
}

async function createSession(userId: string): Promise<AuthResult> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + config.session.ttlMs);
    await Session.create({ userId, token, expiresAt });
    return { token, expiresAt };
}

export async function registerUser(email: string, password: string): Promise<AuthResult> {
    if (await User.exists({ email })) {
        throw new HttpError(409, 'Пользователь с таким email уже существует');
    }

    const user = await User.create({ email, password });
    return createSession(user.id);
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
        throw new HttpError(401, 'Неверный email или пароль');
    }

    return createSession(user.id);
}

export async function logoutUser(token: string): Promise<void> {
    await Session.deleteOne({ token });
}
