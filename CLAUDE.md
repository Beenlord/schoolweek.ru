# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

## Workflow rule — no command execution

Only write/edit code and files. Do not run shell commands of any kind in this repository — no `composer`, `npm`,
`npx`, `vite`, `artisan`, `docker`, `git commit`/`push`, test runners, etc. — even to verify a change (build, lint,
test, migrate). This explicitly includes frontend commands: `npm run dev`, `npm run build`, `npm install`/`npm ci`,
running `vite` directly, or any other Node/npm-based tooling in this repo. The user runs every command themselves.
If a change needs verification (e.g. "does this build"), say so and let the user run it, rather than running it.
This applies to every request in this repo, not just the one that set it.

## Project

schoolweek.ru ("Lemonade") — a digital "school diary": a nostalgia-driven weekly planner/schedule, styled after the
paper school diary, built around a "week on one page" concept. See `README.md` (Russian) for the product pitch.

## Stack

- **Backend**: Laravel 13 (PHP 8.4), installed and runnable (`vendor/`, `artisan`, `app/` all present).
- **Auth**: `laravel/sanctum` ^4.0 (token-based API auth) — installed, config published, but no auth routes/controllers
  exist yet.
- **API docs**: `dedoc/scramble` ^0.13 generates an OpenAPI document from route/validation introspection, served at
  `/docs/api` (config: `config/scramble.php`, access restricted by `RestrictedDocsAccess` middleware).
- **Frontend**: `inertiajs/inertia-laravel` ^3.3 + Vue 3 (server-driven SPA, no separate `web/` app). Pages live in
  `resources/js/Pages/*.vue`, rendered via `Inertia::render(...)` from controllers. Build tooling is wired up:
  `resources/js/app.js` bootstraps `createInertiaApp` (page resolution via `import.meta.glob('./Pages/**/*.vue')`),
  `vite.config.js` registers `laravel-vite-plugin` + `@vitejs/plugin-vue` and an `@` → `resources/js` alias (mirrored
  in `jsconfig.json` for editor IntelliSense), and `package.json` has `dev`/`build` npm scripts (`"type": "module"`
  set since all frontend tooling here is ESM-only). `npm run build`/`npm run dev` both work.
- **Database**: MariaDB (`config/database.php` default connection is `mariadb`, not Laravel's stock `sqlite`).
- **Cache/Queue/Sessions**: Redis for cache and queue (`config/cache.php`, `config/queue.php` both default to
  `redis`); sessions default to Laravel's stock `database` driver (`config/session.php`) — this currently requires
  the `sessions` table, which does have a migration (`database/migrations/..._create_sessions_table.php`).

## Product spec (MVP)

`README.md` (Russian) now contains the actual product spec, agreed with the project owner — read it before
implementing schedule/day or auth features. Highlights, so context isn't lost if `README.md` drifts:

- **Day** is the core content unit: `(userId, date)` → one freeform markdown text field, rendered live (WYSIWYG,
  no raw markdown syntax shown to the user), not split into sub-rows. Week = Monday-anchored, not stored as its own
  entity, just computed.
- **Week grid** mirrors the paper diary spread: Mon/Tue/Wed in one column, Thu/Fri/Sat/Sun in the other, with Sat and
  Sun as two independent half-height cells (not a merged cell). Day-cell previews clip at a fixed number of visual
  lines (~6 for weekdays, ~3 for Sat/Sun) with no line-wrapping — an overlong line is truncated, not wrapped.
- **Week navigation**: swipe forward/back one week; a header showing year/month/week-number opens a calendar-style
  week picker (cells are `[date–date]` ranges instead of days). Week number is counted from the start of the month
  (not ISO), and a week split across two months belongs to whichever month has the majority of its days.
- **Users**: `name` + `email` (login) + `password` + `timezone` (client auto-detected at registration, user-editable)
  + a secret question/answer pair for password recovery. No email verification, no password-reset email flow — MVP
  recovery is entirely secret-question-based. No surname, no sharing/collaboration between users (out of scope).
- Explicitly **out of scope for MVP**: multi-user sharing, reminders/notifications, day version history (only
  current state is stored), markdown beyond basic (lists/emphasis — no tables etc.), offline/PWA sync (not carried
  over from the old Node API below).

## Current state / gaps to be aware of

- **Routing is essentially empty**: `routes/web.php` has a single `/` route to `HomeController` (renders the `Home`
  Inertia page); `routes/api.php` is an empty stub (`<?php` only) — no API endpoints exist yet.
- **No test tooling**: `composer.json` has no `require-dev` section — no PHPUnit/Pest, no `tests/` directory, no
  `phpunit.xml`. There is currently no test or lint command to run.
- **Migrations are minimal**: only `personal_access_tokens` (Sanctum) and `sessions` exist. There is no `users`
  migration yet (per the product spec above, it will need `name`/`email`/`password`/`timezone`/secret-question
  fields — no surname), and no seeders/factories. No `schedule`/`days` migration exists yet either.
- **`app/helpers.php`** defines a custom `routes_path()` helper (autoloaded via `composer.json`'s `autoload.files`)
  used by `bootstrap/app.php`'s `withRouting()` call — this is non-standard Laravel and worth knowing before
  assuming route file locations follow the framework default.
- **`Register`/`Login`/`ForgotPassword`/`Now`/`Me` Vue pages are unstyled functional skeletons**, wired to their
  controllers (real `useForm`/fetch calls, real validation error display) but with no CSS — built specifically to
  manually test the auth + profile-edit flow before any visual design pass. See `CHECKLIST.md` for the manual test
  checklist covering those flows.

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
