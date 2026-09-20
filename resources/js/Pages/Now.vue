<script setup>
import { router } from '@inertiajs/vue3';

defineProps({
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    week: { type: Number, required: true },
    weekStart: { type: String, required: true },
    days: { type: Array, required: true }, // { date, weekday, content, isToday }
});

function logout() {
    router.post('/logout');
}
</script>

<template>
    <div class="Now NowPage">
        <h1>{{ year }} / месяц {{ month }} / неделя {{ week }} (с {{ weekStart }})</h1>

        <ul>
            <li v-for="day in days" :key="day.date">
                {{ day.date }} (день недели {{ day.weekday }}){{ day.isToday ? ' — сегодня' : '' }}:
                {{ day.content ?? '(пусто)' }}
            </li>
        </ul>

        <a href="/me">Профиль</a>
        <button type="button" @click="logout">Выйти</button>
    </div>
</template>
