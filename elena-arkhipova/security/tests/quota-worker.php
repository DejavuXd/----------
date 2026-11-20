<?php
declare(strict_types=1);
require __DIR__ . '/../php/App.php';
echo Elena\Contact\takeQuota($argv[1], str_repeat('test-only-', 8), '192.0.2.55', true, 1000) === 0 ? 'accepted' : 'limited';
