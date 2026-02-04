# Bezpečnostní prověrka a doporučení

Dokument popisuje stav zabezpečení aplikace a opatření proti známým i potenciálním útokům.

---

## 1. Autentizace a session

- **Přihlášení:** hesla se ukládají přes `password_hash()` (bcrypt), ověření `password_verify()`.
- **Session:** `httponly`, `samesite=Strict`, volitelně `secure` při HTTPS. Session ID po přihlášení regenerováno (`session_regenerate_id(true)`).
- **Ochrana:** Všechny API endpointy kromě `auth.php` (login) volají `requireLogin()` nebo `requireAdmin()`.

**Doporučení:**  
- Zajistit HTTPS v produkci.  
- Zvážit rate limiting na login (např. po 5 neúspěších zablokovat IP na 15 minut).

---

## 2. CSRF (Cross-Site Request Forgery)

- **Token:** Po přihlášení se vrací `csrf` v JSON; klient ho posílá v hlavičce `X-CSRF-Token` u všech mutujících požadavků (POST).
- **Ověření:** `verifyCsrf()` v _bootstrap.php kontroluje `hash_equals($_SESSION['csrf'], $tok)`.
- **Volá se** na začátku POST zpracování v crud.php (add, edit, delete, link_payment_request, …).

**Stav:** CSRF ochrana je implementována korektně.

---

## 3. SQL injection

- **Prepared statements:** Všechny dotazy v api (crud.php, auth.php, dashboard.php, search.php, users.php, migrate.php) používají `db()->prepare(...)->execute([...])` s parametry.
- **Tabulky a sloupce:** Pocházejí z whitelistů ($FIELDS, $table z GET/POST po ověření), ne z uživatelského vstupu přímo do SQL.
- **Řazení:** V `findAllActive($table, $order)` je `$order` ošetřeno: `preg_replace('/[^a-zA-Z0-9_ ,]/', '', $order)`.

**Stav:** Riziko SQL injection je minimalizované. Při přidávání nových dotazů vždy používat placeholdery `?` a předávat hodnoty v `execute()`.

---

## 4. XSS (Cross-Site Scripting)

- **API:** Vrací JSON; Content-Type je application/json. Data z API nejsou v prohlížeči interpretována jako HTML, pokud je klient nevkládá do DOM bez escapování.
- **Frontend (JS):** V `UI.esc()` (js/ui.js) se používá escapování pro vložení textu do HTML (např. v tabulkách, tagech). Při vykreslování uživatelského obsahu (jména, poznámky, adresy) je nutné vždy použít `UI.esc()` nebo ekvivalent.

**Doporučení:**  
- Při přidávání nových míst, kde se vykresluje obsah z API, vždy escapovat (UI.esc).  
- Nepoužívat `innerHTML = userInput` bez escapování; u dynamického HTML sestavovat řetězce s `UI.esc(field)`.

---

## 5. Autorizace (přístup k datům)

- **Model:** Jednotenantová aplikace – všichni přihlášení uživatelé vidí stejná data (všechny nemovitosti, smlouvy, platby).
- **Role:** `admin` vs `user` – rozlišení je (např. v users.php) pro správu uživatelů; CRUD dat nemovitostí je společný.

**Poznámka:** Pokud v budoucnu přibude multi-tenancy (vlastník nemovitostí = jiný než ostatní), bude nutné u každého dotazu filtrovat podle „vlastníka“ nebo tenant_id.

---

## 6. Citlivá data a konfigurace

- **config.php:** Obsahuje DB přihlašovací údaje a SESSION_NAME; nesmí být v gitu (v .gitignore). Existuje config.php.example.
- **Hesla:** V DB pouze hash; nikdy ne plain text.
- **Logy:** Aplikace neloguje hesla ani CSRF tokeny; v produkci vypnout zobrazení stack trace (DEBUG).

**Doporučení:**  
- V produkci nastavit `DEBUG = false`.  
- Nepřidávat do repozitáře žádné soubory s hesly nebo API klíči.

---

## 7. Headers a další HTTP bezpečnost

- **Content-Type:** API vrací `application/json`; u HTML stránek by mělo být nastaveno např. `X-Content-Type-Options: nosniff`.
- **Session cookie:** Již nastaveno httponly, samesite.

**Doporučení:**  
- Na úrovni web serveru (Apache/Nginx) nebo v PHP přidat hlavičky:  
  `X-Content-Type-Options: nosniff`,  
  `X-Frame-Options: DENY` (nebo SAMEORIGIN, pokud potřebujete iframe),  
  `Content-Security-Policy` dle potřeby (omezit zdroje skriptů a stylů).

---

## 8. Shrnutí – co je ošetřeno

| Oblast | Stav |
|--------|------|
| Autentizace (hesla) | ✅ Hash, verify |
| Session | ✅ Bezpečné cookie, regenerace ID |
| CSRF | ✅ Token, verifyCsrf u POST |
| SQL injection | ✅ Prepared statements, whitelist tabulek/sloupců |
| XSS | ✅ UI.esc na frontendu u zobrazení z API |
| Autorizace | ✅ requireLogin/requireAdmin; jednotenantový model |
| Config / hesla | ✅ config mimo git, pouze hash v DB |

---

## 9. Checklist před veřejnou betou

- [ ] HTTPS v produkci.
- [ ] DEBUG = false v produkci.
- [ ] Zvážit rate limiting na login.
- [ ] Přidat bezpečnostní hlavičky (X-Content-Type-Options, X-Frame-Options, CSP).
- [ ] Pravidelně aktualizovat závislosti (PHP, MariaDB, prohlížeče).
