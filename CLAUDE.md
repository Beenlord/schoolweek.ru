# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

schoolweek.ru — an app for a digital "school diary": a nostalgia-driven weekly planner/schedule, styled after the paper school diary, built around a "week on one page" concept. See `README.md` (in Russian) for the product pitch and the outstanding TODO list (auth API, registration API, migrations, and a PWA frontend under `web/`, which doesn't exist yet).

## Current state — mid-migration, not runnable yet

The backend is being rewritten from a Node.js/TypeScript (Koa + Mongoose/MongoDB) API to **Laravel** (PHP). The old TypeScript source tree has been deleted; the new Laravel codebase is only a bare skeleton right now:

- `composer.json` declares `laravel/framework ^11` and `laravel/sanctum ^4`, but `composer.lock` currently resolves **zero packages** — the framework has not actually been installed into `vendor/`.
- `bootstrap/app.php`, `public/index.php`, `routes/api.php` are empty placeholder files (just an opening `<?php` tag).
- `config/app.php` returns an empty array.
- There is no `artisan`, no `app/` directory, no `.env`, and `database/migrations` / `database/seeders` exist but are empty.

Because of this, **there are no working build/test/lint commands yet** — do not assume standard Laravel commands (`php artisan serve`, `composer install`, etc.) will succeed until the scaffold is actually filled in. Before adding application code, the project needs a real Laravel install (e.g. `composer create-project laravel/laravel` merged into this repo, or `composer update` after fixing `composer.json`) so `vendor/`, `artisan`, and the standard `app/` structure exist.

Also note: `.gitignore` was deleted as part of this migration and has not been replaced. `vendor/`, `composer.lock`'s companions, and `.idea/` are currently untracked/uncommitted — a Laravel-appropriate `.gitignore` (ignoring `/vendor`, `.env`, `.idea/`, etc.) should be restored before committing further, to avoid accidentally checking in dependencies or IDE config.

## Prior architecture (for reference during migration)

The deleted Node/Koa API is still useful context for parity when rebuilding equivalent endpoints in Laravel:

- Resources: auth (bearer-token sessions, not JWT), users, schedule (day-keyed by `(userId, date)` with soft-delete for offline PWA sync via `/schedule/sync?since=` and a `/schedule/batch` bulk endpoint), health, and an OpenAPI document generated from the same validation schemas.
- Data lived in MongoDB via Mongoose; the new stack should decide on Laravel's persistence layer (likely Eloquent/MySQL or Postgres, or `mongodb/laravel-mongodb` if MongoDB is being kept) as part of the migration.

Confirm actual endpoint/data-model parity requirements with the project owner before porting logic — don't assume 1:1 translation is wanted.
