<?php
// api/dashboard.php – GET → platební morálka + heatmap data
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonErr('Metoda nepodporovaná.', 405);

$nowY = (int)date('Y');
$nowM = (int)date('n');
$year = isset($_GET['year']) ? (int)$_GET['year'] : $nowY;
$showEnded = isset($_GET['show_ended']) && $_GET['show_ended'] !== '0' && $_GET['show_ended'] !== '';
$extended = isset($_GET['extended']) && $_GET['extended'] !== '0' && $_GET['extended'] !== '';

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

/**
 * Očekávaná částka za měsíc: pokud je uložena first_month_rent a jde o první (poměrný) měsíc, použije se;
 * jinak plný měsíc = full rent, jinak dopočtená poměrná část.
 */
function getExpectedRentForMonth(array $c, int $year, int $m, array $rentChangesByContract): float {
    $firstOfMonth = sprintf('%04d-%02d-01', $year, $m);
    $lastDayOfMonth = date('Y-m-t', strtotime($firstOfMonth));
    $start = $c['contract_start'];
    if ($start > $firstOfMonth && (int)date('Y', strtotime($start)) === $year && (int)date('n', strtotime($start)) === $m) {
        $firstRent = isset($c['first_month_rent']) && $c['first_month_rent'] !== null && $c['first_month_rent'] !== '' ? (float)$c['first_month_rent'] : null;
        if ($firstRent !== null) {
            return $firstRent;
        }
    }
    $fullRent = getRentForMonth((float)$c['monthly_rent'], (int)($c['contracts_id'] ?? $c['id']), $year, $m, $rentChangesByContract);
    $end = $c['contract_end'] ?? $lastDayOfMonth;
    if ($start <= $firstOfMonth && $end >= $lastDayOfMonth) {
        return $fullRent;
    }
    $from = max($start, $firstOfMonth);
    $to = min($end, $lastDayOfMonth);
    if ($from > $to) return 0.0;
    $daysInMonth = (int)date('t', strtotime($firstOfMonth));
    $daysCovered = (int)((strtotime($to) - strtotime($from)) / 86400) + 1;
    return round($fullRent * $daysCovered / $daysInMonth, 2);
}

// Payments per contract – platby odkazují na contracts_id (entity_id smlouvy)
// paidRent: jen platby typu rent (pro očekávaný nájem, neuhrazené měsíce)
// paidTotal: všechny platby (pro součet v sekci Nájemník)
$paymentsByContract = [];
$paymentsListByContract = [];
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
    $paymentsListByContract[$entityId] = [];
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
        if (!isset($paymentsListByContract[$entityId][$key])) {
            $paymentsListByContract[$entityId][$key] = [];
        }
        $paymentsListByContract[$entityId][$key][] = [
            'amount' => $amt,
            'payment_date' => !empty($row['payment_date']) ? $row['payment_date'] : null,
        ];
    }
}

// Jen aktivní smlouvy (contract_end IS NULL nebo >= dnes), pokud nechceme skončené
$today = date('Y-m-d');
$contractsForView = $showEnded ? $contracts : array_values(array_filter($contracts, function ($c) use ($today) {
    return empty($c['contract_end']) || $c['contract_end'] >= $today;
}));

// Contract overview (pro tabulku)
$out = [];
$totalInvestment = 0;
foreach ($properties as $p) {
    if (!empty($p['purchase_price'])) $totalInvestment += (float)$p['purchase_price'];
}

$yearIncome = 0;
$expectedYearIncome = 0;

foreach ($contractsForView as $c) {
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
        $rent = getExpectedRentForMonth($c, $y, $m, $rentChangesByContract);
        $expTotal += $rent;
        $expected++;
        if (++$m > 12) { $m=1; $y++; }
    }

    $unpaid = [];
    for ($y=$sY, $m=$sM; $y<$nowY || ($y===$nowY && $m<=$nowM); ) {
        if ($endY !== null && ($y > $endY || ($y === $endY && $m > $endM))) break;
        $key = $y . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $rent = getExpectedRentForMonth($c, $y, $m, $rentChangesByContract);
        $paidAmt = isset($paid[$key]) ? (float)($paid[$key]['amount_rent'] ?? $paid[$key]['amount'] ?? 0) : 0;
        if ($rent > 0 && $paidAmt < $rent) $unpaid[] = ['year'=>$y,'month'=>$m,'rent'=>$rent];
        if (++$m > 12) { $m=1; $y++; }
    }

    // Roční příjmy pro stats (včetně poměrného prvního měsíce)
    for ($m = 1; $m <= 12; $m++) {
        $key = $year . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $firstOfMonth = $key . '-01';
        $lastDayOfMonth = date('Y-m-t', strtotime($firstOfMonth));
        $hasDayInMonth = $c['contract_start'] <= $lastDayOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth);
        if ($hasDayInMonth) {
            $rent = getExpectedRentForMonth($c, $year, $m, $rentChangesByContract);
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

// Požadované platby (nezaplacené) – seskupeno podle contracts_id
$paymentRequestsRaw = db()->query("
    SELECT * FROM payment_requests
    WHERE valid_to IS NULL AND paid_at IS NULL
    ORDER BY contracts_id, id ASC
")->fetchAll();
$paymentRequestsByContract = [];
foreach ($paymentRequestsRaw as $pr) {
    $cid = (int)$pr['contracts_id'];
    if (!isset($paymentRequestsByContract[$cid])) {
        $paymentRequestsByContract[$cid] = [];
    }
    $paymentRequestsByContract[$cid][] = $pr;
}
foreach ($out as &$row) {
    $row['payment_requests'] = $paymentRequestsByContract[(int)$row['contracts_id']] ?? [];
}
unset($row);

// Heatmap: pro každou nemovitost, pro každý měsíc roku
$heatmap = [];
$monthNames = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];

foreach ($properties as $p) {
    $propId = $p['id'];
    for ($m = 1; $m <= 12; $m++) {
        $monthKey = $year . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
        $firstOfMonth = $monthKey . '-01';
        $lastDayOfMonth = date('Y-m-t', strtotime($firstOfMonth));

        $contract = null;
        $propEntityId = $p['properties_id'] ?? $p['id'];
        foreach ($contractsForView as $c) {
            $cPropMatch = ($c['properties_id'] == $propEntityId);
            $hasDayInMonth = $c['contract_start'] <= $lastDayOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth);
            if ($cPropMatch && $hasDayInMonth) {
                $contract = $c;
                break;
            }
        }

        if (!$contract) {
            $heatmap[$propId . '_' . $monthKey] = ['type' => 'empty', 'monthKey' => $monthKey];
        } else {
            $entityId = $contract['contracts_id'] ?? $contract['id'];
            $paid = $paymentsByContract[$entityId][$monthKey] ?? null;
            $expectedRent = getExpectedRentForMonth($contract, $year, $m, $rentChangesByContract);
            $fullMonthRent = getRentForMonth((float)$contract['monthly_rent'], $entityId, $year, $m, $rentChangesByContract);
            $paidAmt = $paid ? (float)($paid['amount_rent'] ?? $paid['amount'] ?? 0) : 0;
            $paymentCount = $paid ? (int)($paid['payment_count'] ?? 0) : 0;
            $hasPaymentDate = $paid && !empty($paid['payment_date']);
            $isPast = ($year < $nowY) || ($year == $nowY && $m < $nowM);

            $isPartialMonth = ($contract['contract_start'] > $firstOfMonth)
                || (!empty($contract['contract_end']) && $contract['contract_end'] < $lastDayOfMonth);
            $isContractStartMonth = ($contract['contract_start'] > $firstOfMonth)
                && (int)date('Y', strtotime($contract['contract_start'])) === $year
                && (int)date('n', strtotime($contract['contract_start'])) === $m;
            if ($hasPaymentDate && $paidAmt >= $expectedRent) {
                $type = $isPartialMonth ? 'exact' : ($paidAmt > $fullMonthRent ? 'overpaid' : 'exact');
            } else {
                $type = $isPast ? 'overdue' : 'unpaid';
            }

            $paymentDetails = $paymentsListByContract[$entityId][$monthKey] ?? [];
            $heatmap[$propId . '_' . $monthKey] = [
                'type'                 => $type,
                'isPast'               => $isPast,
                'is_contract_start_month' => $isContractStartMonth,
                'contract'             => ['id'=>$entityId, 'contracts_id'=>$entityId, 'monthly_rent'=>$fullMonthRent, 'tenant_name'=>$contract['tenant_name']],
                'monthKey'             => $monthKey,
                'amount'               => $expectedRent,
                'amount_full'          => $fullMonthRent,
                'payment'              => $paid ? ['amount'=>(float)($paid['amount_rent'] ?? $paid['amount'] ?? 0), 'date'=>$paid['payment_date'], 'count'=>$paymentCount] : null,
                'paid_amount'          => $paidAmt,
                'payment_count'        => $paymentCount,
                'remaining'            => max(0, $expectedRent - $paidAmt),
                'payment_details'      => $paymentDetails,
            ];
        }
    }
}

// Stats podle spec (jen zobrazené smlouvy = aktivní nebo včetně skončených)
$activeCount = count(array_unique(array_column($contractsForView, 'properties_id')));
$occupancyRate = count($properties) > 0 ? round($activeCount / count($properties) * 100, 1) : 0;

$currentMonthKey = $nowY . '-' . str_pad((string)$nowM, 2, '0', STR_PAD_LEFT);
$monthlyIncome = 0;
foreach ($contractsForView as $c) {
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
foreach ($contractsForView as $c) {
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

// Rozšířené statistiky a data pro graf (jen když extended=1)
$extendedStats = null;
$monthlyChart = null;
if ($extended) {
    $today = date('Y-m-d');
    $threeMonthsLater = date('Y-m-d', strtotime('+3 months'));

    $expectedCurrentMonth = 0;
    foreach ($contractsForView as $c) {
        $firstOfMonth = $currentMonthKey . '-01';
        if ($c['contract_start'] <= $firstOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
            $expectedCurrentMonth += getExpectedRentForMonth($c, $nowY, $nowM, $rentChangesByContract);
        }
    }

    $totalArrears = 0;
    $tenantsWithArrearsCount = 0;
    $depositsTotal = 0;
    $depositsToReturn = 0;
    $contractsEndingSoon = [];
    foreach ($out as $row) {
        if ($row['balance'] > 0) {
            $totalArrears += $row['balance'];
            $tenantsWithArrearsCount++;
        }
        $contractEnd = $row['contract_end'] ?? null;
        if ($contractEnd && $contractEnd >= $today && $contractEnd <= $threeMonthsLater) {
            $contractsEndingSoon[] = [
                'id' => $row['id'],
                'tenant_name' => $row['tenant_name'],
                'property_name' => $row['property_name'],
                'contract_end' => $contractEnd,
            ];
        }
        if (!$contractEnd || $contractEnd >= $today) {
            $depositsTotal += (float)($row['deposit_amount'] ?? 0);
        }
        if (!empty($row['deposit_to_return'])) {
            $depositsToReturn += (float)($row['deposit_amount'] ?? 0);
        }
    }

    $extendedStats = [
        'expected_current_month' => round($expectedCurrentMonth, 2),
        'total_arrears' => round($totalArrears, 2),
        'tenants_with_arrears_count' => $tenantsWithArrearsCount,
        'contracts_ending_soon' => $contractsEndingSoon,
        'deposits_total' => round($depositsTotal, 2),
        'deposits_to_return' => round($depositsToReturn, 2),
    ];

    // Graf: posledních 12 měsíců – očekávaný vs. skutečný nájem
    $monthlyChart = [];
    $chartY = $nowY;
    $chartM = $nowM;
    for ($i = 0; $i < 12; $i++) {
        $key = $chartY . '-' . str_pad((string)$chartM, 2, '0', STR_PAD_LEFT);
        $firstOfMonth = $key . '-01';
        $lastDayOfMonth = date('Y-m-t', strtotime($firstOfMonth));
        $expected = 0;
        $actual = 0;
        foreach ($contractsForView as $c) {
            if ($c['contract_start'] <= $lastDayOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
                $expected += getExpectedRentForMonth($c, $chartY, $chartM, $rentChangesByContract);
                $entityId = $c['contracts_id'] ?? $c['id'];
                $paid = $paymentsByContract[$entityId][$key] ?? null;
                if ($paid && !empty($paid['payment_date'])) {
                    $actual += (float)($paid['amount_rent'] ?? $paid['amount'] ?? 0);
                }
            }
        }
        $monthLabel = $monthNames[$chartM - 1] ?? $chartM;
        $monthlyChart[] = [
            'month_key' => $key,
            'label' => $monthLabel . ' ' . $chartY,
            'expected' => round($expected, 2),
            'actual' => round($actual, 2),
        ];
        $chartM--;
        if ($chartM < 1) {
            $chartM = 12;
            $chartY--;
        }
    }
    $monthlyChart = array_reverse($monthlyChart);
}

$payload = [
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
];
if ($extendedStats !== null) {
    $payload['extendedStats'] = $extendedStats;
}
if ($monthlyChart !== null) {
    $payload['monthlyChart'] = $monthlyChart;
}
jsonOk($payload);
