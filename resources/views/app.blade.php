<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1">

    <title inertia>{{ config('app.name', 'Laravel') }}</title>

    {{-- vite-plugin-pwa не может инжектить эти теги сам (Vite не обрабатывает эту Blade-страницу как HTML-энтрипоинт
         — см. комментарий у injectRegister в vite.config.js), поэтому manifest.webmanifest — стандартное имя,
         которое генерирует плагин — и theme-color прописаны здесь руками.

         Ссылка на манифест — только когда приложение работает на сборке: под `npm run dev` файлы Vite отдаёт
         со своего порта, в public/build ничего не лежит, и этот тег дал бы ровно такой же 404, как dev-sw.js
         (см. комментарий у devOptions в vite.config.js). --}}
    @unless (\Illuminate\Support\Facades\Vite::isRunningHot())
        <link rel="manifest" href="/build/manifest.webmanifest">
    @endunless
    <meta name="theme-color" content="#fbc02d">

    {{-- Иконки — из готового экспорта в public/favicon/ (см. icons в vite.config.js). Отдельного favicon.ico
         в наборе нет, поэтому ссылки на PNG прописаны явно: без них браузер пойдёт за /favicon.ico и получит
         404-страницу Laravel. Размеры соответствуют Android-бакетам плотности (mdpi 48, xhdpi 96, xxxhdpi 192)
         и именам iOS-файлов (60x60@3x = 180). --}}
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon/android/mipmap-mdpi/lemonade.png">
    <link rel="icon" type="image/png" sizes="96x96" href="/favicon/android/mipmap-xhdpi/lemonade.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon/android/mipmap-xxxhdpi/lemonade.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/favicon/ios/AppIcon.appiconset/Icon-App-60x60@3x.png">

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

    @vite('resources/js/app.js')

    <x-inertia::head />
</head>
<body>
<x-inertia::app />
</body>
</html>
