<?php
// api/auth.php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── OPTIONS – CORS preflight (prohlížeč ho posílá před POST s JSON) ─────────
if ($method === 'OPTIONS') {
    header('Allow: GET, POST, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    http_response_code(204);
    exit;
}

// ── GET – session check ─────────────────────────────────────────────────────
if ($method === 'GET') {
    if (!isset($_SESSION['uid'])) jsonErr('Nejste přihlášen.', 401);
    jsonOk([
        'id'    => $_SESSION['uid'],
        'name'  => $_SESSION['name'],
        'email' => $_SESSION['email'],
        'role'  => $_SESSION['role'],
        'csrf'  => csrfToken(),
        'php_version' => PHP_VERSION,
    ]);
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
            setcookie(session_name(), '', [
                'expires'=>time()-1, 'path'=>$p['path'],
                'secure'=>$p['secure'], 'httponly'=>$p['httponly'], 'samesite'=>$p['samesite']
            ]);
        }
        session_destroy();
        jsonOk();
    }

    jsonErr('Neznámá akce.');
}

header('Allow: GET, POST, OPTIONS');
jsonErr('Metoda nepodporovaná.', 405);
