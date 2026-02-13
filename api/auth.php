<?php
// api/auth.php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

/** Vrátí true, pokud je daný origin povolen pro CORS (whitelist nebo localhost). */
$corsOriginAllowed = function (string $origin): bool {
    $origin = trim($origin);
    if ($origin === '') return false;
    $list = array_map('trim', array_filter(explode(',', (string)(defined('CORS_ALLOWED_ORIGINS') ? CORS_ALLOWED_ORIGINS : ''))));
    if (in_array($origin, $list, true)) return true;
    if (!$list && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $origin)) return true;
    return false;
};

// ── OPTIONS – CORS preflight (pouze whitelistované origin dostanou CORS hlavičky) ─
if ($method === 'OPTIONS') {
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($corsOriginAllowed($origin)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, X-Csrf-Token');
        header('Access-Control-Max-Age: 86400');
    }
    header('Allow: GET, POST, OPTIONS');
    http_response_code(204);
    exit;
}

// CORS pro GET/POST: pouze whitelistovaný origin smí dostat credentials v odpovědi
$origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
if ($origin !== '' && $corsOriginAllowed($origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
}

// ── GET – session check ─────────────────────────────────────────────────────
if ($method === 'GET') {
    if (!isset($_SESSION['uid'])) jsonErr('Nejste přihlášen.', 401);
    $out = [
        'id'    => $_SESSION['uid'],
        'name'  => $_SESSION['name'],
        'email' => $_SESSION['email'],
        'role'  => $_SESSION['role'],
        'csrf'  => csrfToken(),
        'php_version' => PHP_VERSION,
    ];
    if (defined('DEBUG') && DEBUG) {
        $out['session_storage'] = (defined('SESSION_USE_DB') && SESSION_USE_DB) ? 'db' : 'file';
    }
    jsonOk($out);
}

// ── POST – login / logout ───────────────────────────────────────────────────
if ($method === 'POST') {
    $b      = body();
    $action = $b['action'] ?? '';

    if ($action === 'login') {
        $email = trim($b['email'] ?? '');
        $pass  = $b['password'] ?? '';
        if ($email === '' || $pass === '') jsonErr('Vyplňte e-mail i heslo.');

        $s = db()->prepare("SELECT * FROM users WHERE email=? AND valid_to IS NULL");
        $s->execute([$email]);
        $u = $s->fetch();

        if (!$u || !password_verify($pass, $u['password_hash']))
            jsonErr('Nesprávný e-mail nebo heslo.');

        if (function_exists('session_regenerate_id')) {
            session_regenerate_id(true);
        }
        // uid = users_id (entity_id), aby session přežila soft-update
        $_SESSION['uid']   = $u['users_id'] ?? $u['id'];
        $_SESSION['name']  = $u['name'];
        $_SESSION['email'] = $u['email'];
        $_SESSION['role']  = $u['role'];
        $_SESSION['csrf']  = bin2hex(random_bytes(32));

        jsonOk([
            'id'    => $_SESSION['uid'],
            'name'  => $u['name'],
            'email' => $u['email'],
            'role'  => $u['role'],
            'csrf'  => $_SESSION['csrf'],
            'php_version' => PHP_VERSION,
        ]);
    }

    if ($action === 'logout') {
        verifyCsrf();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            if (PHP_VERSION_ID >= 70300) {
                setcookie(session_name(), '', [
                    'expires'=>time()-1, 'path'=>$p['path'],
                    'secure'=>$p['secure'], 'httponly'=>$p['httponly'], 'samesite'=>$p['samesite'] ?? 'Strict',
                ]);
            } else {
                setcookie(session_name(), '', time()-1, $p['path'], $p['domain'] ?? '', $p['secure'], $p['httponly']);
            }
        }
        session_destroy();
        jsonOk();
    }

    jsonErr('Neznámá akce.');
}

header('Allow: GET, POST, OPTIONS');
jsonErr('Metoda nepodporovaná.', 405);
