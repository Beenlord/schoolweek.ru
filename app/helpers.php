<?php

use Illuminate\Support\Facades\Redis;

if (!function_exists('routes_path')) {
    /**
     * Get the path to the routes' folder.
     *
     * @param string $path
     * @return string
     */
    function routes_path(string $path = ''): string
    {
        return app()->basePath('routes' . ($path ? DIRECTORY_SEPARATOR . $path : ''));
    }
}
