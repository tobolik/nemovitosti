<?php
// seed.php – spustit jednou po importu schema.sql
// Příklad: php seed.php
chdir(__DIR__);
require 'config.php';

$pdo = new PDO(
    "mysql:host=".DB_HOST.";port=".DB_PORT.";dbname=".DB_NAME.";charset=utf8mb4;allowPublicKeyRetrieval=true",
    DB_USER, DB_PASS,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
);

$email = 'honza@tobolik.cz';
$pass  = 'honzaq4e';

$s = $pdo->prepare("SELECT 1 FROM users WHERE email=? AND valid_to IS NULL");
$s->execute([$email]);
if ($s->fetch()) { echo "Uživatel $email exists.\n"; exit; }

$pdo->prepare("INSERT INTO users (email,password_hash,name,role) VALUES (?,?,?,?)")
    ->execute([$email, password_hash($pass, PASSWORD_BCRYPT), 'Správce', 'admin']);

echo "✓  Admin: $email  /  $pass\n";
echo "   Změňte heslo po prvním přihlášení.\n";
