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
    'tenants'    => ['name','type','birth_date','email','phone','address','ic','dic','note'],
    'contracts'  => ['properties_id','tenants_id','contract_start','contract_end','monthly_rent','first_month_rent','contract_url','deposit_amount','deposit_paid_date','deposit_return_date','note'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date','note','payment_batch_id','payment_method','bank_accounts_id','payment_type'],
    'bank_accounts' => ['name','account_number','is_primary','sort_order'],
    'contract_rent_changes' => ['contracts_id','amount','effective_from'],
];

// Povinná pole při přidávání
$REQUIRED = [
    'properties' => ['name','address'],
    'tenants'    => ['name'],
    'contracts'  => ['properties_id','tenants_id','contract_start','monthly_rent'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date'],
    'bank_accounts' => ['name','account_number'],
    'contract_rent_changes' => ['contracts_id','amount','effective_from'],
];

// Lidsky čitelné názvy polí pro chybové hlášky
$FIELD_LABELS = [
    'properties' => ['name'=>'Název','address'=>'Adresa'],
    'tenants'    => ['name'=>'Jméno / Název','birth_date'=>'Datum narození'],
    'contracts'  => ['properties_id'=>'Nemovitost','tenants_id'=>'Nájemník','contract_start'=>'Začátek smlouvy','contract_end'=>'Konec smlouvy','monthly_rent'=>'Měsíční nájemné','first_month_rent'=>'Nájem za první měsíc (poměrná část)','deposit_amount'=>'Kauce','deposit_paid_date'=>'Datum přijetí kauce','deposit_return_date'=>'Datum vrácení kauce','note'=>'Poznámka'],
    'payments'   => ['contracts_id'=>'Smlouva','period_year'=>'Rok','period_month'=>'Měsíc','amount'=>'Částka','payment_date'=>'Datum platby','note'=>'Poznámka','payment_method'=>'Způsob platby','bank_accounts_id'=>'Bankovní účet','payment_type'=>'Typ platby'],
    'bank_accounts' => ['name'=>'Název','account_number'=>'Číslo účtu'],
    'contract_rent_changes' => ['contracts_id'=>'Smlouva','amount'=>'Částka','effective_from'=>'Platné od'],
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

    if ($table === 'payments') {
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : 0;
        // properties_id, tenants_id = odkazy na entity_id; bank_accounts_id → account_number pro zobrazení
        $sql = "
            SELECT pay.*, c.monthly_rent, p.name AS property_name, t.name AS tenant_name,
                   ba.account_number AS account_number
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

    // contract_end, deposit_* & note mohou být prázdné → null
    if ($table === 'contracts' && ($data['contract_end']??'') === '') $data['contract_end'] = null;
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
    }
    if ($table === 'contract_rent_changes' && isset($data['effective_from']) && $data['effective_from'] !== '') {
        $e = validateDateField($data['effective_from'], 'Platné od');
        if ($e) jsonErr($e);
    }
    if ($table === 'properties' && isset($data['purchase_date']) && $data['purchase_date'] !== '') {
        $e = validateDateField($data['purchase_date'], 'Datum koupě');
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

    // Pole, která musí být kladné ID (> 0) – 0 znamená „nevybráno“
    $POSITIVE_ID_FIELDS = [
        'contracts' => ['properties_id', 'tenants_id'],
        'payments'  => ['contracts_id'],
        'contract_rent_changes' => ['contracts_id'],
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
            $data['payment_type'] = in_array($data['payment_type'] ?? 'rent', ['rent','deposit','energy','other']) ? $data['payment_type'] : 'rent';
            $newId = softInsert($table, $data);
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
        $amountOverrideId = isset($b['amount_override_id']) ? (int)$b['amount_override_id'] : 0;
        $amountOverrideValue = isset($b['amount_override_value']) ? (float)$b['amount_override_value'] : null;

        $s = db()->prepare("SELECT id FROM payments WHERE payment_batch_id=? AND valid_to IS NULL");
        $s->execute([$batchId]);
        $ids = array_column($s->fetchAll(), 'id');
        $paymentType = in_array($b['payment_type'] ?? 'rent', ['rent','deposit','energy','other']) ? $b['payment_type'] : 'rent';
        $baseData = ['payment_date' => $paymentDate, 'payment_method' => $paymentMethod, 'bank_accounts_id' => $bankAccountsId, 'payment_type' => $paymentType];
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
        } elseif ($table === 'contract_rent_changes') {
            $newId = softUpdate($table, $id, [
                'amount'        => (float)$data['amount'],
                'effective_from'=> $data['effective_from'],
            ]);
            jsonOk(findActive($table, $newId));
        } else {
            $newId = softUpdate($table, $id, $data);
            jsonOk(findActive($table, $newId));
        }
    }

    // Platby: smazání celé dávky (všechny záznamy s daným payment_batch_id)
    if ($table === 'payments' && $action === 'deleteBatch') {
        $batchId = trim($b['payment_batch_id'] ?? '');
        if ($batchId === '') jsonErr('Chybí payment_batch_id.');
        $s = db()->prepare("SELECT id FROM payments WHERE payment_batch_id=? AND valid_to IS NULL");
        $s->execute([$batchId]);
        $ids = array_column($s->fetchAll(), 'id');
        foreach ($ids as $pid) {
            softDelete($table, (int)$pid);
        }
        jsonOk(['deleted' => count($ids)]);
    }

    if ($action === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('Chybí ID.');
        if ($table === 'contract_rent_changes') {
            softDelete($table, $id);
        } elseif ($table === 'bank_accounts') {
            softDelete($table, $id);
        } else {
            softDelete($table, $id);
        }
        jsonOk(['deleted'=>$id]);
    }

    jsonErr('Neznámá akce.');
}

jsonErr('Metoda nepodporovaná.', 405);
