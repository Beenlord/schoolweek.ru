// Laravel кладёт XSRF-TOKEN в cookie на любой ответ, где стартовала сессия (см. bootstrap/app.php —
// EnsureFrontendRequestsAreStateful). Inertia-визиты читают её сами через axios, а для fetch-запросов
// мимо Inertia-роутера (AJAX-эндпоинты в routes/api.php) заголовок нужно проставлять вручную.
export function xsrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : '';
}
