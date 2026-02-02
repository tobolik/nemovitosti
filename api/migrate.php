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
    $migrationsDirReal = realpath($migrationsDir);
    if (!is_dir($migrationsDir) || $migrationsDirReal === false) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'error' => 'Složka migrations nenalezena.',
            'path_checked' => $migrationsDir,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Tabulka pro sledování aplikovaných migrací
    $pdo->exec("CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    $files = glob($migrationsDir . '/*.sql');
    if ($files === false) {
        throw new RuntimeException("Nelze načíst složku migrations: $migrationsDir");
    }
    sort($files);

    $applied = 0;
    $skipped = 0;
    $appliedList = [];
    $skippedList = [];
    $errors = [];

    foreach ($files as $path) {
        $name = basename($path);
        $stmt = $pdo->prepare("SELECT 1 FROM _migrations WHERE name = ?");
        $stmt->execute([$name]);
        if ($stmt->fetch()) {
            $skipped++;
            $skippedList[] = $name;
            continue;
        }

        $sql = file_get_contents($path);
        $sql = preg_replace('/^\s*USE\s+\w+\s*;/mi', '', $sql);
        $rawStatements = array_map('trim', preg_split('/;\s*(\n|$)/m', $sql));
        $statements = [];
        foreach ($rawStatements as $s) {
            if ($s === '' || preg_match('/^USE\s+/i', $s)) continue;
            $s = preg_replace('/^(\s*--[^\n]*\n)+/', '', $s);
            $s = trim($s);
            if ($s !== '') $statements[] = $s;
        }

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
                    // MySQL/MariaDB: sloupec už neexistuje (např. DROP COLUMN už proběhl ručně / dřív)
                    || strpos($msg, "Can't DROP COLUMN") !== false
                    || strpos($msg, "Can't DROP") !== false
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
            $appliedList[] = $name;
        }
    }

    if ($errors) {
        http_response_code(500);
        echo json_encode([
            'ok' => false,
            'error' => implode('; ', $errors),
            'applied' => $applied,
            'applied_files' => $appliedList,
            'skipped' => $skipped,
            'skipped_files' => $skippedList,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'applied' => $applied,
        'applied_files' => $appliedList,
        'skipped' => $skipped,
        'skipped_files' => $skippedList,
        'migrations_path' => $migrationsDirReal,
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
