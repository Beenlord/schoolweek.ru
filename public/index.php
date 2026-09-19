<?php
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (!file_exists($autoload = realpath(__DIR__ . '/../vendor/autoload.php'))) {
    echo 'Missing Composer autoload file. Run `composer install`.';
    exit();
}

require_once $autoload;

(require __DIR__ . '/../bootstrap/app.php')
    ->handleRequest(Request::capture());
