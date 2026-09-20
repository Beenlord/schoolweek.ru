<script setup>
import { useForm } from '@inertiajs/vue3';
import AppLayout from '@/Layouts/AppLayout.vue';

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
</script>

<template>
    <AppLayout>
        <div class="Me MePage mx-auto max-w-lg">
            <h1 class="mb-5 text-xl font-bold text-ink sm:text-2xl">Профиль</h1>

            <form class="ruled-paper flex flex-col gap-4 rounded-xl bg-paper p-6 shadow-sm ring-1 ring-paper-line/70" @submit.prevent="submit">
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
                        <option v-for="q in secretQuestions" :key="q" :value="q">{{ q }}</option>
                    </select>
                    <p v-if="form.errors.secret_question" class="mt-1 text-sm text-error">{{ form.errors.secret_question }}</p>
                </div>

                <div>
                    <label class="mb-1 block text-sm font-semibold text-ink">Новый ответ на секретный вопрос (необязательно)</label>
                    <input
                        v-model="form.secret_answer"
                        type="text"
                        class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                    >
                    <p v-if="form.errors.secret_answer" class="mt-1 text-sm text-error">{{ form.errors.secret_answer }}</p>
                </div>

                <fieldset class="rounded-lg border border-paper-line p-4">
                    <legend class="px-1 text-sm font-semibold text-ink-muted">Смена пароля (необязательно)</legend>

                    <div class="mb-3">
                        <label class="mb-1 block text-sm font-semibold text-ink">Текущий пароль</label>
                        <input
                            v-model="form.current_password"
                            type="password"
                            class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                        >
                        <p v-if="form.errors.current_password" class="mt-1 text-sm text-error">{{ form.errors.current_password }}</p>
                    </div>

                    <div class="mb-3">
                        <label class="mb-1 block text-sm font-semibold text-ink">Новый пароль</label>
                        <input
                            v-model="form.password"
                            type="password"
                            class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                        >
                        <p v-if="form.errors.password" class="mt-1 text-sm text-error">{{ form.errors.password }}</p>
                    </div>

                    <div>
                        <label class="mb-1 block text-sm font-semibold text-ink">Повтор нового пароля</label>
                        <input
                            v-model="form.password_confirmation"
                            type="password"
                            class="w-full rounded-lg border border-paper-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent-dark focus:ring-2 focus:ring-accent/40"
                        >
                    </div>
                </fieldset>

                <div class="flex items-center justify-between">
                    <a href="/now" class="text-sm font-semibold text-ink-muted hover:text-ink">← К дневнику</a>
                    <button
                        type="submit"
                        :disabled="form.processing"
                        class="rounded-full bg-accent px-4 py-2 font-semibold text-ink transition-colors hover:bg-accent-dark disabled:opacity-60"
                    >
                        Сохранить
                    </button>
                </div>
            </form>
        </div>
    </AppLayout>
</template>
