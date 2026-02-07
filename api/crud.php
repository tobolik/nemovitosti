<?php
// api/crud.php
// GET  ?table=X          → list (active records)
// GET  ?table=X&id=N     → single record
// POST { action, table, ...fields }  → add / edit / delete
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();

// Whitelist: tabulka → povolená pole
$FIELDS = [
    'properties' => ['name','address','size_m2','purchase_price','purchase_date','rented_from','purchase_contract_url','valuation_date','valuation_amount','type','note'],
    'tenants'    => ['name','type','birth_date','email','phone','address','ic','dic','note'],
    'tenant_bank_accounts' => ['tenants_id','account_number'],
    'contracts'  => ['properties_id','tenants_id','contract_start','contract_end','monthly_rent','first_month_rent','last_month_rent','contract_url','deposit_amount','deposit_paid_date','deposit_return_date','note','default_payment_method','default_bank_accounts_id'],
    'payments'   => ['contracts_id','period_year','period_month','amount','currency','payment_date','note','counterpart_account','bank_transaction_id','payment_batch_id','payment_method','bank_accounts_id','payment_type','approved_at'],
    'bank_accounts' => ['name','account_number','currency','is_primary','sort_order','fio_token'],
    'contract_rent_changes' => ['contracts_id','amount','effective_from'],
    'payment_requests' => ['contracts_id','amount','type','note','due_date'],
    'payment_imports' => ['bank_accounts_id','payment_date','amount','currency','counterpart_account','note','fio_transaction_id','contracts_id','period_year','period_month','period_year_to','period_month_to','payment_type'],
];

// Povinná pole při přidávání
$REQUIRED = [
    'properties' => ['name','address'],
    'tenants'    => ['name'],
    'tenant_bank_accounts' => ['tenants_id','account_number'],
    'contracts'  => ['properties_id','tenants_id','contract_start','monthly_rent'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date'],
    'bank_accounts' => ['name','account_number'],
    'contract_rent_changes' => ['contracts_id','amount','effective_from'],
    'payment_requests' => ['contracts_id','amount','type'],
];
// Poznámka u payment_requests je nepovinná při přidání/úpravě; při „uzavřít bez platby“ je důvod povinný

// Lidsky čitelné názvy polí pro chybové hlášky
$FIELD_LABELS = [
    'properties' => ['name'=>'Název','address'=>'Adresa','rented_from'=>'Pronajímáno od','valuation_date'=>'K odhadu ke dni','valuation_amount'=>'Odhadní cena'],
    'tenants'    => ['name'=>'Jméno / Název','birth_date'=>'Datum narození'],
    'tenant_bank_accounts' => ['tenants_id'=>'Nájemník','account_number'=>'Číslo účtu'],
    'contracts'  => ['properties_id'=>'Nemovitost','tenants_id'=>'Nájemník','contract_start'=>'Začátek smlouvy','contract_end'=>'Konec smlouvy','monthly_rent'=>'Měsíční nájemné','first_month_rent'=>'Nájem za první měsíc (poměrná část)','last_month_rent'=>'Nájem za poslední měsíc (poměrná část)','deposit_amount'=>'Kauce','deposit_paid_date'=>'Datum přijetí kauce','deposit_return_date'=>'Datum vrácení kauce','note'=>'Poznámka','default_payment_method'=>'Výchozí způsob platby','default_bank_accounts_id'=>'Výchozí bankovní účet'],
    'payments'   => ['contracts_id'=>'Smlouva','period_year'=>'Rok','period_month'=>'Měsíc','amount'=>'Částka','currency'=>'Měna','payment_date'=>'Datum platby','note'=>'Poznámka','counterpart_account'=>'Číslo protiúčtu','payment_method'=>'Způsob platby','bank_accounts_id'=>'Bankovní účet','payment_type'=>'Typ platby','approved_at'=>'Schváleno'],
    'bank_accounts' => ['name'=>'Název','account_number'=>'Číslo účtu','currency'=>'Měna','fio_token'=>'FIO API token'],
    'contract_rent_changes' => ['contracts_id'=>'Smlouva','amount'=>'Částka','effective_from'=>'Platné od'],
    'payment_requests' => ['contracts_id'=>'Smlouva','amount'=>'Částka','type'=>'Typ','note'=>'Poznámka','due_date'=>'Splatnost'],
    'payment_imports' => ['contracts_id'=>'Smlouva','period_year'=>'Rok od','period_month'=>'Měsíc od','period_year_to'=>'Rok do','period_month_to'=>'Měsíc do','currency'=>'Měna','payment_type'=>'Typ platby'],
];

$table = $_GET['table'] ?? body()['table'] ?? '';
if (!isset($FIELDS[$table])) jsonErr('Neznámá tabulka.');

if (function_exists('apiLog500')) {
    apiLog500('REQUEST: table=' . $table . ' method=' . ($_SERVER['REQUEST_METHOD'] ?? ''));
}

/** U bank_accounts nevracíme fio_token do klienta, jen příznak fio_token_isset */
function maskBankAccountFioToken(array $row): array {
    $isset = isset($row['fio_token']) && trim((string)$row['fio_token']) !== '';
    unset($row['fio_token']);
    $row['fio_token_isset'] = $isset;
    return $row;
}

/** Návrh párování importu: podle částky, data a protiúčtu najde vhodnou smlouvu a období (nájem). */
function suggestPaymentImportPairing(float $amount, string $paymentDate, ?string $counterpartAccount, array $contractsWithRent, array $rentChangesByContract): ?array {
    if ($amount <= 0 || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $paymentDate, $m)) return null;
    $y = (int)$m[1]; $mo = (int)$m[2];
    $counterpartNorm = $counterpartAccount !== null && $counterpartAccount !== '' ? strtolower(preg_replace('/\s+/', '', trim($counterpartAccount))) : '';
    $best = null;
    $bestScore = -1;
    foreach ($contractsWithRent as $c) {
        $expectedRent = getRentForMonth((float)$c['monthly_rent'], (int)$c['contracts_id'], $y, $mo, $rentChangesByContract);
        $diff = abs($expectedRent - $amount);
        if ($diff > 0.02) continue; // tolerance 2 haléře
        $score = 0;
        if ($counterpartNorm !== '') {
            $tenantAccounts = db()->prepare("
                SELECT 1 FROM tenant_bank_accounts tba
                WHERE tba.tenants_id = ? AND tba.valid_to IS NULL
                AND LOWER(REPLACE(TRIM(tba.account_number), ' ', '')) = ?
            ");
            $tenantAccounts->execute([(int)$c['tenants_id'], $counterpartNorm]);
            if ($tenantAccounts->fetch()) $score = 10; // protiúčet odpovídá nájemníkovi
        } else {
            $score = 1;
        }
        if ($score > $bestScore || ($score === $bestScore && $diff < ($best['diff'] ?? 999))) {
            $bestScore = $score;
            $best = [
                'suggested_contracts_id' => (int)($c['contracts_id'] ?? $c['id']),
                'suggested_period_year'  => $y,
                'suggested_period_month' => $mo,
                'suggested_payment_type' => 'rent',
                'diff' => $diff,
            ];
        }
    }
    return $best ? [
        'suggested_contracts_id' => $best['suggested_contracts_id'],
        'suggested_period_year'  => $best['suggested_period_year'],
        'suggested_period_month' => $best['suggested_period_month'],
        'suggested_payment_type' => $best['suggested_payment_type'],
    ] : null;
}

/** Ověří, zda řetězec YYYY-MM-DD představuje platné datum. Vrací chybovou zprávu nebo null. */
function validateDateField(?string $val, string $label): ?string {
    if ($val === null || $val === '') return null;
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $val, $m)) {
        return "$label: neplatný formát data (očekáváno YYYY-MM-DD).";
    }
    $y = (int)$m[1]; $mo = (int)$m[2]; $d = (int)$m[3];
    if (!checkdate($mo, $d, $y)) {
        return "$label: neplatné datum (např. únor má pouze 28–29 dní).";
    }
    return null;
}

// ── GET ─────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    // Jednotlivý záznam – parametr id = entity_id (properties_id, contracts_id, …); u payment_imports id = primární klíč
    if ($id > 0) {
        if ($table === 'payment_imports') {
            $s = db()->prepare('SELECT * FROM payment_imports WHERE id = ? AND valid_to IS NULL');
            $s->execute([$id]);
            $row = $s->fetch(PDO::FETCH_ASSOC);
        } else {
            $row = findActiveByEntityId($table, $id);
        }
        if (!$row) jsonErr('Záznam neexistuje.', 404);
        if ($table === 'bank_accounts') $row = maskBankAccountFioToken($row);
        jsonOk($row);
    }

    // payment_imports: soft-update, jen aktivní řádky; volitelně filtr approved_at (to_review / history)
    if ($table === 'payment_imports') {
        $baId = isset($_GET['bank_accounts_id']) ? (int)$_GET['bank_accounts_id'] : 0;
        $from = isset($_GET['from']) ? trim($_GET['from']) : '';
        $to = isset($_GET['to']) ? trim($_GET['to']) : '';
        $onlyToReview = isset($_GET['to_review']) && ($_GET['to_review'] === '1' || $_GET['to_review'] === 'true');
        $onlyHistory = isset($_GET['history']) && ($_GET['history'] === '1' || $_GET['history'] === 'true');
        $onlyMatchingCounterpart = !isset($_GET['only_matching_counterpart']) || $_GET['only_matching_counterpart'] === '1' || $_GET['only_matching_counterpart'] === 'true';
        $sql = "
            SELECT pi.*, c.contracts_id AS c_entity_id, p.name AS property_name, t.name AS tenant_name,
                   CONCAT(t.name, ' – ', p.name) AS contract_label
            FROM payment_imports pi
            LEFT JOIN contracts c ON c.contracts_id = pi.contracts_id AND c.valid_to IS NULL
            LEFT JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
            LEFT JOIN tenants t ON t.tenants_id = c.tenants_id AND t.valid_to IS NULL
            WHERE pi.valid_to IS NULL";
        if ($onlyToReview) $sql .= " AND pi.approved_at IS NULL";
        if ($onlyHistory) $sql .= " AND pi.approved_at IS NOT NULL";
        $params = [];
        if ($baId > 0) {
            $sql .= " AND pi.bank_accounts_id = ?";
            $params[] = $baId;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
            $sql .= " AND pi.payment_date >= ?";
            $params[] = $from;
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
            $sql .= " AND pi.payment_date <= ?";
            $params[] = $to;
        }
        $sql .= " ORDER BY pi.payment_date DESC, pi.id DESC";
        $s = db()->prepare($sql);
        $s->execute($params);
        $rows = $s->fetchAll(PDO::FETCH_ASSOC);
        // Shoda protiúčtu s čísly účtů nájemců (pro zobrazení v UI)
        $allowedCounterparts = [];
        $tbaRows = db()->query("
            SELECT DISTINCT TRIM(tba.account_number) AS account_number
            FROM tenant_bank_accounts tba
            INNER JOIN tenants t ON t.tenants_id = tba.tenants_id
            WHERE tba.valid_to IS NULL AND TRIM(tba.account_number) != ''
        ")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($tbaRows as $acc) {
            $norm = strtolower(preg_replace('/\s+/', '', $acc));
            if ($norm !== '') {
                $allowedCounterparts[$norm] = true;
                $base = preg_replace('/\/.*$/', '', $norm);
                if ($base !== '') $allowedCounterparts[$base] = true;
            }
        }
        $hasTenantAccounts = count($allowedCounterparts) > 0;
        foreach ($rows as &$row) {
            $counterpart = isset($row['counterpart_account']) ? trim((string)$row['counterpart_account']) : '';
            $norm = $counterpart !== '' ? strtolower(preg_replace('/\s+/', '', $counterpart)) : '';
            $base = $norm !== '' ? preg_replace('/\/.*$/', '', $norm) : '';
            $row['counterpart_matches'] = !$hasTenantAccounts ? null : ($norm !== '' && (
                isset($allowedCounterparts[$norm]) || ($base !== '' && isset($allowedCounterparts[$base]))
            );
        }
        unset($row);
        // Filtr: jen řádky s protiúčtem odpovídajícím účtu nájemce (výchozí = jen k párování)
        if ($onlyMatchingCounterpart && $hasTenantAccounts) {
            $rows = array_values(array_filter($rows, function ($r) {
                return $r['counterpart_matches'] === true;
            }));
        }
        // Převyplnění: pro smlouvu+období už existuje platba
        $existingPaymentsKey = [];
        $existingSt = db()->query("
            SELECT contracts_id, period_year, period_month
            FROM payments
            WHERE valid_to IS NULL
        ");
        while ($ex = $existingSt->fetch(PDO::FETCH_ASSOC)) {
            $k = (int)$ex['contracts_id'] . '_' . (int)$ex['period_year'] . '_' . (int)$ex['period_month'];
            $existingPaymentsKey[$k] = true;
        }
        foreach ($rows as &$row) {
            $cid = (int)($row['contracts_id'] ?? 0);
            $py = (int)($row['period_year'] ?? 0);
            $pm = (int)($row['period_month'] ?? 0);
            $row['overpayment'] = ($cid > 0 && $py > 0 && $pm > 0) && isset($existingPaymentsKey[$cid . '_' . $py . '_' . $pm]);
        }
        unset($row);
        // Auto-párování: návrh smlouva/období/typ podle částky, data a protiúčtu
        $contractsWithRent = db()->query("
            SELECT c.contracts_id, c.id, c.tenants_id, c.monthly_rent
            FROM contracts c
            WHERE c.valid_to IS NULL AND (c.contract_end IS NULL OR c.contract_end >= CURDATE())
        ")->fetchAll(PDO::FETCH_ASSOC);
        $rentChangesRaw = db()->query("SELECT * FROM contract_rent_changes WHERE valid_to IS NULL ORDER BY contracts_id, effective_from ASC")->fetchAll();
        $rentChangesByContract = [];
        foreach ($rentChangesRaw as $rc) {
            $cid2 = (int)$rc['contracts_id'];
            if (!isset($rentChangesByContract[$cid2])) $rentChangesByContract[$cid2] = [];
            $rentChangesByContract[$cid2][] = $rc;
        }
        foreach ($rows as &$row) {
            $suggestion = suggestPaymentImportPairing(
                (float)$row['amount'],
                (string)$row['payment_date'],
                isset($row['counterpart_account']) ? trim((string)$row['counterpart_account']) : null,
                $contractsWithRent,
                $rentChangesByContract
            );
            if ($suggestion) {
                $row['suggested_contracts_id'] = $suggestion['suggested_contracts_id'];
                $row['suggested_period_year'] = $suggestion['suggested_period_year'];
                $row['suggested_period_month'] = $suggestion['suggested_period_month'];
                $row['suggested_payment_type'] = $suggestion['suggested_payment_type'];
            }
        }
        unset($row);
        jsonOk($rows);
    }

    // bank_accounts: soft-update, vlastní řazení (primární první); token nikdy neposílat
    if ($table === 'bank_accounts') {
        $rows = db()->query("SELECT * FROM bank_accounts WHERE valid_to IS NULL ORDER BY is_primary DESC, sort_order ASC, id ASC")->fetchAll(PDO::FETCH_ASSOC);
        jsonOk(array_map('maskBankAccountFioToken', $rows));
    }

    // Joined queries pro přehledněji zobrazené lists
    // properties_id, tenants_id = odkazy na entity_id (vždy jen entity_id, nikdy fyzické id)
    if ($table === 'contracts') {
        $pid = isset($_GET['properties_id']) ? (int)$_GET['properties_id'] : 0;
        $sql = "
            SELECT c.*, p.name AS property_name, t.name AS tenant_name
            FROM contracts c
            JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
            JOIN tenants   t ON t.tenants_id = c.tenants_id   AND t.valid_to IS NULL
            WHERE c.valid_to IS NULL";
        if ($pid > 0) {
            $sql .= " AND (c.properties_id = ? OR p.properties_id = ? OR p.id = ?)";
            $s = db()->prepare($sql . " ORDER BY c.contract_start DESC");
            $s->execute([$pid, $pid, $pid]);
            jsonOk($s->fetchAll());
        } else {
            $sql .= " ORDER BY c.contract_start DESC";
            jsonOk(db()->query($sql)->fetchAll());
        }
    }

    if ($table === 'contract_rent_changes') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
        $sql = "SELECT * FROM contract_rent_changes WHERE valid_to IS NULL";
        $params = [];
        if ($cid > 0) {
            $sql .= " AND contracts_id=?";
            $params[] = $cid;
        }
        $sql .= " ORDER BY effective_from ASC";
        $s = db()->prepare($sql);
        $s->execute($params);
        jsonOk($s->fetchAll());
    }

    if ($table === 'tenant_bank_accounts') {
        $tid = isset($_GET['tenants_id']) ? (int)$_GET['tenants_id'] : 0;
        $sql = "SELECT * FROM tenant_bank_accounts WHERE valid_to IS NULL";
        $params = [];
        if ($tid > 0) {
            $sql .= " AND tenants_id=?";
            $params[] = $tid;
        }
        $sql .= " ORDER BY id ASC";
        $s = db()->prepare($sql);
        $s->execute($params);
        jsonOk($s->fetchAll(PDO::FETCH_ASSOC));
    }

    if ($table === 'payment_requests') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
        $pid = isset($_GET['properties_id']) ? (int)$_GET['properties_id'] : 0;
        $unpaidOnly = isset($_GET['unpaid']) && $_GET['unpaid'] !== '0' && $_GET['unpaid'] !== '';
        $params = [];
        if ($pid > 0) {
            $sql = "SELECT pr.* FROM payment_requests pr
                    JOIN contracts c ON c.contracts_id = pr.contracts_id AND c.valid_to IS NULL
                    JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
                    WHERE pr.valid_to IS NULL AND (c.properties_id = ? OR p.properties_id = ? OR p.id = ?)";
            $params = [$pid, $pid, $pid];
            if ($unpaidOnly) { $sql .= " AND pr.paid_at IS NULL"; }
            $sql .= " ORDER BY pr.id ASC";
            $s = db()->prepare($sql);
            $s->execute($params);
            jsonOk($s->fetchAll());
        } else {
            $sql = "SELECT * FROM payment_requests WHERE valid_to IS NULL";
            if ($cid > 0) { $sql .= " AND contracts_id=?"; $params[] = $cid; }
            if ($unpaidOnly) { $sql .= " AND paid_at IS NULL"; }
            $sql .= " ORDER BY id ASC";
            $s = db()->prepare($sql);
            $s->execute($params);
            jsonOk($s->fetchAll());
        }
    }

    if ($table === 'payments') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
        $pid = isset($_GET['properties_id']) ? (int)$_GET['properties_id'] : 0;
        $tid = isset($_GET['tenants_id']) ? (int)$_GET['tenants_id'] : 0;
        $periodYear = isset($_GET['period_year']) ? (int)$_GET['period_year'] : 0;
        $periodMonth = isset($_GET['period_month']) ? (int)$_GET['period_month'] : 0;
        // properties_id, tenants_id = odkazy na entity_id; bank_accounts_id → account_number; propojení s požadavkem
        $sql = "
            SELECT pay.*, c.monthly_rent, p.name AS property_name, t.name AS tenant_name,
                   ba.account_number AS account_number,
                   (SELECT COALESCE(pr.payment_requests_id, pr.id) FROM payment_requests pr WHERE pr.payments_id = pay.payments_id AND pr.valid_to IS NULL ORDER BY pr.id DESC LIMIT 1) AS linked_payment_request_id,
                   (SELECT pr.note FROM payment_requests pr WHERE pr.payments_id = pay.payments_id AND pr.valid_to IS NULL ORDER BY pr.id DESC LIMIT 1) AS linked_request_note,
                   (SELECT pr.amount FROM payment_requests pr WHERE pr.payments_id = pay.payments_id AND pr.valid_to IS NULL ORDER BY pr.id DESC LIMIT 1) AS linked_request_amount
            FROM payments pay
            JOIN contracts  c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
            JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
            JOIN tenants    t ON t.tenants_id = c.tenants_id   AND t.valid_to IS NULL
            LEFT JOIN bank_accounts ba ON ba.bank_accounts_id = pay.bank_accounts_id AND ba.valid_to IS NULL
            WHERE pay.valid_to IS NULL";
        $params = [];
        if ($cid > 0) {
            $sql .= " AND pay.contracts_id=?";
            $params[] = $cid;
        }
        if ($tid > 0) {
            $sql .= " AND (c.tenants_id = ? OR t.tenants_id = ? OR t.id = ?)";
            $params[] = $tid;
            $params[] = $tid;
            $params[] = $tid;
        }
        if ($pid > 0) {
            $sql .= " AND (c.properties_id = ? OR p.properties_id = ?)";
            $params[] = $pid;
            $params[] = $pid;
            if ($periodYear > 0) {
                $sql .= " AND pay.period_year=?";
                $params[] = $periodYear;
            }
            if ($periodMonth > 0) {
                $sql .= " AND pay.period_month=?";
                $params[] = $periodMonth;
            }
        }
        if (isset($_GET['approved']) && $_GET['approved'] === '0') {
            $sql .= " AND pay.approved_at IS NULL";
        }
        $sql .= " ORDER BY pay.period_year DESC, pay.period_month DESC";
        $s = db()->prepare($sql); $s->execute($params);
        $rows = $s->fetchAll();
        $rentChangesRaw = db()->query("SELECT * FROM contract_rent_changes WHERE valid_to IS NULL ORDER BY contracts_id, effective_from ASC")->fetchAll();
        $rentChangesByContract = [];
        foreach ($rentChangesRaw as $rc) {
            $cid2 = (int)$rc['contracts_id'];
            if (!isset($rentChangesByContract[$cid2])) $rentChangesByContract[$cid2] = [];
            $rentChangesByContract[$cid2][] = $rc;
        }
        foreach ($rows as &$row) {
            $baseRent = (float)$row['monthly_rent'];
            $row['monthly_rent'] = getRentForMonth($baseRent, (int)$row['contracts_id'], (int)$row['period_year'], (int)$row['period_month'], $rentChangesByContract);
        }
        unset($row);
        jsonOk($rows);
    }

    // Nemovitosti: seznam včetně ročního nájmu, ROI a celkového vybraného nájmu
    if ($table === 'properties') {
        $rows = db()->query("
            SELECT p.*,
                (SELECT COALESCE(SUM(c.monthly_rent), 0) * 12
                 FROM contracts c
                 WHERE (c.properties_id = p.properties_id OR c.properties_id = p.id)
                   AND c.valid_to IS NULL
                   AND (c.contract_end IS NULL OR c.contract_end >= CURDATE())
                ) AS annual_rent,
                (SELECT COALESCE(SUM(pay.amount), 0)
                 FROM payments pay
                 JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
                 WHERE (c.properties_id = p.properties_id OR c.properties_id = p.id)
                   AND pay.valid_to IS NULL
                   AND pay.approved_at IS NOT NULL
                   AND pay.payment_type = 'rent'
                ) AS total_rent_received
            FROM properties p
            WHERE p.valid_to IS NULL
            ORDER BY p.name ASC
        ")->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as &$r) {
            $r['annual_rent'] = (float)($r['annual_rent'] ?? 0);
            $r['total_rent_received'] = (float)($r['total_rent_received'] ?? 0);
            $val = (float)($r['valuation_amount'] ?? 0);
            $r['roi_pct'] = $val > 0 ? round($r['annual_rent'] / $val * 100, 1) : null;
        }
        unset($r);
        jsonOk($rows);
    }

    // Default plain list
    jsonOk(findAllActive($table, 'name ASC'));
}

// ── POST ────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $b      = body();
    $action = $b['action'] ?? '';

    // Přiřazení platby k požadavku / odpojení (nastaví payment_requests.payments_id a paid_at)
    if ($action === 'link_payment_request') {
        $prEntityId = isset($b['payment_request_id']) ? (int)$b['payment_request_id'] : 0;
        $payEntityId = isset($b['payments_id']) ? (int)$b['payments_id'] : 0;
        if ($prEntityId <= 0 || $payEntityId <= 0) jsonErr('Zadejte požadavek a platbu.');
        $prRow = findActiveByEntityId('payment_requests', $prEntityId);
        if (!$prRow) jsonErr('Požadavek nenalezen.');
        $payRow = findActiveByEntityId('payments', $payEntityId);
        if (!$payRow) jsonErr('Platba nenalezena.');
        if ((int)($prRow['contracts_id'] ?? 0) !== (int)($payRow['contracts_id'] ?? 0)) jsonErr('Platba a požadavek musí být ke stejné smlouvě.');
        $paidAt = !empty($payRow['payment_date']) ? $payRow['payment_date'] : date('Y-m-d');
        softUpdate('payment_requests', (int)$prRow['id'], ['payments_id' => $payEntityId, 'paid_at' => $paidAt]);
        jsonOk(['ok' => true]);
    }
    if ($action === 'unlink_payment_request') {
        $prEntityId = isset($b['payment_request_id']) ? (int)$b['payment_request_id'] : 0;
        if ($prEntityId <= 0) jsonErr('Zadejte požadavek.');
        $prRow = findActiveByEntityId('payment_requests', $prEntityId);
        if (!$prRow) jsonErr('Požadavek nenalezen.');
        softUpdate('payment_requests', (int)$prRow['id'], ['payments_id' => null, 'paid_at' => null]);
        jsonOk(['ok' => true]);
    }
    if ($action === 'close_request_without_payment') {
        $prEntityId = isset($b['payment_request_id']) ? (int)$b['payment_request_id'] : 0;
        $note = isset($b['note']) ? trim((string)$b['note']) : '';
        if ($prEntityId <= 0) jsonErr('Zadejte požadavek.');
        if ($note === '') jsonErr('Důvod uzavření (poznámka) je povinný.');
        $prRow = findActiveByEntityId('payment_requests', $prEntityId);
        if (!$prRow) jsonErr('Požadavek nenalezen.');
        softUpdate('payment_requests', (int)$prRow['id'], [
            'payments_id' => null,
            'paid_at' => date('Y-m-d'),
            'note' => $note,
        ]);
        jsonOk(['ok' => true]);
    }

    // Vybereme jen whitelisted pole
    $data = [];
    foreach ($FIELDS[$table] as $f) {
        if (array_key_exists($f, $b)) $data[$f] = $b[$f];
    }

    // contract_end, deposit_* & note mohou být prázdné → null
    if ($table === 'contracts' && ($data['contract_end']??'') === '') $data['contract_end'] = null;
    if ($table === 'properties' && ($data['valuation_date']??'') === '') $data['valuation_date'] = null;
    if ($table === 'properties' && ($data['valuation_amount']??'') === '') $data['valuation_amount'] = null;
    if ($table === 'properties' && ($data['rented_from']??'') === '') $data['rented_from'] = null;
    if ($table === 'contracts' && ($data['deposit_amount']??'') === '') $data['deposit_amount'] = null;
    if ($table === 'contracts' && ($data['deposit_paid_date']??'') === '') $data['deposit_paid_date'] = null;
    if ($table === 'contracts' && ($data['deposit_return_date']??'') === '') $data['deposit_return_date'] = null;
    if ($table === 'contracts' && ($data['first_month_rent']??'') === '') $data['first_month_rent'] = null;
    if ($table === 'contracts' && ($data['last_month_rent']??'') === '') $data['last_month_rent'] = null;
    if ($table === 'tenants' && ($data['birth_date']??'') === '') $data['birth_date'] = null;

    // Validace dat – neplatné datum nesmí být tiše převedeno na null
    if ($table === 'contracts') {
        $e = validateDateField($data['contract_start'] ?? null, 'Začátek smlouvy');
        if ($e) jsonErr($e);
        $e = validateDateField($data['contract_end'] ?? null, 'Konec smlouvy');
        if ($e) jsonErr($e);
        $e = validateDateField($data['deposit_paid_date'] ?? null, 'Datum přijetí kauce');
        if ($e) jsonErr($e);
        $e = validateDateField($data['deposit_return_date'] ?? null, 'Datum vrácení kauce');
        if ($e) jsonErr($e);
        if (isset($data['deposit_return_date']) && trim((string)($data['deposit_return_date'] ?? '')) !== '') {
            if (!isset($data['contract_end']) || trim((string)($data['contract_end'] ?? '')) === '') {
                jsonErr('Při vyplnění data vrácení kauce musí být vyplněno datum ukončení smlouvy.');
            }
        }
    }
    if ($table === 'contract_rent_changes' && isset($data['effective_from']) && $data['effective_from'] !== '') {
        $e = validateDateField($data['effective_from'], 'Platné od');
        if ($e) jsonErr($e);
    }
    if ($table === 'properties' && isset($data['purchase_date']) && $data['purchase_date'] !== '') {
        $e = validateDateField($data['purchase_date'], 'Datum koupě');
        if ($e) jsonErr($e);
    }
    if ($table === 'properties' && isset($data['valuation_date']) && $data['valuation_date'] !== '') {
        $e = validateDateField($data['valuation_date'], 'K odhadu ke dni');
        if ($e) jsonErr($e);
    }
    if ($table === 'properties' && isset($data['rented_from']) && $data['rented_from'] !== '') {
        $e = validateDateField($data['rented_from'], 'Pronajímáno od');
        if ($e) jsonErr($e);
    }
    if ($table === 'tenants' && isset($data['birth_date']) && $data['birth_date'] !== '') {
        $e = validateDateField($data['birth_date'], 'Datum narození');
        if ($e) jsonErr($e);
    }
    if ($table === 'payments' && isset($data['payment_date']) && $data['payment_date'] !== '') {
        $e = validateDateField($data['payment_date'], 'Datum platby');
        if ($e) jsonErr($e);
    }
    if ($table === 'payment_requests' && isset($data['type'])) {
        if (!in_array($data['type'], ['energy', 'settlement', 'other', 'deposit', 'deposit_return'], true)) {
            $data['type'] = 'energy';
        }
    }
    if ($table === 'payment_requests') {
        if (isset($data['due_date']) && $data['due_date'] === '') $data['due_date'] = null;
        if (isset($data['due_date']) && $data['due_date'] !== null) {
            $e = validateDateField($data['due_date'], 'Splatnost');
            if ($e) jsonErr($e);
        }
    }

    // Pole, která musí být kladné ID (> 0) – 0 znamená „nevybráno“
    $POSITIVE_ID_FIELDS = [
        'contracts' => ['properties_id', 'tenants_id'],
        'payments'  => ['contracts_id'],
        'contract_rent_changes' => ['contracts_id'],
        'tenant_bank_accounts' => ['tenants_id'],
        'payment_requests' => ['contracts_id'],
    ];

    if ($action === 'add') {
        if ($table === 'payment_imports') {
            jsonErr('Import z FIO provádějte v sekci Bankovní účty → Načíst z FIO.');
        }
        foreach ($REQUIRED[$table] as $r) {
            $val = $data[$r] ?? null;
            $isEmpty = ($val === '' || $val === null);
            $isZeroId = in_array($r, $POSITIVE_ID_FIELDS[$table] ?? []) && (int)$val <= 0;
            if ($isEmpty || $isZeroId) {
                $label = $FIELD_LABELS[$table][$r] ?? $r;
                jsonErr("Vyplňte pole: $label");
            }
        }
        // Platba za více měsíců: period_year_to + period_month_to → vytvoří N záznamů
        if ($table === 'payments' && isset($b['period_year_to'], $b['period_month_to'])) {
            $yFrom = (int)($data['period_year'] ?? 0);
            $mFrom = (int)($data['period_month'] ?? 0);
            $yTo   = (int)($b['period_year_to']);
            $mTo   = (int)($b['period_month_to']);
            if ($yFrom <= 0 || $mFrom < 1 || $mFrom > 12 || $yTo <= 0 || $mTo < 1 || $mTo > 12) {
                jsonErr('Vyplňte platný rozsah měsíců (od–do).');
            }
            $tsFrom = $yFrom * 12 + $mFrom;
            $tsTo   = $yTo * 12 + $mTo;
            if ($tsFrom > $tsTo) jsonErr('Měsíc „od“ musí být před měsícem „do“.');
            $numMonths = $tsTo - $tsFrom + 1;
            $totalAmt  = (float)($data['amount'] ?? 0);
            if ($totalAmt === 0.0) jsonErr('Zadejte částku platby.');
            $amtPerMonth = round($totalAmt / $numMonths, 2);
            $paymentDate = $data['payment_date'] ?? '';
            $e = validateDateField($paymentDate, 'Datum platby');
            if ($e) jsonErr($e);
            $batchId = bin2hex(random_bytes(16));
            $paymentMethod = in_array($data['payment_method'] ?? '', ['account','cash']) ? $data['payment_method'] : null;
            $bankAccountsId = ($paymentMethod === 'account' && isset($data['bank_accounts_id'])) ? (int)$data['bank_accounts_id'] : null;
            if ($paymentMethod === 'account' && (!$bankAccountsId || $bankAccountsId <= 0)) jsonErr('Vyberte bankovní účet.');
            $ids = [];
            for ($y = $yFrom, $m = $mFrom; $y < $yTo || ($y === $yTo && $m <= $mTo); ) {
                $row = [
                    'contracts_id'      => $data['contracts_id'],
                    'period_year'      => $y,
                    'period_month'     => $m,
                    'amount'           => $amtPerMonth,
                    'payment_date'     => $paymentDate,
                    'note'             => $data['note'] ?? null,
                    'payment_batch_id'  => $batchId,
                    'payment_method'   => $paymentMethod,
                    'bank_accounts_id' => $bankAccountsId,
                ];
                $ids[] = softInsert($table, $row);
                if (++$m > 12) { $m = 1; $y++; }
            }
            jsonOk(['ids' => $ids, 'count' => count($ids)], 201);
        } elseif ($table === 'contract_rent_changes') {
            $newId = softInsert($table, [
                'contracts_id'   => (int)$data['contracts_id'],
                'amount'         => (float)$data['amount'],
                'effective_from'=> $data['effective_from'],
            ]);
            jsonOk(findActive($table, $newId), 201);
        } elseif ($table === 'tenant_bank_accounts') {
            $acc = isset($data['account_number']) ? trim((string)$data['account_number']) : '';
            if ($acc === '') jsonErr('Vyplňte číslo účtu.');
            $newId = softInsert($table, [
                'tenants_id'     => (int)$data['tenants_id'],
                'account_number' => $acc,
            ]);
            jsonOk(findActive($table, $newId), 201);
        } elseif ($table === 'payments') {
            $pm = in_array($data['payment_method'] ?? '', ['account','cash']) ? $data['payment_method'] : 'account';
            $baId = isset($data['bank_accounts_id']) ? (int)$data['bank_accounts_id'] : 0;
            if ($pm === 'account' && ($baId <= 0)) jsonErr('Vyberte bankovní účet.');
            $data['bank_accounts_id'] = $pm === 'account' ? $baId : null;
            $data['payment_type'] = in_array($data['payment_type'] ?? 'rent', ['rent','deposit','deposit_return','energy','other']) ? $data['payment_type'] : 'rent';
            if (!array_key_exists('approved_at', $data)) $data['approved_at'] = date('Y-m-d H:i:s');
            $amt = (float)($data['amount'] ?? 0);
            if ($amt === 0.0) jsonErr('Zadejte částku platby.');
            $paymentRequestEntityId = isset($b['payment_request_id']) ? (int)$b['payment_request_id'] : 0;
            $newId = softInsert($table, $data);
            if ($paymentRequestEntityId > 0) {
                $prRow = findActiveByEntityId('payment_requests', $paymentRequestEntityId);
                if (!$prRow) {
                    $st = db()->prepare("SELECT * FROM payment_requests WHERE id = ? AND valid_to IS NULL");
                    $st->execute([$paymentRequestEntityId]);
                    $prRow = $st->fetch(PDO::FETCH_ASSOC) ?: null;
                }
                if ($prRow) {
                    $paidAt = !empty($data['payment_date']) ? substr($data['payment_date'], 0, 10) : date('Y-m-d');
                    $paymentRow = findActive('payments', $newId);
                    $paymentEntityId = $paymentRow ? (int)($paymentRow['payments_id'] ?? $paymentRow['id']) : $newId;
                    softUpdate('payment_requests', (int)$prRow['id'], ['paid_at' => $paidAt, 'payments_id' => $paymentEntityId]);
                    // Křížová aktualizace: u vrácení kauce nastavíme ve smlouvě datum vrácení kauce
                    if (($prRow['type'] ?? '') === 'deposit_return') {
                        $contractRow = findActiveByEntityId('contracts', (int)$prRow['contracts_id']);
                        if ($contractRow && (empty($contractRow['deposit_return_date']) || $contractRow['deposit_return_date'] === null)) {
                            softUpdate('contracts', (int)$contractRow['id'], ['deposit_return_date' => $paidAt]);
                        }
                    }
                }
            }
            jsonOk(findActive($table, $newId), 201);
        } elseif ($table === 'payment_requests') {
            $data['type'] = in_array($data['type'] ?? 'energy', ['energy', 'settlement', 'other', 'deposit', 'deposit_return']) ? $data['type'] : 'energy';
            $data['amount'] = (float)($data['amount'] ?? 0);
            if ($data['amount'] === 0.0) jsonErr('Zadejte částku (kladnou = příjem, zápornou = výdej).');
            $newId = softInsert($table, $data);
            jsonOk(findActive($table, $newId), 201);
        } elseif ($table === 'contracts') {
            $depositAmount = isset($data['deposit_amount']) ? (float)$data['deposit_amount'] : 0;
            $newId = softInsert($table, $data);
            $newContract = findActive($table, $newId);
            $contractsId = (int)($newContract['contracts_id'] ?? $newContract['id']);
            if ($depositAmount > 0 && $contractsId > 0) {
                softInsert('payment_requests', [
                    'contracts_id' => $contractsId,
                    'amount'       => $depositAmount,
                    'type'         => 'deposit',
                    'note'         => 'Kauce',
                ]);
            }
            jsonOk(findActive($table, $newId), 201);
        } elseif ($table === 'bank_accounts') {
            if (isset($data['fio_token']) && trim((string)$data['fio_token']) === '') unset($data['fio_token']);
            if (isset($data['is_primary']) && (int)$data['is_primary'] === 1) {
                db()->prepare("UPDATE bank_accounts SET is_primary=0 WHERE valid_to IS NULL")->execute();
            }
            $data['is_primary'] = isset($data['is_primary']) ? (int)$data['is_primary'] : 0;
            $data['sort_order'] = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
            $newId = softInsert($table, $data);
            jsonOk(maskBankAccountFioToken(findActive($table, $newId)), 201);
        } else {
            $newId = softInsert($table, $data);
            jsonOk(findActive($table, $newId), 201);
        }
    }

    // Platby: hromadná úprava dat/method/account pro celou dávku (+ volitelně částka pro jeden záznam)
    if ($table === 'payments' && $action === 'editBatch') {
        $batchId = trim($b['payment_batch_id'] ?? '');
        if ($batchId === '') jsonErr('Chybí payment_batch_id.');
        $paymentDate = $b['payment_date'] ?? '';
        $e = validateDateField($paymentDate, 'Datum platby');
        if ($e) jsonErr($e);
        $paymentMethod = in_array($b['payment_method'] ?? '', ['account','cash']) ? $b['payment_method'] : null;
        $bankAccountsId = ($paymentMethod === 'account' && isset($b['bank_accounts_id'])) ? (int)$b['bank_accounts_id'] : null;
        if ($paymentMethod === 'account' && (!$bankAccountsId || $bankAccountsId <= 0)) jsonErr('Vyberte bankovní účet.');
        $amountOverrideEntityId = isset($b['amount_override_id']) ? (int)$b['amount_override_id'] : 0;
        $amountOverrideValue = isset($b['amount_override_value']) ? (float)$b['amount_override_value'] : null;
        $amountOverrideRowId = null;
        if ($amountOverrideEntityId > 0) {
            $overrideRow = findActiveByEntityId('payments', $amountOverrideEntityId);
            if ($overrideRow) $amountOverrideRowId = (int)$overrideRow['id'];
        }

        $s = db()->prepare("SELECT id FROM payments WHERE payment_batch_id=? AND valid_to IS NULL");
        $s->execute([$batchId]);
        $ids = array_column($s->fetchAll(), 'id');
        $paymentType = in_array($b['payment_type'] ?? 'rent', ['rent','deposit','deposit_return','energy','other']) ? $b['payment_type'] : 'rent';
        $baseData = ['payment_date' => $paymentDate, 'payment_method' => $paymentMethod, 'bank_accounts_id' => $bankAccountsId, 'payment_type' => $paymentType];
        foreach ($ids as $pid) {
            $updateData = $baseData;
            if ($amountOverrideRowId !== null && (int)$pid === $amountOverrideRowId && $amountOverrideValue !== null) {
                $updateData['amount'] = $amountOverrideValue;
            }
            softUpdate($table, (int)$pid, $updateData);
        }
        jsonOk(['updated' => count($ids)]);
    }

    if ($action === 'edit') {
        $entityId = (int)($b['id'] ?? 0);
        if (!$entityId) jsonErr('Chybí ID.');

        if ($table === 'payment_imports') {
            $rowId = $entityId;
            $s = db()->prepare('SELECT * FROM payment_imports WHERE id = ? AND valid_to IS NULL');
            $s->execute([$rowId]);
            $row = $s->fetch(PDO::FETCH_ASSOC);
            if (!$row) jsonErr('Záznam neexistuje.', 404);
            $allowed = ['contracts_id', 'period_year', 'period_month', 'period_year_to', 'period_month_to', 'payment_type'];
            $upd = [];
            foreach ($allowed as $f) {
                if (!array_key_exists($f, $data)) continue;
                if ($f === 'payment_type') {
                    $v = $data[$f] ?? null;
                    $upd[$f] = in_array($v, ['rent', 'deposit', 'deposit_return', 'energy', 'other']) ? $v : null;
                } else {
                    $v = $data[$f];
                    $upd[$f] = ($v === null || $v === '') ? null : (int)$v;
                }
            }
            if (!empty($upd)) {
                $newId = softUpdate('payment_imports', $rowId, $upd);
                $out = findActive('payment_imports', $newId);
                jsonOk($out);
            } else {
                jsonOk($row);
            }
        }

        $row = findActiveByEntityId($table, $entityId);
        if (!$row) jsonErr('Záznam neexistuje.', 404);
        $rowId = (int)$row['id'];
        foreach ($POSITIVE_ID_FIELDS[$table] ?? [] as $f) {
            if (array_key_exists($f, $data) && (int)($data[$f] ?? 0) <= 0) {
                $label = $FIELD_LABELS[$table][$f] ?? $f;
                jsonErr("Vyplňte pole: $label");
            }
        }
        if ($table === 'bank_accounts') {
            if (isset($data['fio_token']) && trim((string)$data['fio_token']) === '') unset($data['fio_token']);
            if (isset($data['is_primary']) && (int)$data['is_primary'] === 1) {
                db()->prepare("UPDATE bank_accounts SET is_primary=0 WHERE valid_to IS NULL")->execute();
            }
            $newId = softUpdate($table, $rowId, $data);
            $out = findActive($table, $newId);
            jsonOk(maskBankAccountFioToken($out));
        } elseif ($table === 'contract_rent_changes') {
            $newId = softUpdate($table, $rowId, [
                'amount'        => (float)$data['amount'],
                'effective_from'=> $data['effective_from'],
            ]);
            jsonOk(findActive($table, $newId));
        } elseif ($table === 'tenant_bank_accounts') {
            $acc = isset($data['account_number']) ? trim((string)$data['account_number']) : '';
            if ($acc === '') jsonErr('Vyplňte číslo účtu.');
            $newId = softUpdate($table, $rowId, [
                'tenants_id'     => (int)($data['tenants_id'] ?? $row['tenants_id']),
                'account_number' => $acc,
            ]);
            jsonOk(findActive($table, $newId));
        } elseif ($table === 'contracts') {
            $newId = softUpdate($table, $rowId, $data);
            $contractEnd = $data['contract_end'] ?? null;
            $depositAmount = isset($data['deposit_amount']) ? (float)$data['deposit_amount'] : 0;
            $depositReturnDate = isset($data['deposit_return_date']) && $data['deposit_return_date'] !== '' ? trim($data['deposit_return_date']) : null;
            $hadDepositReturnDate = isset($row['deposit_return_date']) && $row['deposit_return_date'] !== '' && $row['deposit_return_date'] !== null;

            if ($contractEnd !== null && $contractEnd !== '' && $depositAmount > 0) {
                $st = db()->prepare("SELECT id FROM payment_requests WHERE contracts_id = ? AND type = 'deposit_return' AND valid_to IS NULL");
                $st->execute([$entityId]);
                if ($st->fetch() === false) {
                    $dueDate = date('Y-m-d', strtotime($contractEnd . ' +14 days'));
                    softInsert('payment_requests', [
                        'contracts_id' => $entityId,
                        'amount'      => -$depositAmount,
                        'type'        => 'deposit_return',
                        'note'        => 'Vrácení kauce',
                        'due_date'    => $dueDate,
                    ]);
                }
            }

            // Při vyplnění data vrácení kauce vytvořit platbu (záporná částka, typ Kauce) a provázat s požadavkem
            if ($depositReturnDate !== null && !$hadDepositReturnDate && $depositAmount > 0) {
                $ym = date_parse($depositReturnDate);
                $periodYear = $ym['year'] ?? (int)date('Y');
                $periodMonth = $ym['month'] ?? (int)date('n');
                if ($periodMonth < 1 || $periodMonth > 12) $periodMonth = (int)date('n');
                $st = db()->prepare("SELECT id FROM payments WHERE contracts_id = ? AND payment_type = 'deposit' AND amount < 0 AND payment_date = ? AND valid_to IS NULL");
                $st->execute([$entityId, $depositReturnDate]);
                if ($st->fetch() === false) {
                    $payId = softInsert('payments', [
                        'contracts_id'   => $entityId,
                        'period_year'    => $periodYear,
                        'period_month'   => $periodMonth,
                        'amount'         => -$depositAmount,
                        'payment_date'   => $depositReturnDate,
                        'payment_type'   => 'deposit',
                        'note'           => 'Vrácení kauce',
                        'payment_method' => null,
                        'bank_accounts_id' => null,
                    ]);
                    $paymentRow = findActive('payments', $payId);
                    $paymentEntityId = $paymentRow ? (int)($paymentRow['payments_id'] ?? $paymentRow['id']) : $payId;
                    $st2 = db()->prepare("SELECT id FROM payment_requests WHERE contracts_id = ? AND type = 'deposit_return' AND valid_to IS NULL");
                    $st2->execute([$entityId]);
                    $prRow = $st2->fetch(PDO::FETCH_ASSOC);
                    if ($prRow) {
                        softUpdate('payment_requests', (int)$prRow['id'], ['paid_at' => $depositReturnDate, 'payments_id' => $paymentEntityId]);
                    }
                }
            }

            jsonOk(findActive($table, $newId));
        } elseif ($table === 'payments') {
            $data['payment_type'] = in_array($data['payment_type'] ?? 'rent', ['rent','deposit','deposit_return','energy','other']) ? $data['payment_type'] : 'rent';
            $amt = isset($data['amount']) ? (float)$data['amount'] : null;
            if ($amt !== null && $amt === 0.0) jsonErr('Zadejte částku platby.');
            $newId = softUpdate($table, $rowId, $data);
            jsonOk(findActive($table, $newId));
        } else {
            $newId = softUpdate($table, $rowId, $data);
            jsonOk(findActive($table, $newId));
        }
    }

    // Platby: smazání celé dávky (všechny záznamy s daným payment_batch_id)
    if ($table === 'payments' && $action === 'deleteBatch') {
        $batchId = trim($b['payment_batch_id'] ?? '');
        if ($batchId === '') jsonErr('Chybí payment_batch_id.');
        $s = db()->prepare("SELECT id, payments_id FROM payments WHERE payment_batch_id=? AND valid_to IS NULL");
        $s->execute([$batchId]);
        $rows = $s->fetchAll();
        $unlink = db()->prepare("SELECT id FROM payment_requests WHERE payments_id = ? AND valid_to IS NULL");
        foreach ($rows as $pay) {
            $entityId = (int)($pay['payments_id'] ?? $pay['id']);
            $unlink->execute([$entityId]);
            foreach ($unlink->fetchAll() as $pr) {
                softUpdate('payment_requests', (int)$pr['id'], ['payments_id' => null, 'paid_at' => null]);
            }
            softDelete($table, (int)$pay['id']);
        }
        jsonOk(['deleted' => count($rows)]);
    }

    if ($action === 'delete') {
        $entityId = (int)($b['id'] ?? 0);
        if (!$entityId) jsonErr('Chybí ID.');
        if ($table === 'payment_imports') {
            $s = db()->prepare('SELECT id FROM payment_imports WHERE id = ? AND valid_to IS NULL');
            $s->execute([$entityId]);
            $r = $s->fetch(PDO::FETCH_ASSOC);
            if (!$r) jsonErr('Záznam neexistuje.', 404);
            softDelete('payment_imports', (int)$r['id']);
            jsonOk(['deleted' => $entityId]);
        }
        $row = findActiveByEntityId($table, $entityId);
        if (!$row) jsonErr('Záznam neexistuje.', 404);
        $rowId = (int)$row['id'];
        // Při mazání platby zrušit u propojených požadavků datum úhrady a vazbu
        if ($table === 'payments') {
            $st = db()->prepare("SELECT id FROM payment_requests WHERE payments_id = ? AND valid_to IS NULL");
            $st->execute([$entityId]);
            foreach ($st->fetchAll() as $pr) {
                softUpdate('payment_requests', (int)$pr['id'], ['payments_id' => null, 'paid_at' => null]);
            }
        }
        if ($table === 'contract_rent_changes') {
            softDelete($table, $rowId);
        } elseif ($table === 'bank_accounts') {
            softDelete($table, $rowId);
        } else {
            softDelete($table, $rowId);
        }
        jsonOk(['deleted'=>$entityId]);
    }

    jsonErr('Neznámá akce.');
}

jsonErr('Metoda nepodporovaná.', 405);
