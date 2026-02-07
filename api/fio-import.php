<?php
// api/fio-import.php – načtení z FIO a uložení do payment_imports (kontrola a schválení později)
// POST { bank_accounts_id, from?, to? } nebo GET ?bank_accounts_id=1&from=2025-01-01&to=2025-01-31
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    jsonErr('Pouze GET nebo POST.', 405);
}

$input = $method === 'POST' ? (json_decode((string)file_get_contents('php://input'), true) ?: []) : $_GET;
$bankAccountsId = isset($input['bank_accounts_id']) ? (int)$input['bank_accounts_id'] : 0;
$from = isset($input['from']) ? trim((string)$input['from']) : '';
$to = isset($input['to']) ? trim((string)$input['to']) : '';

if ($bankAccountsId <= 0) {
    jsonErr('Zadejte bank_accounts_id.');
}

$stmt = db()->prepare("
    SELECT id, bank_accounts_id, name, fio_token
    FROM bank_accounts
    WHERE (bank_accounts_id = ? OR id = ?) AND valid_to IS NULL
    LIMIT 1
");
$stmt->execute([$bankAccountsId, $bankAccountsId]);
$account = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$account) {
    jsonErr('Bankovní účet nenalezen.');
}
$token = isset($account['fio_token']) ? trim((string)$account['fio_token']) : '';
if ($token === '') {
    jsonErr('U tohoto účtu není nastaven FIO API token.');
}

$today = date('Y-m-d');
if ($from === '' || $to === '') {
    $from = date('Y-m-01');
    $to = $today;
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    jsonErr('Parametry from a to musí být RRRR-MM-DD.');
}
if (strtotime($from) > strtotime($to)) {
    jsonErr('Datum od nesmí být po datu do.');
}

// FIO API: základní URL je fioapi.fio.cz/v1/rest/, formát data Y-m-d (viz např. mhujer/fio-api-php)
$url = 'https://fioapi.fio.cz/v1/rest/periods/' . rawurlencode($token) . '/' . $from . '/' . $to . '/transactions.json';
$ctx = stream_context_create([
    'http' => [
        'timeout' => 30,
        'header' => "Accept: application/json\r\nUser-Agent: Nemovitosti/1.0 (FIO API client)\r\n",
    ],
]);
$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) {
    $err = error_get_last();
    jsonErr('Nepodařilo se připojit k FIO API. ' . (isset($err['message']) ? $err['message'] : ''));
}
$data = json_decode($raw, true);
if (!is_array($data)) {
    $jsonErr = json_last_error_msg();
    $preview = mb_substr(preg_replace('/\s+/', ' ', trim($raw)), 0, 300);
    $debug = ' [Debug: požadavek from=' . $from . ', to=' . $to . ', bank_accounts_id=' . $bankAccountsId
        . '; odpověď délka=' . strlen($raw) . ', json_err=' . $jsonErr . ', začátek=' . $preview . (strlen($raw) > 300 ? '…' : '') . ']';
    jsonErr('FIO API vrátilo neplatnou odpověď.' . $debug);
}
// FIO může vrátit JSON s chybovou strukturou (např. errorDescription)
if (isset($data['errorDescription']) || isset($data['error'])) {
    $msg = $data['errorDescription'] ?? $data['error'] ?? 'Neznámá chyba FIO';
    jsonErr('FIO API: ' . (is_string($msg) ? $msg : json_encode($msg)));
}
if (!isset($data['accountStatement']['transactionList'])) {
    $keys = is_array($data) ? implode(', ', array_keys($data)) : '–';
    jsonErr('FIO API nevrátilo očekávanou strukturu (accountStatement.transactionList). Klíče v odpovědi: ' . $keys);
}

$baId = (int)($account['bank_accounts_id'] ?? $account['id']);
// Protiúčty z tabulky tenant_bank_accounts (včetně historických nájemníků – pro import i starších záznamů)
$allowedCounterparts = [];
$accounts = db()->query("
    SELECT DISTINCT tba.account_number
    FROM tenant_bank_accounts tba
    INNER JOIN tenants t ON t.tenants_id = tba.tenants_id
    WHERE tba.valid_to IS NULL AND TRIM(tba.account_number) != ''
")->fetchAll(PDO::FETCH_COLUMN);
foreach ($accounts as $acc) {
    $norm = strtolower(preg_replace('/\s+/', '', trim($acc)));
    if ($norm !== '') {
        $allowedCounterparts[$norm] = true;
    }
}
$filterByCounterpart = count($allowedCounterparts) > 0; // pokud žádný nájemník nemá protiúčty, stáhneme vše (zpětná kompatibilita)

// Duplicita: stačí kontrolovat fio_transaction_id (jednoznačný u FIO)
$checkStmt = db()->prepare('SELECT id FROM payment_imports WHERE fio_transaction_id = ? LIMIT 1');

$txList = $data['accountStatement']['transactionList']['transaction'] ?? null;
if ($txList !== null && !is_array($txList)) {
    $txList = [$txList];
}
$imported = 0;
$skipped = 0;
$skipped_filter = 0; // neodpovídají protiúčtu u smluv
$items = [];

if (is_array($txList)) {
    foreach ($txList as $t) {
        $col = static function ($key) use ($t) {
            $v = $t[$key] ?? null;
            return is_array($v) && isset($v['value']) ? $v['value'] : (is_string($v) ? $v : '');
        };
        $amount = $col('column1');
        $amountNum = 0.0;
        if (is_numeric(str_replace(['+', ',', ' '], ['', '.', ''], $amount))) {
            $amountNum = (float)str_replace(',', '.', $amount);
        }
        if ($amountNum <= 0) {
            continue;
        }
        $date = $col('column0');
        $dateNorm = $date;
        if (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $date, $m)) {
            $dateNorm = $m[3] . '-' . str_pad($m[2], 2, '0', STR_PAD_LEFT) . '-' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
        }
        $counterpart = $col('column2');
        $bankCode = $col('column3');
        $message = $col('column16') !== '' ? $col('column16') : $col('column7');
        $fioId = $col('column22') !== '' ? $col('column22') : $col('column14');
        $counterpartFull = trim($counterpart . ($bankCode !== '' ? '/' . $bankCode : ''), '/');
        $counterpartNorm = $counterpartFull !== '' ? strtolower(preg_replace('/\s+/', '', $counterpartFull)) : '';
        if ($filterByCounterpart && ($counterpartNorm === '' || !isset($allowedCounterparts[$counterpartNorm]))) {
$skipped_filter++;
            continue; // tento pohyb není od protiúčtu uloženého u žádného nájemníka
        }

        if ($fioId !== '') {
            $checkStmt->execute([$fioId]);
            if ($checkStmt->fetch()) {
                $skipped++;
                continue;
            }
        }
        $newId = softInsert('payment_imports', [
            'bank_accounts_id'    => $baId,
            'payment_date'        => $dateNorm,
            'amount'              => $amountNum,
            'counterpart_account' => $counterpartFull !== '' ? $counterpartFull : null,
            'note'                => $message !== '' ? $message : null,
            'fio_transaction_id'  => $fioId !== '' ? $fioId : null,
            'payment_type'        => null,
        ]);
        $imported++;
        $items[] = [
            'id' => $newId,
            'payment_date' => $dateNorm,
            'amount' => $amountNum,
            'counterpart_account' => $counterpartFull,
            'note' => $message,
        ];
    }
}

jsonOk([
    'imported' => $imported,
    'skipped' => $skipped,
    'skipped_filter' => $skipped_filter,
    'account_name' => $account['name'] ?? '',
    'from' => $from,
    'to' => $to,
    'items' => $items,
]);
