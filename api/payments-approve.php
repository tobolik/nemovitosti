<?php
// api/payments-approve.php – hromadné schválení plateb (např. po načtení z FIO)
// POST { "payment_ids": [1, 2, 3] } – entity_id plateb (payments_id)
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';
requireLogin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonErr('Pouze POST.', 405);
}
verifyCsrf();
$b = json_decode((string)file_get_contents('php://input'), true) ?: [];
$ids = $b['payment_ids'] ?? [];
if (!is_array($ids) || count($ids) === 0) {
    jsonErr('Zadejte payment_ids (pole ID plateb).');
}
$now = date('Y-m-d H:i:s');
$approved = 0;
foreach ($ids as $rawId) {
    $entityId = (int)$rawId;
    if ($entityId <= 0) continue;
    $row = findActiveByEntityId('payments', $entityId);
    if (!$row || !empty($row['approved_at'])) continue;
    db()->prepare('UPDATE payments SET approved_at = ? WHERE id = ? AND valid_to IS NULL')
        ->execute([$now, (int)$row['id']]);
    $approved++;
}
jsonOk(['approved' => $approved]);
