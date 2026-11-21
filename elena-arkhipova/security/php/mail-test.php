<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; form-action 'self'; frame-ancestors 'none'");
header('Content-Type: text/html; charset=utf-8');
try {
    if (($_SERVER['HTTPS'] ?? '') !== 'on') throw new RuntimeException();
    $private = realpath(dirname(__DIR__, 2) . '/private');
    $root = realpath($_SERVER['DOCUMENT_ROOT']);
    if (!$private || !$root || $private === $root || str_starts_with($private, $root . '/')) throw new RuntimeException();
    $config = require $private . '/mail-test-config.php';
    if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'POST'], true)) {
        header('Allow: GET, POST'); http_response_code(405); exit;
    }
    session_start(['cookie_secure' => true, 'cookie_httponly' => true, 'cookie_samesite' => 'Strict', 'use_strict_mode' => true]);
    $_SESSION['mail_test_csrf'] ??= bin2hex(random_bytes(32));
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024) { http_response_code(413); exit; }
    if (($_SESSION['mail_test_access_until'] ?? 0) < time()) {
        if ($_SERVER['REQUEST_METHOD'] === 'POST'
            && is_string($_POST['access_key'] ?? null)
            && hash_equals($_SESSION['mail_test_csrf'], (string) ($_POST['csrf'] ?? ''))
            && hash_equals($config['access_key'], $_POST['access_key'])) {
            session_regenerate_id(true);
            $_SESSION['mail_test_access_until'] = time() + 900;
            header('Location: mail-test.php', true, 303); exit;
        }
        $csrf = htmlspecialchars($_SESSION['mail_test_csrf'], ENT_QUOTES, 'UTF-8');
        echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Доступ к тесту</title><h1>Доступ к тесту SMTP</h1><p>Введите значение access_key из приватной конфигурации без кавычек. Пароль почты сюда вводить не нужно.</p><form method="post"><input type="hidden" name="csrf" value="' . $csrf . '"><input type="password" name="access_key" required maxlength="128" aria-label="Ключ доступа"><button>Войти</button></form></html>';
        exit;
    }
    $message = '';
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 1024
            || !hash_equals($_SESSION['mail_test_csrf'], (string) ($_POST['csrf'] ?? ''))) {
            http_response_code(403); exit('Запрос отклонён.');
        }
        if ($config['smtp']['password'] === 'REPLACE_SMTP_PASSWORD') throw new RuntimeException();
        require $private . '/vendor/autoload.php';
        require $private . '/App.php';
        $lock = fopen($private . '/mail-test.lock', 'c+');
        if (!$lock || !flock($lock, LOCK_EX)) throw new RuntimeException();
        try {
            $last = (int) stream_get_contents($lock);
            if ($last > time() - 600) {
                http_response_code(429); $message = 'Повторный тест доступен через 10 минут.';
            } else {
                rewind($lock); ftruncate($lock, 0); fwrite($lock, (string) time()); fflush($lock);
                $mail = \Elena\Contact\buildMail(['name' => 'Тест сайта', 'phone' => '+70000000000', 'email' => 'test@example.invalid'], $config['smtp']);
                $mail->Subject = 'Тест SMTP arxipova.ru';
                $mail->Body = 'Тестовое письмо с хостинга arxipova.ru. Это проверка SMTP, не заявка клиента.';
                $mail->send();
                $message = 'SMTP-сервер принял письмо. Проверьте info@arxipova.ru, включая папку Спам. Это ещё не подтверждение доставки.';
            }
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }
    $csrf = htmlspecialchars($_SESSION['mail_test_csrf'], ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="robots" content="noindex,nofollow"><title>Проверка SMTP</title><h1>Проверка отправки почты</h1><p>Будет отправлено одно тестовое письмо на info@arxipova.ru.</p><p>' . htmlspecialchars($message, ENT_QUOTES, 'UTF-8') . '</p><form method="post"><input type="hidden" name="csrf" value="' . $csrf . '"><button>Отправить тестовое письмо</button></form></html>';
} catch (Throwable $error) {
    http_response_code(503);
    echo 'Тест недоступен. Проверьте HTTPS, PHP, путь к приватной папке и SMTP-настройки. Технические подробности скрыты.';
}
