<script setup>
import { useForm } from '@inertiajs/vue3';
import AuthLayout from '@/Layouts/AuthLayout.vue';

// Галочки «запомнить меня» нет: вход всегда запоминает пользователя, см. комментарий
// в AuthenticatedSessionController::store.
const form = useForm({
    email: '',
    password: '',
});

function submit() {
    form.post('/login');
}
</script>

<template>
    <AuthLayout>
        <template #title>Вход</template>

        <form class="Login LoginPage flex flex-col gap-4" @submit.prevent="submit">
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

            <button
                type="submit"
                :disabled="form.processing"
                class="mt-2 rounded-full bg-accent px-4 py-2 font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
            >
                Войти
            </button>
        </form>

        <template #footer>
            <a href="/register" class="hover:text-ink">Ещё нет аккаунта? Зарегистрироваться</a>
            <a href="/forgot-password" class="hover:text-ink">Забыли пароль?</a>
        </template>
    </AuthLayout>
</template>
