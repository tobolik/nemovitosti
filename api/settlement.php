<?php
// api/settlement.php – Vyúčtování energií a zúčtování kauce
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonErr('Pouze POST.', 405);
verifyCsrf();

$b = json_decode((string)file_get_contents('php://input'), true) ?: [];
$action = $b['action'] ?? '';

// ─── Vyúčtování energií ─────────────────────────────────────────────────
if ($action === 'energy_settlement') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $actualAmount = isset($b['actual_amount']) ? (float)$b['actual_amount'] : null;
    if ($actualAmount === null || $actualAmount < 0) jsonErr('Zadejte skutečnou částku energií (>= 0).');

    // Načíst všechny energy advance požadavky pro tuto smlouvu
    $st = db()->prepare("SELECT id, payment_requests_id, amount, paid_at, payments_id, note FROM payment_requests WHERE contracts_id = ? AND type = 'energy' AND valid_to IS NULL ORDER BY id ASC");
    $st->execute([$contractsId]);
    $energyRequests = $st->fetchAll(PDO::FETCH_ASSOC);

    $paidSum = 0.0;
    foreach ($energyRequests as $er) {
        if (!empty($er['paid_at'])) {
            $paidSum += (float)$er['amount'];
        }
    }

    // Nezaplacené zálohy (energy) nemažeme – zůstávají v historii; vyúčtování jen přidá požadavek nedoplatek/přeplatek.

    // Nedoplatek / přeplatek
    $settlementAmount = round($actualAmount - $paidSum, 2);
    // settlementAmount > 0 = nájemce dluží (nedoplatek)
    // settlementAmount < 0 = přeplatek (nájemci vrátit)
    // settlementAmount == 0 = vyrovnáno

    $settlementId = null;
    if (abs($settlementAmount) > 0.005) {
        // Fetch contract to get contract_end for due_date/period
        $contract = findActiveByEntityId('contracts', $contractsId);
        $contractEnd = $contract['contract_end'] ?? null;
        $settlementDueDate = ($contractEnd !== null && $contractEnd !== '') ? date('Y-m-d', strtotime($contractEnd)) : date('Y-m-d', strtotime('+14 days'));
        $settlementPeriodYear = ($contractEnd !== null && $contractEnd !== '') ? (int)date('Y', strtotime($contractEnd)) : null;
        $settlementPeriodMonth = ($contractEnd !== null && $contractEnd !== '') ? (int)date('n', strtotime($contractEnd)) : null;

        $newId = softInsert('payment_requests', [
            'contracts_id' => $contractsId,
            'amount'       => $settlementAmount,
            'type'         => 'settlement',
            'note'         => $settlementAmount > 0
                ? 'Vyúčtování energií: nedoplatek (skutečnost ' . number_format($actualAmount, 0, ',', ' ') . ' – zálohy ' . number_format($paidSum, 0, ',', ' ') . ')'
                : 'Vyúčtování energií: přeplatek (zálohy ' . number_format($paidSum, 0, ',', ' ') . ' – skutečnost ' . number_format($actualAmount, 0, ',', ' ') . ')',
            'due_date'     => $settlementDueDate,
            'period_year'  => $settlementPeriodYear,
            'period_month' => $settlementPeriodMonth,
        ]);
        $settlementId = $newId;
    }

    jsonOk([
        'paid_advances'     => round($paidSum, 2),
        'unpaid_closed'     => 0,
        'settlement_amount' => $settlementAmount,
        'settlement_id'     => $settlementId,
    ]);
}

// ─── Zúčtování kauce ────────────────────────────────────────────────────
if ($action === 'deposit_settlement') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $requestIds = $b['request_ids'] ?? [];
    if (!is_array($requestIds)) jsonErr('request_ids musí být pole.');

    // Načíst smlouvu – deposit_amount
    $contract = findActiveByEntityId('contracts', $contractsId);
    if (!$contract) jsonErr('Smlouva nenalezena.');
    $depositAmount = (float)($contract['deposit_amount'] ?? 0);
    if ($depositAmount <= 0) jsonErr('Smlouva nemá kauci.');

    // Najít platbu kauce (deposit payment, kladná)
    $st = db()->prepare("SELECT id, payments_id, payment_date FROM payments WHERE contracts_id = ? AND payment_type = 'deposit' AND amount > 0 AND valid_to IS NULL ORDER BY id ASC LIMIT 1");
    $st->execute([$contractsId]);
    $depositPayment = $st->fetch(PDO::FETCH_ASSOC);
    if (!$depositPayment) jsonErr('Platba kauce nenalezena.');
    $depositPaymentEntityId = (int)($depositPayment['payments_id'] ?? $depositPayment['id']);

    // paid_at = datum úhrady kauce (payment_date platby), ne dnešek. REVERT: při problémech vrátit na $paidAt = date('Y-m-d');
    $paidAt = (!empty($depositPayment['payment_date'])) ? date('Y-m-d', strtotime($depositPayment['payment_date'])) : date('Y-m-d');
    $coveredSum = 0.0;

    // Propojit vybrané požadavky s platbou kauce (záznamy se nemažou, jen přiřadí k platbě kauce)
    foreach ($requestIds as $reqId) {
        $reqId = (int)$reqId;
        if ($reqId <= 0) continue;
        $pr = findActiveByEntityId('payment_requests', $reqId);
        if (!$pr) continue;
        if ((int)($pr['contracts_id'] ?? 0) !== $contractsId) continue;
        if (!empty($pr['payments_id'])) continue; // už propojený

        softUpdate('payment_requests', (int)$pr['id'], [
            'payments_id' => $depositPaymentEntityId,
            'paid_at'     => $paidAt,
        ]);
        $coveredSum += abs((float)$pr['amount']);
    }

    $toReturn = round($depositAmount - $coveredSum, 2);
    if ($toReturn < 0) $toReturn = 0;

    // Compute due_date and period from contract_end
    $contractEnd = $contract['contract_end'] ?? null;
    $returnDueDate = ($contractEnd !== null && $contractEnd !== '') ? date('Y-m-d', strtotime($contractEnd . ' +14 days')) : date('Y-m-d', strtotime('+14 days'));
    $returnPeriodYear = ($contractEnd !== null && $contractEnd !== '') ? (int)date('Y', strtotime($contractEnd)) : null;
    $returnPeriodMonth = ($contractEnd !== null && $contractEnd !== '') ? (int)date('n', strtotime($contractEnd)) : null;

    // Build detailed note with covered request breakdown
    $coveredDetails = [];
    $reqTypeLabels = ['rent' => 'Nájem', 'energy' => 'Energie', 'settlement' => 'Vyúčtování', 'deposit' => 'Kauce', 'deposit_return' => 'Vrácení kauce', 'other' => 'Jiné'];
    foreach ($requestIds as $reqId) {
        $reqId = (int)$reqId;
        if ($reqId <= 0) continue;
        $prDetail = findActiveByEntityId('payment_requests', $reqId);
        if (!$prDetail) continue;
        if ((int)($prDetail['contracts_id'] ?? 0) !== $contractsId) continue;
        $typeLabel = $reqTypeLabels[$prDetail['type'] ?? ''] ?? ($prDetail['type'] ?? '?');
        $periodPart = '';
        if (!empty($prDetail['period_month']) && !empty($prDetail['period_year'])) {
            $periodPart = ' ' . (int)$prDetail['period_month'] . '/' . (int)$prDetail['period_year'];
        }
        $coveredDetails[] = $typeLabel . $periodPart . ' ' . number_format(abs((float)$prDetail['amount']), 0, ',', ' ');
    }
    $detailStr = $coveredDetails ? ': ' . implode(', ', $coveredDetails) : '';
    $returnNote = 'Vrácení kauce (po zúčtování: ' . number_format($depositAmount, 0, ',', ' ') . ' – pokryto ' . number_format($coveredSum, 0, ',', ' ') . $detailStr . ')';

    // Aktualizovat nebo vytvořit deposit_return požadavek
    $st2 = db()->prepare("SELECT id, amount FROM payment_requests WHERE contracts_id = ? AND type = 'deposit_return' AND valid_to IS NULL LIMIT 1");
    $st2->execute([$contractsId]);
    $existingReturn = $st2->fetch(PDO::FETCH_ASSOC);

    if ($toReturn > 0) {
        if ($existingReturn) {
            if (abs((float)$existingReturn['amount'] - (-$toReturn)) > 0.005) {
                softUpdate('payment_requests', (int)$existingReturn['id'], [
                    'amount'       => -$toReturn,
                    'note'         => $returnNote,
                    'due_date'     => $returnDueDate,
                    'period_year'  => $returnPeriodYear,
                    'period_month' => $returnPeriodMonth,
                ]);
            }
        } else {
            softInsert('payment_requests', [
                'contracts_id' => $contractsId,
                'amount'       => -$toReturn,
                'type'         => 'deposit_return',
                'note'         => $returnNote,
                'due_date'     => $returnDueDate,
                'period_year'  => $returnPeriodYear,
                'period_month' => $returnPeriodMonth,
            ]);
        }
    } elseif ($existingReturn && empty($existingReturn['payments_id'])) {
        // Celá kauce spotřebována → smazat neuhrazený deposit_return
        softDelete('payment_requests', (int)$existingReturn['id']);
    }

    jsonOk([
        'deposit_amount' => $depositAmount,
        'covered'        => round($coveredSum, 2),
        'to_return'      => $toReturn,
    ]);
}

// ─── Info: energie pro smlouvu ──────────────────────────────────────────
if ($action === 'energy_info') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $st = db()->prepare("SELECT id, payment_requests_id, amount, paid_at, payments_id, note, due_date, period_year, period_month FROM payment_requests WHERE contracts_id = ? AND type = 'energy' AND valid_to IS NULL ORDER BY due_date ASC, id ASC");
    $st->execute([$contractsId]);
    $items = $st->fetchAll(PDO::FETCH_ASSOC);
    $paidSum = 0;
    $unpaidSum = 0;
    foreach ($items as &$it) {
        $amt = (float)$it['amount'];
        if (!empty($it['paid_at'])) {
            $paidSum += $amt;
        } else {
            $unpaidSum += $amt;
        }
        $it['entity_id'] = (int)($it['payment_requests_id'] ?? $it['id']);
    }
    unset($it);

    $settlementRequest = null;
    $stSettlement = db()->prepare("SELECT id, payment_requests_id, amount, note, due_date, period_year, period_month FROM payment_requests WHERE contracts_id = ? AND type = 'settlement' AND valid_to IS NULL LIMIT 1");
    $stSettlement->execute([$contractsId]);
    $row = $stSettlement->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $row['entity_id'] = (int)($row['payment_requests_id'] ?? $row['id']);
        $settlementRequest = $row;
    }

    jsonOk([
        'items' => $items,
        'paid_sum' => round($paidSum, 2),
        'unpaid_sum' => round($unpaidSum, 2),
        'total' => round($paidSum + $unpaidSum, 2),
        'settlement_request' => $settlementRequest,
    ]);
}

// ─── Info: neuhrazené požadavky pro vyúčtování kauce ────────────────────
if ($action === 'deposit_info') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $contract = findActiveByEntityId('contracts', $contractsId);
    if (!$contract) jsonErr('Smlouva nenalezena.');
    $depositAmount = (float)($contract['deposit_amount'] ?? 0);

    $st = db()->prepare("SELECT id, payment_requests_id, amount, type, note, due_date, period_year, period_month FROM payment_requests WHERE contracts_id = ? AND valid_to IS NULL AND paid_at IS NULL AND type != 'deposit' ORDER BY due_date ASC, id ASC");
    $st->execute([$contractsId]);
    $items = $st->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$it) {
        $it['entity_id'] = (int)($it['payment_requests_id'] ?? $it['id']);
    }
    unset($it);

    $coveredRequests = [];
    $stPay = db()->prepare("SELECT id, payments_id FROM payments WHERE contracts_id = ? AND payment_type = 'deposit' AND amount > 0 AND valid_to IS NULL ORDER BY id ASC LIMIT 1");
    $stPay->execute([$contractsId]);
    $depositPayment = $stPay->fetch(PDO::FETCH_ASSOC);
    if ($depositPayment) {
        $depositPaymentEntityId = (int)($depositPayment['payments_id'] ?? $depositPayment['id']);
        $stCovered = db()->prepare("SELECT id, payment_requests_id, amount, type, note, due_date, period_year, period_month FROM payment_requests WHERE contracts_id = ? AND payments_id = ? AND valid_to IS NULL ORDER BY due_date ASC, id ASC");
        $stCovered->execute([$contractsId, $depositPaymentEntityId]);
        $coveredRequests = $stCovered->fetchAll(PDO::FETCH_ASSOC);
        foreach ($coveredRequests as &$cr) {
            $cr['entity_id'] = (int)($cr['payment_requests_id'] ?? $cr['id']);
        }
        unset($cr);
    }

    jsonOk(['deposit_amount' => $depositAmount, 'unpaid_requests' => $items, 'covered_requests' => $coveredRequests]);
}

jsonErr('Neznámá akce: ' . $action);
