import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
    email: string;
    password: string;
    createdAt: Date;
    comparePassword(candidate: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function (candidate: string) {
    return bcrypt.compare(candidate, this.password);
};

export default mongoose.model<IUser>('User', userSchema);
