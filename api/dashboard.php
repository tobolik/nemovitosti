<?php
// api/dashboard.php – GET → platební morálka + heatmap data
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonErr('Metoda nepodporovaná.', 405);

$nowY = (int)date('Y');
$nowM = (int)date('n');
$year = isset($_GET['year']) ? (int)$_GET['year'] : $nowY;

// Properties
$properties = db()->query("SELECT * FROM properties WHERE valid_to IS NULL ORDER BY name ASC")->fetchAll();

// Contracts with payments
// properties_id, tenants_id = odkazy na entity_id (vždy jen entity_id)
$contracts = db()->query("
    SELECT c.*, p.id AS property_row_id, p.name AS property_name, t.id AS tenant_row_id, t.name AS tenant_name
    FROM contracts c
    JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
    JOIN tenants   t ON t.tenants_id = c.tenants_id   AND t.valid_to IS NULL
    WHERE c.valid_to IS NULL
    ORDER BY t.name ASC
")->fetchAll();

// Změny nájemného (contract_rent_changes) – seskupeno podle contracts_id, řazeno podle effective_from
$rentChangesRaw = db()->query("SELECT * FROM contract_rent_changes WHERE valid_to IS NULL ORDER BY contracts_id, effective_from ASC")->fetchAll();
$rentChangesByContract = [];
foreach ($rentChangesRaw as $rc) {
    $cid = (int)$rc['contracts_id'];
    if (!isset($rentChangesByContract[$cid])) $rentChangesByContract[$cid] = [];
    $rentChangesByContract[$cid][] = $rc;
}

// Payments per contract – platby odkazují na contracts_id (entity_id smlouvy)
// paidRent: jen platby typu rent (pro očekávaný nájem, neuhrazené měsíce)
// paidTotal: všechny platby (pro součet v sekci Nájemník)
$paymentsByContract = [];
$s = db()->prepare("
    SELECT p.period_year, p.period_month, p.amount, p.payment_date, p.payment_type
    FROM payments p
    JOIN contracts c ON c.contracts_id = p.contracts_id AND c.valid_to IS NULL
    WHERE p.valid_to IS NULL AND p.contracts_id = ?
");
foreach ($contracts as $c) {
    $entityId = $c['contracts_id'] ?? $c['id'];
    $s->execute([$entityId]);
    $paymentsByContract[$entityId] = [];
    foreach ($s->fetchAll() as $row) {
        $key = $row['period_year'] . '-' . str_pad((string)$row['period_month'], 2, '0', STR_PAD_LEFT);
        if (!isset($paymentsByContract[$entityId][$key])) {
            $paymentsByContract[$entityId][$key] = ['amount' => 0, 'amount_rent' => 0, 'payment_date' => null, 'payment_count' => 0];
        }
        $amt = (float)($row['amount'] ?? 0);
        $paymentsByContract[$entityId][$key]['amount'] += $amt;
        if (($row['payment_type'] ?? 'rent') === 'rent') {
            $paymentsByContract[$entityId][$key]['amount_rent'] += $amt;
        }
        $paymentsByContract[$entityId][$key]['payment_count'] += 1;
        if (empty($paymentsByContract[$entityId][$key]['payment_date']) && !empty($row['payment_date'])) {
            $paymentsByContract[$entityId][$key]['payment_date'] = $row['payment_date'];
        }
    }
}

// Contract overview (pro tabulku)
$out = [];
$totalInvestment = 0;
foreach ($properties as $p) {
    if (!empty($p['purchase_price'])) $totalInvestment += (float)$p['purchase_price'];
}

$yearIncome = 0;
$expectedYearIncome = 0;

foreach ($contracts as $c) {
    $entityId = $c['contracts_id'] ?? $c['id'];
    $sY   = (int)date('Y', strtotime($c['contract_start']));
    $sM   = (int)date('n', strtotime($c['contract_start']));
    $baseRent = (float)$c['monthly_rent'];
    $endY = !empty($c['contract_end']) ? (int)date('Y', strtotime($c['contract_end'])) : null;
    $endM = !empty($c['contract_end']) ? (int)date('n', strtotime($c['contract_end'])) : null;

    $paid = $paymentsByContract[$entityId] ?? [];
    $totPaid = 0;
    foreach ($paid as $prow) $totPaid += (float)($prow['amount'] ?? 0);
    $totPaidRent = 0;
    foreach ($paid as $prow) $totPaidRent += (float)($prow['amount_rent'] ?? $prow['amount'] ?? 0);
    $expTotal = 0;
    $expected = 0;
    for ($y=$sY, $m=$sM; $y<$nowY || ($y===$nowY && $m<=$nowM); ) {
        if ($endY !== null && ($y > $endY || ($y === $endY && $m > $endM))) break;
        $rent = getRentForMonth($baseRent, $entityId, $y, $m, $rentChangesByContract);
        $expTotal += $rent;
        $expected++;
        if (++$m > 12) { $m=1; $y++; }
    }

    $unpaid = [];
    for ($y=$sY, $m=$sM; $y<$nowY || ($y===$nowY && $m<=$nowM); ) {
        if ($endY !== null && ($y > $endY || ($y === $endY && $m > $endM))) break;
        $key = $y . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $rent = getRentForMonth($baseRent, $entityId, $y, $m, $rentChangesByContract);
        $paidAmt = isset($paid[$key]) ? (float)($paid[$key]['amount_rent'] ?? $paid[$key]['amount'] ?? 0) : 0;
        if ($paidAmt < $rent) $unpaid[] = ['year'=>$y,'month'=>$m,'rent'=>$rent];
        if (++$m > 12) { $m=1; $y++; }
    }

    // Roční příjmy pro stats
    for ($m = 1; $m <= 12; $m++) {
        $key = $year . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $firstOfMonth = $key . '-01';
        if ($c['contract_start'] <= $firstOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
            $rent = getRentForMonth($baseRent, $entityId, $year, $m, $rentChangesByContract);
            $expectedYearIncome += $rent;
            if (isset($paid[$key]) && !empty($paid[$key]['payment_date'])) {
                $yearIncome += (float)($paid[$key]['amount_rent'] ?? $paid[$key]['amount'] ?? $rent);
            }
        }
    }

    $balance = $expTotal - $totPaidRent;
    $statusType = $balance > 0 ? 'debt' : ($balance < 0 ? 'overpaid' : 'exact');
    $currentRent = getRentForMonth($baseRent, $entityId, $nowY, $nowM, $rentChangesByContract);
    $depositAmt = (float)($c['deposit_amount'] ?? 0);
    $depositReturned = !empty($c['deposit_return_date']);
    $contractEnded = !empty($c['contract_end']) && $c['contract_end'] <= date('Y-m-d');
    $depositToReturn = $depositAmt > 0 && !$depositReturned && $contractEnded;
    $out[] = [
        'id'             => $c['id'],
        'contracts_id'   => $entityId,
        'properties_id'  => $c['properties_id'],
        'tenants_id'     => $c['tenants_id'],
        'property_row_id'=> $c['property_row_id'] ?? null,
        'tenant_row_id'  => $c['tenant_row_id'] ?? null,
        'property_name'  => $c['property_name'],
        'tenant_name'    => $c['tenant_name'],
        'monthly_rent'   => $currentRent,
        'contract_start' => $c['contract_start'],
        'contract_end'   => $c['contract_end'],
        'expected_months'=> $expected,
        'expected_total' => $expTotal,
        'total_paid'     => $totPaid,
        'balance'        => $balance,
        'status_type'    => $statusType,
        'unpaid_months'  => $unpaid,
        'deposit_amount' => $depositAmt,
        'deposit_to_return' => $depositToReturn,
    ];
}

// Heatmap: pro každou nemovitost, pro každý měsíc roku
$heatmap = [];
$monthNames = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];

foreach ($properties as $p) {
    $propId = $p['id'];
    for ($m = 1; $m <= 12; $m++) {
        $monthKey = $year . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $firstOfMonth = $monthKey . '-01';

        $contract = null;
        $propEntityId = $p['properties_id'] ?? $p['id'];
        foreach ($contracts as $c) {
            $cPropMatch = ($c['properties_id'] == $propEntityId);
            if ($cPropMatch
                && $c['contract_start'] <= $firstOfMonth
                && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
                $contract = $c;
                break;
            }
        }

        if (!$contract) {
            $heatmap[$propId . '_' . $monthKey] = ['type' => 'empty', 'monthKey' => $monthKey];
        } else {
            $entityId = $contract['contracts_id'] ?? $contract['id'];
            $paid = $paymentsByContract[$entityId][$monthKey] ?? null;
            $monthRent = getRentForMonth((float)$contract['monthly_rent'], $entityId, $year, $m, $rentChangesByContract);
            $paidAmt = $paid ? (float)($paid['amount_rent'] ?? $paid['amount'] ?? 0) : 0;
            $paymentCount = $paid ? (int)($paid['payment_count'] ?? 0) : 0;
            $hasPaymentDate = $paid && !empty($paid['payment_date']);
            $isPast = ($year < $nowY) || ($year == $nowY && $m < $nowM);

            if ($hasPaymentDate && $paidAmt >= $monthRent) {
                $type = $paidAmt > $monthRent ? 'overpaid' : 'exact';
            } else {
                $type = $isPast ? 'overdue' : 'unpaid';
            }

            $heatmap[$propId . '_' . $monthKey] = [
                'type'          => $type,
                'isPast'        => $isPast,
                'contract'      => ['id'=>$entityId, 'contracts_id'=>$entityId, 'monthly_rent'=>$monthRent, 'tenant_name'=>$contract['tenant_name']],
                'monthKey'       => $monthKey,
                'amount'         => $monthRent,
                'payment'        => $paid ? ['amount'=>(float)($paid['amount_rent'] ?? $paid['amount'] ?? 0), 'date'=>$paid['payment_date'], 'count'=>$paymentCount] : null,
                'paid_amount'    => $paidAmt,
                'payment_count'  => $paymentCount,
                'remaining'      => max(0, $monthRent - $paidAmt),
            ];
        }
    }
}

// Stats podle spec
$activeCount = count(array_unique(array_column($contracts, 'properties_id')));
$occupancyRate = count($properties) > 0 ? round($activeCount / count($properties) * 100, 1) : 0;

$currentMonthKey = $nowY . '-' . str_pad((string)$nowM, 2, '0', STR_PAD_LEFT);
$monthlyIncome = 0;
foreach ($contracts as $c) {
    $entityId = $c['contracts_id'] ?? $c['id'];
    $firstOfMonth = $currentMonthKey . '-01';
    if ($c['contract_start'] <= $firstOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
        $paid = $paymentsByContract[$entityId][$currentMonthKey] ?? null;
        if ($paid && !empty($paid['payment_date'])) {
            $monthlyIncome += (float)($paid['amount_rent'] ?? $paid['amount'] ?? $c['monthly_rent']);
        }
    }
}

$roi = $totalInvestment > 0 ? round($yearIncome / $totalInvestment * 100, 1) : 0;
$collectionRate = $expectedYearIncome > 0 ? round($yearIncome / $expectedYearIncome * 100, 1) : 100;

// Rozsah let pro tlačítka – podle nejstarší smlouvy a plateb
$yearMin = $nowY - 2;
$yearMax = $nowY + 1;
foreach ($contracts as $c) {
    $sy = (int)date('Y', strtotime($c['contract_start']));
    if ($sy < $yearMin) $yearMin = $sy;
    if (!empty($c['contract_end'])) {
        $ey = (int)date('Y', strtotime($c['contract_end']));
        if ($ey > $yearMax) $yearMax = $ey;
    }
}
foreach ($paymentsByContract as $rows) {
    foreach ($rows as $key => $_) {
        $py = (int)explode('-', $key)[0];
        if ($py < $yearMin) $yearMin = $py;
    }
}

jsonOk([
    'contracts'   => $out,
    'properties' => $properties,
    'heatmap'    => $heatmap,
    'year'       => $year,
    'yearMin'    => $yearMin,
    'yearMax'    => $yearMax,
    'monthNames' => $monthNames,
    'stats'      => [
        'occupancyRate'  => $occupancyRate,
        'monthlyIncome'  => $monthlyIncome,
        'roi'            => $roi,
        'collectionRate' => $collectionRate,
        'totalInvestment'=> $totalInvestment,
        'yearIncome'     => $yearIncome,
        'expectedYearIncome' => $expectedYearIncome,
    ],
]);
