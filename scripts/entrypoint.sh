#!/bin/bash

chown -R www:www /var/www/html/bootstrap/cache/ /var/www/html/storage/
chmod -R 775 /var/www/html/bootstrap/cache/ /var/www/html/storage/

composer dump-autoload --no-interaction --optimize

php artisan migrate

php artisan cache:clear
php artisan route:clear

php artisan queue:work &
php artisan schedule:work &
php artisan serve --host=0.0.0.0 --port=8000
