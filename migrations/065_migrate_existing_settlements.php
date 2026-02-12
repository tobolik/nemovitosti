<?php
/**
 * Migration 065: Migrovat existující vyúčtování (payment_requests type=settlement) do tabulky settlements.
 *
 * Hledá payment_requests type=settlement a energy advances propojené přes settled_by_request_id.
 * Vytváří záznamy settlements + settlement_items.
 * Idempotentní – přeskočí, pokud settlement pro daný požadavek již existuje.
 *
 * Spuštění: migrate.php (automaticky) nebo php migrations/065_migrate_existing_settlements.php
 */
declare(strict_types=1);

if (!defined('MIGRATE_RUNNING')) {
    require __DIR__ . '/../api/_bootstrap.php';
}
if (!isset($_SESSION)) $_SESSION = [];
$_SESSION['uid'] = 1;

$stSettlements = db()->query("
    SELECT pr.payment_requests_id, pr.contracts_id, pr.amount, pr.note, pr.due_date,
           pr.period_year, pr.period_month, pr.valid_from
    FROM payment_requests pr
    WHERE pr.type = 'settlement' AND pr.valid_to IS NULL
    ORDER BY pr.contracts_id, pr.id ASC
");
$settlementPRs = $stSettlements->fetchAll(PDO::FETCH_ASSOC);
$created = 0;
$skipped = 0;

if (!empty($settlementPRs)) {
    $stCheck = db()->prepare("SELECT id FROM settlements WHERE settlement_request_id = ? AND valid_to IS NULL LIMIT 1");
    $stAdv = db()->prepare("
        SELECT payment_requests_id, amount
        FROM payment_requests
        WHERE settled_by_request_id = ? AND valid_to IS NULL
        ORDER BY id ASC
    ");
    $stPaid = db()->prepare("
        SELECT payment_requests_id, amount
        FROM payment_requests
        WHERE contracts_id = ? AND type = 'energy' AND paid_at IS NOT NULL
              AND settled_by_request_id IS NULL AND valid_to IS NULL
              AND payment_requests_id < ?
        ORDER BY id ASC
    ");

    foreach ($settlementPRs as $spr) {
        $contractsId = (int)$spr['contracts_id'];
        $sprEntityId = (int)$spr['payment_requests_id'];
        $stCheck->execute([$sprEntityId]);
        if ($stCheck->fetch()) {
            $skipped++;
            continue;
        }
        $stAdv->execute([$sprEntityId]);
        $advances = $stAdv->fetchAll(PDO::FETCH_ASSOC);
        $stPaid->execute([$contractsId, $sprEntityId]);
        $paidAdvances = $stPaid->fetchAll(PDO::FETCH_ASSOC);
        $allAdvances = array_merge($paidAdvances, $advances);
        if (empty($allAdvances)) {
            $skipped++;
            continue;
        }
        $advancesSum = 0.0;
        $paidSum = 0.0;
        foreach ($allAdvances as $a) {
            $advancesSum += (float)$a['amount'];
        }
        foreach ($paidAdvances as $a) {
            $paidSum += (float)$a['amount'];
        }
        $advancesSum = round($advancesSum, 2);
        $paidSum = round($paidSum, 2);
        $settlementAmount = (float)$spr['amount'];
        $actualAmount = round($paidSum + $settlementAmount, 2);
        $settledAt = $spr['valid_from'] ?? date('Y-m-d H:i:s');
        $sId = softInsert('settlements', [
            'contracts_id'          => $contractsId,
            'type'                  => 'energy',
            'label'                 => null,
            'actual_amount'         => $actualAmount,
            'advances_sum'          => $advancesSum,
            'settlement_amount'     => $settlementAmount,
            'settlement_request_id' => $sprEntityId,
            'settled_at'            => $settledAt,
            'locked_at'             => $settledAt,
            'locked_by'             => 1,
            'note'                  => 'Migrováno z původního systému (migration 065)',
        ]);
        $sRow = db()->query("SELECT settlements_id FROM settlements WHERE id = " . (int)$sId)->fetch();
        $settlementEntityId = (int)($sRow['settlements_id'] ?? $sId);
        foreach ($allAdvances as $a) {
            softInsert('settlement_items', [
                'settlements_id'      => $settlementEntityId,
                'payment_requests_id' => (int)$a['payment_requests_id'],
            ]);
        }
        $created++;
    }
}

echo "Migration 065: Migrace existujících vyúčtování do tabulky settlements\n";
echo "Vytvořeno: $created, přeskočeno: $skipped, celkem settlement požadavků: " . count($settlementPRs) . "\n";
echo "Hotovo.\n";
