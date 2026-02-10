/**
 * tests/test-allocation.js – Testy alokace plateb (frontendova logika)
 * Spusteni: node tests/test-allocation.js
 *
 * Testuje logiku amountContributingToMonth z js/views/dashboard.js:
 * jak se castky plateb rozdeluji do mesicu na zaklade propojenych pozadavku.
 */

let failures = [];
let passed = 0;
let total = 0;

function assertEq(actual, expected, msg) {
    total++;
    if (typeof actual === 'number' && typeof expected === 'number') {
        if (Math.abs(actual - expected) < 0.005) { passed++; return; }
    } else if (actual === expected) { passed++; return; }
    failures.push(`${msg}: expected ${expected}, got ${actual}`);
}

// ─── Extrahovaná logika z dashboard.js ──────────────────────────────
/**
 * Simulace amountContributingToMonth.
 * @param {object} payment - { amount, payment_type, period_year, period_month, payment_date, linked_request_ids }
 * @param {Array}  requests - [ { id, amount, due_date, type }, ... ]
 * @param {string} monthKey - 'YYYY-MM'
 * @returns {number} castka prispivajici do daneho mesice
 */
function amountContributingToMonth(payment, requests, monthKey) {
    const payAmt = parseFloat(payment.amount) || 0;
    const linkedIds = payment.linked_request_ids || [];
    const linkedReqs = linkedIds.length
        ? requests.filter(r => linkedIds.includes(String(r.id)))
        : [];
    const paymentMonthKey = (payment.period_year != null && payment.period_month != null)
        ? (String(payment.period_year) + '-' + String(payment.period_month).padStart(2, '0'))
        : '';

    // effectiveMonthKey
    const pt = payment.payment_type || 'rent';
    let effectiveKey;
    if ((pt === 'deposit' || pt === 'deposit_return') && payment.payment_date) {
        effectiveKey = String(payment.payment_date).slice(0, 7);
    } else {
        effectiveKey = paymentMonthKey;
    }

    if (linkedReqs.length === 0) {
        return (effectiveKey === monthKey) ? payAmt : 0;
    }

    const shouldCap = (pt !== 'deposit' && pt !== 'deposit_return');
    let sum = 0;
    let budget = payAmt;
    linkedReqs.forEach(r => {
        let rAmt = parseFloat(r.amount) || 0;
        if (shouldCap && payAmt >= 0 && rAmt > 0) {
            rAmt = Math.min(rAmt, Math.max(0, Math.round(budget * 100) / 100));
        } else if (shouldCap && payAmt < 0 && rAmt < 0) {
            rAmt = Math.max(rAmt, Math.min(0, Math.round(budget * 100) / 100));
        }
        budget = Math.round((budget - rAmt) * 100) / 100;
        const reqMonthKey = r.due_date ? String(r.due_date).slice(0, 7) : '';
        if (reqMonthKey === monthKey) sum += rAmt;
    });
    if (budget > 0 && paymentMonthKey === monthKey) sum += budget;
    return sum;
}

/**
 * Simulace breakdownu – vraci pole cappedAmt pro kazdy request + remainder.
 */
function allocateBreakdown(payment, requests) {
    const payAmt = parseFloat(payment.amount) || 0;
    const linkedIds = payment.linked_request_ids || [];
    const linkedReqs = linkedIds.length
        ? requests.filter(r => linkedIds.includes(String(r.id)))
        : [];
    const pt = payment.payment_type || 'rent';
    const shouldCap = (pt !== 'deposit' && pt !== 'deposit_return');
    let budget = payAmt;
    const capped = linkedReqs.map(r => {
        let rAmt = parseFloat(r.amount) || 0;
        if (shouldCap && payAmt >= 0 && rAmt > 0) {
            rAmt = Math.min(rAmt, Math.max(0, Math.round(budget * 100) / 100));
        } else if (shouldCap && payAmt < 0 && rAmt < 0) {
            rAmt = Math.max(rAmt, Math.min(0, Math.round(budget * 100) / 100));
        }
        budget = Math.round((budget - rAmt) * 100) / 100;
        return { id: r.id, original: parseFloat(r.amount), capped: rAmt };
    });
    return { capped, remainder: Math.max(0, Math.round(budget * 100) / 100) };
}


// ═══════════════════════════════════════════════════════════════════════
// SCENAR 1: Bezna platba najmu – presna shoda
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 1: Bezna platba najmu – presna shoda');
{
    const p = { amount: 9000, payment_type: 'rent', period_year: 2020, period_month: 10 };
    const reqs = [{ id: '1', amount: 9000, due_date: '2020-10-31', type: 'rent' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 9000, 'S1: rijen = 9000');
    assertEq(amountContributingToMonth(p, reqs, '2020-11'), 0, 'S1: listopad = 0');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 2: Castecna uhrada najmu (8000 za pozadavek 9000)
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 2: Castecna uhrada najmu (platba < pozadavek)');
{
    const p = { amount: 8000, payment_type: 'rent', period_year: 2020, period_month: 10 };
    const reqs = [{ id: '1', amount: 9000, due_date: '2020-10-31', type: 'rent' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 8000, 'S2: rijen = 8000 (capped)');
    const bd = allocateBreakdown(p, reqs);
    assertEq(bd.capped[0].capped, 8000, 'S2 breakdown: najem capped 8000');
    assertEq(bd.remainder, 0, 'S2 breakdown: remainder 0');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 3: Platba najmu za vice mesicu
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 3: Platba najmu za vice mesicu');
{
    const p = { amount: 18000, payment_type: 'rent', period_year: 2020, period_month: 10 };
    const reqs = [
        { id: '1', amount: 9000, due_date: '2020-10-31', type: 'rent' },
        { id: '2', amount: 9000, due_date: '2020-11-30', type: 'rent' },
    ];
    p.linked_request_ids = ['1', '2'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 9000, 'S3: rijen = 9000');
    assertEq(amountContributingToMonth(p, reqs, '2020-11'), 9000, 'S3: listopad = 9000');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 4: Platba najmu s prebytkem (remainder do obdobi)
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 4: Platba najmu s prebytkem');
{
    const p = { amount: 10000, payment_type: 'rent', period_year: 2020, period_month: 10 };
    const reqs = [{ id: '1', amount: 9000, due_date: '2020-10-31', type: 'rent' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 10000, 'S4: rijen = 10000 (9000+1000)');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 5: Platba bez propojenych pozadavku
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 5: Platba bez propojenych pozadavku');
{
    const p = { amount: 9000, payment_type: 'rent', period_year: 2020, period_month: 10 };
    p.linked_request_ids = [];
    assertEq(amountContributingToMonth(p, [], '2020-10'), 9000, 'S5: rijen = 9000 (cele obdobi)');
    assertEq(amountContributingToMonth(p, [], '2020-11'), 0, 'S5: listopad = 0');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 6: Kaucova platba po zuctovani (deposit – cap preskocen)
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 6: Kaucova platba po zuctovani (deposit)');
{
    const p = { amount: 18000, payment_type: 'deposit', period_year: 2020, period_month: 9, payment_date: '2020-09-15' };
    const reqs = [
        { id: '1', amount: 18000, due_date: '2020-09-15', type: 'deposit' },
        { id: '2', amount: 9000, due_date: '2020-12-31', type: 'rent' },
        { id: '3', amount: 4500, due_date: '2021-01-31', type: 'rent' },
        { id: '4', amount: 500, due_date: '2021-01-24', type: 'settlement' },
    ];
    p.linked_request_ids = ['1', '2', '3', '4'];
    assertEq(amountContributingToMonth(p, reqs, '2020-09'), 18000, 'S6: zari = 18000 (kauce)');
    assertEq(amountContributingToMonth(p, reqs, '2020-12'), 9000, 'S6: prosinec = 9000 (najem)');
    assertEq(amountContributingToMonth(p, reqs, '2021-01'), 5000, 'S6: leden = 5000 (4500+500)');

    const bd = allocateBreakdown(p, reqs);
    assertEq(bd.capped[0].capped, 18000, 'S6 breakdown: kauce = 18000 (not capped)');
    assertEq(bd.capped[1].capped, 9000, 'S6 breakdown: najem = 9000 (not capped)');
    assertEq(bd.capped[2].capped, 4500, 'S6 breakdown: najem = 4500 (not capped)');
    assertEq(bd.capped[3].capped, 500, 'S6 breakdown: vyuctovani = 500 (not capped)');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 7: Kaucova platba BEZ zuctovani
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 7: Kaucova platba bez zuctovani');
{
    const p = { amount: 18000, payment_type: 'deposit', period_year: 2020, period_month: 9, payment_date: '2020-09-15' };
    const reqs = [{ id: '1', amount: 18000, due_date: '2020-09-15', type: 'deposit' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-09'), 18000, 'S7: zari = 18000');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 8: Vraceni kauce (deposit_return, zaporna castka)
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 8: Vraceni kauce (deposit_return)');
{
    const p = { amount: -4000, payment_type: 'deposit_return', period_year: 2021, period_month: 1, payment_date: '2021-02-15' };
    const reqs = [{ id: '1', amount: -4000, due_date: '2021-01-31', type: 'deposit_return' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2021-01'), -4000, 'S8: leden = -4000');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 9: Zaloha na energie – presna shoda
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 9: Zaloha na energie – presna shoda');
{
    const p = { amount: 600, payment_type: 'energy', period_year: 2020, period_month: 10 };
    const reqs = [{ id: '1', amount: 600, due_date: '2020-10-31', type: 'energy' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 600, 'S9: rijen = 600');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 10: Castecna uhrada energie
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 10: Castecna uhrada energie');
{
    const p = { amount: 500, payment_type: 'energy', period_year: 2020, period_month: 10 };
    const reqs = [{ id: '1', amount: 600, due_date: '2020-10-31', type: 'energy' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 500, 'S10: rijen = 500 (capped)');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 11: Najem + energie v jedne platbe
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 11: Najem + energie v jedne platbe');
{
    const p = { amount: 9600, payment_type: 'rent', period_year: 2020, period_month: 10 };
    const reqs = [
        { id: '1', amount: 9000, due_date: '2020-10-31', type: 'rent' },
        { id: '2', amount: 600, due_date: '2020-10-31', type: 'energy' },
    ];
    p.linked_request_ids = ['1', '2'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 9600, 'S11: rijen = 9600');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 12: Castecna uhrada najem+energie
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 12: Castecna uhrada najem+energie');
{
    const p = { amount: 8000, payment_type: 'rent', period_year: 2020, period_month: 10 };
    const reqs = [
        { id: '1', amount: 9000, due_date: '2020-10-31', type: 'rent' },
        { id: '2', amount: 600, due_date: '2020-10-31', type: 'energy' },
    ];
    p.linked_request_ids = ['1', '2'];
    assertEq(amountContributingToMonth(p, reqs, '2020-10'), 8000, 'S12: rijen = 8000 (capped)');

    const bd = allocateBreakdown(p, reqs);
    assertEq(bd.capped[0].capped, 8000, 'S12 breakdown: najem capped 8000');
    assertEq(bd.capped[1].capped, 0, 'S12 breakdown: energie capped 0 (budget exhausted)');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 13: Deposit settlement pokryva energie i najem
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 13: Deposit settlement pokryva energie i najem');
{
    const p = { amount: 18000, payment_type: 'deposit', period_year: 2020, period_month: 9, payment_date: '2020-09-15' };
    const reqs = [
        { id: '1', amount: 18000, due_date: '2020-09-15', type: 'deposit' },
        { id: '2', amount: 9000, due_date: '2020-12-31', type: 'rent' },
        { id: '3', amount: 3000, due_date: '2021-01-24', type: 'settlement' },
    ];
    p.linked_request_ids = ['1', '2', '3'];
    assertEq(amountContributingToMonth(p, reqs, '2020-09'), 18000, 'S13: zari = 18000');
    assertEq(amountContributingToMonth(p, reqs, '2020-12'), 9000, 'S13: prosinec = 9000');
    assertEq(amountContributingToMonth(p, reqs, '2021-01'), 3000, 'S13: leden = 3000');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 14: Pomerna cast najmu (prvni mesic)
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 14: Pomerna cast najmu');
{
    const p = { amount: 4500, payment_type: 'rent', period_year: 2020, period_month: 9 };
    const reqs = [{ id: '1', amount: 4500, due_date: '2020-09-30', type: 'rent' }];
    p.linked_request_ids = ['1'];
    assertEq(amountContributingToMonth(p, reqs, '2020-09'), 4500, 'S14: zari = 4500');
}

// ═══════════════════════════════════════════════════════════════════════
// SCENAR 15: Deposit platba, effectiveMonthKey = payment_date
// ═══════════════════════════════════════════════════════════════════════
console.log('Scenar 15: Deposit bez linked – pouzije payment_date');
{
    const p = { amount: 18000, payment_type: 'deposit', period_year: 2020, period_month: 9, payment_date: '2020-09-15' };
    p.linked_request_ids = [];
    assertEq(amountContributingToMonth(p, [], '2020-09'), 18000, 'S15: zari = 18000 (payment_date)');
    assertEq(amountContributingToMonth(p, [], '2020-10'), 0, 'S15: rijen = 0');
}

// ═══════════════════════════════════════════════════════════════════════
// Vysledky
// ═══════════════════════════════════════════════════════════════════════
console.log('');
if (failures.length === 0) {
    console.log(`OK – ${passed}/${total} assertions passed.`);
    process.exit(0);
}
console.log(`FAILED – ${failures.length} failure(s) of ${total}:`);
failures.forEach(f => console.log(`  ✗ ${f}`));
process.exit(1);
