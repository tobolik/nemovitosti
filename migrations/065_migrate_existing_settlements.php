<?php
/**
 * Migration 065: Migrate existing settlement data into new settlements + settlement_items tables.
 *
 * Looks at existing payment_requests with type='settlement' and finds energy advances
 * that reference them via settled_by_request_id. Creates proper settlement records
 * with settlement_items linking the covered advances.
 *
 * Spuštění: migrate.php zpracuje všechny .php v migrations/ (jednou, dle _migrations).
 * CLI: php migrations/065_migrate_existing_settlements.php
 */
declare(strict_types=1);

if (!defined('MIGRATE_RUNNING')) {
    require __DIR__ . '/../api/_bootstrap.php';
}
if (!isset($_SESSION)) $_SESSION = [];
$_SESSION['uid'] = 1;

$result = runMigration065();
echo "Migration 065: Migrace existujících vyúčtování do tabulky settlements\n";
echo "Vytvořeno: {$result['created']}, přeskočeno: {$result['skipped']}, celkem settlement požadavků: {$result['total']}\n";
echo "Hotovo.\n";
