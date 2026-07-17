import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Имя обязательно для заполнения'], // Валидация
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, // Создает уникальный индекс в MongoDB
        lowercase: true,
    },
    role: {
        type: String,
        enum: ['user', 'admin'], // Разрешены только эти значения
        default: 'user',
    },
    createdAt: {
        type: Date,
        default: Date.now, // Автоматическая дата создания
    }
});

export default mongoose.model('User', userSchema);
