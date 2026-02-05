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
// Indexovat i pod řádkovým id smlouvy (c.id), aby heatmapa našla změny i když frontend ukládá contracts_id = row.id
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $rid = (int)$c['id'];
    if ($eid !== $rid && isset($rentChangesByContract[$eid]) && !isset($rentChangesByContract[$rid])) {
        $rentChangesByContract[$rid] = $rentChangesByContract[$eid];
    }
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
    $end = $c['contract_end'] ?? null;
    if ($end && $end !== '' && (int)date('Y', strtotime($end)) === $year && (int)date('n', strtotime($end)) === $m && $end < $lastDayOfMonth) {
        $lastRent = isset($c['last_month_rent']) && $c['last_month_rent'] !== null && $c['last_month_rent'] !== '' ? (float)$c['last_month_rent'] : null;
        if ($lastRent !== null) {
            return $lastRent;
        }
    }
    $fullRent = getRentForMonth((float)$c['monthly_rent'], (int)($c['contracts_id'] ?? $c['id']), $year, $m, $rentChangesByContract);
    $endForFull = $end ?? $lastDayOfMonth;
    if ($start <= $firstOfMonth && $endForFull >= $lastDayOfMonth) {
        return $fullRent;
    }
    $from = max($start, $firstOfMonth);
    $to = min($end ?? $lastDayOfMonth, $lastDayOfMonth);
    if ($from > $to) return 0.0;
    $daysInMonth = (int)date('t', strtotime($firstOfMonth));
    $daysCovered = (int)((strtotime($to) - strtotime($from)) / 86400) + 1;
    return round($fullRent * $daysCovered / $daysInMonth, 2);
}

/** Očekávaná částka za měsíc = nájem + předpisy (payment_requests) se splatností v daném měsíci. */
function getExpectedTotalForMonth(array $c, int $year, int $m, array $rentChangesByContract, array $paymentRequestsByContractMonth): float {
    $rent = getExpectedRentForMonth($c, $year, $m, $rentChangesByContract);
    $entityId = (int)($c['contracts_id'] ?? $c['id']);
    $monthKey = sprintf('%04d-%02d', $year, $m);
    $requests = $paymentRequestsByContractMonth[$entityId][$monthKey] ?? 0;
    return round($rent + $requests, 2);
}

// Platby navázané na požadavek: započítat do měsíce splatnosti požadavku (due_date), ne do period – aby kauce uhrazená dle požadavku nezpůsobila „přeplaceno“ v jiném měsíci
$paymentEntityToRequestMonth = [];
$prLinkStmt = db()->query("
    SELECT payments_id, due_date FROM payment_requests
    WHERE valid_to IS NULL AND payments_id IS NOT NULL AND due_date IS NOT NULL
");
foreach ($prLinkStmt->fetchAll() as $pr) {
    $paymentEntityToRequestMonth[(int)$pr['payments_id']] = date('Y-m', strtotime($pr['due_date']));
}

// Payments per contract – platby odkazují na contracts_id (entity_id smlouvy)
// paidRent: jen platby typu rent (pro očekávaný nájem, neuhrazené měsíce)
// paidTotal: všechny platby (pro součet v sekci Nájemník)
$paymentsByContract = [];
$paymentsListByContract = [];
$s = db()->prepare("
    SELECT p.payments_id, p.period_year, p.period_month, p.amount, p.payment_date, p.payment_type
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
        $periodKey = $row['period_year'] . '-' . str_pad((string)$row['period_month'], 2, '0', STR_PAD_LEFT);
        $paymentEntityId = isset($row['payments_id']) ? (int)$row['payments_id'] : null;
        $key = ($paymentEntityId !== null && isset($paymentEntityToRequestMonth[$paymentEntityId]))
            ? $paymentEntityToRequestMonth[$paymentEntityId]
            : $periodKey;
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

// Očekáváno = nájem + všechny předpisy (požadavky), stejně jako v heatmapě. Jednotná logika: předpis = očekávání, platba = uhrazeno.
$paymentRequestsSumByContract = [];
$allRequestsStmt = db()->query("
    SELECT contracts_id, type, amount FROM payment_requests
    WHERE valid_to IS NULL
");
foreach ($allRequestsStmt->fetchAll() as $pr) {
    $cid = (int)$pr['contracts_id'];
    $amt = (float)$pr['amount'];
    // Zpětná kompatibilita: staré deposit_return měly kladnou částku, v novém modelu je výdej záporný
    if (($pr['type'] ?? '') === 'deposit_return' && $amt > 0) $amt = -$amt;
    $paymentRequestsSumByContract[$cid] = ($paymentRequestsSumByContract[$cid] ?? 0) + $amt;
}
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $rid = (int)$c['id'];
    if ($eid === $rid) continue;
    if (isset($paymentRequestsSumByContract[$eid]) && !isset($paymentRequestsSumByContract[$rid])) {
        $paymentRequestsSumByContract[$rid] = $paymentRequestsSumByContract[$eid];
    }
    if (isset($paymentRequestsSumByContract[$rid]) && !isset($paymentRequestsSumByContract[$eid])) {
        $paymentRequestsSumByContract[$eid] = $paymentRequestsSumByContract[$rid];
    }
}

// Předpisy s due_date – součet podle smlouvy a měsíce (pro neuhrazené měsíce a heatmapu)
$paymentRequestsByContractMonth = [];
$paymentRequestsByPropertyMonth = [];
$contractToProperty = [];
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $rid = (int)$c['id'];
    $pid = (int)$c['properties_id'];
    $contractToProperty[$eid] = $pid;
    if ($eid !== $rid) $contractToProperty[$rid] = $pid;
}
$paymentRequestsListByContractMonth = [];
// Nevyřízené požadavky (paid_at IS NULL) podle smlouvy a měsíce – pro oranžový okraj buňky a tooltip
$hasUnfulfilledByContractMonth = [];
$unfulfilledListByContractMonth = []; // [contractId][monthKey] => [ ['label'=>..., 'amount'=>...], ... ]
$stmtUnfulfilled = db()->query("
    SELECT contracts_id, due_date, amount, type, note FROM payment_requests
    WHERE valid_to IS NULL AND due_date IS NOT NULL AND paid_at IS NULL
");
foreach ($stmtUnfulfilled->fetchAll() as $pr) {
    $cid = (int)$pr['contracts_id'];
    $monthKey = date('Y-m', strtotime($pr['due_date']));
    if (!isset($hasUnfulfilledByContractMonth[$cid])) {
        $hasUnfulfilledByContractMonth[$cid] = [];
    }
    $hasUnfulfilledByContractMonth[$cid][$monthKey] = true;
    $amt = (float)$pr['amount'];
    if (($pr['type'] ?? '') === 'deposit_return' && $amt > 0) $amt = -$amt;
    $label = trim($pr['note'] ?? '') !== '' ? $pr['note'] : (
        ($pr['type'] ?? '') === 'deposit' ? 'Kauce' :
        (($pr['type'] ?? '') === 'deposit_return' ? 'Vrácení kauce' : (($pr['type'] ?? '') === 'energy' ? 'Energie' : 'Požadavek'))
    );
    if (!isset($unfulfilledListByContractMonth[$cid])) $unfulfilledListByContractMonth[$cid] = [];
    if (!isset($unfulfilledListByContractMonth[$cid][$monthKey])) $unfulfilledListByContractMonth[$cid][$monthKey] = [];
    $unfulfilledListByContractMonth[$cid][$monthKey][] = ['label' => $label, 'amount' => $amt];
}
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $rid = (int)$c['id'];
    if ($eid === $rid) continue;
    if (isset($hasUnfulfilledByContractMonth[$eid]) && !isset($hasUnfulfilledByContractMonth[$rid])) {
        $hasUnfulfilledByContractMonth[$rid] = $hasUnfulfilledByContractMonth[$eid];
    }
    if (isset($hasUnfulfilledByContractMonth[$rid]) && !isset($hasUnfulfilledByContractMonth[$eid])) {
        $hasUnfulfilledByContractMonth[$eid] = $hasUnfulfilledByContractMonth[$rid];
    }
    if (isset($unfulfilledListByContractMonth[$eid]) && !isset($unfulfilledListByContractMonth[$rid])) {
        $unfulfilledListByContractMonth[$rid] = $unfulfilledListByContractMonth[$eid];
    }
    if (isset($unfulfilledListByContractMonth[$rid]) && !isset($unfulfilledListByContractMonth[$eid])) {
        $unfulfilledListByContractMonth[$eid] = $unfulfilledListByContractMonth[$rid];
    }
}
// Pro oranžový okraj a tooltip: neuhrazené požadavky u JAKÉKOLIV smlouvy dané nemovitosti v daném měsíci (každou smlouvu jen jednou)
$hasUnfulfilledByPropertyMonth = [];
$unfulfilledRequestsByPropertyMonth = [];
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $pid = (int)$c['properties_id'];
    $months = $hasUnfulfilledByContractMonth[$eid] ?? [];
    foreach ($months as $monthKey => $_) {
        $hasUnfulfilledByPropertyMonth[$pid][$monthKey] = true;
        $list = $unfulfilledListByContractMonth[$eid][$monthKey] ?? [];
        if (!empty($list)) {
            if (!isset($unfulfilledRequestsByPropertyMonth[$pid])) $unfulfilledRequestsByPropertyMonth[$pid] = [];
            if (!isset($unfulfilledRequestsByPropertyMonth[$pid][$monthKey])) $unfulfilledRequestsByPropertyMonth[$pid][$monthKey] = [];
            foreach ($list as $item) {
                $unfulfilledRequestsByPropertyMonth[$pid][$monthKey][] = $item;
            }
        }
    }
}

$stmtPrMonth = db()->query("
    SELECT id, payment_requests_id, contracts_id, due_date, amount, type, note
    FROM payment_requests
    WHERE valid_to IS NULL AND due_date IS NOT NULL
");
foreach ($stmtPrMonth->fetchAll() as $pr) {
    $cid = (int)$pr['contracts_id'];
    $monthKey = date('Y-m', strtotime($pr['due_date']));
    $amt = (float)$pr['amount'];
    if (($pr['type'] ?? '') === 'deposit_return' && $amt > 0) $amt = -$amt;
    $prId = (int)($pr['payment_requests_id'] ?? $pr['id']);
    if (!isset($paymentRequestsListByContractMonth[$cid])) {
        $paymentRequestsListByContractMonth[$cid] = [];
    }
    if (!isset($paymentRequestsListByContractMonth[$cid][$monthKey])) {
        $paymentRequestsListByContractMonth[$cid][$monthKey] = [];
    }
    $paymentRequestsListByContractMonth[$cid][$monthKey][] = [
        'id' => $prId,
        'amount' => $amt,
        'type' => $pr['type'] ?? 'energy',
        'note' => $pr['note'] ?? '',
    ];
    if (!isset($paymentRequestsByContractMonth[$cid])) {
        $paymentRequestsByContractMonth[$cid] = [];
    }
    if (!isset($paymentRequestsByContractMonth[$cid][$monthKey])) {
        $paymentRequestsByContractMonth[$cid][$monthKey] = 0.0;
    }
    $paymentRequestsByContractMonth[$cid][$monthKey] += $amt;
    $propId = $contractToProperty[$cid] ?? null;
    if ($propId !== null) {
        if (!isset($paymentRequestsByPropertyMonth[$propId])) {
            $paymentRequestsByPropertyMonth[$propId] = [];
        }
        if (!isset($paymentRequestsByPropertyMonth[$propId][$monthKey])) {
            $paymentRequestsByPropertyMonth[$propId][$monthKey] = 0.0;
        }
        $paymentRequestsByPropertyMonth[$propId][$monthKey] += $amt;
    }
}
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $rid = (int)$c['id'];
    if ($eid === $rid) continue;
    if (isset($paymentRequestsByContractMonth[$eid]) && !isset($paymentRequestsByContractMonth[$rid])) {
        $paymentRequestsByContractMonth[$rid] = $paymentRequestsByContractMonth[$eid];
    }
    if (isset($paymentRequestsByContractMonth[$rid]) && !isset($paymentRequestsByContractMonth[$eid])) {
        $paymentRequestsByContractMonth[$eid] = $paymentRequestsByContractMonth[$rid];
    }
    if (isset($paymentRequestsListByContractMonth[$eid]) && !isset($paymentRequestsListByContractMonth[$rid])) {
        $paymentRequestsListByContractMonth[$rid] = $paymentRequestsListByContractMonth[$eid];
    }
    if (isset($paymentRequestsListByContractMonth[$rid]) && !isset($paymentRequestsListByContractMonth[$eid])) {
        $paymentRequestsListByContractMonth[$eid] = $paymentRequestsListByContractMonth[$rid];
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
        $expectedMonth = getExpectedTotalForMonth($c, $y, $m, $rentChangesByContract, $paymentRequestsByContractMonth);
        $paidMonth = isset($paid[$key]) ? (float)($paid[$key]['amount'] ?? 0) : 0;
        if ($expectedMonth > 0 && $paidMonth < $expectedMonth) $unpaid[] = ['year'=>$y,'month'=>$m,'rent'=>$expectedMonth];
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

    $requestsSum = $paymentRequestsSumByContract[$entityId] ?? 0;
    $expectedTotalIncl = round($expTotal + $requestsSum, 2);
    $balanceRent = $expTotal - $totPaidRent;
    $balanceAll = $expectedTotalIncl - $totPaid;
    $statusType = $balanceAll > 0 ? 'debt' : ($balanceAll < 0 ? 'overpaid' : 'exact');
    $currentRent = getRentForMonth($baseRent, $entityId, $nowY, $nowM, $rentChangesByContract);
    $depositAmt = (float)($c['deposit_amount'] ?? 0);
    $depositReturned = !empty($c['deposit_return_date']);
    $contractEnded = !empty($c['contract_end']) && $c['contract_end'] <= date('Y-m-d');
    $depositToReturn = $depositAmt > 0 && !$depositReturned && $contractEnded;
    // Historie nájmu pro tooltip (základní nájem + změny, řazeno podle effective_from)
    $changes = $rentChangesByContract[$entityId] ?? $rentChangesByContract[(int)$c['id']] ?? [];
    $rentHistory = [['amount' => $baseRent, 'effective_from' => $c['contract_start'] ?? '']];
    foreach ($changes as $ch) {
        $rentHistory[] = ['amount' => (float)($ch['amount'] ?? 0), 'effective_from' => $ch['effective_from'] ?? ''];
    }
    usort($rentHistory, fn($a, $b) => strcmp($a['effective_from'], $b['effective_from']));
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
        'rent_history'   => $rentHistory,
        'contract_start' => $c['contract_start'],
        'contract_end'   => $c['contract_end'],
        'expected_months'=> $expected,
        'expected_total' => $expectedTotalIncl,
        'total_paid'     => $totPaid,
        'total_paid_rent'=> $totPaidRent,
        'balance'        => $balanceRent,
        'status_type'    => $statusType,
        'unpaid_months'  => $unpaid,
        'deposit_amount' => $depositAmt,
        'deposit_to_return' => $depositToReturn,
    ];
}

// Požadované platby (všechny platné, včetně uhrazených) – seskupeno podle contracts_id (pro tagy u smluv)
$paymentRequestsRaw = db()->query("
    SELECT * FROM payment_requests
    WHERE valid_to IS NULL
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
// Smlouvy mohou mít contracts_id (entity_id) jiné než řádkové id – indexovat i pod id, ať se požadavky vždy zobrazí
foreach ($contracts as $c) {
    $eid = (int)($c['contracts_id'] ?? $c['id']);
    $rid = (int)$c['id'];
    if ($rid !== $eid && isset($paymentRequestsByContract[$eid]) && !isset($paymentRequestsByContract[$rid])) {
        $paymentRequestsByContract[$rid] = $paymentRequestsByContract[$eid];
    }
}
foreach ($out as &$row) {
    $byEntity = $paymentRequestsByContract[(int)$row['contracts_id']] ?? [];
    $byRowId = $paymentRequestsByContract[(int)$row['id']] ?? [];
    $row['payment_requests'] = $byEntity ?: $byRowId;
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
        $propEntityId = (int)($p['properties_id'] ?? $p['id']);
        $candidates = [];
        foreach ($contracts as $c) {
            $cPropMatch = ((int)$c['properties_id']) === $propEntityId;
            $hasDayInMonth = $c['contract_start'] <= $lastDayOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth);
            if ($cPropMatch && $hasDayInMonth) {
                $candidates[] = $c;
            }
        }
        // Seřadit: aktivní první, pak podle data konce sestupně (pro zobrazení „hlavní“ smlouvy v buňce)
        if (count($candidates) > 0) {
            usort($candidates, function ($a, $b) {
                $aEnd = $a['contract_end'] ?? '';
                $bEnd = $b['contract_end'] ?? '';
                if ($aEnd === '' && $bEnd !== '') return -1;
                if ($aEnd !== '' && $bEnd === '') return 1;
                if ($aEnd === '' && $bEnd === '') return 0;
                return strcmp($bEnd, $aEnd);
            });
        }

        if (count($candidates) === 0) {
            // Může být platba (např. kauce) v měsíci, kdy smlouva ještě neběžela – zobrazit buňku „jen platba“
            $contractsForProperty = array_filter($contracts, function ($c) use ($propEntityId) {
                return (int)$c['properties_id'] === $propEntityId;
            });
            $paidTotalOnly = 0.0;
            $paymentDetailsOnly = [];
            foreach ($contractsForProperty as $c) {
                $entityId = (int)($c['contracts_id'] ?? $c['id']);
                $paid = $paymentsByContract[$entityId][$monthKey] ?? null;
                if ($paid && ((float)($paid['amount'] ?? 0) > 0)) {
                    $paidTotalOnly += (float)($paid['amount'] ?? 0);
                    $paymentDetailsOnly = array_merge($paymentDetailsOnly, $paymentsListByContract[$entityId][$monthKey] ?? []);
                }
            }
            $requestsForPropertyMonth = $paymentRequestsByPropertyMonth[$propEntityId][$monthKey] ?? 0.0;
            if ($paidTotalOnly > 0 || $requestsForPropertyMonth != 0) {
                $expectedTotalOnly = round($requestsForPropertyMonth, 2);
                $primaryContract = reset($contractsForProperty) ?: null;
                $primaryEntityId = $primaryContract ? (int)($primaryContract['contracts_id'] ?? $primaryContract['id']) : 0;
                $monthBreakdownOnly = [];
                foreach ($contractsForProperty as $c) {
                    $eid = (int)($c['contracts_id'] ?? $c['id']);
                    $monthRequests = $paymentRequestsListByContractMonth[$eid][$monthKey] ?? [];
                    foreach ($monthRequests as $req) {
                        $monthBreakdownOnly[] = [
                            'type'   => 'request',
                            'id'     => (int)$req['id'],
                            'label'  => $req['note'] ?: ($req['type'] === 'energy' ? 'Energie' : ($req['type'] === 'settlement' ? 'Vyúčtování' : ($req['type'] === 'deposit' ? 'Kauce' : 'Požadavek'))),
                            'amount' => (float)$req['amount'],
                            'request_type' => $req['type'],
                        ];
                    }
                }
                $paymentDateOnly = null;
                foreach ($paymentDetailsOnly as $pd) {
                    if (!empty($pd['payment_date']) && ($paymentDateOnly === null || $pd['payment_date'] > $paymentDateOnly)) {
                        $paymentDateOnly = $pd['payment_date'];
                    }
                }
                $diffOnly = round($paidTotalOnly - $expectedTotalOnly, 2);
                $typeOnly = $diffOnly >= 0 ? ($diffOnly > 0 ? 'overpaid' : 'exact') : 'overdue';
                $heatmap[$propId . '_' . $monthKey] = [
                    'type'                 => $typeOnly,
                    'isPast'               => ($year < $nowY) || ($year == $nowY && $m < $nowM),
                    'is_contract_start_month' => false,
                    'has_unfulfilled_requests' => !empty($hasUnfulfilledByPropertyMonth[$propEntityId][$monthKey]),
                    'unfulfilled_requests'  => $unfulfilledRequestsByPropertyMonth[$propEntityId][$monthKey] ?? [],
                    'contract'             => $primaryContract ? [
                    'id' => $primaryEntityId,
                    'contracts_id' => $primaryEntityId,
                    'monthly_rent' => (float)($primaryContract['monthly_rent'] ?? 0),
                    'tenant_name' => $primaryContract['tenant_name'] ?? '',
                    'contract_start' => $primaryContract['contract_start'] ?? null,
                    'contract_end' => $primaryContract['contract_end'] ?? null,
                    'rent_changes' => array_map(function ($rc) {
                        return ['effective_from' => $rc['effective_from'] ?? '', 'amount' => (float)($rc['amount'] ?? 0)];
                    }, $rentChangesByContract[$primaryEntityId] ?? []),
                ] : null,
                    'monthKey'             => $monthKey,
                    'amount'               => $expectedTotalOnly,
                    'amount_full'          => $expectedTotalOnly,
                    'payment'              => $paymentDateOnly ? ['amount' => $paidTotalOnly, 'date' => $paymentDateOnly, 'count' => count($paymentDetailsOnly)] : null,
                    'paid_amount'          => $paidTotalOnly,
                    'payment_count'        => count($paymentDetailsOnly),
                    'remaining'            => max(0, $expectedTotalOnly - $paidTotalOnly),
                    'payment_details'      => $paymentDetailsOnly,
                    'month_breakdown'      => $monthBreakdownOnly,
                ];
            } else {
                $heatmap[$propId . '_' . $monthKey] = ['type' => 'empty', 'monthKey' => $monthKey];
            }
        } else {
            // V jednom měsíci může být více smluv (např. jedna končí 13.3., druhá začíná 14.3.) – sčítáme očekávaný nájem i platby ze všech
            $expectedRent = 0.0;
            $paidTotal = 0.0;
            $paymentCount = 0;
            $paymentDate = null;
            $paymentDetails = [];
            $monthBreakdown = [];
            $isPartialMonth = false;
            $isContractStartMonth = false;
            $primaryContract = $candidates[0];
            $primaryEntityId = (int)($primaryContract['contracts_id'] ?? $primaryContract['id']);

            foreach ($candidates as $c) {
                $entityId = (int)($c['contracts_id'] ?? $c['id']);
                $rentForContract = getExpectedRentForMonth($c, $year, $m, $rentChangesByContract);
                $expectedRent += $rentForContract;
                $paid = $paymentsByContract[$entityId][$monthKey] ?? null;
                if ($paid) {
                    $paidTotal += (float)($paid['amount'] ?? 0);
                    $paymentCount += (int)($paid['payment_count'] ?? 0);
                    if (!empty($paid['payment_date']) && ($paymentDate === null || $paid['payment_date'] > $paymentDate)) {
                        $paymentDate = $paid['payment_date'];
                    }
                    $paymentDetails = array_merge($paymentDetails, $paymentsListByContract[$entityId][$monthKey] ?? []);
                }
                if ($rentForContract > 0) {
                    $label = count($candidates) > 1 ? 'Nájem (' . ($c['tenant_name'] ?? '') . ')' : 'Nájem';
                    $monthBreakdown[] = ['type' => 'rent', 'label' => $label, 'amount' => round($rentForContract, 2)];
                }
                if (($c['contract_start'] ?? '') > $firstOfMonth || (!empty($c['contract_end']) && $c['contract_end'] < $lastDayOfMonth)) {
                    $isPartialMonth = true;
                }
                if ((int)date('Y', strtotime($c['contract_start'] ?? $firstOfMonth)) === $year
                    && (int)date('n', strtotime($c['contract_start'] ?? $firstOfMonth)) === $m
                    && ($c['contract_start'] ?? '') > $firstOfMonth) {
                    $isContractStartMonth = true;
                }
            }
            // Při zvýšení nájmu v tomto měsíci přidat do „Co uhradit“ i variantu nového nájmu (od data)
            foreach ($candidates as $c) {
                $eid = (int)($c['contracts_id'] ?? $c['id']);
                $changes = $rentChangesByContract[$eid] ?? [];
                foreach ($changes as $rc) {
                    $eff = $rc['effective_from'] ?? '';
                    if ($eff === '') continue;
                    if ($eff >= $firstOfMonth && $eff <= $lastDayOfMonth) {
                        $amt = (float)($rc['amount'] ?? 0);
                        $dateStr = date('j.n.Y', strtotime($eff));
                        $monthBreakdown[] = ['type' => 'rent', 'label' => 'Nájem (od ' . $dateStr . ')', 'amount' => round($amt, 2)];
                    }
                }
            }

            $requestsForPropertyMonth = $paymentRequestsByPropertyMonth[$propEntityId][$monthKey] ?? 0.0;
            $expectedTotal = round($expectedRent + $requestsForPropertyMonth, 2);
            $fullMonthRent = getRentForMonth((float)$primaryContract['monthly_rent'], $primaryEntityId, $year, $m, $rentChangesByContract);
            foreach ($candidates as $c) {
                $eid = (int)($c['contracts_id'] ?? $c['id']);
                $monthRequests = $paymentRequestsListByContractMonth[$eid][$monthKey] ?? [];
                foreach ($monthRequests as $req) {
                    $monthBreakdown[] = [
                        'type'   => 'request',
                        'id'     => (int)$req['id'],
                        'label'  => $req['note'] ?: ($req['type'] === 'energy' ? 'Energie' : ($req['type'] === 'settlement' ? 'Vyúčtování' : 'Požadavek')),
                        'amount' => (float)$req['amount'],
                        'request_type' => $req['type'],
                    ];
                }
            }
            $hasPaymentDate = $paymentDate !== null;
            $isPast = ($year < $nowY) || ($year == $nowY && $m < $nowM);
            $diff = round($paidTotal - $expectedTotal, 2);
            if ($hasPaymentDate && $diff >= 0) {
                $type = $isPartialMonth ? 'exact' : ($diff > 0 ? 'overpaid' : 'exact');
            } else {
                $type = $isPast ? 'overdue' : 'unpaid';
            }

            $hasUnfulfilledRequests = !empty($hasUnfulfilledByPropertyMonth[$propEntityId][$monthKey]);
            $unfulfilledRequests = $unfulfilledRequestsByPropertyMonth[$propEntityId][$monthKey] ?? [];
            $heatmap[$propId . '_' . $monthKey] = [
                'type'                 => $type,
                'isPast'               => $isPast,
                'is_contract_start_month' => $isContractStartMonth,
                'has_unfulfilled_requests' => $hasUnfulfilledRequests,
                'unfulfilled_requests'  => $unfulfilledRequests,
                'contract'             => [
                    'id' => $primaryEntityId,
                    'contracts_id' => $primaryEntityId,
                    'monthly_rent' => (float)($primaryContract['monthly_rent'] ?? 0),
                    'tenant_name' => $primaryContract['tenant_name'] ?? '',
                    'contract_start' => $primaryContract['contract_start'] ?? null,
                    'contract_end' => $primaryContract['contract_end'] ?? null,
                    'rent_changes' => array_map(function ($rc) {
                        return ['effective_from' => $rc['effective_from'] ?? '', 'amount' => (float)($rc['amount'] ?? 0)];
                    }, $rentChangesByContract[$primaryEntityId] ?? []),
                ],
                'monthKey'             => $monthKey,
                'amount'               => $expectedTotal,
                'amount_full'          => $expectedTotal,
                'payment'              => $hasPaymentDate ? ['amount'=>$paidTotal, 'date'=>$paymentDate, 'count'=>$paymentCount] : null,
                'paid_amount'          => $paidTotal,
                'payment_count'        => $paymentCount,
                'remaining'            => max(0, $expectedTotal - $paidTotal),
                'payment_details'      => $paymentDetails,
                'month_breakdown'      => $monthBreakdown,
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

// Míra vytížení: za vybraný rok a celkově (podíl obsazených měsíců na všech měsících)
$monthsOccupiedInYear = 0;
$monthsPeriodInYear = count($properties) * 12;
$totalMonthsOccupiedOverall = 0;
$totalMonthsPeriodOverall = 0;
foreach ($properties as $prop) {
    $propId = (int)($prop['properties_id'] ?? $prop['id']);
    $contractsOfProp = array_filter($contracts, function ($c) use ($propId) {
        return (int)($c['properties_id'] ?? $c['property_row_id'] ?? 0) === $propId;
    });
    $monthsInYear = 0;
    for ($m = 1; $m <= 12; $m++) {
        $firstOfMonth = sprintf('%04d-%02d-01', $year, $m);
        $lastOfMonth = date('Y-m-t', strtotime($firstOfMonth));
        foreach ($contractsOfProp as $c) {
            if ($c['contract_start'] <= $lastOfMonth && (empty($c['contract_end']) || $c['contract_end'] >= $firstOfMonth)) {
                $monthsInYear++;
                break;
            }
        }
    }
    $monthsOccupiedInYear += $monthsInYear;

    $starts = [];
    $ends = [];
    foreach ($contractsOfProp as $c) {
        $starts[] = $c['contract_start'];
        $ends[] = $c['contract_end'] ?? $nowY . '-' . str_pad((string)$nowM, 2, '0', STR_PAD_LEFT) . '-' . date('t', mktime(0, 0, 0, $nowM, 1, $nowY));
    }
    $purchaseDate = $prop['purchase_date'] ?? null;
    if ($purchaseDate) $starts[] = $purchaseDate;
    if (empty($starts)) {
        $totalMonthsPeriodOverall += 0;
        continue;
    }
    $periodStart = min($starts);
    $periodEnd = max($ends);
    if ($periodEnd < $periodStart) $periodEnd = $periodStart;
    $periodMonths = (int)date('Y', strtotime($periodEnd)) * 12 + (int)date('n', strtotime($periodEnd))
        - (int)date('Y', strtotime($periodStart)) * 12 - (int)date('n', strtotime($periodStart)) + 1;
    if ($periodMonths < 1) $periodMonths = 1;
    $occupiedMonths = 0;
    $d = new DateTime($periodStart);
    $endDt = new DateTime($periodEnd);
    $endDt->modify('last day of this month');
    while ($d <= $endDt) {
        $firstOfMonth = $d->format('Y-m') . '-01';
        $lastOfMonth = $d->format('Y-m-t');
        foreach ($contractsOfProp as $c) {
            if ($c['contract_start'] <= $lastOfMonth && (empty($c['contract_end']) || $c['contract_end'] >= $firstOfMonth)) {
                $occupiedMonths++;
                break;
            }
        }
        $d->modify('+1 month');
    }
    $totalMonthsOccupiedOverall += $occupiedMonths;
    $totalMonthsPeriodOverall += $periodMonths;
}
$utilizationRateYear = $monthsPeriodInYear > 0 ? round($monthsOccupiedInYear / $monthsPeriodInYear * 100, 1) : 0;
$utilizationRateOverall = $totalMonthsPeriodOverall > 0 ? round($totalMonthsOccupiedOverall / $totalMonthsPeriodOverall * 100, 1) : 0;

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
                $expected += getExpectedTotalForMonth($c, $chartY, $chartM, $rentChangesByContract, $paymentRequestsByContractMonth);
                $entityId = $c['contracts_id'] ?? $c['id'];
                $paid = $paymentsByContract[$entityId][$key] ?? null;
                if ($paid && !empty($paid['payment_date'])) {
                    $actual += (float)($paid['amount'] ?? 0);
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

// Součty za jednotlivé měsíce roku (pro řádek pod heatmapou) + celkový součet roku – vždy všechny smlouvy
$monthlyTotals = [];
$yearTotalExpected = 0;
$yearTotalActual = 0;
for ($m = 1; $m <= 12; $m++) {
    $monthKey = $year . '-' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
    $firstOfMonth = $monthKey . '-01';
    $lastDayOfMonth = date('Y-m-t', strtotime($firstOfMonth));
    $expected = 0;
    $actual = 0;
    foreach ($contracts as $c) {
        if ($c['contract_start'] <= $lastDayOfMonth && (!$c['contract_end'] || $c['contract_end'] >= $firstOfMonth)) {
            $expected += getExpectedTotalForMonth($c, $year, $m, $rentChangesByContract, $paymentRequestsByContractMonth);
            $entityId = $c['contracts_id'] ?? $c['id'];
            $paid = $paymentsByContract[$entityId][$monthKey] ?? null;
            if ($paid && !empty($paid['payment_date'])) {
                $actual += (float)($paid['amount'] ?? 0);
            }
        }
    }
    $monthlyTotals[] = ['month' => $m, 'expected' => round($expected, 2), 'actual' => round($actual, 2)];
    $yearTotalExpected += $expected;
    $yearTotalActual += $actual;
}
$yearTotalExpected = round($yearTotalExpected, 2);
$yearTotalActual = round($yearTotalActual, 2);

$payload = [
    'contracts'   => $out,
    'properties' => $properties,
    'heatmap'    => $heatmap,
    'year'       => $year,
    'yearMin'    => $yearMin,
    'yearMax'    => $yearMax,
    'monthNames' => $monthNames,
    'monthlyTotals' => $monthlyTotals,
    'yearTotalExpected' => $yearTotalExpected,
    'yearTotalActual'   => $yearTotalActual,
    'stats'      => [
        'occupancyRate'  => $occupancyRate,
        'monthlyIncome'  => $monthlyIncome,
        'roi'            => $roi,
        'collectionRate' => $collectionRate,
        'utilizationRateYear'   => $utilizationRateYear,
        'utilizationRateOverall'=> $utilizationRateOverall,
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
