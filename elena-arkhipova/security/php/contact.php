<?php
declare(strict_types=1);

// The ONLY PHP file copied into the public tree (e.g. api/contact.php).
// Set ELENA_CONTACT_PRIVATE_DIR in the hosting panel/PHP-FPM configuration.
// If unavailable, replace the empty literal below with an absolute PRIVATE path.
ini_set('display_errors', '0');
header_remove('X-Powered-By');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header('Content-Security-Policy: default-src \'none\'; frame-ancestors \'none\'');
header('X-Frame-Options: DENY');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        http_response_code(405);
        echo '{"ok":false,"code":"method_not_allowed"}';
        exit;
    }
    $privatePath = getenv('ELENA_CONTACT_PRIVATE_DIR') ?: '';
    if ($privatePath === '') throw new RuntimeException('Private directory not configured');
    $private = realpath($privatePath);
    $root = realpath($_SERVER['DOCUMENT_ROOT'] ?? '');
    if (!$private || !$root || $private === $root || str_starts_with($private, $root . DIRECTORY_SEPARATOR)) {
        throw new RuntimeException('Private directory unavailable');
    }
    foreach (['App.php', 'config.php', 'vendor/autoload.php'] as $file) {
        $real = realpath($private . '/' . $file);
        if (!$real || !str_starts_with($real, $private . DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Private file unavailable');
        }
    }
    require $private . '/App.php';
    $config = require $private . '/config.php';
    \Elena\Contact\assertPrivateConfig($config, $root);
    require $private . '/vendor/autoload.php';
    $result = \Elena\Contact\handle($_SERVER, static function (): string {
        $input = fopen('php://input', 'rb');
        if ($input === false) throw new RuntimeException('Input unavailable');
        try { return stream_get_contents($input, 4097); }
        finally { fclose($input); }
    }, $config, static fn(array $data): bool => \Elena\Contact\sendMail($data, $config['smtp']));
} catch (Throwable $error) {
    // Never log exception messages, request bodies, addresses or SMTP transcripts.
    $result = [503, ['ok' => false, 'code' => 'unavailable'], []];
}
http_response_code($result[0]);
foreach ($result[2] as $name => $value) header($name . ': ' . $value);
echo json_encode($result[1], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
