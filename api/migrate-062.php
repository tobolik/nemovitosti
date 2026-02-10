<?php
// api/migrate-062.php – spuštění migrace 062 (generování rent požadavků) přes web
// Volání: GET api/migrate-062.php?key=MIGRATE_KEY  (stejný klíč jako u api/migrate.php)
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$config = __DIR__ . '/../config.php';
$configDefault = __DIR__ . '/../config.default.php';
if (file_exists($config)) require $config;
require $configDefault;

$key = $_GET['key'] ?? '';
if (!defined('MIGRATE_KEY') || MIGRATE_KEY === '' || !hash_equals((string)MIGRATE_KEY, $key)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Neplatný klíč.'], JSON_UNESCAPED_UNICODE);
    exit;
}

require __DIR__ . '/_bootstrap.php';
$_SESSION['uid'] = $_SESSION['uid'] ?? null;

try {
    $result = runMigration062();
    echo json_encode(['ok' => true, 'data' => $result], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'detail' => (defined('DEBUG') && DEBUG) ? $e->getTraceAsString() : null,
    ], JSON_UNESCAPED_UNICODE);
}
