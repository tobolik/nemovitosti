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
    'payments'   => ['contract_id','period_year','period_month','amount','payment_date','note'],
];

// Povinná pole při přidávání
$REQUIRED = [
    'properties' => ['name','address'],
    'tenants'    => ['name'],
    'contracts'  => ['property_id','tenant_id','contract_start','monthly_rent'],
    'payments'   => ['contract_id','period_year','period_month','amount','payment_date'],
];

$table = $_GET['table'] ?? body()['table'] ?? '';
if (!isset($FIELDS[$table])) jsonErr('Neznámá tabulka.');

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
        $cid = isset($_GET['contract_id']) ? (int)$_GET['contract_id'] : 0;
        $sql = "
            SELECT pay.*, c.monthly_rent, p.name AS property_name, t.name AS tenant_name
            FROM payments pay
            JOIN contracts  c ON c.id = pay.contract_id AND c.valid_to IS NULL
            JOIN properties p ON p.id = c.property_id   AND p.valid_to IS NULL
            JOIN tenants    t ON t.id = c.tenant_id     AND t.valid_to IS NULL
            WHERE pay.valid_to IS NULL";
        $params = [];
        if ($cid > 0) { $sql .= " AND pay.contract_id=?"; $params[] = $cid; }
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

    if ($action === 'add') {
        foreach ($REQUIRED[$table] as $r) {
            if (empty($data[$r]) && $data[$r] !== '0' && $data[$r] !== 0)
                jsonErr("Pole '$r' je povinné.");
        }
        $newId = softInsert($table, $data);
        jsonOk(findActive($table, $newId), 201);
    }

    if ($action === 'edit') {
        $id = (int)($b['id'] ?? 0);
        if (!$id) jsonErr('Chybí ID.');
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
