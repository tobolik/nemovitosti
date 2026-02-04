<?php
// tests/bootstrap.php – pro automatizované testy
declare(strict_types=1);

define('TESTING', true);

$projectRoot = dirname(__DIR__);
if (is_file($projectRoot . '/config.php')) {
    require $projectRoot . '/config.php';
}
require $projectRoot . '/api/_bootstrap.php';
