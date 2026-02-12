<?php
/**
 * Migrace Fáze 4: Vygenerovat rent požadavky pro existující smlouvy
 * a propojit existující rent platby s odpovídajícím rent požadavkem.
 *
 * Spuštění: migrate.php (automaticky) nebo php migrations/062_generate_rent_requests.php
 * Bezpečné pro opakované spuštění (syncRentPaymentRequests je idempotentní).
 */
declare(strict_types=1);

if (!defined('MIGRATE_RUNNING')) {
    if (php_sapi_name() !== 'cli') {
        die("Tento skript lze spustit pouze z příkazové řádky. Na serveru použijte api/migrate.php?key=...\n");
    }
    require __DIR__ . '/../api/_bootstrap.php';
}
$_SESSION['uid'] = $_SESSION['uid'] ?? null;

$contracts = db()->query("SELECT * FROM contracts WHERE valid_to IS NULL ORDER BY id ASC")->fetchAll(PDO::FETCH_ASSOC);
$generated = 0;
foreach ($contracts as $c) {
    $contractsId = (int)($c['contracts_id'] ?? $c['id']);
    $before = db()->prepare("SELECT COUNT(*) FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL");
    $before->execute([$contractsId]);
    $countBefore = (int)$before->fetchColumn();
    syncRentPaymentRequests($contractsId);
    $after = db()->prepare("SELECT COUNT(*) FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL");
    $after->execute([$contractsId]);
    $countAfter = (int)$after->fetchColumn();
    $generated += max(0, (int)$countAfter - $countBefore);
}

$payments = db()->query("
    SELECT p.id, p.payments_id AS entity_id, p.contracts_id, p.period_year, p.period_month, p.amount, p.payment_date
    FROM payments p
    WHERE p.valid_to IS NULL AND p.payment_type = 'rent'
      AND p.payments_id IS NOT NULL
      AND p.period_year IS NOT NULL AND p.period_month IS NOT NULL
      AND p.period_year > 0 AND p.period_month BETWEEN 1 AND 12
    ORDER BY p.contracts_id, p.period_year, p.period_month
")->fetchAll(PDO::FETCH_ASSOC);
$linked = 0;
$alreadyLinked = 0;
$noMatch = 0;
$findPr = db()->prepare("
    SELECT id, payment_requests_id, payments_id
    FROM payment_requests
    WHERE contracts_id = ? AND period_year = ? AND period_month = ? AND type = 'rent' AND valid_to IS NULL
    LIMIT 1
");
foreach ($payments as $pay) {
    $contractsId = (int)$pay['contracts_id'];
    $py = (int)$pay['period_year'];
    $pm = (int)$pay['period_month'];
    $payEntityId = (int)$pay['entity_id'];
    $paidAt = !empty($pay['payment_date']) ? substr($pay['payment_date'], 0, 10) : date('Y-m-d');
    $findPr->execute([$contractsId, $py, $pm]);
    $pr = $findPr->fetch(PDO::FETCH_ASSOC);
    if (!$pr) { $noMatch++; continue; }
    if (!empty($pr['payments_id'])) { $alreadyLinked++; continue; }
    softUpdate('payment_requests', (int)$pr['id'], ['payments_id' => $payEntityId, 'paid_at' => $paidAt]);
    $linked++;
}

echo "=== Fáze 4: Generování rent požadavků a propojení plateb ===\n\n";
echo "Smluv: " . count($contracts) . "\n";
echo "Nových rent požadavků: $generated\n";
echo "Propojeno plateb: $linked\n";
echo "Již propojeno: $alreadyLinked\n";
echo "Bez odpovídajícího požadavku: $noMatch\n";
echo "\n=== Hotovo ===\n";
