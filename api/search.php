<?php
// api/search.php – globální vyhledávání (nájemníci, nemovitosti, smlouvy)
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    header('Allow: GET');
    jsonErr('Metoda nepodporovaná.', 405);
}

$raw = isset($_GET['q']) ? trim((string)$_GET['q']) : '';
if ($raw === '') {
    jsonOk(['tenants' => [], 'properties' => [], 'contracts' => []]);
}

// LIKE bezpečné: escape % a _
$term = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $raw);
$like = '%' . $term . '%';
$limit = 12;

$tenants = [];
$st = db()->prepare("
    SELECT id, tenants_id, name, email, phone, address, ic, dic, note
    FROM tenants
    WHERE valid_to IS NULL
      AND (name LIKE :q OR COALESCE(email,'') LIKE :q OR COALESCE(phone,'') LIKE :q
           OR COALESCE(address,'') LIKE :q OR COALESCE(ic,'') LIKE :q OR COALESCE(dic,'') LIKE :q OR COALESCE(note,'') LIKE :q)
    ORDER BY name ASC
    LIMIT " . (int)$limit
);
$st->bindValue(':q', $like, PDO::PARAM_STR);
$st->execute();
foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $tenants[] = [
        'id'   => (int)($r['tenants_id'] ?? $r['id']),
        'name' => $r['name'],
        'phone' => $r['phone'] ?? '',
        'email' => $r['email'] ?? '',
        'address' => $r['address'] ?? '',
    ];
}

$properties = [];
$st = db()->prepare("
    SELECT id, properties_id, name, address, note
    FROM properties
    WHERE valid_to IS NULL
      AND (name LIKE :q OR COALESCE(address,'') LIKE :q OR COALESCE(note,'') LIKE :q)
    ORDER BY name ASC
    LIMIT " . (int)$limit
);
$st->bindValue(':q', $like, PDO::PARAM_STR);
$st->execute();
foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $properties[] = [
        'id'      => (int)($r['properties_id'] ?? $r['id']),
        'name'    => $r['name'],
        'address' => $r['address'] ?? '',
    ];
}

$contracts = [];
$st = db()->prepare("
    SELECT c.id, c.contracts_id, c.contract_start, c.contract_end, c.monthly_rent,
           p.name AS property_name, p.properties_id AS property_entity_id,
           t.name AS tenant_name, t.tenants_id AS tenant_entity_id
    FROM contracts c
    JOIN properties p ON p.properties_id = c.properties_id AND p.valid_to IS NULL
    JOIN tenants   t ON t.tenants_id = c.tenants_id   AND t.valid_to IS NULL
    WHERE c.valid_to IS NULL
      AND (t.name LIKE :q OR p.name LIKE :q OR COALESCE(p.address,'') LIKE :q)
    ORDER BY c.contract_start DESC
    LIMIT " . (int)$limit
);
$st->bindValue(':q', $like, PDO::PARAM_STR);
$st->execute();
foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
    $contracts[] = [
        'id'             => (int)($r['contracts_id'] ?? $r['id']),
        'tenant_name'    => $r['tenant_name'],
        'property_name'  => $r['property_name'],
        'contract_start' => $r['contract_start'],
        'contract_end'   => $r['contract_end'] ?? null,
        'monthly_rent'   => (float)$r['monthly_rent'],
    ];
}

jsonOk(['tenants' => $tenants, 'properties' => $properties, 'contracts' => $contracts]);
