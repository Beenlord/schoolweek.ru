# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

schoolweek.ru ("Lemonade") — a digital "school diary": a nostalgia-driven weekly planner/schedule, styled after the
paper school diary, built around a "week on one page" concept. See `README.md` (Russian) for the product pitch.

## Stack

- **Backend**: Laravel 13 (PHP 8.4), installed and runnable (`vendor/`, `artisan`, `app/` all present).
- **Auth**: `laravel/sanctum` ^4.0 (token-based API auth) — installed, config published, but no auth routes/controllers
  exist yet.
- **API docs**: `dedoc/scramble` ^0.13 generates an OpenAPI document from route/validation introspection, served at
  `/docs/api` (config: `config/scramble.php`, access restricted by `RestrictedDocsAccess` middleware).
- **Frontend**: `inertiajs/inertia-laravel` ^3.3 + Vue (server-driven SPA, no separate `web/` app). Pages live in
  `resources/js/Pages/*.vue`, rendered via `Inertia::render(...)` from controllers.
- **Database**: MariaDB (`config/database.php` default connection is `mariadb`, not Laravel's stock `sqlite`).
- **Cache/Queue/Sessions**: Redis for cache and queue (`config/cache.php`, `config/queue.php` both default to
  `redis`); sessions default to Laravel's stock `database` driver (`config/session.php`) — this currently requires
  the `sessions` table, which does have a migration (`database/migrations/..._create_sessions_table.php`).

## Current state / gaps to be aware of

- **Routing is essentially empty**: `routes/web.php` has a single `/` route to `HomeController` (renders the `Home`
  Inertia page); `routes/api.php` is an empty stub (`<?php` only) — no API endpoints exist yet.
- **Frontend build tooling is not wired up**: `resources/js/app.js` (the Inertia entry point) is empty and there is
  no `vite.config.*`; `package.json` has no dependencies/devDependencies listed (no Vue, Inertia client, or Vite
  packages installed) despite `resources/js/Pages/Home.vue` existing. Don't assume `npm run dev`/`npm run build`
  work until this is set up.
- **No test tooling**: `composer.json` has no `require-dev` section — no PHPUnit/Pest, no `tests/` directory, no
  `phpunit.xml`. There is currently no test or lint command to run.
- **Migrations are minimal**: only `personal_access_tokens` (Sanctum) and `sessions` exist. There is no `users`
  migration yet, and no seeders/factories.
- **`app/helpers.php`** defines a custom `routes_path()` helper (autoloaded via `composer.json`'s `autoload.files`)
  used by `bootstrap/app.php`'s `withRouting()` call — this is non-standard Laravel and worth knowing before
  assuming route file locations follow the framework default.

## Config file convention (established, keep following it)

All `config/*.php` files in this repo have been normalized to Laravel's standard comment-block style, with one
project-specific twist: **section header lines stay in English** (e.g. `| Default Database Connection Name`), but
the **body/description text is translated into Russian**. When editing or adding config files, match this pattern
rather than the framework's stock all-English comments or a fully-Russian header.

## Docker / running the app

- `Dockerfile` is a 3-stage build: `base` (PHP 8.4-FPM Alpine + extensions: redis, imagick, gd, intl, pdo_mysql,
  etc. — published separately to Docker Hub as `vovikko/alpine-php-fpm`, see `README.md`'s "Сборка" section for the
  build/push commands) → `vendor` (runs `composer install` against `vovikko/alpine-php-fpm`) → final stage that
  copies the app and `vendor/` from the `vendor` stage.
- `compose.yml` defines `app` (PHP/Laravel), `mariadb`, and `redis` services. `mariadb` and `redis` have
  healthchecks, and `app` depends on both via `condition: service_healthy` — this matters because
  `scripts/entrypoint.sh` runs `php artisan migrate` immediately on container start, before serving; without the
  healthcheck gate this races against MariaDB/Redis still initializing.
- `scripts/entrypoint.sh` on every container start: fixes storage/bootstrap-cache permissions, runs
  `composer dump-autoload`, `php artisan migrate`, clears cache/route caches, then starts `queue:work` and
  `schedule:work` in the background before `php artisan serve --host=0.0.0.0 --port=8000` in the foreground.
- No `.env` values are baked into the image; `DB_*`/`REDIS_*` are injected via `compose.yml`'s `environment:` block
  (with `APP_NAME`-based defaults), and `docker compose up --build` is the expected way to run the whole stack.

## Prior architecture (Node/Koa, for product-parity reference only)

The backend was previously a Node.js/TypeScript (Koa + Mongoose/MongoDB) API; that source tree has been deleted, but
its shape is useful context when deciding what the Laravel equivalents should look like:

- Resources: auth (bearer-token sessions, not JWT), users, schedule (day-keyed by `(userId, date)` with soft-delete
  for offline PWA sync via `/schedule/sync?since=` and a `/schedule/batch` bulk endpoint), health, and an OpenAPI
  document generated from the same validation schemas (now the role `dedoc/scramble` fills).

Confirm actual endpoint/data-model parity requirements with the project owner before porting logic — don't assume
1:1 translation from the old API is wanted.