<?php
declare(strict_types=1);
require __DIR__ . '/../php/App.php';
require __DIR__ . '/../vendor/autoload.php';
use function Elena\Contact\{handle, takeQuota, validate, buildMail, assertPrivateConfig};

function check(bool $value, string $label): void {
    if (!$value) throw new RuntimeException('Failed: ' . $label);
}
$runtime = __DIR__ . '/../.runtime';
if (!is_dir($runtime)) mkdir($runtime, 0700, true);
$config = ['origin' => 'https://example.test', 'enabled' => true, 'legal_ready' => true, 'rate_key' => str_repeat('test-only-', 8)];
$valid = ['name' => 'Тестовый Пользователь', 'phone' => '+7 (900) 000-00-00', 'email' => 'qa@example.invalid', 'consent' => true, 'website' => ''];
$server = ['REQUEST_METHOD' => 'POST', 'CONTENT_TYPE' => 'application/json', 'HTTP_ORIGIN' => 'https://example.test', 'REMOTE_ADDR' => '192.0.2.1'];
$count = 0;
$sends = 0;
function request(array $server, string $body, array $config, callable $transport): array {
    global $count, $runtime;
    $config['rate_db'] = $runtime . '/case-' . getmypid() . '-' . (++$count) . '.sqlite';
    return handle($server, static fn() => $body, $config, $transport);
}
$accept = static function (array $data) use (&$sends): bool { $sends++; return true; };
$json = json_encode($valid, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
check(request($server, json_encode([...$valid, 'email' => '']), $config, $accept)[0] === 422, 'email required');
check(request($server, json_encode([...$valid, 'email' => 'qa@example.invalid']), $config, $accept)[0] === 200, 'valid email');
$badCases = [
    ['name' => ''], ['name' => 'A'], ['name' => str_repeat('Я', 121)], ['name' => '<script>alert(1)</script>'],
    ['name' => "Имя\r\nBcc: other@example.invalid"], ['name' => '..'], ['name' => ['nested']],
    ['phone' => '123'], ['phone' => str_repeat('1', 16)], ['phone' => str_repeat(' ', 31) . '1234567890'],
    ['phone' => "1234567890\n" . 'Bcc:'], ['phone' => true], ['email' => '<img src=x onerror=alert(1)>'],
    ['email' => str_repeat('a', 255) . '@example.invalid'], ['email' => "a@example.invalid\r\nBcc:x@example.invalid"],
    ['consent' => false], ['consent' => 'true'], ['website' => 'bot.example'], ['website' => []], ['unexpected' => 'field'],
];
$before = $sends;
foreach ($badCases as $index => $bad) check(request($server, json_encode([...$valid, ...$bad]), $config, $accept)[0] === 422, 'invalid input #' . $index);
foreach (['{}', '[]', 'null', '"text"', '{bad', '{"name":"\uD800"}'] as $body) check(request($server, $body, $config, $accept)[0] >= 400, 'invalid JSON');
check(request($server, str_repeat(' ', 4097), $config, $accept)[0] === 413, 'stream body cap');
check(request([...$server, 'CONTENT_LENGTH' => '5000'], $json, $config, $accept)[0] === 413, 'declared body cap');
foreach (['GET', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'] as $method) check(request([...$server, 'REQUEST_METHOD' => $method], $json, $config, $accept)[0] === 405, 'method');
foreach (['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', 'application/json; charset=iso-8859-1'] as $type) check(request([...$server, 'CONTENT_TYPE' => $type], $json, $config, $accept)[0] === 415, 'type');
check(request([...$server, 'HTTP_CONTENT_ENCODING' => 'gzip'], $json, $config, $accept)[0] === 415, 'encoding');
foreach (['', 'null', 'https://evil.example', 'https://example.test.evil.example'] as $origin) check(request([...$server, 'HTTP_ORIGIN' => $origin], $json, $config, $accept)[0] === 403, 'origin');
check(request([...$server, 'HTTP_SEC_FETCH_SITE' => 'cross-site'], $json, $config, $accept)[0] === 403, 'fetch metadata');
check($sends === $before, 'no mail for invalid requests');
check(request($server, $json, [...$config, 'legal_ready' => false], $accept)[0] === 503, 'legal closed');
check(request($server, $json, $config, static fn() => false)[0] === 502, 'transport refusal');
$failure = request($server, $json, $config, static function () { throw new RuntimeException('SMTP_PASSWORD=private'); });
check($failure[0] === 503 && !str_contains(json_encode($failure), 'private'), 'no exception leak');
$db = $runtime . '/quota-' . getmypid() . '.sqlite';
for ($i = 0; $i < 5; $i++) check(takeQuota($db, $config['rate_key'], '192.0.2.7', false, 1000) === 0, 'quota allowance');
check(takeQuota($db, $config['rate_key'], '192.0.2.7', false, 1000) > 0, 'quota exceeded');
check(takeQuota($db, $config['rate_key'], '192.0.2.7', false, 1100) === 0, 'quota window reset');
check(takeQuota($db, $config['rate_key'], '2001:db8:1:2::1', false, 1100) === 0, 'ipv6');
for ($i = 0; $i < 4; $i++) takeQuota($db, $config['rate_key'], '2001:db8:1:2::2', false, 1100);
check(takeQuota($db, $config['rate_key'], '2001:db8:1:2::3', false, 1100) > 0, 'ipv6 shares /64');
$mail = buildMail(validate($valid), ['host' => 'smtp.example.invalid', 'port' => 465, 'encryption' => 'smtps', 'username' => 'sender@example.invalid', 'password' => 'test-only', 'from' => 'sender@example.invalid', 'to' => 'qa@example.invalid']);
check($mail->preSend(), 'MIME rendering without sending');
check($mail->ContentType === 'text/plain' && $mail->From === 'sender@example.invalid' && $mail->SMTPDebug === 0, 'plain fixed headers');
check($mail->SMTPOptions['ssl'] === ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false], 'TLS verification');
check($mail->getReplyToAddresses() === [], 'no user-controlled reply-to');
try { assertPrivateConfig(require __DIR__ . '/../config/smtp.example.php', realpath(__DIR__ . '/../../dist')); throw new RuntimeException('Example enabled'); }
catch (RuntimeException $error) { check($error->getMessage() !== 'Example enabled', 'example fails closed'); }
echo json_encode(['invalid_cases' => count($badCases), 'http_validation' => 'passed', 'smtp_outcomes_mocked' => 'passed', 'mime_and_tls_options' => 'passed', 'quotas' => 'passed', 'real_mail_sent' => false], JSON_PRETTY_PRINT) . PHP_EOL;
