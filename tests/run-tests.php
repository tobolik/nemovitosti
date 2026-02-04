<?php
// tests/run-tests.php – jednoduchý test runner (bez PHPUnit)
// Spuštění: php tests/run-tests.php
declare(strict_types=1);

$projectRoot = dirname(__DIR__);
$failures = [];
$count = 0;

function assert_true(bool $cond, string $msg, array &$failures): void {
    global $count;
    $count++;
    if (!$cond) {
        $failures[] = $msg;
    }
}

$hasConfig = is_file($projectRoot . '/config.php');
if ($hasConfig) {
    require $projectRoot . '/config.php';
    require $projectRoot . '/api/_bootstrap.php';
    // Soft-update a auth funkce existují
    assert_true(function_exists('softInsert'), 'softInsert exists', $failures);
    assert_true(function_exists('softUpdate'), 'softUpdate exists', $failures);
    assert_true(function_exists('softDelete'), 'softDelete exists', $failures);
    assert_true(function_exists('findActive'), 'findActive exists', $failures);
    assert_true(function_exists('findActiveByEntityId'), 'findActiveByEntityId exists', $failures);
    assert_true(function_exists('csrfToken'), 'csrfToken exists', $failures);
    assert_true(function_exists('verifyCsrf'), 'verifyCsrf exists', $failures);
}

// CRUD whitelist (načteme z crud.php bez vykonání)
$crudPath = $projectRoot . '/api/crud.php';
$crudSrc = file_get_contents($crudPath);
assert_true(strpos($crudSrc, '$FIELDS') !== false, 'crud.php defines $FIELDS', $failures);
assert_true(strpos($crudSrc, 'softInsert') !== false, 'crud.php uses softInsert', $failures);
assert_true(strpos($crudSrc, 'softUpdate') !== false, 'crud.php uses softUpdate', $failures);
assert_true(strpos($crudSrc, 'valid_to IS NULL') !== false, 'crud.php filters valid_to IS NULL', $failures);

// Auth používá prepared statement
$authPath = $projectRoot . '/api/auth.php';
$authSrc = file_get_contents($authPath);
assert_true(strpos($authSrc, 'prepare(') !== false, 'auth.php uses prepared statements', $failures);
assert_true(strpos($authSrc, 'password_verify') !== false, 'auth.php uses password_verify', $failures);

// Výsledek
if (count($failures) === 0) {
    echo "OK – $count assertions passed.\n";
    exit(0);
}
echo "FAILED – " . count($failures) . " failure(s):\n";
foreach ($failures as $f) {
    echo "  - $f\n";
}
exit(1);
