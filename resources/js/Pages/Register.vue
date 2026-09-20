<script setup>
import { useForm } from '@inertiajs/vue3';
import AuthLayout from '@/Layouts/AuthLayout.vue';

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
    <AuthLayout>
        <template #title>Регистрация</template>

        <form class="Register RegisterPage flex flex-col gap-4" @submit.prevent="submit">
            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Имя</label>
                <input
                    v-model="form.name"
                    type="text"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
                <p v-if="form.errors.name" class="mt-1 text-sm text-error">{{ form.errors.name }}</p>
            </div>

            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Email</label>
                <input
                    v-model="form.email"
                    type="email"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
                <p v-if="form.errors.email" class="mt-1 text-sm text-error">{{ form.errors.email }}</p>
            </div>

            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Пароль</label>
                <input
                    v-model="form.password"
                    type="password"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
                <p v-if="form.errors.password" class="mt-1 text-sm text-error">{{ form.errors.password }}</p>
            </div>

            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Повтор пароля</label>
                <input
                    v-model="form.password_confirmation"
                    type="password"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
            </div>

            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Часовой пояс</label>
                <input
                    v-model="form.timezone"
                    type="text"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
                <p v-if="form.errors.timezone" class="mt-1 text-sm text-error">{{ form.errors.timezone }}</p>
            </div>

            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Секретный вопрос</label>
                <select
                    v-model="form.secret_question"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
                    <option value="" disabled>Выберите вопрос</option>
                    <option v-for="q in secretQuestions" :key="q" :value="q">{{ q }}</option>
                </select>
                <p v-if="form.errors.secret_question" class="mt-1 text-sm text-error">{{ form.errors.secret_question }}</p>
            </div>

            <div>
                <label class="mb-1 block text-sm font-semibold text-ink">Ответ на секретный вопрос</label>
                <input
                    v-model="form.secret_answer"
                    type="text"
                    class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                >
                <p v-if="form.errors.secret_answer" class="mt-1 text-sm text-error">{{ form.errors.secret_answer }}</p>
            </div>

            <button
                type="submit"
                :disabled="form.processing"
                class="mt-2 rounded-full bg-accent px-4 py-2 font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
            >
                Зарегистрироваться
            </button>
        </form>

        <template #footer>
            <a href="/login" class="hover:text-ink">Уже есть аккаунт? Войти</a>
        </template>
    </AuthLayout>
</template>
