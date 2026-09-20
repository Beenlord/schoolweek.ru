<script setup>
import { router, useForm } from '@inertiajs/vue3';

const props = defineProps({
    user: { type: Object, required: true },
    secretQuestions: { type: Array, required: true },
});

const form = useForm({
    name: props.user.name,
    email: props.user.email,
    timezone: props.user.timezone,
    secret_question: props.user.secret_question,
    secret_answer: '',
    current_password: '',
    password: '',
    password_confirmation: '',
});

function submit() {
    form.patch('/me', {
        preserveScroll: true,
        onSuccess: () => form.reset('current_password', 'password', 'password_confirmation', 'secret_answer'),
    });
}

function logout() {
    router.post('/logout');
}
</script>

<template>
    <div class="Me MePage">
        <h1>Профиль</h1>

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
                <label>Часовой пояс</label>
                <input v-model="form.timezone" type="text">
                <div v-if="form.errors.timezone">{{ form.errors.timezone }}</div>
            </div>

            <div>
                <label>Секретный вопрос</label>
                <select v-model="form.secret_question">
                    <option v-for="q in secretQuestions" :key="q" :value="q">{{ q }}</option>
                </select>
                <div v-if="form.errors.secret_question">{{ form.errors.secret_question }}</div>
            </div>

            <div>
                <label>Новый ответ на секретный вопрос (необязательно)</label>
                <input v-model="form.secret_answer" type="text">
                <div v-if="form.errors.secret_answer">{{ form.errors.secret_answer }}</div>
            </div>

            <fieldset>
                <legend>Смена пароля (необязательно)</legend>

                <label>Текущий пароль</label>
                <input v-model="form.current_password" type="password">
                <div v-if="form.errors.current_password">{{ form.errors.current_password }}</div>

                <label>Новый пароль</label>
                <input v-model="form.password" type="password">
                <div v-if="form.errors.password">{{ form.errors.password }}</div>

                <label>Повтор нового пароля</label>
                <input v-model="form.password_confirmation" type="password">
            </fieldset>

            <button type="submit" :disabled="form.processing">Сохранить</button>
        </form>

        <a href="/now">К дневнику</a>

        <button type="button" @click="logout">Выйти</button>
    </div>
</template>
