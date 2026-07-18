import mongoose from 'mongoose';

export interface ISchedule {
    userId: mongoose.Types.ObjectId;
    date: Date;
    text: string;
    deletedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const scheduleSchema = new mongoose.Schema<ISchedule>(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        text: {
            type: String,
            required: true,
            maxlength: 256,
            trim: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

scheduleSchema.index({ userId: 1, date: 1 }, { unique: true });
scheduleSchema.index({ userId: 1, updatedAt: 1 });

export default mongoose.model<ISchedule>('Schedule', scheduleSchema);
