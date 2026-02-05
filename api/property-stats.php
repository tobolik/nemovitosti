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

// Vytížení za daný rok: počet měsíců 1–12, kdy byla nemovitost obsazena
$monthsInYear = 0;
for ($m = 1; $m <= 12; $m++) {
    $firstOfMonth = sprintf('%04d-%02d-01', $year, $m);
    $lastOfMonth = date('Y-m-t', strtotime($firstOfMonth));
    foreach ($contracts as $c) {
        if ($c['contract_start'] <= $lastOfMonth && (empty($c['contract_end']) || $c['contract_end'] >= $firstOfMonth)) {
            $monthsInYear++;
            break;
        }
    }
}
$utilizationRateYear = round($monthsInYear / 12 * 100, 1);

// Vytížení celkem: od prvního startu/koupě do teď (nebo posledního konce)
$starts = [];
$ends = [];
foreach ($contracts as $c) {
    $starts[] = $c['contract_start'];
    $ends[] = $c['contract_end'] ?? sprintf('%04d-%02d-%02d', $nowY, $nowM, (int)date('t', mktime(0, 0, 0, $nowM, 1, $nowY)));
}
if ($prop['purchase_date'] ?? null) $starts[] = $prop['purchase_date'];
if (empty($starts)) {
    $utilizationRateOverall = 0;
    $byYear = [];
} else {
    $periodStart = min($starts);
    $periodEnd = max($ends);
    if ($periodEnd < $periodStart) $periodEnd = $periodStart;
    $d = new DateTime($periodStart);
    $endDt = new DateTime($periodEnd);
    $endDt->modify('last day of this month');
    $occupiedMonths = 0;
    $totalMonths = 0;
    $byYear = [];
    while ($d <= $endDt) {
        $totalMonths++;
        $firstOfMonth = $d->format('Y-m') . '-01';
        $lastOfMonth = $d->format('Y-m-t');
        $yr = (int)$d->format('Y');
        foreach ($contracts as $c) {
            if ($c['contract_start'] <= $lastOfMonth && (empty($c['contract_end']) || $c['contract_end'] >= $firstOfMonth)) {
                $occupiedMonths++;
                if (!isset($byYear[$yr])) $byYear[$yr] = ['months_occupied' => 0, 'rent_received' => 0];
                $byYear[$yr]['months_occupied']++;
                break;
            }
        }
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
$valuationAmount = (float)($row['valuation_amount'] ?? 0);
$roiPct = $valuationAmount > 0 ? round($annualRent / $valuationAmount * 100, 1) : null;

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
    'annual_rent' => round($annualRent, 2),
    'roi_pct' => $roiPct,
    'valuation_amount' => $valuationAmount > 0 ? round($valuationAmount, 2) : null,
    'by_year' => $byYear,
]);
