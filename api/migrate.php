<?php
// api/migrate.php – inkrementální SQL migrace při deployi
// Volání: GET api/migrate.php?key=YOUR_MIGRATE_KEY
// Spouští jen dosud neaplikované migrace z migrations/*.sql
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

try {
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

    $migrationsDir = __DIR__ . '/../migrations';
    if (!is_dir($migrationsDir)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Složka migrations nenalezena.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Tabulka pro sledování aplikovaných migrací
    $pdo->exec("CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $files = glob($migrationsDir . '/*.sql');
    sort($files);

    $applied = 0;
    $skipped = 0;
    $errors = [];

    foreach ($files as $path) {
        $name = basename($path);
        $stmt = $pdo->prepare("SELECT 1 FROM _migrations WHERE name = ?");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            $skipped++;
            continue;
        }

        $sql = file_get_contents($path);
        $sql = preg_replace('/^\s*USE\s+\w+\s*;/mi', '', $sql);
        $statements = array_filter(
            array_map('trim', preg_split('/;\s*(\n|$)/m', $sql)),
            fn($s) => $s !== '' && !preg_match('/^--/', $s) && !preg_match('/^USE\s+/i', $s)
        );

        $fileOk = true;
        foreach ($statements as $stmtSql) {
            try {
                $pdo->exec($stmtSql);
            } catch (PDOException $e) {
                $msg = $e->getMessage();
                $isAlreadyApplied = strpos($msg, 'Duplicate column') !== false
                    || strpos($msg, 'Duplicate key') !== false
                    || strpos($msg, 'Duplicate key name') !== false
                    || strpos($msg, 'already exists') !== false
                    || strpos($msg, 'Unknown column') !== false
                    || in_array($e->getCode(), [1060, 1061, 1054, '42S21', '42S22'], true);
                if (!$isAlreadyApplied) {
                    $fileOk = false;
                    $preview = strlen($stmtSql) > 80 ? substr($stmtSql, 0, 80) . '...' : $stmtSql;
                    $errors[] = "$name: $msg | SQL: $preview";
                    break;
                }
            }
        }

        if ($fileOk) {
            $pdo->prepare("INSERT INTO _migrations (name) VALUES (?)")->execute([$name]);
            $applied++;
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
