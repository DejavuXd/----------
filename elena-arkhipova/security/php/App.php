<?php
declare(strict_types=1);
namespace Elena\Contact;

use PDO;
use RuntimeException;
use PHPMailer\PHPMailer\PHPMailer;

function assertPrivateConfig(array $config, string $root): void
{
    if (($config['enabled'] ?? false) !== true || ($config['legal_ready'] ?? false) !== true
        || !preg_match('~^https://[a-z0-9.-]+(?::[0-9]{1,5})?$~D', $config['origin'] ?? '')
        || str_contains($config['origin'], '.invalid') || strlen($config['rate_key'] ?? '') < 64) {
        throw new RuntimeException('Configuration unavailable');
    }
    $directory = realpath(dirname($config['rate_db'] ?? ''));
    if (!$directory || $directory === $root || str_starts_with($directory, $root . DIRECTORY_SEPARATOR)
        || !is_writable($directory)) throw new RuntimeException('Private storage unavailable');
    $database = realpath($config['rate_db']);
    if ($database && ($database === $root || str_starts_with($database, $root . DIRECTORY_SEPARATOR))) {
        throw new RuntimeException('Unsafe storage');
    }
    $smtp = $config['smtp'] ?? [];
    foreach (['username', 'from', 'to'] as $key) {
        if (!filter_var($smtp[$key] ?? '', FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $smtp[$key])) {
            throw new RuntimeException('Invalid mail configuration');
        }
    }
    if ($smtp['from'] !== $smtp['username'] || str_contains($smtp['from'], '.invalid')
        || !preg_match('/^[a-z0-9.-]+$/iD', $smtp['host'] ?? '')
        || strlen($smtp['password'] ?? '') < 1
        || !in_array([$smtp['encryption'] ?? '', $smtp['port'] ?? 0], [['smtps', 465], ['starttls', 587]], true)) {
        throw new RuntimeException('Invalid SMTP configuration');
    }
}

// One transaction covers all counters: simultaneous PHP workers cannot overspend.
// Stores only keyed IP(/64) hashes, windows and counters; never application data.
function takeQuota(string $database, string $key, string $ip, bool $mail = false, ?int $time = null): int
{
    $packed = @inet_pton($ip);
    if ($packed === false) throw new RuntimeException('Missing client address');
    if (strlen($packed) === 16) $packed = substr($packed, 0, 8); // IPv6 /64.
    $identity = hash_hmac('sha256', $packed, $key);
    $now = $time ?? time();
    $rules = $mail
        ? [['mail-global', 86400, 50], ['mail-' . $identity, 3600, 3]]
        : [['attempt-global', 600, 100], ['attempt-minute-' . $identity, 60, 5], ['attempt-hour-' . $identity, 3600, 20]];
    $oldMask = umask(0077);
    try {
        $db = new PDO('sqlite:' . $database, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $db->exec('PRAGMA busy_timeout=3000');
        $db->exec('CREATE TABLE IF NOT EXISTS quota (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, n INTEGER NOT NULL)');
        $db->exec('BEGIN IMMEDIATE');
        try {
            $cleanup = $db->prepare('DELETE FROM quota WHERE expires <= ?');
            $cleanup->execute([$now]);
            $select = $db->prepare('SELECT n FROM quota WHERE id = ?');
            $counters = [];
            $retry = 0;
            foreach ($rules as [$label, $window, $limit]) {
                $start = intdiv($now, $window) * $window;
                $id = $label . '-' . $start;
                $select->execute([$id]);
                $count = (int) ($select->fetchColumn() ?: 0);
                if ($count >= $limit) $retry = max($retry, $start + $window - $now);
                $counters[] = [$id, $start + $window, $count + 1];
            }
            if ($retry === 0) {
                $write = $db->prepare('INSERT INTO quota(id,expires,n) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET n=excluded.n');
                foreach ($counters as $counter) $write->execute($counter);
            }
            $db->exec('COMMIT');
            return $retry;
        } catch (\Throwable $error) {
            $db->exec('ROLLBACK');
            throw $error;
        }
    } finally { umask($oldMask); }
}

function validate(array $data): ?array
{
    if (array_diff(array_keys($data), ['name', 'phone', 'email', 'consent', 'website'])) return null;
    foreach (['name', 'phone', 'website'] as $key) if (!isset($data[$key]) || !is_string($data[$key])) return null;
    if (($data['consent'] ?? null) !== true || !is_string($data['email'] ?? '') || $data['website'] !== '') return null;
    foreach (['name', 'phone', 'email'] as $key) {
        if (preg_match('/[\p{Cc}\p{Cf}]/u', $data[$key] ?? '')) return null;
    }
    if (mb_strlen($data['name'], 'UTF-8') > 120 || strlen($data['phone']) > 30 || strlen($data['email'] ?? '') > 254) return null;
    $name = trim($data['name']);
    $phone = trim($data['phone']);
    $email = trim($data['email'] ?? '');
    if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($name, 'UTF-8') > 120
        || !preg_match('/^[\p{L}\p{M} .\x{2019}\x{0027}-]+$/uD', $name) || !preg_match('/\p{L}/u', $name)
        || strlen($phone) > 30 || !preg_match('/^\+?[0-9 ()-]+$/D', $phone)) return null;
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) < 10 || strlen($digits) > 15) return null;
    if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL) || preg_match('/[\r\n]/', $email)) return null;
    return ['name' => $name, 'phone' => $phone, 'email' => $email];
}

function handle(array $server, callable $readBody, array $config, callable $send): array
{
    $fail = static fn(int $status, string $code, array $headers = []): array => [$status, ['ok' => false, 'code' => $code], $headers];
    if (($server['REQUEST_METHOD'] ?? '') !== 'POST') return $fail(405, 'method_not_allowed', ['Allow' => 'POST']);
    if (!preg_match('/^application\/json(?:\s*;\s*charset=utf-8)?$/iD', $server['CONTENT_TYPE'] ?? '')) return $fail(415, 'unsupported_type');
    if (isset($server['HTTP_CONTENT_ENCODING']) && strtolower($server['HTTP_CONTENT_ENCODING']) !== 'identity') return $fail(415, 'unsupported_encoding');
    if (isset($server['CONTENT_LENGTH']) && (!ctype_digit((string) $server['CONTENT_LENGTH']) || (int) $server['CONTENT_LENGTH'] > 4096)) return $fail(413, 'too_large');
    // Require the canonical Origin. No CORS response, no cookie authentication.
    // Origin can be forged by bots; quotas and validation remain mandatory.
    if (($server['HTTP_ORIGIN'] ?? '') !== $config['origin']
        || (isset($server['HTTP_SEC_FETCH_SITE']) && $server['HTTP_SEC_FETCH_SITE'] !== 'same-origin')) return $fail(403, 'forbidden');
    try {
        $retry = takeQuota($config['rate_db'], $config['rate_key'], $server['REMOTE_ADDR'] ?? '');
        if ($retry) return $fail(429, 'rate_limited', ['Retry-After' => (string) $retry]);
        $body = $readBody();
        if (strlen($body) > 4096) return $fail(413, 'too_large');
        try { $object = json_decode($body, false, 8, JSON_THROW_ON_ERROR); }
        catch (\JsonException $error) { return $fail(400, 'invalid_json'); }
        if (!$object instanceof \stdClass) return $fail(400, 'invalid_json');
        $data = validate((array) $object);
        if (!$data) return $fail(422, 'invalid_fields');
        if (($config['enabled'] ?? false) !== true || ($config['legal_ready'] ?? false) !== true) return $fail(503, 'unavailable');
        $retry = takeQuota($config['rate_db'], $config['rate_key'], $server['REMOTE_ADDR'], true);
        if ($retry) return $fail(429, 'rate_limited', ['Retry-After' => (string) $retry]);
        if ($send($data) !== true) return $fail(502, 'mail_unavailable');
        return [200, ['ok' => true], []]; // SMTP accepted, not a delivery guarantee.
    } catch (\Throwable $error) { return $fail(503, 'unavailable'); }
}

function buildMail(array $data, array $smtp): PHPMailer
{
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->SMTPDebug = 0;
    $mail->Host = $smtp['host'];
    $mail->Port = $smtp['port'];
    $mail->SMTPAuth = true;
    $mail->Username = $smtp['username'];
    $mail->Password = $smtp['password'];
    $mail->SMTPSecure = $smtp['encryption'] === 'smtps' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->SMTPOptions = ['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false]];
    $mail->Timeout = 8;
    $mail->getSMTPInstance()->Timelimit = 8;
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->XMailer = '';
    $mail->setFrom($smtp['from'], 'Сайт Елены Архиповой');
    $mail->addAddress($smtp['to']);
    $mail->isHTML(false);
    $mail->Subject = 'Заявка с сайта Елены Архиповой';
    $mail->Body = "Имя: {$data['name']}\nТелефон: {$data['phone']}\n"
        . ($data['email'] !== '' ? "Электронная почта: {$data['email']}\n" : '')
        . "Согласие подтверждено пользователем.\n";
    return $mail;
}

function sendMail(array $data, array $smtp): bool { return buildMail($data, $smtp)->send(); }
