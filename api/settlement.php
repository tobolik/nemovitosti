<?php
// api/settlement.php – Vyúčtování energií a vyúčtování kauce (v2)
// Nové akce pracují s tabulkou `settlements` + `settlement_items` (migrace 064).
// Staré akce (energy_settlement, deposit_settlement) ponechány pro zpětnou kompatibilitu.
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') jsonErr('Pouze POST.', 405);
verifyCsrf();

$b = json_decode((string)file_get_contents('php://input'), true) ?: [];
$action = $b['action'] ?? '';

// ═════════════════════════════════════════════════════════════════════════
// NOVÉ AKCE (v2) – settlements tabulka
// ═════════════════════════════════════════════════════════════════════════

// ─── Seznam vyúčtování pro smlouvu ──────────────────────────────────────
if ($action === 'settlements_list') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $type = in_array($b['type'] ?? '', ['energy', 'deposit']) ? $b['type'] : null;

    $where = 'contracts_id = ? AND valid_to IS NULL';
    $params = [$contractsId];
    if ($type) {
        $where .= ' AND type = ?';
        $params[] = $type;
    }

    $st = db()->prepare("SELECT * FROM settlements WHERE $where ORDER BY settled_at DESC, id DESC");
    $st->execute($params);
    $settlements = $st->fetchAll(PDO::FETCH_ASSOC);

    // Přidat items ke každému settlement
    $stItems = db()->prepare("
        SELECT si.payment_requests_id, pr.amount, pr.type AS pr_type, pr.note AS pr_note, pr.due_date, pr.paid_at, pr.period_year, pr.period_month
        FROM settlement_items si
        JOIN payment_requests pr ON pr.payment_requests_id = si.payment_requests_id AND pr.valid_to IS NULL
        WHERE si.settlements_id = ? AND si.valid_to IS NULL
    ");
    foreach ($settlements as &$s) {
        $s['entity_id'] = (int)($s['settlements_id'] ?? $s['id']);
        $stItems->execute([$s['entity_id']]);
        $s['items'] = $stItems->fetchAll(PDO::FETCH_ASSOC);
    }
    unset($s);

    jsonOk(['settlements' => $settlements]);
}

// ─── Uložit nové vyúčtování (energy i deposit) ─────────────────────────
if ($action === 'settlement_save') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');

    $type = in_array($b['type'] ?? '', ['energy', 'deposit']) ? $b['type'] : null;
    if (!$type) jsonErr('Neplatný typ vyúčtování (energy/deposit).');

    $label = trim((string)($b['label'] ?? ''));
    $actualAmount = isset($b['actual_amount']) ? (float)$b['actual_amount'] : null;
    if ($actualAmount === null) jsonErr('Zadejte skutečnou částku.');
    if ($type === 'energy' && $actualAmount < 0) jsonErr('Skutečná částka energií nemůže být záporná.');

    $requestIds = $b['request_ids'] ?? [];
    if (!is_array($requestIds) || empty($requestIds)) jsonErr('Vyberte alespoň jednu zálohu/požadavek.');
    $requestIds = array_values(array_unique(array_filter(array_map('intval', $requestIds))));

    $note = trim((string)($b['note'] ?? ''));
    $requestLabel = trim((string)($b['request_label'] ?? '')); // Název pro výsledný payment_request
    $lockAfterSave = !empty($b['lock']);

    $contract = findActiveByEntityId('contracts', $contractsId);
    if (!$contract) jsonErr('Smlouva nenalezena.');

    // ── Načíst vybrané požadavky a spočítat součet záloh ──
    $advancesSum = 0.0;
    $selectedRequests = [];
    foreach ($requestIds as $reqEntityId) {
        $pr = findActiveByEntityId('payment_requests', $reqEntityId);
        if (!$pr) jsonErr("Požadavek #$reqEntityId nenalezen.");
        if ((int)($pr['contracts_id'] ?? 0) !== $contractsId) jsonErr("Požadavek #$reqEntityId nepatří k této smlouvě.");

        // Ověřit, že požadavek není součástí jiného vyúčtování
        $stCheck = db()->prepare("SELECT si.settlements_id FROM settlement_items si JOIN settlements s ON s.settlements_id = si.settlements_id AND s.valid_to IS NULL WHERE si.payment_requests_id = ? AND si.valid_to IS NULL LIMIT 1");
        $stCheck->execute([$reqEntityId]);
        if ($stCheck->fetch()) jsonErr("Požadavek #$reqEntityId je již součástí jiného vyúčtování.");

        $selectedRequests[] = $pr;
        $advancesSum += (float)$pr['amount'];
    }
    $advancesSum = round($advancesSum, 2);

    // ── Výpočet rozdílu ──
    $settlementAmount = round($actualAmount - $advancesSum, 2);
    // energy: kladný = nedoplatek, záporný = přeplatek
    // deposit: actual_amount = kolik z kauce pokrýt (advancesSum = součet dluhů) → záporný rest = vrátit

    // ── Due date / period ──
    $contractEnd = $contract['contract_end'] ?? null;
    $dueDate = ($contractEnd !== null && $contractEnd !== '')
        ? date('Y-m-d', strtotime($contractEnd . ($type === 'deposit' ? ' +14 days' : '')))
        : date('Y-m-d', strtotime('+14 days'));
    $periodYear = (int)date('Y', strtotime($dueDate));
    $periodMonth = (int)date('n', strtotime($dueDate));

    // ── Vytvořit payment_request pro rozdíl (pokud != 0) ──
    $settlementRequestId = null;
    if (abs($settlementAmount) > 0.005) {
        if (!$requestLabel) {
            if ($type === 'energy') {
                $requestLabel = $settlementAmount > 0
                    ? 'Nedoplatek' . ($label ? ' ' . $label : ' energie')
                    : 'Přeplatek' . ($label ? ' ' . $label : ' energie');
            } else {
                $requestLabel = 'Vrácení kauce' . ($label ? ' – ' . $label : '');
            }
        }

        $prType = $type === 'deposit' ? 'deposit_return' : 'settlement';
        $prAmount = $type === 'deposit' ? -abs($settlementAmount) : $settlementAmount;

        $prNote = $requestLabel . ' (skutečnost ' . number_format($actualAmount, 0, ',', ' ')
            . ' – zálohy ' . number_format($advancesSum, 0, ',', ' ') . ')';

        $newPrId = softInsert('payment_requests', [
            'contracts_id' => $contractsId,
            'amount'       => $prAmount,
            'type'         => $prType,
            'note'         => $prNote,
            'due_date'     => $dueDate,
            'period_year'  => $periodYear,
            'period_month' => $periodMonth,
        ]);
        // softInsert vrací row id, potřebujeme entity_id
        $newPrRow = db()->query("SELECT payment_requests_id FROM payment_requests WHERE id = $newPrId")->fetch();
        $settlementRequestId = (int)($newPrRow['payment_requests_id'] ?? $newPrId);
    }

    // ── Uložit settlement záznam ──
    $settledAt = date('Y-m-d H:i:s');
    $sId = softInsert('settlements', [
        'contracts_id'          => $contractsId,
        'type'                  => $type,
        'label'                 => $label ?: null,
        'actual_amount'         => $actualAmount,
        'advances_sum'          => $advancesSum,
        'settlement_amount'     => $settlementAmount,
        'settlement_request_id' => $settlementRequestId,
        'settled_at'            => $settledAt,
        'locked_at'             => $lockAfterSave ? $settledAt : null,
        'locked_by'             => $lockAfterSave ? ($_SESSION['uid'] ?? null) : null,
        'note'                  => $note ?: null,
    ]);
    $sRow = db()->query("SELECT settlements_id FROM settlements WHERE id = $sId")->fetch();
    $settlementEntityId = (int)($sRow['settlements_id'] ?? $sId);

    // ── Uložit settlement_items ──
    foreach ($requestIds as $reqEntityId) {
        softInsert('settlement_items', [
            'settlements_id'      => $settlementEntityId,
            'payment_requests_id' => $reqEntityId,
        ]);
    }

    // ── Označit neuhrazené vybrané zálohy jako settled ──
    if ($settlementRequestId) {
        foreach ($selectedRequests as $pr) {
            if (empty($pr['paid_at']) && empty($pr['payments_id'])) {
                softUpdate('payment_requests', (int)$pr['id'], ['settled_by_request_id' => $settlementRequestId]);
            }
        }
    }

    jsonOk([
        'settlement_id'         => $settlementEntityId,
        'settlement_amount'     => $settlementAmount,
        'settlement_request_id' => $settlementRequestId,
        'advances_sum'          => $advancesSum,
        'actual_amount'         => $actualAmount,
    ]);
}

// ─── Aktualizovat existující odemčené vyúčtování ────────────────────────
if ($action === 'settlement_update') {
    $settlementId = (int)($b['settlement_id'] ?? 0);
    if ($settlementId <= 0) jsonErr('Chybí settlement_id.');

    $settlement = findActiveByEntityId('settlements', $settlementId);
    if (!$settlement) jsonErr('Vyúčtování nenalezeno.');
    if (!empty($settlement['locked_at'])) jsonErr('Vyúčtování je zamčené. Nejdříve ho odemkněte.');

    $contractsId = (int)$settlement['contracts_id'];
    $type = $settlement['type'];

    $label = isset($b['label']) ? trim((string)$b['label']) : ($settlement['label'] ?? '');
    $actualAmount = isset($b['actual_amount']) ? (float)$b['actual_amount'] : (float)$settlement['actual_amount'];
    $note = isset($b['note']) ? trim((string)$b['note']) : ($settlement['note'] ?? '');
    $requestLabel = trim((string)($b['request_label'] ?? ''));
    $lockAfterSave = !empty($b['lock']);

    $requestIds = $b['request_ids'] ?? null;
    if ($requestIds !== null) {
        if (!is_array($requestIds) || empty($requestIds)) jsonErr('Vyberte alespoň jednu zálohu/požadavek.');
        $requestIds = array_values(array_unique(array_filter(array_map('intval', $requestIds))));
    }

    $contract = findActiveByEntityId('contracts', $contractsId);
    if (!$contract) jsonErr('Smlouva nenalezena.');

    // ── Odebrat settled_by_request_id ze starých záloh ──
    $oldRequestId = $settlement['settlement_request_id'] ? (int)$settlement['settlement_request_id'] : null;
    if ($oldRequestId) {
        $stClear = db()->prepare("SELECT id FROM payment_requests WHERE settled_by_request_id = ? AND valid_to IS NULL");
        $stClear->execute([$oldRequestId]);
        foreach ($stClear->fetchAll(PDO::FETCH_ASSOC) as $row) {
            softUpdate('payment_requests', (int)$row['id'], ['settled_by_request_id' => null]);
        }
    }

    // ── Smazat staré settlement_items ──
    if ($requestIds !== null) {
        $stOldItems = db()->prepare("SELECT id FROM settlement_items WHERE settlements_id = ? AND valid_to IS NULL");
        $stOldItems->execute([$settlementId]);
        foreach ($stOldItems->fetchAll(PDO::FETCH_ASSOC) as $oldItem) {
            softDelete('settlement_items', (int)$oldItem['id']);
        }
    }

    // ── Načíst nové/stávající požadavky ──
    if ($requestIds !== null) {
        $advancesSum = 0.0;
        $selectedRequests = [];
        foreach ($requestIds as $reqEntityId) {
            $pr = findActiveByEntityId('payment_requests', $reqEntityId);
            if (!$pr) jsonErr("Požadavek #$reqEntityId nenalezen.");
            if ((int)($pr['contracts_id'] ?? 0) !== $contractsId) jsonErr("Požadavek #$reqEntityId nepatří k této smlouvě.");

            // Ověřit: není součástí JINÉHO vyúčtování
            $stCheck = db()->prepare("SELECT si.settlements_id FROM settlement_items si JOIN settlements s ON s.settlements_id = si.settlements_id AND s.valid_to IS NULL WHERE si.payment_requests_id = ? AND si.valid_to IS NULL AND si.settlements_id != ? LIMIT 1");
            $stCheck->execute([$reqEntityId, $settlementId]);
            if ($stCheck->fetch()) jsonErr("Požadavek #$reqEntityId je součástí jiného vyúčtování.");

            $selectedRequests[] = $pr;
            $advancesSum += (float)$pr['amount'];
        }
        $advancesSum = round($advancesSum, 2);
    } else {
        $advancesSum = (float)$settlement['advances_sum'];
        $selectedRequests = [];
    }

    $settlementAmount = round($actualAmount - $advancesSum, 2);

    // ── Smazat/aktualizovat starý payment_request ──
    if ($oldRequestId) {
        $oldPr = findActiveByEntityId('payment_requests', $oldRequestId);
        if ($oldPr && empty($oldPr['paid_at'])) {
            softDelete('payment_requests', (int)$oldPr['id']);
        }
    }

    // ── Vytvořit nový payment_request pro rozdíl ──
    $contractEnd = $contract['contract_end'] ?? null;
    $dueDate = ($contractEnd !== null && $contractEnd !== '')
        ? date('Y-m-d', strtotime($contractEnd . ($type === 'deposit' ? ' +14 days' : '')))
        : date('Y-m-d', strtotime('+14 days'));
    $periodYear = (int)date('Y', strtotime($dueDate));
    $periodMonth = (int)date('n', strtotime($dueDate));

    $settlementRequestId = null;
    if (abs($settlementAmount) > 0.005) {
        if (!$requestLabel) {
            if ($type === 'energy') {
                $requestLabel = $settlementAmount > 0
                    ? 'Nedoplatek' . ($label ? ' ' . $label : ' energie')
                    : 'Přeplatek' . ($label ? ' ' . $label : ' energie');
            } else {
                $requestLabel = 'Vrácení kauce' . ($label ? ' – ' . $label : '');
            }
        }

        $prType = $type === 'deposit' ? 'deposit_return' : 'settlement';
        $prAmount = $type === 'deposit' ? -abs($settlementAmount) : $settlementAmount;
        $prNote = $requestLabel . ' (skutečnost ' . number_format($actualAmount, 0, ',', ' ')
            . ' – zálohy ' . number_format($advancesSum, 0, ',', ' ') . ')';

        $newPrId = softInsert('payment_requests', [
            'contracts_id' => $contractsId,
            'amount'       => $prAmount,
            'type'         => $prType,
            'note'         => $prNote,
            'due_date'     => $dueDate,
            'period_year'  => $periodYear,
            'period_month' => $periodMonth,
        ]);
        $newPrRow = db()->query("SELECT payment_requests_id FROM payment_requests WHERE id = $newPrId")->fetch();
        $settlementRequestId = (int)($newPrRow['payment_requests_id'] ?? $newPrId);
    }

    // ── Aktualizovat settlement ──
    $now = date('Y-m-d H:i:s');
    softUpdate('settlements', (int)$settlement['id'], [
        'label'                 => $label ?: null,
        'actual_amount'         => $actualAmount,
        'advances_sum'          => $advancesSum,
        'settlement_amount'     => $settlementAmount,
        'settlement_request_id' => $settlementRequestId,
        'note'                  => $note ?: null,
        'locked_at'             => $lockAfterSave ? $now : null,
        'locked_by'             => $lockAfterSave ? ($_SESSION['uid'] ?? null) : null,
    ]);

    // ── Vložit nové settlement_items ──
    if ($requestIds !== null) {
        foreach ($requestIds as $reqEntityId) {
            softInsert('settlement_items', [
                'settlements_id'      => $settlementId,
                'payment_requests_id' => $reqEntityId,
            ]);
        }
    }

    // ── Označit neuhrazené zálohy jako settled ──
    if ($settlementRequestId && !empty($selectedRequests)) {
        foreach ($selectedRequests as $pr) {
            if (empty($pr['paid_at']) && empty($pr['payments_id'])) {
                softUpdate('payment_requests', (int)$pr['id'], ['settled_by_request_id' => $settlementRequestId]);
            }
        }
    }

    jsonOk([
        'settlement_id'         => $settlementId,
        'settlement_amount'     => $settlementAmount,
        'settlement_request_id' => $settlementRequestId,
        'advances_sum'          => $advancesSum,
        'actual_amount'         => $actualAmount,
    ]);
}

// ─── Zamknout vyúčtování ────────────────────────────────────────────────
if ($action === 'settlement_lock') {
    $settlementId = (int)($b['settlement_id'] ?? 0);
    if ($settlementId <= 0) jsonErr('Chybí settlement_id.');

    $settlement = findActiveByEntityId('settlements', $settlementId);
    if (!$settlement) jsonErr('Vyúčtování nenalezeno.');
    if (!empty($settlement['locked_at'])) jsonErr('Vyúčtování je již zamčené.');

    softUpdate('settlements', (int)$settlement['id'], [
        'locked_at' => date('Y-m-d H:i:s'),
        'locked_by' => $_SESSION['uid'] ?? null,
    ]);

    jsonOk(['locked' => true]);
}

// ─── Odemknout vyúčtování ───────────────────────────────────────────────
if ($action === 'settlement_unlock') {
    $settlementId = (int)($b['settlement_id'] ?? 0);
    if ($settlementId <= 0) jsonErr('Chybí settlement_id.');

    $settlement = findActiveByEntityId('settlements', $settlementId);
    if (!$settlement) jsonErr('Vyúčtování nenalezeno.');
    if (empty($settlement['locked_at'])) jsonErr('Vyúčtování není zamčené.');

    softUpdate('settlements', (int)$settlement['id'], [
        'locked_at' => null,
        'locked_by' => null,
    ]);

    jsonOk(['locked' => false]);
}

// ─── Smazat vyúčtování (soft-delete, pouze odemčené) ────────────────────
if ($action === 'settlement_delete') {
    $settlementId = (int)($b['settlement_id'] ?? 0);
    if ($settlementId <= 0) jsonErr('Chybí settlement_id.');

    $settlement = findActiveByEntityId('settlements', $settlementId);
    if (!$settlement) jsonErr('Vyúčtování nenalezeno.');
    if (!empty($settlement['locked_at'])) jsonErr('Vyúčtování je zamčené – nejdříve ho odemkněte.');

    // ── Odebrat settled_by_request_id ze záloh ──
    $reqId = $settlement['settlement_request_id'] ? (int)$settlement['settlement_request_id'] : null;
    if ($reqId) {
        $stClear = db()->prepare("SELECT id FROM payment_requests WHERE settled_by_request_id = ? AND valid_to IS NULL");
        $stClear->execute([$reqId]);
        foreach ($stClear->fetchAll(PDO::FETCH_ASSOC) as $row) {
            softUpdate('payment_requests', (int)$row['id'], ['settled_by_request_id' => null]);
        }

        // Smazat payment_request (jen pokud nebyl uhrazen)
        $pr = findActiveByEntityId('payment_requests', $reqId);
        if ($pr && empty($pr['paid_at'])) {
            softDelete('payment_requests', (int)$pr['id']);
        }
    }

    // ── Smazat settlement_items ──
    $stItems = db()->prepare("SELECT id FROM settlement_items WHERE settlements_id = ? AND valid_to IS NULL");
    $stItems->execute([$settlementId]);
    foreach ($stItems->fetchAll(PDO::FETCH_ASSOC) as $item) {
        softDelete('settlement_items', (int)$item['id']);
    }

    // ── Smazat settlement ──
    softDelete('settlements', (int)$settlement['id']);

    jsonOk(['deleted' => true]);
}


// ═════════════════════════════════════════════════════════════════════════
// STARŠÍ AKCE (deprecated – ponechány pro zpětnou kompatibilitu)
// ═════════════════════════════════════════════════════════════════════════

// ─── Vyúčtování energií (starý formát) ──────────────────────────────────
if ($action === 'energy_settlement') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $actualAmount = isset($b['actual_amount']) ? (float)$b['actual_amount'] : null;
    if ($actualAmount === null || $actualAmount < 0) jsonErr('Zadejte skutečnou částku energií (>= 0).');

    $st = db()->prepare("SELECT id, payment_requests_id, amount, paid_at, payments_id, note FROM payment_requests WHERE contracts_id = ? AND type = 'energy' AND valid_to IS NULL ORDER BY id ASC");
    $st->execute([$contractsId]);
    $energyRequests = $st->fetchAll(PDO::FETCH_ASSOC);

    $paidSum = 0.0;
    foreach ($energyRequests as $er) {
        if (!empty($er['paid_at'])) {
            $paidSum += (float)$er['amount'];
        }
    }

    $settlementAmount = round($actualAmount - $paidSum, 2);
    $settlementId = null;
    if (abs($settlementAmount) > 0.005) {
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
        $newPrRow = db()->query("SELECT payment_requests_id FROM payment_requests WHERE id = $newId")->fetch();
        $settlementRequestEntityId = (int)($newPrRow['payment_requests_id'] ?? $newId);
        $settlementId = $settlementRequestEntityId;

        $stEnergy = db()->prepare("SELECT id FROM payment_requests WHERE contracts_id = ? AND type = 'energy' AND paid_at IS NULL AND payments_id IS NULL AND valid_to IS NULL");
        $stEnergy->execute([$contractsId]);
        foreach ($stEnergy->fetchAll(PDO::FETCH_ASSOC) as $row) {
            softUpdate('payment_requests', (int)$row['id'], ['settled_by_request_id' => $settlementRequestEntityId]);
        }
    }

    jsonOk([
        'paid_advances'     => round($paidSum, 2),
        'unpaid_closed'     => 0,
        'settlement_amount' => $settlementAmount,
        'settlement_id'     => $settlementId,
    ]);
}

// ─── Zúčtování kauce (starý formát) ────────────────────────────────────
if ($action === 'deposit_settlement') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $requestIds = $b['request_ids'] ?? [];
    if (!is_array($requestIds)) jsonErr('request_ids musí být pole.');

    $contract = findActiveByEntityId('contracts', $contractsId);
    if (!$contract) jsonErr('Smlouva nenalezena.');
    $depositAmount = (float)($contract['deposit_amount'] ?? 0);
    if ($depositAmount <= 0) jsonErr('Smlouva nemá kauci.');

    $st = db()->prepare("SELECT id, payments_id FROM payments WHERE contracts_id = ? AND payment_type = 'deposit' AND amount > 0 AND valid_to IS NULL ORDER BY id ASC LIMIT 1");
    $st->execute([$contractsId]);
    $depositPayment = $st->fetch(PDO::FETCH_ASSOC);
    if (!$depositPayment) jsonErr('Platba kauce nenalezena.');
    $depositPaymentEntityId = (int)($depositPayment['payments_id'] ?? $depositPayment['id']);

    $paidAt = date('Y-m-d');
    $coveredSum = 0.0;

    foreach ($requestIds as $reqId) {
        $reqId = (int)$reqId;
        if ($reqId <= 0) continue;
        $pr = findActiveByEntityId('payment_requests', $reqId);
        if (!$pr) continue;
        if ((int)($pr['contracts_id'] ?? 0) !== $contractsId) continue;
        if (!empty($pr['payments_id'])) continue;

        softUpdate('payment_requests', (int)$pr['id'], [
            'payments_id' => $depositPaymentEntityId,
            'paid_at'     => $paidAt,
        ]);
        $coveredSum += abs((float)$pr['amount']);
    }

    $toReturn = round($depositAmount - $coveredSum, 2);
    if ($toReturn < 0) $toReturn = 0;

    $contractEnd = $contract['contract_end'] ?? null;
    $returnDueDate = ($contractEnd !== null && $contractEnd !== '') ? date('Y-m-d', strtotime($contractEnd . ' +14 days')) : date('Y-m-d', strtotime('+14 days'));
    $returnPeriodYear = (int)date('Y', strtotime($returnDueDate));
    $returnPeriodMonth = (int)date('n', strtotime($returnDueDate));

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

    // Zálohy na energie
    $st = db()->prepare("
        SELECT pr.id, pr.payment_requests_id, pr.amount, pr.paid_at, pr.payments_id, pr.note, pr.due_date,
               pr.period_year, pr.period_month, pr.settled_by_request_id
        FROM payment_requests pr
        WHERE pr.contracts_id = ? AND pr.type = 'energy' AND pr.valid_to IS NULL
        ORDER BY pr.due_date ASC, pr.id ASC
    ");
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
        // Přidat info zda je součástí existujícího vyúčtování
        $stSi = db()->prepare("SELECT si.settlements_id FROM settlement_items si JOIN settlements s ON s.settlements_id = si.settlements_id AND s.valid_to IS NULL WHERE si.payment_requests_id = ? AND si.valid_to IS NULL LIMIT 1");
        $stSi->execute([$it['entity_id']]);
        $siRow = $stSi->fetch();
        $it['in_settlement'] = $siRow ? (int)$siRow['settlements_id'] : null;
    }
    unset($it);

    // Existující vyúčtování
    $stSet = db()->prepare("SELECT settlements_id, label, actual_amount, advances_sum, settlement_amount, settled_at, locked_at FROM settlements WHERE contracts_id = ? AND type = 'energy' AND valid_to IS NULL ORDER BY settled_at DESC");
    $stSet->execute([$contractsId]);
    $settlements = $stSet->fetchAll(PDO::FETCH_ASSOC);
    foreach ($settlements as &$s) {
        $s['entity_id'] = (int)($s['settlements_id'] ?? 0);
    }
    unset($s);

    jsonOk([
        'items'       => $items,
        'paid_sum'    => round($paidSum, 2),
        'unpaid_sum'  => round($unpaidSum, 2),
        'total'       => round($paidSum + $unpaidSum, 2),
        'settlements' => $settlements,
    ]);
}

// ─── Info: neuhrazené požadavky pro vyúčtování kauce ────────────────────
if ($action === 'deposit_info') {
    $contractsId = (int)($b['contracts_id'] ?? 0);
    if ($contractsId <= 0) jsonErr('Chybí contracts_id.');
    $contract = findActiveByEntityId('contracts', $contractsId);
    if (!$contract) jsonErr('Smlouva nenalezena.');
    $depositAmount = (float)($contract['deposit_amount'] ?? 0);

    $st = db()->prepare("
        SELECT pr.id, pr.payment_requests_id, pr.amount, pr.type, pr.note, pr.due_date, pr.period_year, pr.period_month
        FROM payment_requests pr
        WHERE pr.contracts_id = ? AND pr.valid_to IS NULL AND pr.paid_at IS NULL AND pr.type != 'deposit'
        ORDER BY pr.due_date ASC, pr.id ASC
    ");
    $st->execute([$contractsId]);
    $items = $st->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as &$it) {
        $it['entity_id'] = (int)($it['payment_requests_id'] ?? $it['id']);
        // Přidat info zda je součástí existujícího vyúčtování
        $stSi = db()->prepare("SELECT si.settlements_id FROM settlement_items si JOIN settlements s ON s.settlements_id = si.settlements_id AND s.valid_to IS NULL WHERE si.payment_requests_id = ? AND si.valid_to IS NULL LIMIT 1");
        $stSi->execute([$it['entity_id']]);
        $siRow = $stSi->fetch();
        $it['in_settlement'] = $siRow ? (int)$siRow['settlements_id'] : null;
    }
    unset($it);

    // Existující vyúčtování kauce
    $stSet = db()->prepare("SELECT settlements_id, label, actual_amount, advances_sum, settlement_amount, settled_at, locked_at FROM settlements WHERE contracts_id = ? AND type = 'deposit' AND valid_to IS NULL ORDER BY settled_at DESC");
    $stSet->execute([$contractsId]);
    $settlements = $stSet->fetchAll(PDO::FETCH_ASSOC);
    foreach ($settlements as &$s) {
        $s['entity_id'] = (int)($s['settlements_id'] ?? 0);
    }
    unset($s);

    jsonOk([
        'deposit_amount'    => $depositAmount,
        'unpaid_requests'   => $items,
        'settlements'       => $settlements,
    ]);
}

jsonErr('Neznámá akce: ' . $action);
