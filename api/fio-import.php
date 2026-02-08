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
    SELECT id, bank_accounts_id, name, fio_token, currency
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
if ($from > $today || $to > $today) {
    jsonErr('Období nesmí být v budoucnosti. FIO API vrací pouze minulá data.');
}

// FIO API: cURL abychom při 4xx dostali tělo odpovědi (FIO tam posílá popis chyby)
$url = 'https://fioapi.fio.cz/v1/rest/periods/' . rawurlencode($token) . '/' . $from . '/' . $to . '/transactions.json';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: Nemovitosti/1.0 (FIO API client)'],
]);
$raw = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($raw === false || $raw === '') {
    if ($curlErr !== '') {
        jsonErr('Nepodařilo se připojit k FIO API. ' . $curlErr);
    }
    jsonErr('FIO API nevrátilo žádná data.');
}

$data = json_decode($raw, true);

// Při 4xx/5xx zobrazit zprávu z těla (FIO posílá errorDescription), jinak běžná chyba
if ($httpCode >= 400) {
    $msg = 'FIO API vrátilo HTTP ' . $httpCode . '.';
    $hasDetail = false;
    if (is_array($data)) {
        $detail = $data['errorDescription'] ?? $data['error'] ?? $data['message'] ?? null;
        if ($detail !== null && $detail !== '') {
            $msg .= ' ' . (is_string($detail) ? $detail : json_encode($detail));
            $hasDetail = true;
        }
    }
    if ($httpCode === 409) {
        $msg = 'FIO API omezuje počet požadavků (max. 1× za 30 sekund). Zkuste to znovu za chvíli.';
    } elseif ($httpCode === 422) {
        if (!$hasDetail) {
            $msg .= ' Časté příčiny: období v budoucnosti, neplatný nebo vypršený token. Zkontrolujte token v úpravě účtu.';
            $preview = mb_substr(preg_replace('/\s+/', ' ', trim($raw)), 0, 200);
            if ($preview !== '') {
                $msg .= ' Odpověď: ' . $preview . (strlen(trim($raw)) > 200 ? '…' : '');
            }
        }
        if (stripos($msg, 'authoriz') !== false || stripos($msg, 'strong') !== false || stripos($msg, 'ověřen') !== false) {
            $msg .= ' Postup: (1) Přihlaste se na ib.fio.cz → Nastavení → API. (2) U daného účtu zkontrolujte, zda není potřeba znovu autorizovat přístup k datům (někdy se zobrazí pokyn k potvrzení přes SMS nebo mobilní aplikaci; platnost 10 min). (3) Případně token zrušte a vytvořte nový („+ Přidat nový token“, práva „Pouze sledovat účet“, potvrzení SMS). (4) Do 10 minut zkuste import znovu.';
        }
    }
    jsonErr($msg);
}

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
$accountCurrency = isset($account['currency']) && trim((string)$account['currency']) !== ''
    ? strtoupper(substr(trim($account['currency']), 0, 3)) : 'CZK';
// Protiúčty z tabulky tenant_bank_accounts – importujeme jen příchozí platby od čísel účtů nájemců
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
        $base = preg_replace('/\/.*$/', '', $norm);
        if ($base !== '') {
            $allowedCounterparts[$base] = true;
        }
    }
}
$filterByCounterpart = count($allowedCounterparts) > 0;

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
        // FIO API: buď přímé klíče column0, column1, … nebo pole column/columns s objekty {id/name, value}
        $col = static function ($key) use ($t) {
            $v = $t[$key] ?? null;
            if (is_array($v) && isset($v['value'])) return (string)$v['value'];
            if (is_string($v)) return $v;
            foreach (($t['column'] ?? $t['columns'] ?? []) as $c) {
                if (!is_array($c)) continue;
                $id = $c['id'] ?? $c['name'] ?? null;
                if ((string)$id === (string)$key && isset($c['value'])) return (string)$c['value'];
            }
            return '';
        };
        $amount = $col('column1');
        $amountNum = 0.0;
        if (is_numeric(str_replace(['+', ',', ' '], ['', '.', ''], $amount))) {
            $amountNum = (float)str_replace(',', '.', $amount);
        }
        if ($amountNum <= 0) {
            continue;
        }
        // Datum: FIO může vracet column0 nebo date; cílový formát Y-m-d
        $date = trim($col('column0'));
        if ($date === '') $date = trim($col('date'));
        $dateNorm = null;
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', trim($date), $m)) {
            $dateNorm = $m[1] . '-' . $m[2] . '-' . $m[3];
        } elseif (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', trim($date), $m)) {
            $dateNorm = $m[3] . '-' . str_pad($m[2], 2, '0', STR_PAD_LEFT) . '-' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
        } elseif ($date !== '' && strtotime($date) !== false) {
            $dateNorm = date('Y-m-d', strtotime($date));
        }
        if ($dateNorm === null || $dateNorm === '') {
            $dateNorm = date('Y-m-d');
        }
        $counterpart = $col('column2');
        $bankCode = $col('column3');
        $message = $col('column16') !== '' ? $col('column16') : $col('column7');
        $fioId = $col('column22') !== '' ? $col('column22') : $col('column14');
        $counterpartFull = trim($counterpart . ($bankCode !== '' ? '/' . $bankCode : ''), '/');
        $counterpartNorm = $counterpartFull !== '' ? strtolower(preg_replace('/\s+/', '', $counterpartFull)) : '';
        $counterpartBase = $counterpartNorm !== '' ? preg_replace('/\/.*$/', '', $counterpartNorm) : '';
        $matchesCounterpart = $counterpartNorm !== '' && (
            isset($allowedCounterparts[$counterpartNorm]) || ($counterpartBase !== '' && isset($allowedCounterparts[$counterpartBase]))
        );
        if ($filterByCounterpart && !$matchesCounterpart) {
            $skipped_filter++;
            continue;
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
            'currency'            => $accountCurrency,
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
