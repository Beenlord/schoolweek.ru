import type { Context } from 'koa';
import { z } from 'zod';
import * as scheduleService from '@/services/scheduleService';
import { scheduleTextSchema, batchRequestSchema } from '@/schemas/schedule';

const dateParamSchema = z.iso.date();
const sinceQuerySchema = z.iso.datetime().optional();

function parseDateParam(ctx: Context): string | null {
    const parsed = dateParamSchema.safeParse(ctx.params.date);
    return parsed.success ? parsed.data : null;
}

function invalidDate(ctx: Context) {
    ctx.status = 400;
    ctx.body = { error: 'Некорректная дата, ожидается формат YYYY-MM-DD' };
}

export async function list(ctx: Context) {
    ctx.body = await scheduleService.listSchedule(ctx.state.userId);
}

export async function getDay(ctx: Context) {
    const date = parseDateParam(ctx);
    if (!date) {
        invalidDate(ctx);
        return;
    }

    ctx.body = await scheduleService.getScheduleDay(ctx.state.userId, date);
}

export async function upsertDay(ctx: Context) {
    const date = parseDateParam(ctx);
    if (!date) {
        invalidDate(ctx);
        return;
    }

    const parsed = scheduleTextSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        ctx.status = 400;
        ctx.body = { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' };
        return;
    }

    ctx.body = await scheduleService.upsertScheduleDay(ctx.state.userId, date, parsed.data.text);
}

export async function removeDay(ctx: Context) {
    const date = parseDateParam(ctx);
    if (!date) {
        invalidDate(ctx);
        return;
    }

    await scheduleService.deleteScheduleDay(ctx.state.userId, date);
    ctx.status = 204;
}

export async function batch(ctx: Context) {
    const parsed = batchRequestSchema.safeParse(ctx.request.body);
    if (!parsed.success) {
        ctx.status = 400;
        ctx.body = { error: parsed.error.issues[0]?.message ?? 'Некорректные данные' };
        return;
    }

    ctx.body = await scheduleService.applyScheduleBatch(ctx.state.userId, parsed.data);
}

export async function sync(ctx: Context) {
    const parsedSince = sinceQuerySchema.safeParse(ctx.query.since);
    if (!parsedSince.success) {
        ctx.status = 400;
        ctx.body = { error: 'Некорректный параметр since, ожидается ISO-дата со временем' };
        return;
    }

    ctx.body = await scheduleService.getScheduleChanges(ctx.state.userId, parsedSince.data);
}
