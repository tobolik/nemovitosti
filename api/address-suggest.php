<?php
// api/address-suggest.php – našeptávač adres (ulice, PSČ, město)
// GET ?q=Hlavní+123+Praha
// Proxy: Nominatim (default, free) | Mapy.cz (vyžaduje ADDRESS_API_KEY)
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'GET') jsonErr('Metoda nepodporovaná.', 405);

$q = trim($_GET['q'] ?? '');
if (strlen($q) < 2) jsonOk([]);

$provider = defined('ADDRESS_API_PROVIDER') ? ADDRESS_API_PROVIDER : 'nominatim';
$limit = min(10, (int)($_GET['limit'] ?? 5));

if ($provider === 'mapy' && defined('ADDRESS_API_KEY')) {
    $url = 'https://api.mapy.com/v1/suggest?' . http_build_query([
        'query' => $q,
        'limit' => $limit,
        'type'  => 'regional.address,regional.street,regional.municipality',
        'lang'  => 'cs',
        'apikey' => ADDRESS_API_KEY,
    ]);
    $ctx = stream_context_create(['http' => [
        'timeout' => 5,
        'header'  => "User-Agent: Nemovitosti/1.0\r\n",
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false) jsonOk([]);
    $data = json_decode($raw, true);
    $out = [];
    foreach ($data['suggestions'] ?? [] as $s) {
        $out[] = [
            'label'   => $s['name'] ?? '',
            'address' => $s['name'] ?? '',
            'postcode'=> $s['regionalStructure'][0]['zip'] ?? '',
        ];
    }
    jsonOk($out);
}

// Default: Nominatim (OpenStreetMap) – free, no API key
$url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
    'q'               => $q,
    'format'           => 'json',
    'addressdetails'   => 1,
    'limit'            => $limit,
    'countrycodes'     => 'cz,sk',
]);
$ctx = stream_context_create(['http' => [
    'timeout' => 5,
    'header'  => "User-Agent: Nemovitosti/1.0 (https://nemovitosti.tobolik.cz)\r\nAccept-Language: cs\r\n",
]]);
$raw = @file_get_contents($url, false, $ctx);
if ($raw === false) jsonOk([]);
$data = json_decode($raw, true);
$out = [];
foreach ($data ?: [] as $r) {
    $addr = $r['address'] ?? [];
    $parts = [];
    if (!empty($addr['house_number'])) $parts[] = $addr['house_number'];
    if (!empty($addr['road'])) $parts[] = $addr['road'];
    if (!empty($addr['suburb'])) $parts[] = $addr['suburb'];
    if (!empty($addr['city']) || !empty($addr['town']) || !empty($addr['village'])) {
        $parts[] = $addr['city'] ?? $addr['town'] ?? $addr['village'] ?? '';
    }
    if (!empty($addr['postcode'])) $parts[] = $addr['postcode'];
    $label = $r['display_name'] ?? implode(', ', $parts);
    $out[] = [
        'label'   => $label,
        'address' => $label,
        'postcode'=> $addr['postcode'] ?? '',
    ];
}
jsonOk($out);
