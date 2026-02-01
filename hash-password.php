<?php
// hash-password.php – vygeneruje bcrypt hash pro heslo
// Použití: php hash-password.php "VaseHeslo"
// Nebo interaktivně: php hash-password.php

$pass = $argv[1] ?? null;
if (!$pass) {
    echo "Použití: php hash-password.php \"VaseHeslo\"\n";
    exit(1);
}

echo password_hash($pass, PASSWORD_BCRYPT) . "\n";
