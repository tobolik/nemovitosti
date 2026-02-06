<?php
// api/payment-imports-approve.php – hromadné schválení importů: vytvoření plateb a smazání importů
// POST { import_ids: [1, 2, 3] }
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Pouze POST.', 405);
}
verifyCsrf();
$b = json_decode((string)file_get_contents('php://input'), true) ?: [];
$ids = $b['import_ids'] ?? [];
if (!is_array($ids) || count($ids) === 0) {
    jsonErr('Zadejte import_ids (pole ID importů).');
}

$approved = 0;
$created = 0;
$errors = [];

foreach ($ids as $rawId) {
    $importId = (int)$rawId;
    if ($importId <= 0) continue;
    $row = db()->prepare('SELECT * FROM payment_imports WHERE id = ?');
    $row->execute([$importId]);
    $imp = $row->fetch(PDO::FETCH_ASSOC);
    if (!$imp) continue;
    $cid = isset($imp['contracts_id']) ? (int)$imp['contracts_id'] : 0;
    $py = isset($imp['period_year']) ? (int)$imp['period_year'] : 0;
    $pm = isset($imp['period_month']) ? (int)$imp['period_month'] : 0;
    if ($cid <= 0 || $py <= 0 || $pm <= 0) {
        $errors[] = 'Import #' . $importId . ': vyplňte smlouvu a období (rok, měsíc).';
        continue;
    }
    $pyTo = isset($imp['period_year_to']) && $imp['period_year_to'] !== '' ? (int)$imp['period_year_to'] : null;
    $pmTo = isset($imp['period_month_to']) && $imp['period_month_to'] !== '' ? (int)$imp['period_month_to'] : null;
    $amount = (float)($imp['amount'] ?? 0);
    $paymentDate = $imp['payment_date'] ?? date('Y-m-d');
    $bankAccountId = (int)($imp['bank_accounts_id'] ?? 0);
    $counterpart = !empty(trim((string)($imp['counterpart_account'] ?? ''))) ? trim($imp['counterpart_account']) : null;
    $note = !empty(trim((string)($imp['note'] ?? ''))) ? trim($imp['note']) : null;
    $paymentType = in_array($imp['payment_type'] ?? 'rent', ['rent', 'deposit', 'deposit_return', 'energy', 'other']) ? $imp['payment_type'] : 'rent';

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

    $uid = $_SESSION['uid'] ?? null;
    foreach ($months as [$y, $m]) {
        $payData = [
            'contracts_id'      => $cid,
            'period_year'       => $y,
            'period_month'      => $m,
            'amount'            => $amountPerMonth,
            'payment_date'      => $paymentDate,
            'payment_method'    => 'account',
            'bank_accounts_id'  => $bankAccountId > 0 ? $bankAccountId : null,
            'counterpart_account' => $counterpart,
            'note'              => $note,
            'payment_type'      => $paymentType,
            'approved_at'       => date('Y-m-d H:i:s'),
            'valid_from'        => date('Y-m-d H:i:s'),
            'valid_to'          => null,
            'valid_user_from'   => $uid,
            'valid_user_to'     => null,
        ];
        db()->prepare("
            INSERT INTO payments (contracts_id, period_year, period_month, amount, payment_date, payment_method, bank_accounts_id, counterpart_account, note, payment_type, approved_at, valid_from, valid_to, valid_user_from, valid_user_to)
            VALUES (?, ?, ?, ?, ?, 'account', ?, ?, ?, ?, ?, ?, NULL, ?, NULL)
        ")->execute([
            $cid, $y, $m, $amountPerMonth, $paymentDate,
            $bankAccountId > 0 ? $bankAccountId : null, $counterpart, $note, $paymentType, $payData['approved_at'], $payData['valid_from'], $uid,
        ]);
        $newId = (int)db()->lastInsertId();
        db()->prepare('UPDATE payments SET payments_id = ? WHERE id = ? AND payments_id IS NULL')->execute([$newId, $newId]);
        $created++;
    }
    db()->prepare('DELETE FROM payment_imports WHERE id = ?')->execute([$importId]);
    $approved++;
}

jsonOk([
    'approved' => $approved,
    'created'  => $created,
    'errors'   => $errors,
]);
