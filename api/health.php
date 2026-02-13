<?php
// api/health.php – ověření připojení k MySQL (bez session, pro ladění na Railway)
// GET /api/health.php – vrátí { "ok": true, "db": "ok" } nebo chybovou hlášku
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$config = __DIR__ . '/../config.php';
$configDefault = __DIR__ . '/../config.default.php';
if (file_exists($config)) require $config;
require $configDefault;

$out = ['ok' => false, 'db' => null];

try {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4;allowPublicKeyRetrieval=true',
        DB_HOST,
        (int)DB_PORT,
        DB_NAME
    );
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $pdo->query('SELECT 1');
    $out['ok'] = true;
    $out['db'] = 'ok';
} catch (Throwable $e) {
    $out['error'] = $e->getMessage();
    $out['hint'] = 'Zkontrolujte na Railway: Variables (MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE) a případně DB_NAME pokud data jsou v tobolikcz01.';
}

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
