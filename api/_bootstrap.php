<?php
// api/_bootstrap.php – sdílený základ pro všechny API endpointy
declare(strict_types=1);

require __DIR__ . '/../config.php';

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

// ── JSON response helpers ───────────────────────────────────────────────────
function jsonOk(mixed $data = null, int $code = 200): never {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['ok'=>true,'data'=>$data], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
    exit;
}

function jsonErr(string $msg, int $code = 400): never {
    http_response_code($code);
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
function softInsert(string $tbl, array $data): int {
    $data['valid_from'] = date('Y-m-d H:i:s');
    $data['valid_to']   = null;
    $cols = implode(', ', array_keys($data));
    $ph   = implode(', ', array_fill(0, count($data), '?'));
    db()->prepare("INSERT INTO `$tbl` ($cols) VALUES ($ph)")->execute(array_values($data));
    return (int) db()->lastInsertId();
}

function softUpdate(string $tbl, int $id, array $new): int {
    $now = date('Y-m-d H:i:s');

    $s = db()->prepare("SELECT * FROM `$tbl` WHERE id=? AND valid_to IS NULL");
    $s->execute([$id]);
    $cur = $s->fetch();
    if (!$cur) jsonErr("Záznam #$id neexistuje.", 404);

    // zavři starý
    db()->prepare("UPDATE `$tbl` SET valid_to=? WHERE id=?")->execute([$now, $id]);

    // vloží nový
    unset($cur['id'], $cur['valid_from'], $cur['valid_to']);
    $merged = array_merge($cur, $new);
    $merged['valid_from'] = $now;
    $merged['valid_to']   = null;

    $cols = implode(', ', array_keys($merged));
    $ph   = implode(', ', array_fill(0, count($merged), '?'));
    db()->prepare("INSERT INTO `$tbl` ($cols) VALUES ($ph)")->execute(array_values($merged));
    return (int) db()->lastInsertId();
}

function softDelete(string $tbl, int $id): void {
    db()->prepare("UPDATE `$tbl` SET valid_to=? WHERE id=? AND valid_to IS NULL")
        ->execute([date('Y-m-d H:i:s'), $id]);
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
