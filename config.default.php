<?php
// config.default.php – výchozí konfigurace z proměnných prostředí (pro Railway, Docker, …)
// Lokálně: použijte config.php (gitignore) pro vlastní hodnoty; ty mají přednost.
// Na Railway: při přidání MySQL služby Railway nastaví MYSQLHOST, MYSQLUSER, … (použijí se automaticky).
// Případně nastavte DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS ručně (např. pro externí MySQL).
declare(strict_types=1);

if (!defined('DB_HOST'))   define('DB_HOST',   getenv('DB_HOST')   ?: getenv('MYSQLHOST')   ?: '127.0.0.1');
if (!defined('DB_PORT'))   define('DB_PORT',   (int)(getenv('DB_PORT')   ?: getenv('MYSQLPORT')   ?: '3306'));
if (!defined('DB_NAME'))   define('DB_NAME',   getenv('DB_NAME')   ?: getenv('MYSQLDATABASE') ?: 'tobolikcz01');
if (!defined('DB_USER'))   define('DB_USER',   getenv('DB_USER')   ?: getenv('MYSQLUSER')   ?: '');
if (!defined('DB_PASS'))   define('DB_PASS',   getenv('DB_PASS')   ?: getenv('MYSQLPASSWORD')?: '');

if (!defined('SESSION_NAME')) define('SESSION_NAME', getenv('SESSION_NAME') ?: 'nemov');
if (!defined('SESSION_LIFE')) define('SESSION_LIFE', (int)(getenv('SESSION_LIFE') ?: '2592000'));
if (!defined('DEBUG'))       define('DEBUG',       (getenv('DEBUG') ?: '1') === '1');
if (!defined('MIGRATE_KEY')) define('MIGRATE_KEY', getenv('MIGRATE_KEY') ?: '');
// CORS: comma-separated list of allowed origins (e.g. https://app.example.com). Empty = only localhost/127.0.0.1 for dev.
if (!defined('CORS_ALLOWED_ORIGINS')) define('CORS_ALLOWED_ORIGINS', getenv('CORS_ALLOWED_ORIGINS') ?: '');
