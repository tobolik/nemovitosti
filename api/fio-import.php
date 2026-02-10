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

$today = date('Y-m-d');
if ($from === '' || $to === '') {
    $from = date('Y-m-01');
    $to = $today;
}

require_once __DIR__ . '/fio-fetch.php';

try {
    $result = runFioImportForAccount($bankAccountsId, $from, $to);
} catch (RuntimeException $e) {
    jsonErr($e->getMessage());
}

jsonOk($result);
