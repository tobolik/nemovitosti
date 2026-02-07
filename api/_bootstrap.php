<?php
// api/_bootstrap.php – sdílený základ pro všechny API endpointy
declare(strict_types=1);

// Diagnostika: každý krok zapíše řádek do api/diag.txt – podle posledního řádku uvidíte, kde skript skončil
function apiDiag(string $step): void {
    @file_put_contents(__DIR__ . '/diag.txt', date('c') . ' ' . $step . "\n", FILE_APPEND | LOCK_EX);
}
apiDiag('1_bootstrap_start');

const API_LOG_PREFIX = 'NEMOVITOSTI-API-500';

/** Zapisuje do api/log/api-500.log (v adresáři skriptu – obvykle má zápis). Případně do PHP error_log. */
function apiLog500(string $message): void {
    $full = API_LOG_PREFIX . ' ' . $message;
    error_log($full);
    $logFile = __DIR__ . '/log/api-500.log';  // api/log/api-500.log
    $dir = dirname($logFile);
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
        @file_put_contents($logFile, date('c') . ' ' . $message . "\n", FILE_APPEND | LOCK_EX);
    }
}

ob_start();
set_exception_handler(function(Throwable $e) {
    if (ob_get_level()) ob_end_clean();
    apiLog500('EXCEPTION: ' . $e->getMessage() . ' | ' . $e->getFile() . ':' . $e->getLine());
    http_response_code(500);
    header('Content-Type: application/json');
    $msg = (defined('DEBUG') && DEBUG) ? $e->getMessage() : 'Chyba serveru.';
    echo json_encode(['ok'=>false,'error'=>$msg], JSON_UNESCAPED_UNICODE);
    exit;
});

// Fatální chyby (např. undefined variable v PHP 8) neprojdou exception handlerem – zachytíme je tady
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        apiLog500('FATAL: ' . ($err['message'] ?? '') . ' | ' . ($err['file'] ?? '') . ':' . ($err['line'] ?? ''));
    }
});

require __DIR__ . '/../config.php';
apiDiag('2_config_loaded');

// ── PDO singleton ───────────────────────────────────────────────────────────
function db(): PDO {
    static $pdo = null;
    if (!$pdo) {
        $pdo = new PDO(
            "mysql:host=".DB_HOST.";port=".DB_PORT.";dbname=".DB_NAME.";charset=utf8mb4",
            DB_USER, DB_PASS,
            [ PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
              PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
              PDO::ATTR_EMULATE_PREPARES   => false ]
        );
    }
    return $pdo;
}

// ── Session ─────────────────────────────────────────────────────────────────
(function(){
    if (session_status() !== PHP_SESSION_NONE) return;
    ini_set('session.gc_maxlifetime', (string)SESSION_LIFE);
    session_set_cookie_params([
        'lifetime' => SESSION_LIFE,
        'path'     => '/',
        'secure'   => ($_SERVER['HTTPS'] ?? '') === 'on',
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_name(SESSION_NAME);
    session_start();
})();

// ── Security headers (pro JSON odpovědi) ────────────────────────────────────
function _securityHeaders(): void {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
}

// ── JSON response helpers ───────────────────────────────────────────────────
function jsonOk($data = null, int $code = 200): void {
    if (ob_get_level()) ob_end_clean();
    http_response_code($code);
    _securityHeaders();
    header('Content-Type: application/json');
    echo json_encode(['ok'=>true,'data'=>$data], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
    exit;
}

function jsonErr(string $msg, int $code = 400): void {
    if (ob_get_level()) ob_end_clean();
    http_response_code($code);
    _securityHeaders();
    header('Content-Type: application/json');
    echo json_encode(['ok'=>false,'error'=>$msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── CSRF ────────────────────────────────────────────────────────────────────
function csrfToken(): string {
    if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function verifyCsrf(): void {
    $tok = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $tok))
        jsonErr('Neplatný CSRF token.', 403);
}

// ── Auth guards ─────────────────────────────────────────────────────────────
function requireLogin(): void {
    if (!isset($_SESSION['uid'])) jsonErr('Nejste přihlášen.', 401);
}
function requireAdmin(): void {
    requireLogin();
    if (($_SESSION['role']??'') !== 'admin') jsonErr('Nedostatečná práva.', 403);
}

// ── JSON request body ───────────────────────────────────────────────────────
function body(): array {
    static $b = null;
    if ($b === null) $b = json_decode(file_get_contents('php://input'), true) ?? [];
    return $b;
}

// ── Soft-record helpers ─────────────────────────────────────────────────────
// Entity_id sloupce: users_id, properties_id, tenants_id, contracts_id, payments_id, contract_rent_changes_id
function _entityIdCol(string $tbl): string {
    return $tbl . '_id';
}

function softInsert(string $tbl, array $data): int {
    $uid = $_SESSION['uid'] ?? null;
    $data['valid_from']      = date('Y-m-d H:i:s');
    $data['valid_to']        = null;
    $data['valid_user_from'] = $uid;
    $data['valid_user_to']   = null;
    $cols = implode(', ', array_keys($data));
    $ph   = implode(', ', array_fill(0, count($data), '?'));
    db()->prepare("INSERT INTO `$tbl` ($cols) VALUES ($ph)")->execute(array_values($data));
    $newId = (int) db()->lastInsertId();
    $eidCol = _entityIdCol($tbl);
    db()->prepare("UPDATE `$tbl` SET `$eidCol`=? WHERE id=? AND `$eidCol` IS NULL")
        ->execute([$newId, $newId]);
    return $newId;
}

function softUpdate(string $tbl, int $id, array $new): int {
    $now = date('Y-m-d H:i:s');
    $eidCol = _entityIdCol($tbl);

    $s = db()->prepare("SELECT * FROM `$tbl` WHERE id=? AND valid_to IS NULL");
    $s->execute([$id]);
    $cur = $s->fetch();
    if (!$cur) jsonErr("Záznam #$id neexistuje.", 404);

    $entityId = $cur[$eidCol] ?? $cur['id'];
    if ($entityId === null) $entityId = $cur['id'];

    $uid = $_SESSION['uid'] ?? null;

    // zavři všechny aktivní verze této entity (včetně řádku s bank_accounts_id=NULL)
    db()->prepare("UPDATE `$tbl` SET valid_to=?, valid_user_to=? WHERE (`$eidCol`=? OR (id=? AND `$eidCol` IS NULL)) AND valid_to IS NULL")
        ->execute([$now, $uid, $entityId, $id]);

    // vloží nový řádek se stejným entity_id
    unset($cur['id'], $cur['valid_from'], $cur['valid_to'], $cur['valid_user_from'], $cur['valid_user_to']);
    $merged = array_merge($cur, $new);
    $merged[$eidCol]         = $entityId;
    $merged['valid_from']   = $now;
    $merged['valid_to']      = null;
    $merged['valid_user_from'] = $uid;
    $merged['valid_user_to']   = null;

    $cols = implode(', ', array_keys($merged));
    $ph   = implode(', ', array_fill(0, count($merged), '?'));
    db()->prepare("INSERT INTO `$tbl` ($cols) VALUES ($ph)")->execute(array_values($merged));
    return (int) db()->lastInsertId();
}

function softDelete(string $tbl, int $id): void {
    $uid = $_SESSION['uid'] ?? null;
    db()->prepare("UPDATE `$tbl` SET valid_to=?, valid_user_to=? WHERE id=? AND valid_to IS NULL")
        ->execute([date('Y-m-d H:i:s'), $uid, $id]);
}

function findActive(string $tbl, int $id): ?array {
    $s = db()->prepare("SELECT * FROM `$tbl` WHERE id=? AND valid_to IS NULL");
    $s->execute([$id]);
    return $s->fetch() ?: null;
}

function findAllActive(string $tbl, string $order = 'id ASC'): array {
    $order = preg_replace('/[^a-zA-Z0-9_ ,]/', '', $order);
    $s = db()->prepare("SELECT * FROM `$tbl` WHERE valid_to IS NULL ORDER BY $order");
    $s->execute();
    return $s->fetchAll();
}

/** Vrátí nájemné pro daný měsíc – zohledňuje změny k datu (contract_rent_changes). */
function getRentForMonth(float $baseRent, int $contractsId, int $y, int $m, array $rentChangesByContract): float {
    $firstOfMonth = sprintf('%04d-%02d-01', $y, $m);
    $changes = $rentChangesByContract[$contractsId] ?? [];
    $applicable = null;
    foreach ($changes as $ch) {
        $effFrom = substr((string)($ch['effective_from'] ?? ''), 0, 10);
        if ($effFrom !== '' && $effFrom <= $firstOfMonth) {
            $applicable = (float)$ch['amount'];
        }
    }
    return $applicable !== null ? $applicable : $baseRent;
}

/** Vyhledá aktivní řádek podle entity_id (users_id, properties_id, …). */
function findActiveByEntityId(string $tbl, int $entityId): ?array {
    $eidCol = _entityIdCol($tbl);
    $s = db()->prepare("SELECT * FROM `$tbl` WHERE `$eidCol`=? AND valid_to IS NULL");
    $s->execute([$entityId]);
    return $s->fetch() ?: null;
}
