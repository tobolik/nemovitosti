<?php
/**
 * Migrace Fáze 4: Vygenerovat rent požadavky pro existující smlouvy
 * a propojit existující rent platby s odpovídajícím rent požadavkem.
 *
 * Spuštění: php migrations/062_generate_rent_requests.php
 * Bezpečné pro opakované spuštění (syncRentPaymentRequests je idempotentní).
 */
declare(strict_types=1);

// CLI-only
if (php_sapi_name() !== 'cli') {
    die("Tento skript lze spustit pouze z příkazové řádky.\n");
}

require __DIR__ . '/../api/_bootstrap.php';

// Po session_start() nastavit uid pro softInsert/softUpdate (valid_user_from)
$_SESSION['uid'] = $_SESSION['uid'] ?? null;

echo "=== Fáze 4: Generování rent požadavků a propojení plateb ===\n\n";

// 1) Načíst všechny aktivní smlouvy
$contracts = db()->query("
    SELECT * FROM contracts WHERE valid_to IS NULL ORDER BY id ASC
")->fetchAll(PDO::FETCH_ASSOC);

echo "Nalezeno smluv: " . count($contracts) . "\n";

$generated = 0;
foreach ($contracts as $c) {
    $contractsId = (int)($c['contracts_id'] ?? $c['id']);
    $start = $c['contract_start'] ?? '';
    $end = $c['contract_end'] ?? 'běží';
    echo "  Smlouva #{$contractsId} ({$start} – {$end}): ";

    $before = db()->prepare("SELECT COUNT(*) FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL");
    $before->execute([$contractsId]);
    $countBefore = (int)$before->fetchColumn();

    syncRentPaymentRequests($contractsId);

    $after = db()->prepare("SELECT COUNT(*) FROM payment_requests WHERE contracts_id = ? AND type = 'rent' AND valid_to IS NULL");
    $after->execute([$contractsId]);
    $countAfter = (int)$after->fetchColumn();

    $new = $countAfter - $countBefore;
    echo "{$countAfter} rent požadavků" . ($new > 0 ? " (+{$new} nových)" : " (beze změny)") . "\n";
    $generated += max(0, $new);
}

echo "\nCelkem vygenerováno nových rent požadavků: {$generated}\n";

// 2) Propojit existující rent platby s odpovídajícím rent požadavkem
echo "\n--- Propojení plateb s rent požadavky ---\n";

$payments = db()->query("
    SELECT p.id, COALESCE(p.payments_id, p.id) AS entity_id, p.contracts_id, p.period_year, p.period_month, p.amount, p.payment_date
    FROM payments p
    WHERE p.valid_to IS NULL
      AND p.payment_type = 'rent'
      AND p.period_year IS NOT NULL AND p.period_month IS NOT NULL
      AND p.period_year > 0 AND p.period_month BETWEEN 1 AND 12
    ORDER BY p.contracts_id, p.period_year, p.period_month
")->fetchAll(PDO::FETCH_ASSOC);

echo "Nalezeno rent plateb: " . count($payments) . "\n";

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

    if (!$pr) {
        $noMatch++;
        continue;
    }

    if (!empty($pr['payments_id'])) {
        $alreadyLinked++;
        continue;
    }

    // Propojit: nastavit payments_id a paid_at na požadavku
    softUpdate('payment_requests', (int)$pr['id'], [
        'payments_id' => $payEntityId,
        'paid_at'     => $paidAt,
    ]);
    $linked++;
}

echo "Propojeno: {$linked}\n";
echo "Již propojeno: {$alreadyLinked}\n";
echo "Bez odpovídajícího požadavku: {$noMatch}\n";

echo "\n=== Hotovo ===\n";
