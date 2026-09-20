<script setup>
import { useForm } from '@inertiajs/vue3';

const form = useForm({
    email: '',
    password: '',
    remember: false,
});

function submit() {
    form.post('/login');
}
</script>

<template>
    <div class="Login LoginPage">
        <h1>Вход</h1>

        <form @submit.prevent="submit">
            <div>
                <label>Email</label>
                <input v-model="form.email" type="email">
                <div v-if="form.errors.email">{{ form.errors.email }}</div>
            </div>

            <div>
                <label>Пароль</label>
                <input v-model="form.password" type="password">
                <div v-if="form.errors.password">{{ form.errors.password }}</div>
            </div>

            <label>
                <input v-model="form.remember" type="checkbox">
                Запомнить меня
            </label>

            <button type="submit" :disabled="form.processing">Войти</button>
        </form>

        <a href="/register">Регистрация</a>
        <a href="/forgot-password">Забыли пароль?</a>
    </div>
</template>
