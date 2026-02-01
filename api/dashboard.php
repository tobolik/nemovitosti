<?php
// api/dashboard.php – GET → platební morálka přehled
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonErr('Metoda nepodporovaná.', 405);

$nowY = (int)date('Y');
$nowM = (int)date('n');

$contracts = db()->query("
    SELECT c.*, p.name AS property_name, t.name AS tenant_name
    FROM contracts c
    JOIN properties p ON p.id=c.property_id AND p.valid_to IS NULL
    JOIN tenants   t ON t.id=c.tenant_id   AND t.valid_to IS NULL
    WHERE c.valid_to IS NULL
    ORDER BY t.name ASC
")->fetchAll();

$out = [];
foreach ($contracts as $c) {
    $sY   = (int)date('Y', strtotime($c['contract_start']));
    $sM   = (int)date('n', strtotime($c['contract_start']));
    $rent = (float)$c['monthly_rent'];

    // Kolik měsíců by mělo být zaplaceno
    $expected = max(0, ($nowY - $sY)*12 + ($nowM - $sM) + 1);

    // Aggregate plateb
    $s = db()->prepare("SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS total FROM payments WHERE contract_id=? AND valid_to IS NULL");
    $s->execute([$c['id']]);
    $agg = $s->fetch();

    // Konkrétní zaplacené periods
    $s2 = db()->prepare("SELECT period_year, period_month FROM payments WHERE contract_id=? AND valid_to IS NULL");
    $s2->execute([$c['id']]);
    $paid = [];
    foreach ($s2->fetchAll() as $r) $paid["{$r['period_year']}-{$r['period_month']}"] = true;

    // Seznam neuhrazených měsíců
    $unpaid = [];
    for ($y=$sY, $m=$sM; $y<$nowY || ($y===$nowY && $m<=$nowM); ) {
        if (!isset($paid["$y-$m"])) $unpaid[] = ['year'=>$y,'month'=>$m];
        if (++$m > 12) { $m=1; $y++; }
    }

    $expTotal  = $expected * $rent;
    $totPaid   = (float)$agg['total'];

    $out[] = [
        'contract_id'    => $c['id'],
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
        'balance'        => $expTotal - $totPaid,   // >0 = dluh
        'unpaid_months'  => $unpaid,
    ];
}

jsonOk($out);
