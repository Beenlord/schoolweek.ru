#!/bin/bash

chown -R www:www /app/bootstrap/cache/ /app/storage/
chmod -R 775 /app/bootstrap/cache/ /app/storage/

composer dump-autoload --no-interaction --optimize

grep -q "^APP_KEY=base64:" .env || php artisan key:generate

php artisan migrate --force

php artisan cache:clear
php artisan route:clear

php artisan queue:work &
php artisan schedule:work &
php artisan serve --host=0.0.0.0 --port=8000
