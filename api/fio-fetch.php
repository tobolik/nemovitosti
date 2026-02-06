<?php
// api/fio-fetch.php – načtení pohybů z FIO banky (podle tokenu u bankovního účtu)
// GET ?bank_accounts_id=1&from=2025-01-01&to=2025-01-31
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonErr('Pouze GET.', 405);
}

$bankAccountsId = isset($_GET['bank_accounts_id']) ? (int)$_GET['bank_accounts_id'] : 0;
$from = isset($_GET['from']) ? trim($_GET['from']) : '';
$to = isset($_GET['to']) ? trim($_GET['to']) : '';

if ($bankAccountsId <= 0) {
    jsonErr('Zadejte bank_accounts_id (entity_id bankovního účtu).');
}

// Načíst účet a token (token je pouze v DB, neposíláme ho do klienta)
$stmt = db()->prepare("
    SELECT id, bank_accounts_id, name, account_number, fio_token
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
    jsonErr('U tohoto účtu není nastaven FIO API token. Nastavte ho v úpravě účtu.');
}

// Výchozí období: aktuální měsíc
$today = date('Y-m-d');
if ($from === '' || $to === '') {
    $from = date('Y-m-01');
    $to = $today;
}
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
    jsonErr('Parametry from a to musí být ve formátu RRRR-MM-DD.');
}
if (strtotime($from) > strtotime($to)) {
    jsonErr('Datum od nesmí být po datu do.');
}

// FIO API: periods – formát data d.m.Y
$fromFio = date('d.m.Y', strtotime($from));
$toFio = date('d.m.Y', strtotime($to));
$url = 'https://www.fio.cz/ib_api/rest/periods/' . rawurlencode($token) . '/' . $fromFio . '/' . $toFio . '/transactions.json';

$ctx = stream_context_create([
    'http' => [
        'timeout' => 30,
        'header' => "Accept: application/json\r\n",
    ],
]);
$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) {
    jsonErr('Nepodařilo se připojit k FIO API. Zkontrolujte token a připojení.');
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    jsonErr('FIO API vrátilo neplatnou odpověď.');
}

// Struktura: accountStatement.transactionList.transaction[]; každý pohyb má column0 (datum), column1 (objem), column2 (protiúčet), atd.
$transactions = [];
// FIO JSON: transactionList.transaction[]; při jednom pohybu může být objekt místo pole
$stmt = $data['accountStatement']['transactionList']['transaction'] ?? null;
if ($stmt !== null && !is_array($stmt)) {
    $stmt = [$stmt];
}
if (is_array($stmt)) {
    foreach ($stmt as $t) {
        $col = static function ($key) use ($t) {
            $v = $t[$key] ?? null;
            return is_array($v) && isset($v['value']) ? $v['value'] : (is_string($v) ? $v : '');
        };
        $date = $col('column0');
        $amount = $col('column1');
        $counterpart = $col('column2');
        $bankCode = $col('column3');
        $message = $col('column16') !== '' ? $col('column16') : $col('column7');
        $id = $col('column22') !== '' ? $col('column22') : $col('column14');
        // Datum může být d.m.yyyy → převést na Y-m-d
        $dateNorm = $date;
        if (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', $date, $m)) {
            $dateNorm = $m[3] . '-' . str_pad($m[2], 2, '0', STR_PAD_LEFT) . '-' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
        }
        // Objem: řetězec s + nebo - (příjem/výdej); převést na číslo
        $amountNum = 0.0;
        if (is_numeric(str_replace(['+', ',', ' '], ['', '.', ''], $amount))) {
            $amountNum = (float)str_replace(',', '.', $amount);
        }
        // Do výpisu dávat jen příchozí platby (kladná částka)
        if ($amountNum > 0) {
            $transactions[] = [
                'id' => $id,
                'date' => $dateNorm,
                'amount' => $amountNum,
                'counterpart_account' => trim($counterpart . ($bankCode !== '' ? '/' . $bankCode : ''), '/'),
                'message' => $message,
                'bank_accounts_id' => (int)($account['bank_accounts_id'] ?? $account['id']),
            ];
        }
    }
}

jsonOk([
    'account_name' => $account['name'] ?? '',
    'account_number' => $account['account_number'] ?? '',
    'from' => $from,
    'to' => $to,
    'transactions' => $transactions,
]);
