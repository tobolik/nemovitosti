<?php
// tests/test-allocation.php – Testy alokace plateb do mesicu heatmapy
// Spusteni: php tests/test-allocation.php
// Testuje logiku z api/dashboard.php: jak se castky plateb rozdeluji do mesicu
// na zaklade propojenych pozadavku (payment_requests).
declare(strict_types=1);

$failures = [];
$passed = 0;
$total = 0;

function assert_eq($actual, $expected, string $msg): void {
    global $failures, $passed, $total;
    $total++;
    // Float comparison with tolerance
    if (is_float($actual) || is_float($expected)) {
        if (abs((float)$actual - (float)$expected) < 0.005) {
            $passed++;
            return;
        }
    } elseif ($actual === $expected) {
        $passed++;
        return;
    }
    $failures[] = "$msg: expected " . var_export($expected, true) . ", got " . var_export($actual, true);
}

/**
 * Simulace alokacni smycky z dashboard.php (radky 251-292).
 * Vraci: ['byMonth' => [monthKey => amount, ...], 'remainder' => float]
 */
function allocatePayment(float $payAmt, string $paymentType, int $periodYear, int $periodMonth, ?string $paymentDate, array $linked): array {
    $hasValidPeriod = $periodMonth >= 1 && $periodMonth <= 12 && $periodYear >= 2000 && $periodYear <= 2100;
    $periodKey = $hasValidPeriod ? ($periodYear . '-' . str_pad((string)$periodMonth, 2, '0', STR_PAD_LEFT)) : null;
    $fallbackMonthKey = !empty($paymentDate) ? date('Y-m', strtotime($paymentDate)) : $periodKey;

    $byMonth = [];
    $allocated = 0.0;
    $shouldCap = !in_array($paymentType, ['deposit', 'deposit_return']);

    foreach ($linked as $pr) {
        $monthKey = date('Y-m', strtotime($pr['due_date']));
        $amt = (float)$pr['amount'];

        // Cap: don't allocate more than the actual payment amount (skip for deposit/deposit_return)
        if ($shouldCap && $payAmt >= 0 && $amt > 0) {
            $amt = min($amt, max(0, round($payAmt - $allocated, 2)));
        } elseif ($shouldCap && $payAmt < 0 && $amt < 0) {
            $amt = max($amt, min(0, round($payAmt - $allocated, 2)));
        }
        $allocated += $amt;

        if (!isset($byMonth[$monthKey])) $byMonth[$monthKey] = 0;
        $byMonth[$monthKey] += $amt;
    }

    $remainder = round($payAmt - $allocated, 2);
    if ($remainder > 0) {
        $monthKey = $periodKey ?: $fallbackMonthKey;
        if ($monthKey) {
            if (!isset($byMonth[$monthKey])) $byMonth[$monthKey] = 0;
            $byMonth[$monthKey] += $remainder;
        }
    }

    return ['byMonth' => $byMonth, 'remainder' => $remainder];
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 1: Bezna platba najmu – presna shoda
// Platba 9000 propojena s pozadavkem na najem 9000 (rijen 2020)
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 1: Bezna platba najmu – presna shoda\n";
$r = allocatePayment(9000, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 9000.0, 'S1: rijen = 9000');
assert_eq($r['remainder'], 0.0, 'S1: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 2: Castecna uhrada najmu (platba < pozadavek)
// Platba 8000, pozadavek 9000 → alokovat 8000, remainder 0
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 2: Castecna uhrada najmu (platba < pozadavek)\n";
$r = allocatePayment(8000, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 8000.0, 'S2: rijen = 8000 (capped)');
assert_eq($r['remainder'], 0.0, 'S2: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 3: Platba najmu za vice mesicu
// Platba 18000, propojena s 2 pozadavky po 9000 (rijen + listopad)
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 3: Platba najmu za vice mesicu\n";
$r = allocatePayment(18000, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
    ['due_date' => '2020-11-30', 'amount' => 9000],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 9000.0, 'S3: rijen = 9000');
assert_eq($r['byMonth']['2020-11'] ?? 0, 9000.0, 'S3: listopad = 9000');
assert_eq($r['remainder'], 0.0, 'S3: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 4: Platba najmu s prebytkem (remainder do obdobi)
// Platba 10000, pozadavek 9000 → 9000 do pozadavku, 1000 remainder do obdobi
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 4: Platba najmu s prebytkem\n";
$r = allocatePayment(10000, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 10000.0, 'S4: rijen = 10000 (9000 + 1000 remainder)');
assert_eq($r['remainder'], 1000.0, 'S4: remainder = 1000');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 5: Platba bez propojenych pozadavku
// Platba 9000, bez linked → cela castka do obdobi
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 5: Platba bez propojenych pozadavku\n";
$r = allocatePayment(9000, 'rent', 2020, 10, '2020-10-15', []);
assert_eq($r['byMonth']['2020-10'] ?? 0, 9000.0, 'S5: rijen = 9000 (remainder)');
assert_eq($r['remainder'], 9000.0, 'S5: remainder = 9000');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 6: Kaucova platba po zuctovani (deposit)
// Platba 18000 (deposit), propojena s kauce 18000 + najem 9000 + najem 4500 + vyuctovani 500
// Celkem linked: 32000 > platba 18000 → cap se NEAPLIKUJE
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 6: Kaucova platba po zuctovani (deposit)\n";
$r = allocatePayment(18000, 'deposit', 2020, 9, '2020-09-15', [
    ['due_date' => '2020-09-15', 'amount' => 18000],  // kauce
    ['due_date' => '2020-12-31', 'amount' => 9000],   // najem prosinec
    ['due_date' => '2021-01-31', 'amount' => 4500],   // najem leden
    ['due_date' => '2021-01-24', 'amount' => 500],    // vyuctovani
]);
assert_eq($r['byMonth']['2020-09'] ?? 0, 18000.0, 'S6: zari = 18000 (kauce)');
assert_eq($r['byMonth']['2020-12'] ?? 0, 9000.0, 'S6: prosinec = 9000 (najem)');
assert_eq($r['byMonth']['2021-01'] ?? 0, 5000.0, 'S6: leden = 5000 (4500+500)');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 7: Kaucova platba BEZ zuctovani (jen kauce)
// Platba 18000 (deposit), propojena pouze s kauce 18000
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 7: Kaucova platba bez zuctovani\n";
$r = allocatePayment(18000, 'deposit', 2020, 9, '2020-09-15', [
    ['due_date' => '2020-09-15', 'amount' => 18000],
]);
assert_eq($r['byMonth']['2020-09'] ?? 0, 18000.0, 'S7: zari = 18000');
assert_eq($r['remainder'], 0.0, 'S7: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 8: Vraceni kauce (deposit_return, zaporna castka)
// Platba -4000 (deposit_return), propojena s pozadavkem -4000
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 8: Vraceni kauce (deposit_return)\n";
$r = allocatePayment(-4000, 'deposit_return', 2021, 1, '2021-02-15', [
    ['due_date' => '2021-01-31', 'amount' => -4000],
]);
assert_eq($r['byMonth']['2021-01'] ?? 0, -4000.0, 'S8: leden = -4000');
assert_eq($r['remainder'], 0.0, 'S8: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 9: Bezna zaloha na energie – presna shoda
// Platba 600, pozadavek 600 (energy)
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 9: Zaloha na energie – presna shoda\n";
$r = allocatePayment(600, 'energy', 2020, 10, '2020-10-30', [
    ['due_date' => '2020-10-31', 'amount' => 600],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 600.0, 'S9: rijen = 600');
assert_eq($r['remainder'], 0.0, 'S9: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 10: Castecna uhrada energie (platba < pozadavek)
// Platba 500, pozadavek 600 → cap na 500
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 10: Castecna uhrada energie\n";
$r = allocatePayment(500, 'energy', 2020, 10, '2020-10-30', [
    ['due_date' => '2020-10-31', 'amount' => 600],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 500.0, 'S10: rijen = 500 (capped)');
assert_eq($r['remainder'], 0.0, 'S10: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 11: Najem + energie v jedne platbe
// Platba 9600, pozadavky: najem 9000 + energie 600
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 11: Najem + energie v jedne platbe\n";
$r = allocatePayment(9600, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
    ['due_date' => '2020-10-31', 'amount' => 600],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 9600.0, 'S11: rijen = 9600');
assert_eq($r['remainder'], 0.0, 'S11: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 12: Castecna uhrada najem+energie (platba < soucet)
// Platba 8000, pozadavky: najem 9000 + energie 600 (celkem 9600)
// Cap: najem 8000 (capped), energie 0 (budget vycerpan)
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 12: Castecna uhrada najem+energie\n";
$r = allocatePayment(8000, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
    ['due_date' => '2020-10-31', 'amount' => 600],
]);
assert_eq($r['byMonth']['2020-10'] ?? 0, 8000.0, 'S12: rijen = 8000 (capped)');
assert_eq($r['remainder'], 0.0, 'S12: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 13: Kaucova platba pokryva energie i najem (deposit settlement)
// Platba 18000 (deposit), linked: kauce 18000 + najem 9000 + energie 3000
// Celkem 30000 > 18000 → cap preskocen
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 13: Deposit settlement pokryva energie i najem\n";
$r = allocatePayment(18000, 'deposit', 2020, 9, '2020-09-15', [
    ['due_date' => '2020-09-15', 'amount' => 18000],  // kauce
    ['due_date' => '2020-12-31', 'amount' => 9000],   // najem
    ['due_date' => '2021-01-24', 'amount' => 3000],   // energie settlement
]);
assert_eq($r['byMonth']['2020-09'] ?? 0, 18000.0, 'S13: zari = 18000 (kauce)');
assert_eq($r['byMonth']['2020-12'] ?? 0, 9000.0, 'S13: prosinec = 9000 (najem)');
assert_eq($r['byMonth']['2021-01'] ?? 0, 3000.0, 'S13: leden = 3000 (energie)');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 14: Zaporna remainder se nealokuje
// Platba 8000 (rent), linked: najem 9000 → cap 8000, remainder -1000 → 0
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 14: Zaporna remainder se nealokuje\n";
$r = allocatePayment(8000, 'rent', 2020, 10, '2020-10-15', [
    ['due_date' => '2020-10-31', 'amount' => 9000],
]);
// Remainder by mel byt 0 (8000 - 8000 capped = 0)
assert_eq($r['remainder'], 0.0, 'S14: remainder = 0 (cap prevents negative)');
// Rijen dostane presne 8000
assert_eq($r['byMonth']['2020-10'] ?? 0, 8000.0, 'S14: rijen = 8000');

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 15: Prvni/posledni mesic – pomerna cast najmu
// Platba 4500 za prvni mesic (pomerna cast), pozadavek 4500
// ═══════════════════════════════════════════════════════════════════════
echo "Scenar 15: Pomerna cast najmu (prvni mesic)\n";
$r = allocatePayment(4500, 'rent', 2020, 9, '2020-09-14', [
    ['due_date' => '2020-09-30', 'amount' => 4500],
]);
assert_eq($r['byMonth']['2020-09'] ?? 0, 4500.0, 'S15: zari = 4500');
assert_eq($r['remainder'], 0.0, 'S15: remainder = 0');

// ═══════════════════════════════════════════════════════════════════════
// Vysledky
// ═══════════════════════════════════════════════════════════════════════
echo "\n";
if (count($failures) === 0) {
    echo "OK – $passed/$total assertions passed.\n";
    exit(0);
}
echo "FAILED – " . count($failures) . " failure(s) of $total:\n";
foreach ($failures as $f) {
    echo "  ✗ $f\n";
}
exit(1);
