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
    'properties' => ['name','address','size_m2','purchase_price','purchase_date','purchase_contract_url','type','note'],
    'tenants'    => ['name','type','email','phone','address','ic','dic','note'],
    'contracts'  => ['property_id','tenant_id','contract_start','contract_end','monthly_rent','contract_url','note'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date','note','payment_batch_id','payment_method','account_number'],
    'bank_accounts' => ['name','account_number','is_primary','sort_order'],
];

// Povinná pole při přidávání
$REQUIRED = [
    'properties' => ['name','address'],
    'tenants'    => ['name'],
    'contracts'  => ['property_id','tenant_id','contract_start','monthly_rent'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date'],
    'bank_accounts' => ['name','account_number'],
];

// Lidsky čitelné názvy polí pro chybové hlášky
$FIELD_LABELS = [
    'properties' => ['name'=>'Název','address'=>'Adresa'],
    'tenants'    => ['name'=>'Jméno / Název'],
    'contracts'  => ['property_id'=>'Nemovitost','tenant_id'=>'Nájemník','contract_start'=>'Začátek smlouvy','contract_end'=>'Konec smlouvy','monthly_rent'=>'Měsíční nájemné','note'=>'Poznámka'],
    'payments'   => ['contracts_id'=>'Smlouva','period_year'=>'Rok','period_month'=>'Měsíc','amount'=>'Částka','payment_date'=>'Datum platby','note'=>'Poznámka','payment_method'=>'Způsob platby','account_number'=>'Číslo účtu'],
    'bank_accounts' => ['name'=>'Název','account_number'=>'Číslo účtu'],
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

    // Jednotlivý záznam
    if ($id > 0) {
        $row = findActive($table, $id);
        if (!$row) jsonErr('Záznam neexistuje.', 404);
        jsonOk($row);
    }

    // bank_accounts: soft-update, vlastní řazení (primární první)
    if ($table === 'bank_accounts') {
        jsonOk(db()->query("SELECT * FROM bank_accounts WHERE valid_to IS NULL ORDER BY is_primary DESC, sort_order ASC, id ASC")->fetchAll());
    }

    // Joined queries pro přehledněji zobrazené lists
    if ($table === 'contracts') {
        jsonOk(db()->query("
            SELECT c.*, p.name AS property_name, t.name AS tenant_name
            FROM contracts c
            JOIN properties p ON p.id = c.property_id AND p.valid_to IS NULL
            JOIN tenants   t ON t.id = c.tenant_id   AND t.valid_to IS NULL
            WHERE c.valid_to IS NULL
            ORDER BY c.contract_start DESC
        ")->fetchAll());
    }

    if ($table === 'payments') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
        $sql = "
            SELECT pay.*, c.monthly_rent, p.name AS property_name, t.name AS tenant_name
            FROM payments pay
            JOIN contracts  c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
            JOIN properties p ON p.id = c.property_id   AND p.valid_to IS NULL
            JOIN tenants    t ON t.id = c.tenant_id     AND t.valid_to IS NULL
            WHERE pay.valid_to IS NULL";
        $params = [];
        if ($cid > 0) {
            $sql .= " AND pay.contracts_id=?";
            $params[] = $cid;
        }
        $sql .= " ORDER BY pay.period_year DESC, pay.period_month DESC";
        $s = db()->prepare($sql); $s->execute($params);
        jsonOk($s->fetchAll());
    }

    // Default plain list
    jsonOk(findAllActive($table, 'name ASC'));
}

// ── POST ────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    $b      = body();
    $action = $b['action'] ?? '';

    // Vybereme jen whitelisted pole
    $data = [];
    foreach ($FIELDS[$table] as $f) {
        if (array_key_exists($f, $b)) $data[$f] = $b[$f];
    }

    // contract_end & note mohou být prázdné → null
    if ($table === 'contracts' && ($data['contract_end']??'') === '') $data['contract_end'] = null;

    // Validace dat – neplatné datum nesmí být tiše převedeno na null
    if ($table === 'contracts') {
        $e = validateDateField($data['contract_start'] ?? null, 'Začátek smlouvy');
        if ($e) jsonErr($e);
        $e = validateDateField($data['contract_end'] ?? null, 'Konec smlouvy');
        if ($e) jsonErr($e);
    }
    if ($table === 'properties' && isset($data['purchase_date']) && $data['purchase_date'] !== '') {
        $e = validateDateField($data['purchase_date'], 'Datum koupě');
        if ($e) jsonErr($e);
    }
    if ($table === 'payments' && isset($data['payment_date']) && $data['payment_date'] !== '') {
        $e = validateDateField($data['payment_date'], 'Datum platby');
        if ($e) jsonErr($e);
    }

    // Pole, která musí být kladné ID (> 0) – 0 znamená „nevybráno“
    $POSITIVE_ID_FIELDS = [
        'contracts' => ['property_id', 'tenant_id'],
        'payments'  => ['contracts_id'],
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
            $accountNumber = trim($data['account_number'] ?? '') ?: null;
            $ids = [];
            for ($y = $yFrom, $m = $mFrom; $y < $yTo || ($y === $yTo && $m <= $mTo); ) {
                $row = [
                    'contracts_id'     => $data['contracts_id'],
                    'period_year'      => $y,
                    'period_month'     => $m,
                    'amount'           => $amtPerMonth,
                    'payment_date'     => $paymentDate,
                    'note'             => $data['note'] ?? null,
                    'payment_batch_id' => $batchId,
                    'payment_method'   => $paymentMethod,
                    'account_number'   => $accountNumber,
                ];
                $ids[] = softInsert($table, $row);
                if (++$m > 12) { $m = 1; $y++; }
            }
            jsonOk(['ids' => $ids, 'count' => count($ids)], 201);
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
        $accountNumber = isset($b['account_number']) ? (trim($b['account_number']) ?: null) : null;
        $amountOverrideId = isset($b['amount_override_id']) ? (int)$b['amount_override_id'] : 0;
        $amountOverrideValue = isset($b['amount_override_value']) ? (float)$b['amount_override_value'] : null;

        $s = db()->prepare("SELECT id FROM payments WHERE payment_batch_id=? AND valid_to IS NULL");
        $s->execute([$batchId]);
        $ids = array_column($s->fetchAll(), 'id');
        $baseData = ['payment_date' => $paymentDate, 'payment_method' => $paymentMethod, 'account_number' => $accountNumber];
        foreach ($ids as $pid) {
            $updateData = $baseData;
            if ($amountOverrideId > 0 && (int)$pid === $amountOverrideId && $amountOverrideValue !== null) {
                $updateData['amount'] = $amountOverrideValue;
            }
            softUpdate($table, (int)$pid, $updateData);
        }
        jsonOk(['updated' => count($ids)]);
    }

    if ($action === 'edit') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('Chybí ID.');
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
            $newId = softUpdate($table, $id, $data);
            jsonOk(findActive($table, $newId));
        } else {
            $newId = softUpdate($table, $id, $data);
            jsonOk(findActive($table, $newId));
        }
    }

    if ($action === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('Chybí ID.');
        if ($table === 'bank_accounts') {
            softDelete($table, $id);
        } else {
            softDelete($table, $id);
        }
        jsonOk(['deleted'=>$id]);
    }

    jsonErr('Neznámá akce.');
}

jsonErr('Metoda nepodporovaná.', 405);
