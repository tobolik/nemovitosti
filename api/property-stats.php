<?php
// api/property-stats.php – GET ?properties_id=X&year=Y → statistiky pro jednu nemovitost
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonErr('Metoda nepodporovaná.', 405);

$propEntityId = isset($_GET['properties_id']) ? (int)$_GET['properties_id'] : 0;
$year = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
if ($propEntityId <= 0) jsonErr('Zadejte properties_id.');

$stmt = db()->prepare("SELECT * FROM properties WHERE (properties_id = ? OR id = ?) AND valid_to IS NULL LIMIT 1");
$stmt->execute([$propEntityId, $propEntityId]);
$prop = $stmt->fetch();
if (!$prop) jsonErr('Nemovitost nenalezena.');
$propId = (int)($prop['properties_id'] ?? $prop['id']);

$stmt = db()->prepare("SELECT c.* FROM contracts c WHERE (c.properties_id = ? OR c.properties_id = ?) AND c.valid_to IS NULL ORDER BY c.contract_start ASC");
$stmt->execute([$propEntityId, $propId]);
$contracts = $stmt->fetchAll();

$nowY = (int)date('Y');
$nowM = (int)date('n');

// Vytížení za daný rok: zlomkové měsíce (částečné měsíce na začátku/konci smlouvy)
$monthsInYear = 0;
$today = date('Y-m-d');
for ($m = 1; $m <= 12; $m++) {
    $firstOfMonth = sprintf('%04d-%02d-01', $year, $m);
    $lastOfMonth = date('Y-m-t', strtotime($firstOfMonth));
    $daysInMonth = (int)date('t', strtotime($firstOfMonth));
    $maxFrac = 0;
    foreach ($contracts as $c) {
        $cEnd = !empty($c['contract_end']) && $c['contract_end'] <= $today ? $c['contract_end'] : $today;
        if ($c['contract_start'] <= $lastOfMonth && $cEnd >= $firstOfMonth) {
            $oStart = max($c['contract_start'], $firstOfMonth);
            $oEnd = min($cEnd, $lastOfMonth);
            $days = (strtotime($oEnd) - strtotime($oStart)) / 86400 + 1;
            $frac = min(1, $days / $daysInMonth);
            if ($frac > $maxFrac) $maxFrac = $frac;
        }
    }
    $monthsInYear += $maxFrac;
}
$utilizationRateYear = round($monthsInYear / 12 * 100, 1);

// Vytížení celkem a by_year s částečnými měsíci (zlomkové měsíce na začátku/konci smlouvy)
$starts = [];
$ends = [];
$today = date('Y-m-d');
foreach ($contracts as $c) {
    $starts[] = $c['contract_start'];
    $ends[] = $c['contract_end'] ?? $today;
}
if ($prop['purchase_date'] ?? null) $starts[] = $prop['purchase_date'];
if (empty($starts)) {
    $utilizationRateOverall = 0;
    $byYear = [];
} else {
    $periodStart = min($starts);
    $periodEnd = !empty($ends) ? max($ends) : $today;
    if ($periodEnd < $periodStart) $periodEnd = $periodStart;
    $yMin = (int)date('Y', strtotime($periodStart));
    $yMax = (int)date('Y', strtotime($periodEnd));
    $byYear = [];
    $occupiedMonths = 0;
    $totalMonths = 0;
    for ($yr = $yMin; $yr <= $yMax; $yr++) {
        $monthsInYr = 0;
        for ($m = 1; $m <= 12; $m++) {
            $firstOfMonth = sprintf('%04d-%02d-01', $yr, $m);
            $lastOfMonth = date('Y-m-t', strtotime($firstOfMonth));
            $daysInMonth = (int)date('t', strtotime($firstOfMonth));
            $maxFrac = 0;
            foreach ($contracts as $c) {
                $cEnd = !empty($c['contract_end']) && $c['contract_end'] <= $today ? $c['contract_end'] : $today;
                if ($c['contract_start'] <= $lastOfMonth && $cEnd >= $firstOfMonth) {
                    $oStart = max($c['contract_start'], $firstOfMonth);
                    $oEnd = min($cEnd, $lastOfMonth);
                    $days = (strtotime($oEnd) - strtotime($oStart)) / 86400 + 1;
                    $frac = min(1, $days / $daysInMonth);
                    if ($frac > $maxFrac) $maxFrac = $frac;
                }
            }
            $monthsInYr += $maxFrac;
        }
        $byYear[$yr] = ['months_occupied' => round($monthsInYr, 2), 'rent_received' => 0];
    }
    $d = new DateTime($periodStart);
    $endDt = new DateTime($periodEnd);
    $endDt->modify('last day of this month');
    $occupiedMonths = 0;
    $totalMonths = 0;
    while ($d <= $endDt) {
        $totalMonths++;
        $firstOfMonth = $d->format('Y-m') . '-01';
        $lastOfMonth = $d->format('Y-m-t');
        $daysInMonth = (int)$d->format('t');
        $maxFrac = 0;
        foreach ($contracts as $c) {
            $cEnd = !empty($c['contract_end']) && $c['contract_end'] <= $today ? $c['contract_end'] : $today;
            if ($c['contract_start'] <= $lastOfMonth && $cEnd >= $firstOfMonth) {
                $oStart = max($c['contract_start'], $firstOfMonth);
                $oEnd = min($cEnd, $lastOfMonth);
                $days = (strtotime($oEnd) - strtotime($oStart)) / 86400 + 1;
                $frac = min(1, $days / $daysInMonth);
                if ($frac > $maxFrac) $maxFrac = $frac;
            }
        }
        $occupiedMonths += $maxFrac;
        $d->modify('+1 month');
    }
    $utilizationRateOverall = $totalMonths > 0 ? round($occupiedMonths / $totalMonths * 100, 1) : 0;
    ksort($byYear);
    $byYearList = [];
    foreach ($byYear as $yr => $v) {
        $byYearList[] = ['year' => $yr, 'months_occupied' => $v['months_occupied'], 'rent_received' => 0];
    }
    $byYear = $byYearList;
}

// Vybraný nájem a ROI (shodné s crud listem)
$stmt = db()->prepare("
    SELECT p.*,
        (SELECT COALESCE(SUM(pay.amount), 0)
         FROM payments pay
         JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
         WHERE (c.properties_id = p.properties_id OR c.properties_id = p.id)
           AND pay.valid_to IS NULL
           AND pay.payment_type = 'rent'
        ) AS total_rent_received,
        (SELECT COALESCE(SUM(c.monthly_rent), 0) * 12
         FROM contracts c
         WHERE (c.properties_id = p.properties_id OR c.properties_id = p.id)
           AND c.valid_to IS NULL
           AND (c.contract_end IS NULL OR c.contract_end >= CURDATE())
        ) AS annual_rent
    FROM properties p
    WHERE (p.properties_id = ? OR p.id = ?) AND p.valid_to IS NULL
    LIMIT 1
");
$stmt->execute([$propId, (int)$prop['id']]);
$row = $stmt->fetch();
$totalRentReceived = (float)($row['total_rent_received'] ?? 0);
$annualRent = (float)($row['annual_rent'] ?? 0);
$purchasePrice = (float)($row['purchase_price'] ?? 0);
$valuationAmount = (float)($row['valuation_amount'] ?? 0);

// Aktuální tržní cena: nejnovější z property_valuations (effective_from <= dnes) nebo valuation_amount
$currentMarketValue = $valuationAmount;
try {
    $pvStmt = db()->prepare("
        SELECT amount FROM property_valuations
        WHERE (properties_id = ? OR properties_id = ?) AND valid_to IS NULL AND effective_from <= CURDATE()
        ORDER BY effective_from DESC LIMIT 1
    ");
    $pvStmt->execute([$propEntityId, $propId]);
    $pv = $pvStmt->fetch();
    if ($pv && (float)$pv['amount'] > 0) {
        $currentMarketValue = (float)$pv['amount'];
    }
} catch (Throwable $e) {
    // Tabulka property_valuations nemusí existovat (migrace 041)
}
$appreciationPctVsPurchase = null;
if ($purchasePrice > 0 && $currentMarketValue > 0) {
    $appreciationPctVsPurchase = round(($currentMarketValue - $purchasePrice) / $purchasePrice * 100, 1);
}
$roiPct = $currentMarketValue > 0 ? round($annualRent / $currentMarketValue * 100, 1) : null;

// Náklady: součet uhrazených požadavků mimo kauce (energy, settlement, other)
$costsStmt = db()->prepare("
    SELECT COALESCE(SUM(pr.amount), 0) AS total
    FROM payment_requests pr
    JOIN contracts c ON c.contracts_id = pr.contracts_id AND c.valid_to IS NULL
    WHERE (c.properties_id = ? OR c.properties_id = ?)
      AND pr.valid_to IS NULL
      AND pr.paid_at IS NOT NULL
      AND pr.type IN ('energy', 'settlement', 'other')
");
$costsStmt->execute([$propEntityId, $propId]);
$totalCosts = (float)$costsStmt->fetch()['total'];

// Kauce: ze smluv (deposit_amount, deposit_paid_date, deposit_return_date) + název nájemníka
$deposits = [];
foreach ($contracts as $c) {
    $amt = (float)($c['deposit_amount'] ?? 0);
    if ($amt <= 0) continue;
    $tenantStmt = db()->prepare("SELECT name, type FROM tenants WHERE (tenants_id = ? OR id = ?) AND valid_to IS NULL LIMIT 1");
    $tenantStmt->execute([$c['tenants_id'] ?? 0, $c['tenants_id'] ?? 0]);
    $tenant = $tenantStmt->fetch();
    $deposits[] = [
        'tenant_name' => $tenant['name'] ?? '',
        'tenant_type' => $tenant['type'] ?? 'person',
        'amount' => round($amt, 2),
        'paid_date' => $c['deposit_paid_date'] ?? null,
        'return_date' => $c['deposit_return_date'] ?? null,
    ];
}

// Počet nájemníků (distinct) a rozdělení FO / PO
$tenantsStmt = db()->prepare("
    SELECT t.type, COUNT(DISTINCT t.tenants_id) AS cnt
    FROM contracts c
    JOIN tenants t ON (t.tenants_id = c.tenants_id OR t.id = c.tenants_id) AND t.valid_to IS NULL
    WHERE (c.properties_id = ? OR c.properties_id = ?) AND c.valid_to IS NULL
    GROUP BY t.type
");
$tenantsStmt->execute([$propEntityId, $propId]);
$tenantsByType = [];
$tenantsTotal = 0;
while ($r = $tenantsStmt->fetch()) {
    $tenantsByType[$r['type']] = (int)$r['cnt'];
    $tenantsTotal += (int)$r['cnt'];
}
$tenantsPerson = $tenantsByType['person'] ?? 0;
$tenantsCompany = $tenantsByType['company'] ?? 0;
if ($tenantsTotal === 0 && count($contracts) > 0) {
    $tenantsTotal = count(array_unique(array_column($contracts, 'tenants_id')));
    $tenantsPerson = $tenantsTotal;
    $tenantsCompany = 0;
}

// Počet smluv podle typu nájemníka (FO/PO)
$contractsByTypeStmt = db()->prepare("
    SELECT t.type, COUNT(*) AS cnt
    FROM contracts c
    JOIN tenants t ON (t.tenants_id = c.tenants_id OR t.id = c.tenants_id) AND t.valid_to IS NULL
    WHERE (c.properties_id = ? OR c.properties_id = ?) AND c.valid_to IS NULL
    GROUP BY t.type
");
$contractsByTypeStmt->execute([$propEntityId, $propId]);
$contractsByType = [];
while ($r = $contractsByTypeStmt->fetch()) {
    $contractsByType[$r['type']] = (int)$r['cnt'];
}
$contractsPerson = $contractsByType['person'] ?? 0;
$contractsCompany = $contractsByType['company'] ?? 0;
$contractsCount = count($contracts);

// Průměrná / nejkratší / nejdelší doba nájmu (měsíce) + smlouvy, aktuální nájemník
$avgTenancyMonths = 0;
$shortestTenancyMonths = null;
$longestTenancyMonths = null;
$shortestTenancyContractsId = null;
$longestTenancyContractsId = null;
$currentTenantName = null;
if ($contractsCount > 0) {
    $today = date('Y-m-d');
    $sumMonths = 0;
    $shortestMonths = null;
    $longestMonths = null;
    foreach ($contracts as $c) {
        $start = new DateTime($c['contract_start']);
        $end = !empty($c['contract_end']) && $c['contract_end'] <= $today
            ? new DateTime($c['contract_end'])
            : new DateTime($today);
        $months = (int)$start->diff($end)->format('%y') * 12 + (int)$start->diff($end)->format('%m');
        $sumMonths += $months;
        $cid = (int)($c['contracts_id'] ?? $c['id'] ?? 0);
        if ($shortestMonths === null || $months < $shortestMonths) {
            $shortestMonths = $months;
            $shortestTenancyMonths = $months;
            $shortestTenancyContractsId = $cid;
        }
        if ($longestMonths === null || $months > $longestMonths) {
            $longestMonths = $months;
            $longestTenancyMonths = $months;
            $longestTenancyContractsId = $cid;
        }
        if (empty($c['contract_end']) || $c['contract_end'] >= $today) {
            if ($currentTenantName === null) {
                $tStmt = db()->prepare("SELECT name FROM tenants WHERE (tenants_id = ? OR id = ?) AND valid_to IS NULL LIMIT 1");
                $tStmt->execute([$c['tenants_id'] ?? 0, $c['tenants_id'] ?? 0]);
                $tn = $tStmt->fetch();
                $currentTenantName = $tn['name'] ?? '';
            }
        }
    }
    $avgTenancyMonths = round($sumMonths / $contractsCount, 1);
}

// Doplnit rent_received po letech z plateb
$stmt = db()->prepare("
    SELECT pay.period_year AS y, SUM(pay.amount) AS rent
    FROM payments pay
    JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
    WHERE (c.properties_id = ? OR c.properties_id = ?)
      AND pay.valid_to IS NULL
      AND pay.payment_type = 'rent'
      AND pay.period_year IS NOT NULL
    GROUP BY pay.period_year
");
$stmt->execute([$propEntityId, $propId]);
$paymentsByYear = $stmt->fetchAll();
$rentByYear = [];
foreach ($paymentsByYear as $r) {
    $rentByYear[(int)$r['y']] = (float)$r['rent'];
}
foreach ($byYear as &$b) {
    $b['rent_received'] = $rentByYear[$b['year']] ?? 0;
}
unset($b);

jsonOk([
    'property_name' => $row['name'] ?? $prop['name'],
    'utilization_rate_year' => $utilizationRateYear,
    'utilization_rate_overall' => $utilizationRateOverall,
    'total_rent_received' => round($totalRentReceived, 2),
    'total_costs' => round($totalCosts, 2),
    'annual_rent' => round($annualRent, 2),
    'roi_pct' => $roiPct,
    'purchase_price' => $purchasePrice > 0 ? round($purchasePrice, 2) : null,
    'current_market_value' => $currentMarketValue > 0 ? round($currentMarketValue, 2) : null,
    'valuation_amount' => $valuationAmount > 0 ? round($valuationAmount, 2) : null,
    'appreciation_pct_vs_purchase' => $appreciationPctVsPurchase,
    'deposits' => $deposits,
    'tenants_total' => $tenantsTotal,
    'tenants_person' => $tenantsPerson,
    'tenants_company' => $tenantsCompany,
    'contracts_count' => $contractsCount,
    'contracts_person' => $contractsPerson,
    'contracts_company' => $contractsCompany,
    'avg_tenancy_months' => $avgTenancyMonths,
    'shortest_tenancy_months' => $shortestTenancyMonths,
    'longest_tenancy_months' => $longestTenancyMonths,
    'shortest_tenancy_contracts_id' => $shortestTenancyContractsId,
    'longest_tenancy_contracts_id' => $longestTenancyContractsId,
    'current_tenant_name' => $currentTenantName,
    'by_year' => $byYear,
]);
