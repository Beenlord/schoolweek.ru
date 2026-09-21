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
  `vite.config.js` registers `laravel-vite-plugin` + `@vitejs/plugin-vue` and `@` → `resources/js` / `@css` →
  `resources/css` aliases (both mirrored in `jsconfig.json` for editor IntelliSense), and `package.json` has
  `dev`/`build` npm scripts (`"type": "module"` set since all frontend tooling here is ESM-only). `npm run
  build`/`npm run dev` both work.
- **Styling**: Tailwind CSS 4 (`tailwindcss` + `@tailwindcss/vite` in `devDependencies`) via CSS-first config —
  `resources/css/app.css` (plain CSS, not `.scss`: Tailwind v4 explicitly recommends against pairing itself with a
  Sass/Less/Stylus preprocessor — its `@theme`/`@apply` at-rules aren't guaranteed to survive being piped through
  `sass` first — and nothing here actually needed Sass-specific syntax), imported from `resources/js/app.js`, holds
  the "тетрадный" design tokens (`@theme`: paper/ink/accent colors, `Caveat`/`Nunito` fonts) plus `.ruled-paper`/
  `.ruled-margin` helper classes used by the day-grid on `/now`. `sass` is still a listed devDependency but nothing
  in the tree uses it anymore — keep it only if you're intentionally planning non-Tailwind-entry `.scss` files.
- **PWA**: `vite-plugin-pwa` (`devDependencies`) is registered in `vite.config.js`, wired for Laravel's lack of a
  Vite-processed HTML entry: `injectRegister: false` (auto-injection has nowhere to attach — Vite only ever sees
  `resources/js/app.js` via `@vite()`, never `resources/views/app.blade.php`), manual registration instead via
  `import { registerSW } from 'virtual:pwa-register'` in `app.js`, and a hand-written `<link rel="manifest"
  href="/manifest.webmanifest">` + `<meta name="theme-color">` in `app.blade.php` (`manifest.webmanifest` is the
  plugin's default output filename — don't rename one side without the other). `devOptions.enabled: true` so the SW
  and manifest also build under `npm run dev`, not just `vite build`. Manifest content (name/description/
  theme_color/start_url `/now`/categories) is filled in for the project; `theme_color`/`background_color` are
  explicitly placeholder lemon-yellow pending real design.
  **Icons**: `public/favicon/` holds an app-icon export (easyappicon) — Android `mipmap-*` density buckets plus an
  iOS `AppIcon.appiconset`. Nothing in it is a web icon set (no `.ico`, no 32×32, no SVG), so the manifest and
  `app.blade.php` reference files from it by their known sizes rather than new copies: 192×192 =
  `android/mipmap-xxxhdpi/lemonade.png`, 512×512 = `android/ic_launcher-web.png`, `purpose: maskable` =
  `android/playstore-icon.png` (the only asset that's opaque edge-to-edge — `ic_launcher-web.png` has transparent
  rounded corners a square mask would expose), apple-touch-icon = `ios/AppIcon.appiconset/Icon-App-60x60@3x.png`.
  Manifest `src` paths must stay absolute (the manifest is emitted to `public/build/`, so relative paths would
  resolve against `/build/`). The Android XML/`Contents.json` files in the export are dead weight for the web but
  kept so the set stays a re-importable whole.
- **Offline sync for `/now`** (only page that's offline-capable — everything else needs the server, see Product spec
  below): `vite.config.js`'s `VitePWA({ workbox: { runtimeCaching: [...] } })` caches navigations to `/now`
  specifically (`NetworkFirst`, 3s timeout) — not app-shell-wide `navigateFallback`, since Workbox's fallback
  mechanism expects a precached static file and there isn't one (every Laravel route is server-rendered per
  request); this only makes reload/reopen of `/now` work offline, not in-app Inertia navigation *to* `/now` from
  elsewhere while offline. `resources/js/offline/db.js` (`idb` wrapper, single `days` store keyed by `date`, a
  `dirty` field + index for unsynced local edits) is the actual source of truth for what `/now` displays when
  offline — `Pages/Now.vue`'s `onMounted` overwrites the (possibly stale, cached-HTML) props with IndexedDB's state
  when `!navigator.onLine`. `resources/js/offline/sync.js` pushes dirty days to `POST /api/days/batch` then pulls
  `GET /api/days/sync?since=<cursor>` (cursor = server's own clock from the last sync, in `localStorage`, to avoid
  client clock drift) — wired to run on app boot and on the `online` event in `app.js`.
  `App\Http\Controllers\Api\DayController::batch()` resolves conflicts last-write-wins by the *client's claimed
  edit timestamp*, not receipt time (a slow-to-arrive offline edit must not beat a genuinely newer edit from
  another device) — and forces `$day->timestamps = false` before manually setting `updated_at` to that timestamp,
  since Eloquent's auto-touch would otherwise stamp it with server-receipt time instead. Day editing on `/now` is
  currently a bare `<textarea>` per day (autosave on blur) — proves the save/offline-queue mechanism, not the
  planned modal WYSIWYG editor from the product spec.
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
- **Responsive**: must be comfortable on desktop/tablet/phone, not just non-broken. Week-swipe gets a button
  fallback (prev/next), hidden below a 768px viewport-width breakpoint (phone — swipe is the only nav there),
  shown at ≥768px (tablet/desktop) — breakpoint is by width, not `pointer: coarse/fine`, since tablets are touch too.
- **Offline / PWA**: this WAS out of scope, the project owner reversed that decision — now required, and built (see
  "Stack" above for the concrete mechanism: `vite-plugin-pwa` + IndexedDB via `idb` + `DayController::sync`/`batch`).
  Installable (`manifest.json`, `display: standalone`); only `/now` is offline-capable — last-loaded week/days stay
  viewable and editable without a connection, unsynced edits queue locally and auto-push on reconnect. Conflict
  resolution is **last-write-wins by edit timestamp**, no manual-merge UI. Mirrors the old Node API's
  `/schedule/sync?since=` + `/schedule/batch` pattern, see "Prior architecture" below. Still needed: icon files
  (see "Stack"), and the real modal WYSIWYG day editor (`/now` currently just autosaves a plain `<textarea>`).
- Explicitly **out of scope for MVP**: multi-user sharing, reminders/notifications, day version history (only
  current state is stored), markdown beyond basic (lists/emphasis — no tables etc.), manual conflict-resolution UI
  (conflicts auto-resolve, see Offline/PWA above).

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
1:1 translation from the old API is wanted. One confirmed exception: the project owner explicitly asked for the
offline-sync pattern (`/schedule/sync?since=` + `/schedule/batch`, soft-delete) back — see "Product spec (MVP)"
above, "Offline / PWA" — so that piece can be ported/adapted rather than re-derived from scratch. Note the old API's
`content` field wasn't user-facing markdown rendered live the same way — check current requirements before assuming
other fields transfer as-is.
