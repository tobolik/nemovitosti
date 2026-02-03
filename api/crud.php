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
    'properties' => ['name','address','size_m2','purchase_price','purchase_date','purchase_contract_url','valuation_date','valuation_amount','type','note'],
    'tenants'    => ['name','type','birth_date','email','phone','address','ic','dic','note'],
    'contracts'  => ['properties_id','tenants_id','contract_start','contract_end','monthly_rent','first_month_rent','contract_url','deposit_amount','deposit_paid_date','deposit_return_date','note'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date','note','payment_batch_id','payment_method','bank_accounts_id','payment_type'],
    'bank_accounts' => ['name','account_number','is_primary','sort_order'],
    'contract_rent_changes' => ['contracts_id','amount','effective_from'],
    'payment_requests' => ['contracts_id','amount','type','note','due_date'],
];

// Seznam nemovitostí včetně ročního nájmu a ROI (když je zadána odhadní cena)
if ($table === 'properties' && $id <= 0) {
    $rows = db()->query("
        SELECT p.*,
            (SELECT COALESCE(SUM(c.monthly_rent), 0) * 12
             FROM contracts c
             WHERE (c.properties_id = p.properties_id OR c.properties_id = p.id)
               AND c.valid_to IS NULL
               AND (c.contract_end IS NULL OR c.contract_end >= CURDATE())
            ) AS annual_rent
        FROM properties p
        WHERE p.valid_to IS NULL
        ORDER BY p.name ASC
    ")->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as &$r) {
        $r['annual_rent'] = (float)($r['annual_rent'] ?? 0);
        $val = (float)($r['valuation_amount'] ?? 0);
        $r['roi_pct'] = $val > 0 ? round($r['annual_rent'] / $val * 100, 1) : null;
    }
    unset($r);
    jsonOk($rows);
}

// Povinná pole při přidávání
$REQUIRED = [
    'properties' => ['name','address'],
    'tenants'    => ['name'],
    'contracts'  => ['properties_id','tenants_id','contract_start','monthly_rent'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date'],
    'bank_accounts' => ['name','account_number'],
    'contract_rent_changes' => ['contracts_id','amount','effective_from'],
    'payment_requests' => ['contracts_id','amount','type','note'],
];

// Lidsky čitelné názvy polí pro chybové hlášky
$FIELD_LABELS = [
    'properties' => ['name'=>'Název','address'=>'Adresa','valuation_date'=>'K odhadu ke dni','valuation_amount'=>'Odhadní cena'],
    'tenants'    => ['name'=>'Jméno / Název','birth_date'=>'Datum narození'],
    'contracts'  => ['properties_id'=>'Nemovitost','tenants_id'=>'Nájemník','contract_start'=>'Začátek smlouvy','contract_end'=>'Konec smlouvy','monthly_rent'=>'Měsíční nájemné','first_month_rent'=>'Nájem za první měsíc (poměrná část)','deposit_amount'=>'Kauce','deposit_paid_date'=>'Datum přijetí kauce','deposit_return_date'=>'Datum vrácení kauce','note'=>'Poznámka'],
    'payments'   => ['contracts_id'=>'Smlouva','period_year'=>'Rok','period_month'=>'Měsíc','amount'=>'Částka','payment_date'=>'Datum platby','note'=>'Poznámka','payment_method'=>'Způsob platby','bank_accounts_id'=>'Bankovní účet','payment_type'=>'Typ platby'],
    'bank_accounts' => ['name'=>'Název','account_number'=>'Číslo účtu'],
    'contract_rent_changes' => ['contracts_id'=>'Smlouva','amount'=>'Částka','effective_from'=>'Platné od'],
    'payment_requests' => ['contracts_id'=>'Smlouva','amount'=>'Částka','type'=>'Typ','note'=>'Poznámka','due_date'=>'Splatnost'],
];

$table = $_GET['table'] ?? body()['table'] ?? '';
if (!isset($FIELDS[$table])) jsonErr('Neznámá tabulka.');

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

    // Jednotlivý záznam – parametr id = entity_id (properties_id, contracts_id, …)
    if ($id > 0) {
        $row = findActiveByEntityId($table, $id);
        if (!$row) jsonErr('Záznam neexistuje.', 404);
        jsonOk($row);
    }

    // bank_accounts: soft-update, vlastní řazení (primární první)
    if ($table === 'bank_accounts') {
        jsonOk(db()->query("SELECT * FROM bank_accounts WHERE valid_to IS NULL ORDER BY is_primary DESC, sort_order ASC, id ASC")->fetchAll());
    }

    // Joined queries pro přehledněji zobrazené lists
    // properties_id, tenants_id = odkazy na entity_id (vždy jen entity_id, nikdy fyzické id)
    if ($table === 'contracts') {
        jsonOk(db()->query("
            SELECT c.*, p.name AS property_name, t.name AS tenant_name
            FROM contracts c
            JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
            JOIN tenants   t ON t.tenants_id = c.tenants_id   AND t.valid_to IS NULL
            WHERE c.valid_to IS NULL
            ORDER BY c.contract_start DESC
        ")->fetchAll());
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

    if ($table === 'payment_requests') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
        $unpaidOnly = isset($_GET['unpaid']) && $_GET['unpaid'] !== '0' && $_GET['unpaid'] !== '';
        $sql = "SELECT * FROM payment_requests WHERE valid_to IS NULL";
        $params = [];
        if ($cid > 0) {
            $sql .= " AND contracts_id=?";
            $params[] = $cid;
        }
        if ($unpaidOnly) {
            $sql .= " AND paid_at IS NULL";
        }
        $sql .= " ORDER BY id ASC";
        $s = db()->prepare($sql);
        $s->execute($params);
        jsonOk($s->fetchAll());
    }

    if ($table === 'payments') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
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

    // Vybereme jen whitelisted pole
    $data = [];
    foreach ($FIELDS[$table] as $f) {
        if (array_key_exists($f, $b)) $data[$f] = $b[$f];
    }

    // contract_end, deposit_* & note mohou být prázdné → null
    if ($table === 'contracts' && ($data['contract_end']??'') === '') $data['contract_end'] = null;
    if ($table === 'properties' && ($data['valuation_date']??'') === '') $data['valuation_date'] = null;
    if ($table === 'properties' && ($data['valuation_amount']??'') === '') $data['valuation_amount'] = null;
    if ($table === 'contracts' && ($data['deposit_amount']??'') === '') $data['deposit_amount'] = null;
    if ($table === 'contracts' && ($data['deposit_paid_date']??'') === '') $data['deposit_paid_date'] = null;
    if ($table === 'contracts' && ($data['deposit_return_date']??'') === '') $data['deposit_return_date'] = null;
    if ($table === 'contracts' && ($data['first_month_rent']??'') === '') $data['first_month_rent'] = null;
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
        'payment_requests' => ['contracts_id'],
    ];

    if ($action === 'add') {
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
            if ($totalAmt <= 0) jsonErr('Zadejte kladnou částku platby.');
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
        } elseif ($table === 'payments') {
            $pm = in_array($data['payment_method'] ?? '', ['account','cash']) ? $data['payment_method'] : 'account';
            $baId = isset($data['bank_accounts_id']) ? (int)$data['bank_accounts_id'] : 0;
            if ($pm === 'account' && ($baId <= 0)) jsonErr('Vyberte bankovní účet.');
            $data['bank_accounts_id'] = $pm === 'account' ? $baId : null;
            $data['payment_type'] = in_array($data['payment_type'] ?? 'rent', ['rent','deposit','deposit_return','energy','other']) ? $data['payment_type'] : 'rent';
            $amt = (float)($data['amount'] ?? 0);
            $isDepositOrReturn = in_array($data['payment_type'], ['deposit', 'deposit_return'], true);
            if ($amt === 0.0) jsonErr('Zadejte částku platby.');
            if (!$isDepositOrReturn && $amt < 0) jsonErr('U tohoto typu platby zadejte kladnou částku.');
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
            if (isset($data['is_primary']) && (int)$data['is_primary'] === 1) {
                db()->prepare("UPDATE bank_accounts SET is_primary=0 WHERE valid_to IS NULL")->execute();
            }
            $data['is_primary'] = isset($data['is_primary']) ? (int)$data['is_primary'] : 0;
            $data['sort_order'] = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
            $newId = softInsert($table, $data);
            jsonOk(findActive($table, $newId), 201);
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
        if ($amountOverrideValue !== null && $amountOverrideValue < 0 && !in_array($paymentType, ['deposit', 'deposit_return'], true)) {
            jsonErr('Záporná částka je povolena jen u typu Kauce / Vrácení kauce.');
        }
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
            if (isset($data['is_primary']) && (int)$data['is_primary'] === 1) {
                db()->prepare("UPDATE bank_accounts SET is_primary=0 WHERE valid_to IS NULL")->execute();
            }
            $newId = softUpdate($table, $rowId, $data);
            jsonOk(findActive($table, $newId));
        } elseif ($table === 'contract_rent_changes') {
            $newId = softUpdate($table, $rowId, [
                'amount'        => (float)$data['amount'],
                'effective_from'=> $data['effective_from'],
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
            if ($amt !== null) {
                $isDepositOrReturn = in_array($data['payment_type'], ['deposit', 'deposit_return'], true);
                if ($amt === 0.0) jsonErr('Zadejte částku platby.');
                if (!$isDepositOrReturn && $amt < 0) jsonErr('U tohoto typu platby zadejte kladnou částku.');
            }
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
