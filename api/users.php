<?php
// api/users.php
declare(strict_types=1);
require __DIR__ . '/_bootstrap.php';

// ── GET – list ──────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    requireAdmin();
    $rows = findAllActive('users', 'name ASC');
    foreach ($rows as &$r) unset($r['password_hash']);
    unset($r);
    jsonOk($rows);
}

// ── POST ────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    verifyCsrf();
    requireLogin();
    $b      = body();
    $action = $b['action'] ?? '';

    // ADD
    if ($action === 'add') {
        requireAdmin();
        $email = trim($b['email']??'');
        $pass  = $b['password']??'';
        $name  = trim($b['name']??'');
        $role  = in_array($b['role']??'',['admin','user']) ? $b['role'] : 'user';

        if ($email==='' || $pass==='' || $name==='') jsonErr('Vyplňte všechna povinná pole.');
        if (strlen($pass) < 8) jsonErr('Heslo musí být alespoň 8 znaků.');

        $dup = db()->prepare("SELECT 1 FROM users WHERE email=? AND valid_to IS NULL");
        $dup->execute([$email]);
        if ($dup->fetch()) jsonErr('E-mail je již použit.');

        $id = softInsert('users', [
            'email'=>$email,
            'password_hash'=>password_hash($pass, PASSWORD_BCRYPT),
            'name'=>$name,
            'role'=>$role,
        ]);
        $row = findActive('users', $id);
        unset($row['password_hash']);
        jsonOk($row, 201);
    }

    // EDIT
    if ($action === 'edit') {
        requireAdmin();
        $id = (int)($b['id']??0);
        if (!$id) jsonErr('Chybí ID.');
        $data = [];
        if (isset($b['name']))  $data['name']  = trim($b['name']);
        if (isset($b['email'])) $data['email'] = trim($b['email']);
        if (isset($b['role']))  $data['role']  = in_array($b['role'],['admin','user']) ? $b['role'] : 'user';
        $newId = softUpdate('users', $id, $data);
        $row = findActive('users', $newId);
        unset($row['password_hash']);
        jsonOk($row);
    }

    // DELETE
    if ($action === 'delete') {
        requireAdmin();
        $id = (int)($b['id']??0);
        if (!$id) jsonErr('Chybí ID.');
        if ($id === $_SESSION['uid']) jsonErr('Nelze smazat sebe.');
        softDelete('users', $id);
        jsonOk(['deleted'=>$id]);
    }

    // CHANGE PASSWORD
    if ($action === 'change_password') {
        $id   = (int)($b['id']??0);
        $pass = $b['password']??'';
        if (!$id) jsonErr('Chybí ID.');
        if (strlen($pass)<8) jsonErr('Heslo musí být alespoň 8 znaků.');
        if ($id !== $_SESSION['uid']) requireAdmin();

        $newId = softUpdate('users', $id, ['password_hash'=>password_hash($pass, PASSWORD_BCRYPT)]);
        if ($id === $_SESSION['uid']) $_SESSION['uid'] = $newId;
        jsonOk(['changed'=>true]);
    }

    jsonErr('Neznámá akce.');
}

jsonErr('Metoda nepodporovaná.', 405);
