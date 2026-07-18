import { z } from 'zod';

const MAX_BATCH_SIZE = 366;

export const scheduleTextSchema = z.object({
    text: z.string().max(256),
});

const weekdaySchema = z.int().min(1).max(7);

export const scheduleEntrySchema = z.object({
    date: z.string(),
    weekday: weekdaySchema,
    text: z.string(),
});

export const syncEntrySchema = z.object({
    date: z.string(),
    weekday: weekdaySchema,
    text: z.string(),
    deleted: z.boolean(),
    updatedAt: z.string(),
});

export const syncResponseSchema = z.object({
    serverTime: z.string(),
    entries: z.array(syncEntrySchema),
});

export const batchUpsertItemSchema = z.object({
    date: z.iso.date(),
    text: z.string().max(256),
});

export const batchRequestSchema = z.object({
    upserts: z.array(batchUpsertItemSchema).max(MAX_BATCH_SIZE).default([]),
    deletes: z.array(z.iso.date()).max(MAX_BATCH_SIZE).default([]),
});

export const batchResponseSchema = z.object({
    upserted: z.number(),
    deleted: z.number(),
    serverTime: z.string(),
});
