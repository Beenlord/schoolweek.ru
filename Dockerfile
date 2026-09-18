FROM php:8.4-fpm-alpine AS base

RUN apk add --no-cache \
    bash \
    curl \
    git \
    unzip \
    tzdata \
    shadow \
    gettext \
    dos2unix \
    libpng \
    libjpeg-turbo \
    freetype \
    oniguruma \
    libzip \
    icu-libs \
    imagemagick

RUN apk add --no-cache --virtual .build-deps \
    $PHPIZE_DEPS \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    libzip-dev \
    icu-dev \
    imagemagick-dev \
    && pecl install redis imagick \
    && docker-php-ext-enable redis imagick \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install pdo pdo_mysql mbstring zip gd intl pcntl \
    && apk del .build-deps \
    && rm -rf /tmp/peer /tmp/pecl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN addgroup -g 1000 www \
    && adduser -u 1000 -G www -s /bin/sh -D www

FROM composer:2 AS composer

WORKDIR /tmp
COPY composer.json composer.lock ./

RUN composer install \
    --no-scripts \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader \
    --ignore-platform-reqs

FROM base

USER root

WORKDIR /var/www/html
COPY . .

RUN dos2unix ./scripts/entrypoint.sh \
    && chmod +x ./scripts/entrypoint.sh

COPY --from=composer ./tmp/vendor vendor

ENTRYPOINT ["./scripts/entrypoint.sh"]
