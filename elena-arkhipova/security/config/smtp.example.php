<?php
declare(strict_types=1);
// Copy as config.php OUTSIDE every document root. Never put real values in Git.
return [
    'enabled' => false,
    'legal_ready' => false,
    'origin' => 'https://example.invalid', // Exact canonical origin, no trailing slash.
    'rate_key' => '', // Generate on server: bin2hex(random_bytes(32)).
    'rate_db' => __DIR__ . '/runtime/rate.sqlite', // Existing private directory, mode 0700.
    'smtp' => [
        'host' => 'smtp.example.invalid',
        'port' => 465,
        'encryption' => 'smtps', // smtps:465 OR starttls:587; no plaintext option.
        'username' => 'sender@example.invalid',
        'password' => '',
        'from' => 'sender@example.invalid', // Must match authenticated mailbox.
        'to' => 'recipient@example.invalid',
    ],
];
