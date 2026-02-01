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
    'properties' => ['name','address','size_m2','purchase_price','purchase_date','type','note'],
    'tenants'    => ['name','type','email','phone','address','ic','dic','note'],
    'contracts'  => ['property_id','tenant_id','contract_start','contract_end','monthly_rent','note'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date','note'],
];

// Povinná pole při přidávání
$REQUIRED = [
    'properties' => ['name','address'],
    'tenants'    => ['name'],
    'contracts'  => ['property_id','tenant_id','contract_start','monthly_rent'],
    'payments'   => ['contracts_id','period_year','period_month','amount','payment_date'],
];

// Lidsky čitelné názvy polí pro chybové hlášky
$FIELD_LABELS = [
    'properties' => ['name'=>'Název','address'=>'Adresa'],
    'tenants'    => ['name'=>'Jméno / Název'],
    'contracts'  => ['property_id'=>'Nemovitost','tenant_id'=>'Nájemník','contract_start'=>'Začátek smlouvy','contract_end'=>'Konec smlouvy','monthly_rent'=>'Měsíční nájemné','note'=>'Poznámka'],
    'payments'   => ['contracts_id'=>'Smlouva','period_year'=>'Rok','period_month'=>'Měsíc','amount'=>'Částka','payment_date'=>'Datum platby','note'=>'Poznámka'],
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
        $cid = isset($_GET['contracts_id']) ? (int)$_GET['contracts_id'] : (isset($_GET['contract_id']) ? (int)$_GET['contract_id'] : 0);
        $payContractCol = paymentsContractCol();
        $sql = "
            SELECT pay.*, c.monthly_rent, p.name AS property_name, t.name AS tenant_name
            FROM payments pay
            JOIN contracts  c ON (c.contracts_id = pay.$payContractCol OR (c.contracts_id IS NULL AND c.id = pay.$payContractCol)) AND c.valid_to IS NULL
            JOIN properties p ON p.id = c.property_id   AND p.valid_to IS NULL
            JOIN tenants    t ON t.id = c.tenant_id     AND t.valid_to IS NULL
            WHERE pay.valid_to IS NULL";
        $params = [];
        if ($cid > 0) {
            $sql .= " AND pay.$payContractCol=?";
            $params[] = $cid;
        }
        $sql .= " ORDER BY pay.period_year DESC, pay.period_month DESC";
        $s = db()->prepare($sql); $s->execute($params);
        $rows = $s->fetchAll();
        if ($payContractCol === 'contract_id') {
            foreach ($rows as &$r) { $r['contracts_id'] = $r['contract_id'] ?? null; }
            unset($r);
        }
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
        if ($table === 'payments' && isset($data['contracts_id']) && paymentsContractCol() === 'contract_id') {
            $data['contract_id'] = $data['contracts_id'];
            unset($data['contracts_id']);
        }
        $newId = softInsert($table, $data);
        jsonOk(findActive($table, $newId), 201);
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
        if ($table === 'payments' && isset($data['contracts_id']) && paymentsContractCol() === 'contract_id') {
            $data['contract_id'] = $data['contracts_id'];
            unset($data['contracts_id']);
        }
        $newId = softUpdate($table, $id, $data);
        jsonOk(findActive($table, $newId));
    }

    if ($action === 'delete') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('Chybí ID.');
        softDelete($table, $id);
        jsonOk(['deleted'=>$id]);
    }

    jsonErr('Neznámá akce.');
}

jsonErr('Metoda nepodporovaná.', 405);
