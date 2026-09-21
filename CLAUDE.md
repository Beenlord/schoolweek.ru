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
- **Auth**: session-based, on the stock `web` guard — `laravel/sanctum` ^4.0 is present only so `auth:sanctum` on
  `routes/api.php` accepts the app's own session (`EnsureFrontendRequestsAreStateful`); no bearer tokens are
  issued anywhere. `config/auth.php` **is published** (it was not, before per-device remember tokens) and points
  the `users` provider at the custom driver `eloquent-devices`.
  **Remember-me is per device**: `users.remember_token` is gone; each login inserts a row into `remember_tokens`
  (sha256 of the token, `user_agent`, sliding `expires_at`). `App\Auth\DeviceRememberUserProvider` overrides only
  `retrieveByToken`/`updateRememberToken` on `EloquentUserProvider` — the recaller cookie itself stays pure
  Laravel. `App\Models\User` keeps the token in a plain in-memory property (`getRememberToken`/`setRememberToken`
  overridden, `getRememberTokenName()` returns `null`) so Eloquent never tries to persist a column that no longer
  exists; a side effect that the design relies on is that a session-loaded user has an empty token, which makes
  `SessionGuard::logout()` skip `cycleRememberToken()` and stops stray rows appearing. Revocation is explicit, via
  `App\Auth\DeviceTokens`: logout drops **this** device, a profile password change drops **other** devices, and a
  secret-question password reset drops **all** of them.
- **API docs**: `dedoc/scramble` ^0.13 generates an OpenAPI document from route/validation introspection, served at
  `/docs/api` (config: `config/scramble.php`, access restricted by `RestrictedDocsAccess` middleware).
- **Frontend**: `inertiajs/inertia-laravel` ^3.3 + Vue 3 (server-driven SPA, no separate `web/` app). Pages live in
  `resources/js/Pages/*.vue`, rendered via `Inertia::render(...)` from controllers. Build tooling is wired up:
  `resources/js/app.js` bootstraps `createInertiaApp` (page resolution via `import.meta.glob('./Pages/**/*.vue')`),
  `vite.config.js` registers `laravel-vite-plugin` + `@vitejs/plugin-vue` and `@` → `resources/js` / `@css` →
  `resources/css` aliases (both mirrored in `jsconfig.json` for editor IntelliSense), and `package.json` has
  `dev`/`build` npm scripts (`"type": "module"` set since all frontend tooling here is ESM-only). `npm run
  build`/`npm run dev` both work.
- **Day editor**: Tiptap 3 (`@tiptap/vue-3`, `@tiptap/starter-kit`, `@tiptap/extension-list`, `@tiptap/pm`) inside
  a modal (`Components/DayModal.vue` → `Components/DayEditor.vue`), replacing the old inline `<textarea>`.
  `days.content` **stays markdown**; conversion both ways lives in `resources/js/markdown.js`, hand-written
  rather than via `tiptap-markdown`, and round-trip stability is the contract — `serializeDoc` escapes anything
  that would re-parse as markup. Nested lists are supported because Tab creates them and silently dropping them
  on save would destroy user content. **StarterKit deliberately disables headings/blockquote/code/strike/link/
  hardBreak**: the serializer has no representation for them, so allowing their creation would lose formatting
  at save time — if you add a node type to the editor, add it to `markdown.js` in the same change.
  `Components/RichText.vue` renders the same content read-only for week-grid previews via `h()`, never `v-html`,
  which is why there is no HTML sanitizer anywhere — there is no injection path to sanitize.
  The toolbar is a plain footer inside the modal. It ends up above the on-screen keyboard without any
  positioning of its own: `composables/useKeyboardInset.js` reports the keyboard height and the visual
  viewport's `offsetTop`, the modal shrinks to the visible area via padding, and its bottom edge therefore
  *is* the top of the keyboard. Don't reintroduce `position: fixed` on the toolbar — that was the earlier
  design and it needed a breakpoint plus per-frame offsets to do the same job. Editor state still flows through the
  existing `saveSoon`/`saveDay`/IndexedDB path unchanged — content is a plain string to everything downstream.
- **Search** (`Components/DaySearch.vue` + `searchDays` in `offline/db.js`) runs **entirely against IndexedDB**,
  online included — there is no server endpoint and none is needed, because the first `sync` (no cursor) returns
  *every* day the user has, so the local copy is the full corpus, not just visited weeks. Offline support falls
  out of that for free. It also **cannot be its own route**: the service worker only caches `/now`, so `/search`
  would not open offline — hence an overlay inside `/now`, with the trigger in the page's `#bottom-bar` slot
  rather than in `AppLayout` (there is nothing to search on `/me`). Two implementation constraints worth keeping:
  the scan walks a cursor newest-first and stops at the limit, and matching uses a pre-compiled `RegExp` rather
  than `content.toLowerCase().includes()` — the latter allocates a copy of every day's text on every keystroke.
  Storage is *not* a concern people should "fix": the corpus predates search and is a few MB per decade.
- **Events** (`events` table, `App\Models\Event`, `Api\EventController`) — see README, «События», for the spec.
  Recurrence is an *optional property*, not the concept: `frequency` is `once|daily|weekly|monthly|yearly` and
  `once` is the default. The server stores **rules only**; expanding a rule into actual dates happens **only on
  the client** (`resources/js/events.js`). There is deliberately no "events for week X" endpoint — a PHP copy of
  that calendar would be a second `WeekCalculator`-style duplicate to keep in sync.
  - `repeat_on` is one nullable JSON column holding weekdays `1–7` for `weekly` or days-of-month `1–31` for
    `monthly`, and `null` otherwise. One column rather than two because only one is ever in use and the
    frequency makes the meaning unambiguous. `EventController::normalized()` **nulls out fields that don't
    apply** to the chosen frequency instead of storing them "just in case".
  - Day-of-month values **clamp to the last day of short months** rather than skipping (owner's decision), and
    the same rule covers 29 February for `yearly`. Useful consequence: picking the 31st gives "last day of the
    month" for every month.
  - Rows are **soft-deleted** and `sync` returns deleted ones with `deleted: true` — unlike days, events get
    removed, and a hard delete would leave them alive forever on every other device.
  - Colours are palette keys (`Event::COLORS` ↔ `EVENT_COLORS` in `events.js` ↔ `--color-event-*` tokens); the
    Tailwind classes are spelled out in a literal map in `events.js` because `bg-event-${color}` would never be
    found by the scanner.
  - **No list screen, by design**: the panel button creates, and editing is reached by clicking the event's
    strip in the calendar. Creating/editing needs the network; viewing works offline from IndexedDB store
    `events`. Strips are pinned below the day cell's scroll area (capped at 2 + "ещё N", because they take
    that space permanently) and sit above the text *inside* the scroll in the day editor.
  - `remind` / `remind_minutes_before` columns exist, but **delivery is not built yet** — see README for the
    push design (client uploads computed occurrence timestamps so the server still never learns the rules).
  - The feature carries a **`beta` badge** in `EventModal`'s header, precisely because that toggle saves but
    does nothing yet. Drop the badge when push delivery ships, not before.
- **Date/util libs**: `dayjs` and `lodash` (both `dependencies`). **Never `import dayjs from 'dayjs'` directly** —
  import it from `resources/js/dayjs.js`, which is the one place plugins are registered (`utc` → `timezone` →
  `isoWeek`, in that order; `timezone` is built on `utc`). `extend()` mutates the dayjs module globally, so
  scattering `extend` calls makes `.tz()`/`.isoWeekday()` depend on module load order, which the bundler decides.
  That module also exports `guessTimezone()` (`dayjs.tz.guess()`), used by `Register.vue` to prefill the profile
  and by `Now.vue` as a fallback. lodash is imported per method (`import keyBy from 'lodash/keyBy'`), never as a
  whole — the package is CJS and a namespace import would drag the entire library into an offline-first bundle.
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
  plugin's default output filename — don't rename one side without the other). **`devOptions.enabled` is `false`
  and must stay that way**: the dev service worker is served by the Vite dev server at `/dev-sw.js?dev-sw`, but the
  page comes from Laravel on a different port, and `serviceWorker.register()` resolves relative to the *page*
  origin — so the request lands on Laravel and 404s. It can't be pointed at the Vite port either, since a service
  worker script must be same-origin as its page. Consequently **there is no PWA under `npm run dev` at all**:
  `registerSW` is guarded by `import.meta.env.PROD` in `app.js`, and the `<link rel="manifest">` is wrapped in
  `@unless (Vite::isRunningHot())` (nothing exists in `public/build` while the dev server is running, so it would
  404 the same way). Test PWA behaviour against `npm run build`. Manifest content (name/description/
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
  elsewhere while offline. `matchOptions: { ignoreSearch: true }` on that entry is what lets a reload of
  `/now?date=…` find the cached `/now` at all — those query strings are produced by client-side `history.pushState`
  and were never fetched, so they're not cache keys; the consequence is the cache may hand back a *different*
  week's HTML, which `Now.vue` is written to tolerate (see below).
  `resources/js/offline/db.js` (`idb` wrapper: a `days` store keyed by `date` with a `dirty` field + index for
  unsynced local edits, plus a `weeks` store of "this week was fetched whole" markers) is the actual source of
  truth for what `/now` displays when offline. **The schema is not defined in `db.js`** — it lives as an ordered,
  append-only migration list in `resources/js/offline/migrations.js` (one entry per version, starting at 1; the DB
  version is derived from the last entry, never written by hand, and a load-time check rejects a list whose
  versions aren't contiguous). Adding a store or index means appending a migration, never editing a released one
  or touching `DB_VERSION`. Store/field names inside a migration are written as literals on purpose, so renaming a
  constant in `db.js` can't retroactively change what an old migration meant. `db.js` also handles the
  multi-tab cases `idb` leaves to the caller (`blocking` closes this tab's connection so another tab's upgrade
  isn't stuck, `terminated` drops the cached promise). The `weeks` store exists because `days` alone
  can't distinguish "day is empty" from "day was never downloaded" — and letting the user type over a day they
  never saw would silently destroy it on the next sync (`DayController::batch` resolves by edit time, not
  content). An unmarked week renders as "нет данных" and is read-only — but a week whose server fetch is still
  in flight counts as loaded optimistically, otherwise every forward navigation online would flash that state.
- **The owner tests on iOS as an installed PWA** (added to the Home Screen), not as a page in Safari. Assume
  that environment when reasoning about a bug report or proposing a fix, and say which environment you mean if
  it matters. Consequences worth holding onto:
  - **Web Push is actually available there** (iOS 16.4+ requires exactly this — an installed PWA; in
    Safari-as-browser it does not work at all), so notification work is testable on the owner's device.
  - **There is no browser chrome**: no address bar, no visible Back button. Week navigation via
    `history.pushState`/`popstate` is reachable only through the app's own controls and the iOS edge-swipe
    gesture — and that gesture competes with the week swipe, which the grid's `touch-action: pan-y pinch-zoom`
    deliberately constrains.
  - A symptom seen in one environment does not automatically reproduce in the other; `display: standalone`
    changes viewport behaviour and browser UI, so reproduce in the installed app before concluding a fix worked.
- **iOS/iPadOS touch constraints — don't "tidy" these away.** Five rules exist because Safari both rubber-bands
  the document on any touch and zooms on double-tap, either of which fights the week swipe:
  `body { touch-action: manipulation }` in `app.css` (kills double-tap zoom while keeping panning and pinch-zoom —
  **not** `user-scalable=no`/`maximum-scale=1` in the viewport meta, which iOS Safari has deliberately ignored
  since iOS 10 and which would kill pinch-zoom where it is honoured), `html { overscroll-behavior: none }` in
  `app.css` (kills the bounce and pull-to-refresh; it does **not** disable scrolling, so `/me` and the auth pages
  still scroll), `overscroll-contain` on every scrollable box (`main` when not `fit`, each day cell, each
  `textarea`) so reaching their end doesn't chain to the page, `[touch-action:pan-y_pinch-zoom]` on the week grid
  — the swipe handlers are `.passive` and *cannot* `preventDefault()`, so horizontal panning has to be refused
  declaratively, and the explicit `pinch-zoom` keeps zoom working (plain `touch-pan-y` would forbid it) — and
  `min-h-dvh` rather than `min-h-screen` in `AuthLayout`, since `100vh` on iOS excludes the address bar and makes
  a page that fits scroll anyway. What this does **not** address: tapping a day cell opens the keyboard and Safari
  scrolls the visual viewport to reveal the caret; that needs a different fix if it ever becomes a problem.
- **Client-side week switching**: `Pages/Now.vue` changes weeks in place — no server round-trip, so it works
  offline. `resources/js/week.js` is a deliberate line-for-line port of `App\Support\WeekCalculator` (week bounds,
  ISO weekday, and the spec's "week belongs to the month holding most of its days" numbering), built on dayjs;
  **these two implementations must not drift**, and nothing enforces that, so change them together. Its functions
  take and return dayjs objects or `'YYYY-MM-DD'` strings, never `Date`. `Now.vue`'s `onMounted`
  derives the wanted week from `?date=` (or today in the user's timezone) and only trusts its Inertia props when
  they describe that same week — otherwise it rebuilds from IndexedDB, which is what makes a stale/foreign
  service-worker page harmless. Timezone comes from the `auth.user.timezone` shared prop
  (`HandleInertiaRequests`), because "today" can't be computed server-side for a week the server never rendered. `resources/js/offline/sync.js` pushes dirty days to `POST /api/days/batch` then pulls
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
  Sun as two independent half-height cells (not a merged cell). Day-cell previews **wrap** long lines exactly the
  way the editor does (`whitespace-pre-wrap` + `wrap-break-word`), so nothing spills past the cell edge. The spec
  originally called for truncation instead; users asked for wrapping, since a truncated tail was invisible with no
  hint that it existed. Wrapping is safe for the ruled background because the wrapped lines keep the same
  `line-height`, which must stay equal to `--line-h` on `.ruled-paper`. Empty lines are rendered as a non-breaking
  space — a plain one would collapse and the line would lose its height.
- **Week navigation**: swipe forward/back one week; `Components/WeekPickerButton.vue` (in the header and again in
  the navbar) opens the **native date picker**, and the chosen day switches to the week containing it. That
  component's shape is dictated by two browsers pulling opposite ways, so don't "simplify" it: the real
  `<input type="date">` sits as a transparent overlay and takes the tap itself, because Safari on iOS/iPadOS only
  opens its wheel when the user actually hits the date field — a hidden input plus `showPicker()` silently does
  nothing there (that was the first version, and it failed on iPad). Desktop Chrome is the reverse: clicking the
  field alone won't open the calendar, so the input's own click handler also calls `showPicker()`. Each button
  needs its **own** input, since the picker anchors to its field. The spec
  originally called for a custom `[date–date]` week-cell calendar here; the native one was preferred because it
  is familiar on phones, scrolls years, and needs no markup of its own. Week number is counted from the start of the month
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

- **Routes**: `routes/web.php` — `/` (`HomeController`), `/sw.js` (serves the built service worker from the root,
  see PWA above), guest-only `/register`, `/login`, `/forgot-password`, and auth-only `/logout`, `/now`, `/me`.
  `routes/api.php` — the three password-recovery steps (guest, AJAX from `/forgot-password`) plus, behind
  `auth:sanctum`, `/weeks/{date}`, `/days/sync`, `/days/batch`, `/days/{date}` (GET/PUT). The API is AJAX over the
  session for this app's own frontend, not a public API — `EnsureFrontendRequestsAreStateful` is prepended in
  `bootstrap/app.php` for exactly that.
- **No test tooling**: `composer.json` has no `require-dev` section — no PHPUnit/Pest, no `tests/` directory, no
  `phpunit.xml`. There is currently no test or lint command to run.
- **Migrations**: `personal_access_tokens` (Sanctum), `sessions`, `users`, `days`, `add_remember_token_to_users`
  and `move_remember_tokens_to_own_table` (which creates `remember_tokens` and drops the column the previous one
  added). No seeders or factories. Note the pattern: schema changes go in new migrations rather than edits to
  `create_users_table`, because the database already exists and an edited migration would never re-run.
- **`app/helpers.php`** defines a custom `routes_path()` helper (autoloaded via `composer.json`'s `autoload.files`)
  used by `bootstrap/app.php`'s `withRouting()` call — this is non-standard Laravel and worth knowing before
  assuming route file locations follow the framework default.
- **Login is always "remember me"** — `Auth::attempt($credentials, true)` in `AuthenticatedSessionController`,
  with no checkbox in the UI (deliberate: personal diary, installed as a PWA, should open already signed in).
  Sessions are per device, so logging out on the phone leaves the desktop signed in — see the Auth bullet above
  for how. `remember_tokens` rows are pruned for that user on each login; a re-login on a device that still holds
  a valid cookie leaves one unreachable row behind until it expires, which is harmless and not worth code.
  The table carries `user_agent`/`last_used_at` specifically so a "my devices / sign out everywhere" screen can
  be built later — nothing renders them yet.
- **Vue pages are styled** (Tailwind, the "тетрадный" tokens from `app.css`), including the auth pages and the
  `/now` week grid with its page-flip animation. What is still a placeholder is the *day editor*: a plain
  `<textarea>` per cell, not the modal WYSIWYG from the spec. See `CHECKLIST.md` for the manual test checklist
  covering the auth + profile-edit flows.

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
