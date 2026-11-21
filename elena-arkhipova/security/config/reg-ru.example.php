<?php
declare(strict_types=1);
// Reuse the tested SMTP settings: rename mail-test-config.php to smtp.local.php.
$settings = require __DIR__ . '/smtp.local.php';
return [
    'enabled' => true,
    'legal_ready' => true, // Review the published privacy/consent documents before launch.
    'origin' => 'https://arxipova.ru',
    'rate_key' => hash('sha256', $settings['access_key']),
    'rate_db' => __DIR__ . '/runtime/rate.sqlite',
    'smtp' => $settings['smtp'],
];
