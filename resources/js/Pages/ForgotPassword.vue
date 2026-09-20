<script setup>
import { ref } from 'vue';

const step = ref(1);
const email = ref('');
const secretQuestion = ref('');
const secretAnswer = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const error = ref('');
const processing = ref(false);

function xsrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function callApi(url, body) {
    processing.value = true;
    error.value = '';

    try {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-XSRF-TOKEN': xsrfToken(),
            },
            body: JSON.stringify(body),
        });

        const data = await response.json();

        if (!response.ok) {
            error.value = Object.values(data.errors ?? {}).flat().join(' ') || 'Ошибка запроса.';
            return null;
        }

        return data;
    } catch (e) {
        error.value = 'Ошибка сети.';
        return null;
    } finally {
        processing.value = false;
    }
}

async function submitEmail() {
    const data = await callApi('/api/password/question', { email: email.value });
    if (data) {
        secretQuestion.value = data.secretQuestion;
        step.value = 2;
    }
}

async function submitAnswer() {
    const data = await callApi('/api/password/verify', {
        email: email.value,
        secret_answer: secretAnswer.value,
    });
    if (data) {
        step.value = 3;
    }
}

async function submitPassword() {
    const data = await callApi('/api/password/reset', {
        email: email.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
    });
    if (data) {
        step.value = 4;
    }
}
</script>

<template>
    <div class="ForgotPassword ForgotPasswordPage">
        <h1>Восстановление пароля</h1>

        <div v-if="error">{{ error }}</div>

        <form v-if="step === 1" @submit.prevent="submitEmail">
            <label>Email</label>
            <input v-model="email" type="email">
            <button type="submit" :disabled="processing">Далее</button>
        </form>

        <form v-else-if="step === 2" @submit.prevent="submitAnswer">
            <p>{{ secretQuestion }}</p>
            <label>Ответ</label>
            <input v-model="secretAnswer" type="text">
            <button type="submit" :disabled="processing">Далее</button>
        </form>

        <form v-else-if="step === 3" @submit.prevent="submitPassword">
            <label>Новый пароль</label>
            <input v-model="password" type="password">
            <label>Повтор пароля</label>
            <input v-model="passwordConfirmation" type="password">
            <button type="submit" :disabled="processing">Сохранить</button>
        </form>

        <div v-else-if="step === 4">
            <p>Пароль изменён.</p>
            <a href="/login">Войти</a>
        </div>
    </div>
</template>
