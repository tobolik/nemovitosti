<?php
// api/migrate.php – spuštění SQL migrací při deployi
// Volání: GET api/migrate.php?key=YOUR_MIGRATE_KEY
// Nastavte MIGRATE_KEY v config.php (stejná hodnota jako v GitHub Secrets).
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
// Bez session – jen DB
require __DIR__ . '/../config.php';

$key = $_GET['key'] ?? '';
if (!defined('MIGRATE_KEY') || MIGRATE_KEY === '' || !hash_equals((string)MIGRATE_KEY, $key)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Neplatný klíč.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = new PDO(
    "mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4",
    DB_USER, DB_PASS,
    [ PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION ]
);

$sqlFile = __DIR__ . '/../schema_migration.sql';
if (!is_readable($sqlFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Migrační soubor nenalezen.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$sql = file_get_contents($sqlFile);
// Odstranit USE databáze – používáme DB z config
$sql = preg_replace('/^\s*USE\s+\w+\s*;/mi', '', $sql);
// Rozdělit na příkazy (každý řádek končí ;)
$statements = array_filter(
    array_map('trim', preg_split('/;\s*(\n|$)/m', $sql)),
    fn($s) => $s !== '' && !preg_match('/^--/', $s) && !preg_match('/^USE\s+/i', $s)
);

$applied = 0;
$skipped = 0;
$errors = [];

foreach ($statements as $i => $stmt) {
    try {
        $pdo->exec($stmt);
        $applied++;
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        $isDuplicate = strpos($msg, 'Duplicate column') !== false || strpos($msg, 'Duplicate key') !== false
            || strpos($msg, 'Duplicate key name') !== false || strpos($msg, 'already exists') !== false
            || in_array($e->getCode(), [1060, 1061, '42S21'], true);
        if ($isDuplicate) {
            $skipped++;
        } else {
            $preview = strlen($stmt) > 80 ? substr($stmt, 0, 80) . '...' : $stmt;
            $errors[] = "Stmt #" . ($i + 1) . ": $msg | SQL: $preview";
        }
    }
}

if ($errors) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => implode('; ', $errors),
        'applied' => $applied,
        'skipped' => $skipped,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'ok' => true,
    'applied' => $applied,
    'skipped' => $skipped,
], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE);
}
