<script setup>
import { ref } from 'vue';
import { xsrfToken } from '@/csrf.js';
import AuthLayout from '@/Layouts/AuthLayout.vue';

const step = ref(1);
const email = ref('');
const secretQuestion = ref('');
const secretAnswer = ref('');
const password = ref('');
const passwordConfirmation = ref('');
const error = ref('');
const processing = ref(false);

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
    <AuthLayout>
        <template #title>Восстановление пароля</template>

        <div class="ForgotPassword ForgotPasswordPage flex flex-col gap-4">
            <p v-if="error" class="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{{ error }}</p>

            <form v-if="step === 1" class="flex flex-col gap-4" @submit.prevent="submitEmail">
                <div>
                    <label class="mb-1 block text-sm font-semibold text-ink">Email</label>
                    <input
                        v-model="email"
                        type="email"
                        class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                    >
                </div>
                <button
                    type="submit"
                    :disabled="processing"
                    class="rounded-full bg-accent px-4 py-2 font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
                >
                    Далее
                </button>
            </form>

            <form v-else-if="step === 2" class="flex flex-col gap-4" @submit.prevent="submitAnswer">
                <p class="text-ink">{{ secretQuestion }}</p>
                <div>
                    <label class="mb-1 block text-sm font-semibold text-ink">Ответ</label>
                    <input
                        v-model="secretAnswer"
                        type="text"
                        class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                    >
                </div>
                <button
                    type="submit"
                    :disabled="processing"
                    class="rounded-full bg-accent px-4 py-2 font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
                >
                    Далее
                </button>
            </form>

            <form v-else-if="step === 3" class="flex flex-col gap-4" @submit.prevent="submitPassword">
                <div>
                    <label class="mb-1 block text-sm font-semibold text-ink">Новый пароль</label>
                    <input
                        v-model="password"
                        type="password"
                        class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                    >
                </div>
                <div>
                    <label class="mb-1 block text-sm font-semibold text-ink">Повтор пароля</label>
                    <input
                        v-model="passwordConfirmation"
                        type="password"
                        class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                    >
                </div>
                <button
                    type="submit"
                    :disabled="processing"
                    class="rounded-full bg-accent px-4 py-2 font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
                >
                    Сохранить
                </button>
            </form>

            <div v-else-if="step === 4" class="text-center">
                <p class="mb-3 text-ink">Пароль изменён.</p>
                <a href="/login" class="font-semibold text-accent-dark hover:underline">Войти</a>
            </div>
        </div>

        <template #footer>
            <a href="/login" class="hover:text-ink">Вернуться ко входу</a>
        </template>
    </AuthLayout>
</template>
