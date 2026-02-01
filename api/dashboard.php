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
$contracts = db()->query("
    SELECT c.*, p.name AS property_name, t.name AS tenant_name
    FROM contracts c
    JOIN properties p ON p.id=c.property_id AND p.valid_to IS NULL
    JOIN tenants   t ON t.id=c.tenant_id   AND t.valid_to IS NULL
    WHERE c.valid_to IS NULL
    ORDER BY t.name ASC
")->fetchAll();

// Payments per contract – platby odkazují na contracts_id (logické ID)
$paymentsByContract = [];
$s = db()->prepare("
    SELECT p.period_year, p.period_month, p.amount, p.payment_date
    FROM payments p
    JOIN contracts c ON c.contracts_id = p.contracts_id AND c.valid_to IS NULL
    WHERE p.valid_to IS NULL AND p.contracts_id = ?
");
foreach ($contracts as $c) {
    $logicalId = $c['contracts_id'] ?? $c['id'];
    $s->execute([$logicalId]);
    $paymentsByContract[$logicalId] = [];
    foreach ($s->fetchAll() as $row) {
        $key = $row['period_year'] . '-' . str_pad((string)$row['period_month'], 2, '0', STR_PAD_LEFT);
        if (!isset($paymentsByContract[$logicalId][$key])) {
            $paymentsByContract[$logicalId][$key] = ['amount' => 0, 'payment_date' => null];
        }
        $paymentsByContract[$logicalId][$key]['amount'] += (float)($row['amount'] ?? 0);
        if (empty($paymentsByContract[$logicalId][$key]['payment_date']) && !empty($row['payment_date'])) {
            $paymentsByContract[$logicalId][$key]['payment_date'] = $row['payment_date'];
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
    $logicalId = $c['contracts_id'] ?? $c['id'];
    $sY   = (int)date('Y', strtotime($c['contract_start']));
    $sM   = (int)date('n', strtotime($c['contract_start']));
    $rent = (float)$c['monthly_rent'];

    $expected = max(0, ($nowY - $sY)*12 + ($nowM - $sM) + 1);
    $paid = $paymentsByContract[$logicalId] ?? [];
    $totPaid = 0;
    foreach ($paid as $prow) $totPaid += (float)($prow['amount'] ?? 0);
    $expTotal = $expected * $rent;

    $unpaid = [];
    for ($y=$sY, $m=$sM; $y<$nowY || ($y===$nowY && $m<=$nowM); ) {
        $key = $y . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $paidAmt = isset($paid[$key]) ? (float)($paid[$key]['amount'] ?? 0) : 0;
        if ($paidAmt < $rent) $unpaid[] = ['year'=>$y,'month'=>$m];
        if (++$m > 12) { $m=1; $y++; }
    }

    // Roční příjmy pro stats
    for ($m = 1; $m <= 12; $m++) {
        $key = $year . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $firstOfMonth = $key . '-01';
        if ($c['contract_start'] <= $firstOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
            $expectedYearIncome += $rent;
            if (isset($paid[$key]) && !empty($paid[$key]['payment_date'])) {
                $yearIncome += (float)($paid[$key]['amount'] ?? $rent);
            }
        }
    }

    $out[] = [
        'contracts_id'   => $logicalId,
        'property_id'    => $c['property_id'],
        'tenant_id'      => $c['tenant_id'],
        'property_name'  => $c['property_name'],
        'tenant_name'    => $c['tenant_name'],
        'monthly_rent'   => $rent,
        'contract_start' => $c['contract_start'],
        'contract_end'   => $c['contract_end'],
        'expected_months'=> $expected,
        'expected_total' => $expTotal,
        'total_paid'     => $totPaid,
        'balance'        => $expTotal - $totPaid,
        'unpaid_months'  => $unpaid,
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
        foreach ($contracts as $c) {
            if ($c['property_id'] == $propId
                && $c['contract_start'] <= $firstOfMonth
                && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
                $contract = $c;
                break;
            }
        }

        if (!$contract) {
            $heatmap[$propId . '_' . $monthKey] = ['type' => 'empty', 'monthKey' => $monthKey];
        } else {
            $logicalId = $contract['contracts_id'] ?? $contract['id'];
            $paid = $paymentsByContract[$logicalId][$monthKey] ?? null;
            $monthRent = (float)$contract['monthly_rent'];
            $paidAmt = $paid ? (float)($paid['amount'] ?? 0) : 0;
            $isPaid = $paid && !empty($paid['payment_date']) && $paidAmt >= $monthRent;
            $isPast = ($year < $nowY) || ($year == $nowY && $m < $nowM);

            $heatmap[$propId . '_' . $monthKey] = [
                'type'       => $isPaid ? 'paid' : ($isPast ? 'overdue' : 'unpaid'),
                'contract'   => ['id'=>$logicalId, 'contracts_id'=>$logicalId, 'monthly_rent'=>(float)$contract['monthly_rent'], 'tenant_name'=>$contract['tenant_name']],
                'monthKey'   => $monthKey,
                'amount'     => (float)$contract['monthly_rent'],
                'payment'    => $paid ? ['amount'=>(float)$paid['amount'], 'date'=>$paid['payment_date']] : null,
                'paid_amount'=> $paidAmt,
                'remaining'  => max(0, $monthRent - $paidAmt),
            ];
        }
    }
}

// Stats podle spec
$activeCount = count(array_unique(array_column($contracts, 'property_id')));
$occupancyRate = count($properties) > 0 ? round($activeCount / count($properties) * 100, 1) : 0;

$currentMonthKey = $nowY . '-' . str_pad((string)$nowM, 2, '0', STR_PAD_LEFT);
$monthlyIncome = 0;
foreach ($contracts as $c) {
    $logicalId = $c['contracts_id'] ?? $c['id'];
    $firstOfMonth = $currentMonthKey . '-01';
    if ($c['contract_start'] <= $firstOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
        $paid = $paymentsByContract[$logicalId][$currentMonthKey] ?? null;
        if ($paid && !empty($paid['payment_date'])) {
            $monthlyIncome += (float)($paid['amount'] ?? $c['monthly_rent']);
        }
    }
}

$roi = $totalInvestment > 0 ? round($yearIncome / $totalInvestment * 100, 1) : 0;
$collectionRate = $expectedYearIncome > 0 ? round($yearIncome / $expectedYearIncome * 100, 1) : 100;

jsonOk([
    'contracts'   => $out,
    'properties' => $properties,
    'heatmap'    => $heatmap,
    'year'       => $year,
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
