<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title inertia>{{ config('app.name', 'Laravel') }}</title>

    {{-- vite-plugin-pwa не может инжектить эти теги сам (Vite не обрабатывает эту Blade-страницу как HTML-энтрипоинт
         — см. комментарий у injectRegister в vite.config.js), поэтому manifest.webmanifest — стандартное имя,
         которое генерирует плагин — и theme-color прописаны здесь руками. --}}
    <link rel="manifest" href="/build/manifest.webmanifest">
    <meta name="theme-color" content="#fbc02d">

    @vite('resources/js/app.js')

    <x-inertia::head />
</head>
<body>
<x-inertia::app />
</body>
</html>
