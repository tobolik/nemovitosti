<?php
// api/ares-lookup.php – načtení dat firmy z ARES podle IČ
// GET ?ico=12345678
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();

$ico = preg_replace('/\D/', '', $_GET['ico'] ?? '');
if (strlen($ico) !== 8) {
    jsonErr('IČ musí mít 8 číslic.', 400);
}

$url = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/' . $ico;
$ctx = stream_context_create([
    'http' => [
        'timeout' => 8,
        'user_agent' => 'Nemovitosti/1.0',
    ],
]);
$json = @file_get_contents($url, false, $ctx);
if ($json === false) {
    jsonErr('ARES nedostupný nebo IČ nenalezeno.', 502);
}

$data = json_decode($json, true);
if (!$data) {
    jsonErr('Neplatná odpověď z ARES.', 502);
}

$addr = $data['sidlo']['textovaAdresa'] ?? null;
if (!$addr && isset($data['adresaDorucovaci'])) {
    $a = $data['adresaDorucovaci'];
    $addr = trim(($a['radekAdresy1'] ?? '') . ', ' . ($a['radekAdresy2'] ?? '') . ' ' . ($a['radekAdresy3'] ?? ''));
}

jsonOk([
    'name'  => $data['obchodniJmeno'] ?? '',
    'address' => $addr ?: '',
    'ic'    => $data['ico'] ?? $ico,
    'dic'   => $data['dic'] ?? null,
]);
