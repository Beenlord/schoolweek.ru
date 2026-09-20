<script setup>
import { useForm } from '@inertiajs/vue3';

defineProps({
    secretQuestions: { type: Array, required: true },
});

const form = useForm({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    secret_question: '',
    secret_answer: '',
});

function submit() {
    form.post('/register');
}
</script>

<template>
    <div class="Register RegisterPage">
        <h1>Регистрация</h1>

        <form @submit.prevent="submit">
            <div>
                <label>Имя</label>
                <input v-model="form.name" type="text">
                <div v-if="form.errors.name">{{ form.errors.name }}</div>
            </div>

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

            <div>
                <label>Повтор пароля</label>
                <input v-model="form.password_confirmation" type="password">
            </div>

            <div>
                <label>Часовой пояс</label>
                <input v-model="form.timezone" type="text">
                <div v-if="form.errors.timezone">{{ form.errors.timezone }}</div>
            </div>

            <div>
                <label>Секретный вопрос</label>
                <select v-model="form.secret_question">
                    <option value="" disabled>Выберите вопрос</option>
                    <option v-for="q in secretQuestions" :key="q" :value="q">{{ q }}</option>
                </select>
                <div v-if="form.errors.secret_question">{{ form.errors.secret_question }}</div>
            </div>

            <div>
                <label>Ответ на секретный вопрос</label>
                <input v-model="form.secret_answer" type="text">
                <div v-if="form.errors.secret_answer">{{ form.errors.secret_answer }}</div>
            </div>

            <button type="submit" :disabled="form.processing">Зарегистрироваться</button>
        </form>

        <a href="/login">Уже есть аккаунт? Войти</a>
    </div>
</template>
