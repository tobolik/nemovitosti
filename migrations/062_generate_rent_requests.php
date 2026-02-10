<?php
/**
 * Migrace Fáze 4: Vygenerovat rent požadavky pro existující smlouvy
 * a propojit existující rent platby s odpovídajícím rent požadavkem.
 *
 * Spuštění:
 *   - CLI: php migrations/062_generate_rent_requests.php
 *   - Web (Railway): GET api/migrate-062.php?key=MIGRATE_KEY
 * Bezpečné pro opakované spuštění (syncRentPaymentRequests je idempotentní).
 */
declare(strict_types=1);

if (php_sapi_name() !== 'cli') {
    die("Tento skript lze spustit pouze z příkazové řádky. Na serveru použijte api/migrate-062.php?key=...\n");
}

require __DIR__ . '/../api/_bootstrap.php';
$_SESSION['uid'] = $_SESSION['uid'] ?? null;

$result = runMigration062();
echo "=== Fáze 4: Generování rent požadavků a propojení plateb ===\n\n";
echo "Smluv: {$result['contracts']}\n";
echo "Nových rent požadavků: {$result['generated']}\n";
echo "Propojeno plateb: {$result['linked']}\n";
echo "Již propojeno: {$result['already_linked']}\n";
echo "Bez odpovídajícího požadavku: {$result['no_match']}\n";
echo "\n=== Hotovo ===\n";
