<?php
// api/_bootstrap.php – sdílený základ pro všechny API endpointy
declare(strict_types=1);

ob_start();
set_exception_handler(function(Throwable $e) {
    if (ob_get_level()) ob_end_clean();
    http_response_code(500);
    header('Content-Type: application/json');
    // CORS: stejná hierarchie jako v auth.php (konstanta z config.php / config.default.php, jinak getenv)
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '') {
        $raw = defined('CORS_ALLOWED_ORIGINS') ? (string)CORS_ALLOWED_ORIGINS : (getenv('CORS_ALLOWED_ORIGINS') ?: '');
        $list = array_map('trim', array_filter(explode(',', $raw)));
        $allowed = in_array($origin, $list, true) || (!$list && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin));
        if ($allowed) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
        }
    }
    $showDetails = (defined('DEBUG') && DEBUG);
    $msg = $showDetails ? $e->getMessage() : 'Chyba serveru.';
    $out = ['ok' => false, 'error' => $msg];
    if ($showDetails) {
        $out['error_detail'] = [
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'trace' => array_slice(explode("\n", $e->getTraceAsString()), 0, 10),
        ];
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
    exit;
});

$config = __DIR__ . '/../config.php';
$configDefault = __DIR__ . '/../config.default.php';
if (file_exists($config)) require $config;
require $configDefault;

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
// Na Railway (ephemeral filesystem) použij SESSION_USE_DB=1 – session v MySQL přežijí deploy.
(function(){
    if (session_status() !== PHP_SESSION_NONE) return;
    ini_set('session.gc_maxlifetime', (string)SESSION_LIFE);
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => SESSION_LIFE,
            'path'     => '/',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    } else {
        session_set_cookie_params(SESSION_LIFE, '/', '', $secure, true);
    }
    session_name(SESSION_NAME);
    $useDbSessions = false;
    if (defined('SESSION_USE_DB') && SESSION_USE_DB) {
        try {
            $r = db()->query("SHOW TABLES LIKE '_sessions'");
            $useDbSessions = $r && $r->rowCount() > 0;
        } catch (Throwable $e) {
            error_log('[session] _sessions table check failed: ' . $e->getMessage());
        }
    }
    if ($useDbSessions) {
        $handler = new class implements \SessionHandlerInterface {
            public function open(string $path, string $name): bool { return true; }
            public function close(): bool { return true; }
            public function read(string $id): string|false {
                if ($id === '') return '';
                try {
                    $s = db()->prepare('SELECT data FROM _sessions WHERE id = ? AND last_activity > ?');
                    $s->execute([$id, time() - SESSION_LIFE]);
                    $row = $s->fetch();
                    return $row ? (string) $row['data'] : '';
                } catch (Throwable $e) {
                    error_log('[session] read failed: ' . $e->getMessage());
                    return '';
                }
            }
            public function write(string $id, string $data): bool {
                if ($id === '') return true;
                try {
                    db()->prepare('REPLACE INTO _sessions (id, data, last_activity) VALUES (?, ?, ?)')
                        ->execute([$id, $data, time()]);
                    return true;
                } catch (Throwable $e) {
                    error_log('[session] write failed: ' . $e->getMessage());
                    return false;
                }
            }
            public function destroy(string $id): bool {
                if ($id === '') return true;
                try {
                    db()->prepare('DELETE FROM _sessions WHERE id = ?')->execute([$id]);
                    return true;
                } catch (Throwable $e) {
                    return false;
                }
            }
            public function gc(int $max_lifetime): int|false {
                try {
                    $stmt = db()->prepare('DELETE FROM _sessions WHERE last_activity < ?');
                    $stmt->execute([time() - $max_lifetime]);
                    return $stmt->rowCount();
                } catch (Throwable $e) {
                    return false;
                }
            }
        };
        session_set_save_handler($handler, true);
    }
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

/**
 * Synchronizuje rent požadavky (payment_requests type=rent) pro smlouvu:
 * pro každý měsíc v rozsahu contract_start .. contract_end (nebo do konce běžného měsíce)
 * najde/aktualizuje/vytvoří požadavek; mimo rozsah smaže jen neuhrazené.
 */
function syncRentPaymentRequests(int $contractsId): void {
    $c = findActiveByEntityId('contracts', $contractsId);
    if (!$c || empty($c['contract_start'])) return;
    $start = substr(trim($c['contract_start']), 0, 10);
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $start, $m)) return;
    $yStart = (int)$m[1]; $monthStart = (int)$m[2];
    $end = trim($c['contract_end'] ?? '');
    if ($end !== '' && $end !== null) {
        if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $end, $m2)) return;
        $yEnd = (int)$m2[1]; $monthEnd = (int)$m2[2];
    } else {
        $yEnd = (int)date('Y'); $monthEnd = (int)date('n');
    }
    $baseRent = (float)($c['monthly_rent'] ?? 0);
    $firstMonthRent = isset($c['first_month_rent']) && $c['first_month_rent'] !== null && $c['first_month_rent'] !== '' ? (float)$c['first_month_rent'] : null;
    $lastMonthRent = isset($c['last_month_rent']) && $c['last_month_rent'] !== null && $c['last_month_rent'] !== '' ? (float)$c['last_month_rent'] : null;
    $rentChangesRaw = db()->prepare("SELECT * FROM contract_rent_changes WHERE contracts_id = ? AND valid_to IS NULL ORDER BY effective_from ASC");
    $rentChangesRaw->execute([$contractsId]);
    $rentChangesByContract = [$contractsId => $rentChangesRaw->fetchAll(PDO::FETCH_ASSOC)];
    $findRent = db()->prepare("SELECT id, amount, due_date FROM payment_requests WHERE contracts_id = ? AND period_year = ? AND period_month = ? AND type = 'rent' AND valid_to IS NULL");
    $syncedMonths = [];
    $limit = $yEnd * 12 + $monthEnd; // jedno číslo pro porovnání (y,m) <= (yEnd, monthEnd)
    if (($yStart * 12 + $monthStart) > $limit) return; // start až za koncem – žádné období
    for ($y = $yStart, $m = $monthStart; ($y * 12 + $m) <= $limit; ) {
        $firstOfMonth = sprintf('%04d-%02d-01', $y, $m);
        $lastDayOfMonth = date('Y-m-t', strtotime($firstOfMonth));
        if ($start > $firstOfMonth && (int)date('Y', strtotime($start)) === $y && (int)date('n', strtotime($start)) === $m && $firstMonthRent !== null) {
            $amount = $firstMonthRent;
        } elseif ($end !== '' && $end !== null && (int)date('Y', strtotime($end)) === $y && (int)date('n', strtotime($end)) === $m && $end < $lastDayOfMonth && $lastMonthRent !== null) {
            $amount = $lastMonthRent;
        } else {
            $amount = getRentForMonth($baseRent, $contractsId, $y, $m, $rentChangesByContract);
        }
        $dueDate = date('Y-m-t', strtotime("$y-$m-01"));
        $findRent->execute([$contractsId, $y, $m]);
        $existing = $findRent->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            $exAmt = (float)$existing['amount'];
            $exDue = $existing['due_date'] ? substr($existing['due_date'], 0, 10) : null;
            if (abs($exAmt - $amount) > 0.005 || $exDue !== $dueDate) {
                softUpdate('payment_requests', (int)$existing['id'], ['amount' => round($amount, 2), 'due_date' => $dueDate]);
            }
        } else {
            softInsert('payment_requests', [
                'contracts_id'  => $contractsId,
                'amount'        => round($amount, 2),
                'type'          => 'rent',
                'due_date'      => $dueDate,
                'period_year'   => $y,
                'period_month'  => $m,
            ]);
        }
        $syncedMonths[$y . '_' . $m] = true;
        if (++$m > 12) { $m = 1; $y++; }
    }
    $del = db()->prepare("SELECT id, period_year, period_month FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL AND payments_id IS NULL");
    $del->execute([$contractsId]);
    foreach ($del->fetchAll(PDO::FETCH_ASSOC) as $pr) {
        if ($pr['period_year'] === null || $pr['period_month'] === null) continue;
        $key = (int)$pr['period_year'] . '_' . (int)$pr['period_month'];
        if (!isset($syncedMonths[$key])) {
            softDelete('payment_requests', (int)$pr['id']);
        }
    }
}

/**
 * Migrace 062: vygenerovat rent požadavky pro všechny smlouvy a propojit rent platby.
 * Vrací pole s počty (pro API nebo CLI výpis).
 */
function runMigration062(): array {
    $contracts = db()->query("SELECT * FROM contracts WHERE valid_to IS NULL ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
    $generated = 0;
    foreach ($contracts as $c) {
        $contractsId = (int)($c['contracts_id'] ?? $c['id']);
        $before = db()->prepare("SELECT COUNT(*) FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL");
        $before->execute([$contractsId]);
        $countBefore = (int)$before->fetchColumn();
        syncRentPaymentRequests($contractsId);
        $after = db()->prepare("SELECT COUNT(*) FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL");
        $after->execute([$contractsId]);
        $countAfter = (int)$after->fetchColumn();
        $generated += max(0, (int)$countAfter - $countBefore);
    }
    $payments = db()->query("
        SELECT p.id, COALESCE(p.payments_id, p.id) AS entity_id, p.contracts_id, p.period_year, p.period_month, p.amount, p.payment_date
        FROM payments p
        WHERE p.valid_to IS NULL AND p.payment_type = 'rent'
          AND p.period_year IS NOT NULL AND p.period_month IS NOT NULL
          AND p.period_year > 0 AND p.period_month BETWEEN 1 AND 12
        ORDER BY p.contracts_id, p.period_year, p.period_month
    ")->fetchAll(PDO::FETCH_ASSOC);
    $linked = 0;
    $alreadyLinked = 0;
    $noMatch = 0;
    $findPr = db()->prepare("
        SELECT id, payment_requests_id, payments_id
        FROM payment_requests
        WHERE contracts_id = ? AND period_year = ? AND period_month = ? AND type = 'rent' AND valid_to IS NULL
        LIMIT 1
    ");
    foreach ($payments as $pay) {
        $contractsId = (int)$pay['contracts_id'];
        $py = (int)$pay['period_year'];
        $pm = (int)$pay['period_month'];
        $payEntityId = (int)$pay['entity_id'];
        $paidAt = !empty($pay['payment_date']) ? substr($pay['payment_date'], 0, 10) : date('Y-m-d');
        $findPr->execute([$contractsId, $py, $pm]);
        $pr = $findPr->fetch(PDO::FETCH_ASSOC);
        if (!$pr) { $noMatch++; continue; }
        if (!empty($pr['payments_id'])) { $alreadyLinked++; continue; }
        softUpdate('payment_requests', (int)$pr['id'], ['payments_id' => $payEntityId, 'paid_at' => $paidAt]);
        $linked++;
    }
    return ['contracts' => count($contracts), 'generated' => $generated, 'linked' => $linked, 'already_linked' => $alreadyLinked, 'no_match' => $noMatch];
}

/** Vyhledá aktivní řádek podle entity_id (users_id, properties_id, …). */
function findActiveByEntityId(string $tbl, int $entityId): ?array {
    $eidCol = _entityIdCol($tbl);
    $s = db()->prepare("SELECT * FROM `$tbl` WHERE `$eidCol`=? AND valid_to IS NULL");
    $s->execute([$entityId]);
    return $s->fetch() ?: null;
}
