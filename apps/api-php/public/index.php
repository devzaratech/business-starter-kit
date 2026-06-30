<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if ($path === '/health') {
    echo json_encode([
        'service' => 'api-php',
        'status' => 'ok',
        'runtime' => 'php',
    ]);
    exit;
}

echo json_encode([
    'service' => 'api-php',
    'message' => 'Business Starter Kit PHP API is alive',
    'path' => $path,
]);
