<?php
// api/fio-fetch.php – načtení z FIO a uložení do payment_imports (sdílená logika pro web i cron)
// Použití: require_once + runFioImportForAccount($bankAccountsId, $from, $to)
// Vyžaduje _bootstrap.php (db, softInsert). Při chybě háže RuntimeException.
declare(strict_types=1);

function runFioImportForAccount(int $bankAccountsId, string $from, string $to): array {
    $today = date('Y-m-d');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
        throw new RuntimeException('Parametry from a to musí být RRRR-MM-DD.');
    }
    if (strtotime($from) > strtotime($to)) {
        throw new RuntimeException('Datum od nesmí být po datu do.');
    }
    if ($from > $today || $to > $today) {
        throw new RuntimeException('Období nesmí být v budoucnosti. FIO API vrací pouze minulá data.');
    }

    $stmt = db()->prepare("
        SELECT id, bank_accounts_id, name, fio_token, currency
        FROM bank_accounts
        WHERE (bank_accounts_id = ? OR id = ?) AND valid_to IS NULL
        LIMIT 1
    ");
    $stmt->execute([$bankAccountsId, $bankAccountsId]);
    $account = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$account) {
        throw new RuntimeException('Bankovní účet nenalezen.');
    }
    $token = isset($account['fio_token']) ? trim((string)$account['fio_token']) : '';
    if ($token === '') {
        throw new RuntimeException('U tohoto účtu není nastaven FIO API token.');
    }

    $url = 'https://fioapi.fio.cz/v1/rest/periods/' . rawurlencode($token) . '/' . $from . '/' . $to . '/transactions.json';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'User-Agent: Nemovitosti/1.0 (FIO API client)'],
    ]);
    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = curl_error($ch);
    curl_close($ch);

    if ($raw === false || $raw === '') {
        throw new RuntimeException($curlErr !== '' ? 'Nepodařilo se připojit k FIO API. ' . $curlErr : 'FIO API nevrátilo žádná data.');
    }

    $data = json_decode($raw, true);

    if ($httpCode >= 400) {
        $msg = 'FIO API vrátilo HTTP ' . $httpCode . '.';
        if (is_array($data)) {
            $detail = $data['errorDescription'] ?? $data['error'] ?? $data['message'] ?? null;
            if ($detail !== null && $detail !== '') {
                $msg .= ' ' . (is_string($detail) ? $detail : json_encode($detail));
            }
        }
        if ($httpCode === 409) {
            $msg = 'FIO API omezuje počet požadavků (max. 1× za 30 sekund). Zkuste to znovu za chvíli.';
        } elseif ($httpCode === 422) {
            $preview = mb_substr(preg_replace('/\s+/', ' ', trim($raw)), 0, 200);
            if ($preview !== '') $msg .= ' Odpověď: ' . $preview . (strlen(trim($raw)) > 200 ? '…' : '');
        }
        throw new RuntimeException($msg);
    }

    if (!is_array($data)) {
        throw new RuntimeException('FIO API nevrátilo platný JSON. ' . json_last_error_msg());
    }
    if (isset($data['errorDescription']) || isset($data['error'])) {
        $msg = $data['errorDescription'] ?? $data['error'] ?? 'Neznámá chyba FIO';
        throw new RuntimeException('FIO API: ' . (is_string($msg) ? $msg : json_encode($msg)));
    }
    if (!isset($data['accountStatement']['transactionList'])) {
        throw new RuntimeException('FIO API nevrátilo očekávanou strukturu (accountStatement.transactionList).');
    }

    $baId = (int)($account['bank_accounts_id'] ?? $account['id']);
    $accountCurrency = isset($account['currency']) && trim((string)$account['currency']) !== ''
        ? strtoupper(substr(trim($account['currency']), 0, 3)) : 'CZK';

    $allowedCounterparts = [];
    $accounts = db()->query("
        SELECT DISTINCT tba.account_number
        FROM tenant_bank_accounts tba
        INNER JOIN tenants t ON t.tenants_id = tba.tenants_id
        WHERE tba.valid_to IS NULL AND TRIM(tba.account_number) != ''
    ")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($accounts as $acc) {
        $norm = strtolower(preg_replace('/\s+/', '', trim($acc)));
        if ($norm !== '') {
            $allowedCounterparts[$norm] = true;
            $base = preg_replace('/\/.*$/', '', $norm);
            if ($base !== '') $allowedCounterparts[$base] = true;
        }
    }
    $filterByCounterpart = count($allowedCounterparts) > 0;

    $checkStmt = db()->prepare('SELECT id FROM payment_imports WHERE fio_transaction_id = ? AND valid_to IS NULL LIMIT 1');

    $txList = $data['accountStatement']['transactionList']['transaction'] ?? null;
    if ($txList !== null && !is_array($txList)) {
        $txList = [$txList];
    }
    $imported = 0;
    $skipped = 0;
    $skipped_filter = 0;
    $items = [];

    if (is_array($txList)) {
        foreach ($txList as $t) {
            $col = static function ($key) use ($t) {
                $v = $t[$key] ?? null;
                if (is_array($v) && isset($v['value'])) return (string)$v['value'];
                if (is_string($v)) return $v;
                foreach (($t['column'] ?? $t['columns'] ?? []) as $c) {
                    if (!is_array($c)) continue;
                    $id = $c['id'] ?? $c['name'] ?? null;
                    if ((string)$id === (string)$key && isset($c['value'])) return (string)$c['value'];
                }
                return '';
            };
            $amount = $col('column1');
            $amountNum = 0.0;
            if (is_numeric(str_replace(['+', ',', ' '], ['', '.', ''], $amount))) {
                $amountNum = (float)str_replace(',', '.', $amount);
            }
            if ($amountNum <= 0) continue;

            $date = trim($col('column0'));
            if ($date === '') $date = trim($col('date'));
            $dateNorm = null;
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', trim($date), $m)) {
                $dateNorm = $m[1] . '-' . $m[2] . '-' . $m[3];
            } elseif (preg_match('/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/', trim($date), $m)) {
                $dateNorm = $m[3] . '-' . str_pad($m[2], 2, '0', STR_PAD_LEFT) . '-' . str_pad($m[1], 2, '0', STR_PAD_LEFT);
            } elseif ($date !== '' && strtotime($date) !== false) {
                $dateNorm = date('Y-m-d', strtotime($date));
            }
            if ($dateNorm === null || $dateNorm === '') $dateNorm = date('Y-m-d');

            $counterpart = $col('column2');
            $bankCode = $col('column3');
            $message = $col('column16') !== '' ? $col('column16') : $col('column7');
            $fioId = $col('column22') !== '' ? $col('column22') : $col('column14');
            $counterpartFull = trim($counterpart . ($bankCode !== '' ? '/' . $bankCode : ''), '/');
            $counterpartNorm = $counterpartFull !== '' ? strtolower(preg_replace('/\s+/', '', $counterpartFull)) : '';
            $counterpartBase = $counterpartNorm !== '' ? preg_replace('/\/.*$/', '', $counterpartNorm) : '';
            $matchesCounterpart = $counterpartNorm !== '' && (
                isset($allowedCounterparts[$counterpartNorm]) || ($counterpartBase !== '' && isset($allowedCounterparts[$counterpartBase]))
            );
            if ($filterByCounterpart && !$matchesCounterpart) {
                $skipped_filter++;
                continue;
            }

            if ($fioId !== '') {
                $checkStmt->execute([$fioId]);
                if ($checkStmt->fetch()) {
                    $skipped++;
                    continue;
                }
            }
            $newId = softInsert('payment_imports', [
                'bank_accounts_id'    => $baId,
                'payment_date'        => $dateNorm,
                'amount'              => $amountNum,
                'currency'            => $accountCurrency,
                'counterpart_account' => $counterpartFull !== '' ? $counterpartFull : null,
                'note'                => $message !== '' ? $message : null,
                'fio_transaction_id'  => $fioId !== '' ? $fioId : null,
                'payment_type'        => null,
            ]);
            $imported++;
            $items[] = [
                'id' => $newId,
                'payment_date' => $dateNorm,
                'amount' => $amountNum,
                'counterpart_account' => $counterpartFull,
                'note' => $message,
            ];
        }
    }

    return [
        'imported' => $imported,
        'skipped' => $skipped,
        'skipped_filter' => $skipped_filter,
        'account_name' => $account['name'] ?? '',
        'from' => $from,
        'to' => $to,
        'items' => $items,
    ];
}
