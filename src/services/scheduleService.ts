import type { AnyBulkWriteOperation } from 'mongoose';
import Schedule, { type ISchedule } from '@/models/Schedule';
import { HttpError } from '@/errors/HttpError';

function toDayStart(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
}

function toIsoWeekday(date: Date): number {
    const day = date.getUTCDay();
    return day === 0 ? 7 : day;
}

function toDto(entry: { date: Date; text: string }) {
    return {
        date: entry.date.toISOString().slice(0, 10),
        weekday: toIsoWeekday(entry.date),
        text: entry.text,
    };
}

function toSyncDto(entry: { date: Date; text: string; deletedAt: Date | null; updatedAt: Date }) {
    return {
        date: entry.date.toISOString().slice(0, 10),
        weekday: toIsoWeekday(entry.date),
        text: entry.text,
        deleted: entry.deletedAt !== null,
        updatedAt: entry.updatedAt.toISOString(),
    };
}

export async function listSchedule(userId: string) {
    const entries = await Schedule.find({ userId, deletedAt: null }).sort({ date: 1 });
    return entries.map(toDto);
}

export async function getScheduleDay(userId: string, dateStr: string) {
    const entry = await Schedule.findOne({ userId, date: toDayStart(dateStr), deletedAt: null });
    if (!entry) {
        throw new HttpError(404, 'На эту дату ничего не запланировано');
    }

    return toDto(entry);
}

export async function upsertScheduleDay(userId: string, dateStr: string, text: string) {
    const entry = await Schedule.findOneAndUpdate(
        { userId, date: toDayStart(dateStr) },
        { $set: { text, deletedAt: null } },
        { upsert: true, new: true },
    );

    return toDto(entry);
}

export async function deleteScheduleDay(userId: string, dateStr: string) {
    const entry = await Schedule.findOneAndUpdate(
        { userId, date: toDayStart(dateStr), deletedAt: null },
        { $set: { deletedAt: new Date() } },
    );

    if (!entry) {
        throw new HttpError(404, 'На эту дату ничего не запланировано');
    }
}

interface BatchInput {
    upserts: { date: string; text: string }[];
    deletes: string[];
}

export async function applyScheduleBatch(userId: string, { upserts, deletes }: BatchInput) {
    const serverTime = new Date();

    const ops: AnyBulkWriteOperation<ISchedule>[] = [
        ...upserts.map(({ date, text }) => ({
            updateOne: {
                filter: { userId, date: toDayStart(date) },
                update: { $set: { text, deletedAt: null } },
                upsert: true,
            },
        })),
        ...deletes.map((date) => ({
            updateOne: {
                filter: { userId, date: toDayStart(date) },
                update: { $set: { deletedAt: serverTime } },
            },
        })),
    ];

    if (ops.length > 0) {
        await Schedule.bulkWrite(ops, { ordered: false });
    }

    return { upserted: upserts.length, deleted: deletes.length, serverTime: serverTime.toISOString() };
}

export async function getScheduleChanges(userId: string, since?: string) {
    const serverTime = new Date();

    const filter = since
        ? { userId, updatedAt: { $gt: new Date(since) } }
        : { userId, deletedAt: null };

    const entries = await Schedule.find(filter).sort({ updatedAt: 1 });

    return { serverTime: serverTime.toISOString(), entries: entries.map(toSyncDto) };
}
