<?php
/**
 * Migration 065: Migrate existing settlement data into new settlements + settlement_items tables.
 *
 * Looks at existing payment_requests with type='settlement' and finds energy advances
 * that reference them via settled_by_request_id. Creates proper settlement records
 * with settlement_items linking the covered advances.
 *
 * This migration is idempotent – it skips if settlements already exist for the contract.
 *
 * Run: php migrations/065_migrate_existing_settlements.php
 */
declare(strict_types=1);
require __DIR__ . '/../api/_bootstrap.php';

// Fake session for valid_user_from
if (!isset($_SESSION)) $_SESSION = [];
$_SESSION['uid'] = 1; // System migration user

echo "Migration 065: Migrace existujících vyúčtování do tabulky settlements\n";

// Find all settlement payment_requests
$stSettlements = db()->query("
    SELECT pr.payment_requests_id, pr.contracts_id, pr.amount, pr.note, pr.due_date,
           pr.period_year, pr.period_month, pr.valid_from
    FROM payment_requests pr
    WHERE pr.type = 'settlement' AND pr.valid_to IS NULL
    ORDER BY pr.contracts_id, pr.id ASC
");
$settlementPRs = $stSettlements->fetchAll(PDO::FETCH_ASSOC);

if (empty($settlementPRs)) {
    echo "  Žádné existující settlement požadavky nenalezeny.\n";
    exit(0);
}

$count = 0;
foreach ($settlementPRs as $spr) {
    $contractsId = (int)$spr['contracts_id'];
    $sprEntityId = (int)$spr['payment_requests_id'];

    // Check if settlement already migrated
    $stCheck = db()->prepare("SELECT id FROM settlements WHERE settlement_request_id = ? AND valid_to IS NULL LIMIT 1");
    $stCheck->execute([$sprEntityId]);
    if ($stCheck->fetch()) {
        echo "  Přeskočeno: settlement request #$sprEntityId již má záznam v settlements.\n";
        continue;
    }

    // Find covered energy advances (settled_by_request_id = this settlement PR)
    $stAdv = db()->prepare("
        SELECT payment_requests_id, amount
        FROM payment_requests
        WHERE settled_by_request_id = ? AND valid_to IS NULL
        ORDER BY id ASC
    ");
    $stAdv->execute([$sprEntityId]);
    $advances = $stAdv->fetchAll(PDO::FETCH_ASSOC);

    // Also find paid energy advances for this contract (that might have been part of the settlement)
    $stPaid = db()->prepare("
        SELECT payment_requests_id, amount
        FROM payment_requests
        WHERE contracts_id = ? AND type = 'energy' AND paid_at IS NOT NULL
              AND settled_by_request_id IS NULL AND valid_to IS NULL
              AND payment_requests_id < ?
        ORDER BY id ASC
    ");
    $stPaid->execute([$contractsId, $sprEntityId]);
    $paidAdvances = $stPaid->fetchAll(PDO::FETCH_ASSOC);

    // Combine: all advances that were part of the original settlement
    $allAdvances = array_merge($paidAdvances, $advances);
    $advancesSum = 0.0;
    foreach ($allAdvances as $a) {
        $advancesSum += (float)$a['amount'];
    }
    $advancesSum = round($advancesSum, 2);

    $settlementAmount = (float)$spr['amount'];
    $actualAmount = round($advancesSum + $settlementAmount, 2); // reconstruct actual from advances + diff

    // Insert settlement record
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
        'locked_at'             => $settledAt, // Lock migrated settlements by default
        'locked_by'             => 1,
        'note'                  => 'Migrováno z původního systému (migration 065)',
    ]);
    $sRow = db()->query("SELECT settlements_id FROM settlements WHERE id = $sId")->fetch();
    $settlementEntityId = (int)($sRow['settlements_id'] ?? $sId);

    // Insert settlement_items for each advance
    $itemCount = 0;
    foreach ($allAdvances as $a) {
        $advEntityId = (int)$a['payment_requests_id'];
        softInsert('settlement_items', [
            'settlements_id'      => $settlementEntityId,
            'payment_requests_id' => $advEntityId,
        ]);
        $itemCount++;
    }

    echo "  Smlouva #$contractsId: settlement #$settlementEntityId (actual=$actualAmount, advances=$advancesSum, diff=$settlementAmount, items=$itemCount)\n";
    $count++;
}

echo "Hotovo: vytvořeno $count settlement záznamů.\n";
