<?php
// api/payment-imports-approve.php – hromadné schválení importů: vytvoření plateb, import zůstává v historii (approved_at)
// POST { import_ids: [1, 2, 3] } – žádné mazání
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Pouze POST.', 405);
}
verifyCsrf();
$b = json_decode((string)file_get_contents('php://input'), true) ?: [];
$ids = $b['import_ids'] ?? [];
$overrides = $b['overrides'] ?? []; // [ "id" => { contracts_id, period_year, period_month, payment_type }, ... ]
if (!is_array($ids) || count($ids) === 0) {
    jsonErr('Zadejte import_ids (pole ID importů).');
}

$approved = 0;
$created = 0;
$errors = [];

foreach ($ids as $rawId) {
    $importId = (int)$rawId;
    if ($importId <= 0) continue;
    $st = db()->prepare('SELECT * FROM payment_imports WHERE id = ? AND valid_to IS NULL AND approved_at IS NULL');
    $st->execute([$importId]);
    $imp = $st->fetch(PDO::FETCH_ASSOC);
    if (!$imp) continue;
    $ov = $overrides[(string)$importId] ?? [];
    $cid = isset($ov['contracts_id']) ? (int)$ov['contracts_id'] : (isset($imp['contracts_id']) ? (int)$imp['contracts_id'] : 0);
    $py = isset($ov['period_year']) ? (int)$ov['period_year'] : (isset($imp['period_year']) ? (int)$imp['period_year'] : 0);
    $pm = isset($ov['period_month']) ? (int)$ov['period_month'] : (isset($imp['period_month']) ? (int)$imp['period_month'] : 0);
    if ($cid <= 0 || $py <= 0 || $pm <= 0) {
        $errors[] = 'Import #' . $importId . ': vyplňte smlouvu a období (rok, měsíc).';
        continue;
    }
    $rawType = $ov['payment_type'] ?? $imp['payment_type'] ?? null;
    if ($rawType === '' || $rawType === null) {
        $errors[] = 'Import #' . $importId . ': vyberte typ platby (nájem, kauce, energie, …).';
        continue;
    }
    $paymentType = in_array($rawType, ['rent', 'deposit', 'deposit_return', 'energy', 'other']) ? $rawType : 'rent';
    $pyTo = isset($ov['period_year_to']) ? (int)$ov['period_year_to'] : (isset($imp['period_year_to']) && $imp['period_year_to'] !== '' ? (int)$imp['period_year_to'] : null);
    $pmTo = isset($ov['period_month_to']) ? (int)$ov['period_month_to'] : (isset($imp['period_month_to']) && $imp['period_month_to'] !== '' ? (int)$imp['period_month_to'] : null);
    $amount = (float)($imp['amount'] ?? 0);
    $paymentDate = $imp['payment_date'] ?? date('Y-m-d');
    $bankAccountId = (int)($imp['bank_accounts_id'] ?? 0);
    $counterpart = !empty(trim((string)($imp['counterpart_account'] ?? ''))) ? trim($imp['counterpart_account']) : null;
    $note = !empty(trim((string)($imp['note'] ?? ''))) ? trim($imp['note']) : null;

    $months = [];
    if ($pyTo !== null && $pmTo !== null && ($pyTo > $py || ($pyTo === $py && $pmTo >= $pm))) {
        for ($y = $py, $m = $pm; $y < $pyTo || ($y === $pyTo && $m <= $pmTo); $m++) {
            if ($m > 12) { $m = 1; $y++; }
            $months[] = [$y, $m];
            if ($y === $pyTo && $m === $pmTo) break;
        }
        $div = count($months);
        $amountPerMonth = $div > 0 ? round($amount / $div, 2) : $amount;
    } else {
        $months[] = [$py, $pm];
        $amountPerMonth = $amount;
    }

    $bankTransactionId = !empty(trim((string)($imp['fio_transaction_id'] ?? ''))) ? trim($imp['fio_transaction_id']) : null;
    $currency = isset($imp['currency']) && trim((string)$imp['currency']) !== ''
        ? strtoupper(substr(trim($imp['currency']), 0, 3)) : 'CZK';
    $uid = $_SESSION['uid'] ?? null;
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
        ->execute([date('Y-m-d H:i:s'), $firstPaymentEntityId, $importId]);
    $prId = isset($ov['payment_request_id']) ? (int)$ov['payment_request_id'] : (isset($imp['payment_request_id']) ? (int)$imp['payment_request_id'] : 0);
    if ($prId > 0 && $firstPaymentEntityId !== null) {
        $prRow = findActiveByEntityId('payment_requests', $prId);
        if ($prRow && (int)($prRow['contracts_id'] ?? 0) === $cid) {
            softUpdate('payment_requests', (int)$prRow['id'], ['payments_id' => $firstPaymentEntityId, 'paid_at' => $paymentDate ?: date('Y-m-d')]);
        }
    }
    $approved++;
}

jsonOk([
    'approved' => $approved,
    'created'  => $created,
    'errors'   => $errors,
]);
