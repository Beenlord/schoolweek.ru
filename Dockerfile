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

FROM vovikko/alpine-php-fpm:8.4 AS vendor

WORKDIR /tmp
COPY composer.json composer.lock ./

RUN composer install \
    --no-scripts \
    --prefer-dist \
    --no-interaction \
    --optimize-autoloader \
    --ignore-platform-reqs

FROM node:24-alpine AS node

WORKDIR /app
COPY . .

RUN npm install \
    && npm run build

FROM vovikko/alpine-php-fpm:8.4 AS app

USER root

WORKDIR /app
COPY . .

RUN dos2unix ./scripts/entrypoint.sh \
    && chmod +x ./scripts/entrypoint.sh

COPY --from=vendor ./tmp/vendor vendor

FROM app AS dev

WORKDIR /app
COPY --from=app /app .

ENTRYPOINT ["./scripts/entrypoint.sh"]

FROM app AS prod

WORKDIR /app
COPY --from=app /app .
COPY --from=node /app/public/build ./public/build

ENTRYPOINT ["./scripts/entrypoint.sh"]
