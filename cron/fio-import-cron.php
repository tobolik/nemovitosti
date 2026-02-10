#!/usr/bin/env php
<?php
// cron/fio-import-cron.php – načtení plateb z FIO ze všech účtů s tokenem a automatické párování + schválení
// Spouštět z cronu (např. 1× denně). FIO API: max 1 požadavek za 30 s na účet – mezi účty je pauza.
// Použití: php cron/fio-import-cron.php [--days=60] [--no-approve]
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    die('Skript je určen pouze pro příkazovou řádku (cron).');
}

$options = getopt('', ['days:', 'no-approve']);
$days = isset($options['days']) ? (int)$options['days'] : 60;
$autoApprove = !isset($options['no-approve']);
if ($days < 1 || $days > 365) {
    $days = 60;
}

$baseDir = dirname(__DIR__);
require $baseDir . '/api/_bootstrap.php';
// Cron nemá přihlášeného uživatele – softInsert/softUpdate použijí null pro valid_user_*
$_SESSION['uid'] = null;

define('CRUD_CLI', true);
require $baseDir . '/api/crud.php';
require_once $baseDir . '/api/fio-fetch.php';

$to = date('Y-m-d');
$from = date('Y-m-d', strtotime("-{$days} days"));

$log = static function (string $msg): void {
    echo '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
};

// 1) Účty s FIO tokenem
$accounts = db()->query("
    SELECT id, COALESCE(bank_accounts_id, id) AS bank_accounts_id, name, fio_token
    FROM bank_accounts
    WHERE valid_to IS NULL AND TRIM(COALESCE(fio_token, '')) != ''
    ORDER BY id
")->fetchAll(PDO::FETCH_ASSOC);

if (count($accounts) === 0) {
    $log('Žádný bankovní účet s FIO tokenem.');
    exit(0);
}

$totalImported = 0;
foreach ($accounts as $acc) {
    $baId = (int)$acc['bank_accounts_id'];
    $name = $acc['name'] ?? 'účet #' . $baId;
    try {
        $result = runFioImportForAccount($baId, $from, $to);
        $totalImported += $result['imported'];
        if ($result['imported'] > 0 || $result['skipped'] > 0) {
            $log("FIO {$name}: importováno {$result['imported']}, přeskočeno {$result['skipped']}, filtr protiúčet {$result['skipped_filter']}");
        }
    } catch (Throwable $e) {
        $log("FIO {$name}: chyba – " . $e->getMessage());
    }
    // FIO API limit: 1 požadavek za 30 s
    if (count($accounts) > 1) {
        sleep(31);
    }
}

$log("Celkem nových importů: {$totalImported}");

// 2) Návrh párování (stejná logika jako v API pro payment_imports)
$contractsWithRent = db()->query("
    SELECT c.contracts_id, c.id, c.tenants_id, c.monthly_rent, c.contract_start, c.contract_end
    FROM contracts c
    WHERE c.valid_to IS NULL
    AND (c.contract_end IS NULL OR c.contract_end >= CURDATE() OR c.contract_end >= DATE_SUB(CURDATE(), INTERVAL 24 MONTH))
")->fetchAll(PDO::FETCH_ASSOC);

$rentChangesRaw = db()->query("SELECT * FROM contract_rent_changes WHERE valid_to IS NULL ORDER BY contracts_id, effective_from ASC")->fetchAll(PDO::FETCH_ASSOC);
$rentChangesByContract = [];
foreach ($rentChangesRaw as $rc) {
    $cid = (int)$rc['contracts_id'];
    if (!isset($rentChangesByContract[$cid])) $rentChangesByContract[$cid] = [];
    $rentChangesByContract[$cid][] = $rc;
}

$unpaidRequestsByContract = [];
foreach (db()->query("
    SELECT contracts_id, SUM(amount) AS total FROM payment_requests
    WHERE valid_to IS NULL AND paid_at IS NULL GROUP BY contracts_id
")->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $unpaidRequestsByContract[(int)$r['contracts_id']] = (float)$r['total'];
}

$requestAmountsByContract = [];
$totalRequestsByContract = [];
foreach (db()->query("SELECT contracts_id, amount FROM payment_requests WHERE valid_to IS NULL")->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $cid = (int)$r['contracts_id'];
    $amt = (float)$r['amount'];
    if (!isset($requestAmountsByContract[$cid])) $requestAmountsByContract[$cid] = [];
    $requestAmountsByContract[$cid][] = $amt;
    $totalRequestsByContract[$cid] = ($totalRequestsByContract[$cid] ?? 0) + $amt;
}

$imports = db()->query("
    SELECT id, amount, payment_date, counterpart_account, contracts_id, period_year, period_month, payment_type
    FROM payment_imports
    WHERE valid_to IS NULL AND approved_at IS NULL
    ORDER BY payment_date DESC, id DESC
")->fetchAll(PDO::FETCH_ASSOC);

$paired = 0;
$approved = 0;
$created = 0;

foreach ($imports as $imp) {
    $suggestion = suggestPaymentImportPairing(
        (float)$imp['amount'],
        (string)$imp['payment_date'],
        isset($imp['counterpart_account']) ? trim((string)$imp['counterpart_account']) : null,
        $contractsWithRent,
        $rentChangesByContract,
        $unpaidRequestsByContract,
        $requestAmountsByContract,
        $totalRequestsByContract
    );
    if ($suggestion === null) continue;

    $upd = [
        'contracts_id'      => $suggestion['suggested_contracts_id'],
        'period_year'       => $suggestion['suggested_period_year'],
        'period_month'     => $suggestion['suggested_period_month'],
        'period_year_to'   => $suggestion['suggested_period_year_to'] ?? $suggestion['suggested_period_year'],
        'period_month_to'  => $suggestion['suggested_period_month_to'] ?? $suggestion['suggested_period_month'],
        'payment_type'     => $suggestion['suggested_payment_type'],
    ];
    softUpdate('payment_imports', (int)$imp['id'], $upd);
    $paired++;
}

$log("Spárováno návrhů: {$paired}");

// 3) Automatické schválení spárovaných (vytvoření plateb)
if (!$autoApprove) {
    $log('Schválení přeskočeno (--no-approve).');
    exit(0);
}

$toApprove = db()->query("
    SELECT * FROM payment_imports
    WHERE valid_to IS NULL AND approved_at IS NULL
    AND contracts_id IS NOT NULL AND period_year IS NOT NULL AND period_month IS NOT NULL
    AND payment_type IS NOT NULL AND TRIM(payment_type) != ''
    ORDER BY id
")->fetchAll(PDO::FETCH_ASSOC);

foreach ($toApprove as $imp) {
    $cid = (int)$imp['contracts_id'];
    $py = (int)$imp['period_year'];
    $pm = (int)$imp['period_month'];
    $paymentType = in_array($imp['payment_type'], ['rent', 'deposit', 'deposit_return', 'energy', 'other']) ? $imp['payment_type'] : 'rent';
    $pyTo = isset($imp['period_year_to']) && $imp['period_year_to'] !== '' ? (int)$imp['period_year_to'] : null;
    $pmTo = isset($imp['period_month_to']) && $imp['period_month_to'] !== '' ? (int)$imp['period_month_to'] : null;

    $months = [];
    if ($pyTo !== null && $pmTo !== null && ($pyTo > $py || ($pyTo === $py && $pmTo >= $pm))) {
        for ($y = $py, $m = $pm; $y < $pyTo || ($y === $pyTo && $m <= $pmTo); $m++) {
            if ($m > 12) { $m = 1; $y++; }
            $months[] = [$y, $m];
            if ($y === $pyTo && $m === $pmTo) break;
        }
        $div = count($months);
        $amountPerMonth = $div > 0 ? round((float)$imp['amount'] / $div, 2) : (float)$imp['amount'];
    } else {
        $months[] = [$py, $pm];
        $amountPerMonth = (float)$imp['amount'];
    }

    $paymentDate = $imp['payment_date'] ?? date('Y-m-d');
    $bankAccountId = (int)($imp['bank_accounts_id'] ?? 0);
    $counterpart = !empty(trim((string)($imp['counterpart_account'] ?? ''))) ? trim($imp['counterpart_account']) : null;
    $note = !empty(trim((string)($imp['note'] ?? ''))) ? trim($imp['note']) : null;
    $bankTransactionId = !empty(trim((string)($imp['fio_transaction_id'] ?? ''))) ? trim($imp['fio_transaction_id']) : null;
    $currency = isset($imp['currency']) && trim((string)$imp['currency']) !== ''
        ? strtoupper(substr(trim($imp['currency']), 0, 3)) : 'CZK';

    $firstPaymentEntityId = null;
    foreach ($months as [$y, $m]) {
        $payData = [
            'contracts_id'        => $cid,
            'period_year'         => $y,
            'period_month'        => $m,
            'amount'              => $amountPerMonth,
            'currency'            => $currency,
            'payment_date'        => $paymentDate,
            'payment_method'      => 'account',
            'bank_accounts_id'    => $bankAccountId > 0 ? $bankAccountId : null,
            'counterpart_account' => $counterpart,
            'bank_transaction_id' => $bankTransactionId,
            'note'                => $note,
            'payment_type'        => $paymentType,
            'approved_at'         => date('Y-m-d H:i:s'),
        ];
        $newId = softInsert('payments', $payData);
        if ($firstPaymentEntityId === null) {
            $firstPay = findActive('payments', $newId);
            $firstPaymentEntityId = (int)($firstPay['payments_id'] ?? $firstPay['id']);
        }
        $created++;
    }

    db()->prepare('UPDATE payment_imports SET approved_at = ?, payments_id = ? WHERE id = ? AND valid_to IS NULL')
        ->execute([date('Y-m-d H:i:s'), $firstPaymentEntityId, $imp['id']]);
    $approved++;

    $prId = isset($imp['payment_request_id']) ? (int)$imp['payment_request_id'] : 0;
    if ($prId > 0 && $firstPaymentEntityId !== null) {
        $prRow = findActiveByEntityId('payment_requests', $prId);
        if ($prRow && (int)($prRow['contracts_id'] ?? 0) === $cid) {
            softUpdate('payment_requests', (int)$prRow['id'], ['payments_id' => $firstPaymentEntityId, 'paid_at' => $paymentDate ?: date('Y-m-d')]);
        }
    }
}

$log("Schváleno importů: {$approved}, vytvořeno plateb: {$created}.");
