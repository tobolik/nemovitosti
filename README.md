# Nemovitosti – Správa nemovitostí

Aplikace pro evidenci nemovitostí, nájemníků, smlouv a sledování platební morálky.

## Verzování

Verze v patičce (`index.html`). Při změnách navýšit podle [Semantic Versioning](https://semver.org/):

- **MAJOR** (x.0.0) – zásadní změny, breaking changes
- **MINOR** (1.x.0) – nové funkce, zpětně kompatibilní
- **PATCH** (1.0.x) – opravy chyb, drobné úpravy

## Technologie

- **Frontend:** Vanilla JS SPA (žádné dependencies, žádný build krok)
- **Backend:** PHP 8.0+ (REST API, session auth, CSRF)
- **Databáze:** MySQL 5.7+ / MariaDB 10.3+
- **Architektura:** soft-update / soft-delete (audit trail na každé tabulce)

## Dokumentace

| Dokument | Popis |
|----------|--------|
| [docs/SOFT-UPDATE-AND-VERSIONING.md](docs/SOFT-UPDATE-AND-VERSIONING.md) | Pravidla soft-update, entity_id, verzování |
| [docs/SECURITY.md](docs/SECURITY.md) | Bezpečnostní prověrka a doporučení |
| [docs/TESTING.md](docs/TESTING.md) | Automatizované testy (API, E2E) |
| [docs/DEMO-DATA.md](docs/DEMO-DATA.md) | Demo data pro beta (anonymizace) |
| [docs/demo-data-instructions.md](docs/demo-data-instructions.md) | Návod: seed-demo.sql a plné demo z dumpu |
| [docs/PROPMANAGER-RENAME.md](docs/PROPMANAGER-RENAME.md) | (starší) Návrh přejmenování na PropManager |
| [docs/DOMLY-RENAME.md](docs/DOMLY-RENAME.md) | Návrh přejmenování na Domly (domly.cz) – repo, branding, design |

- **Testy:** `php tests/run-tests.php` (kontrola přítomnosti soft-update a CSRF; s config + DB běží i kontroly funkcí).
- **Demo data:** po schema + migracích lze naplnit `seed-demo.sql`; přihlášení `admin@propmanager.demo` / `password`.

---

## Automatický deploy přes GitHub Actions

Při každém push do `main`/`master` se projekt automaticky nasadí na FTP.

### Nastavení Secrets

V repozitáři: **Settings → Secrets and variables → Actions** přidejte:

| Secret | Popis |
|--------|-------|
| `FTP_SERVER` | FTP host (např. `ftp.vashosting.cz`) |
| `FTP_USERNAME` | FTP uživatel |
| `FTP_PASSWORD` | FTP heslo |
| `FTP_SERVER_DIR` | Cílový adresář na serveru (např. `public_html/` nebo `www/nemovitosti/`) – **musí končit lomítkem** |
| `SITE_URL` | (volitelné) URL aplikace (např. `https://nemovitosti.tobolik.cz`) – pro automatickou SQL migraci |
| `MIGRATE_KEY` | (volitelné) Tajný klíč pro `api/migrate.php` – stejná hodnota jako v `config.php` |

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Popis |
|----------|-------|
| `RUN_MIGRATION` | Nastavte na `true`, pokud chcete po deployi spouštět SQL migraci. Vyžaduje také Secrets `SITE_URL` a `MIGRATE_KEY`. |

### První nasazení

1. Vytvořte repozitář **nemovitosti** na GitHubu.
2. Nastavte Secrets (viz výše).
3. Pushněte kód – deploy se spustí automaticky.
4. **config.php** se neuploaduje (je v .gitignore) – vytvořte ho ručně na serveru z `config.php.example`.
5. Databázi a seed proveďte podle kapitoly níže.

---

## Deployment na shared hosting

### 1. Databáze – via phpMyAdmin

1. Přihlášte se do phpMyAdmin (poskytneme hosting providером).
2. Vytvořte novou databázi, např. `tobolikcz01` (charset: utf8mb4, collation: utf8mb4_czech_ci).
3. Importujte soubor `schema.sql` (Import → Zvolte soubor → Execute).
4. **Existující instalace:** Při ručním upgrade spusťte `schema_migration.sql`. Při automatickém deployi s `SITE_URL` a `MIGRATE_KEY` se spouští **inkrementální migrace** ze složky `migrations/` – při každém deployi se provedou jen dosud neaplikované soubory (sledováno v tabulce `_migrations`). Při přidání nové změny schématu vytvořte soubor např. `010_nazev.sql` v `migrations/`, commitněte – deploy spustí jen tento nový soubor.

### 2. Konfigurace

1. Zkopíujte `config.php.example` → `config.php`.
2. Vyplňte `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` podle údajů od hosting providera.
   - `DB_HOST` je typicky `localhost` nebo `127.0.0.1` (ověřte v phpMyAdmin → Home).
3. Pro automatickou migraci při deployi: odkomentujte a nastavte `MIGRATE_KEY` (náhodný řetězec, např. z `openssl rand -hex 32`) – stejná hodnota musí být v GitHub Secrets.

### 3. Upload na hosting

Nahrňte všechny soubory do vaší hosting directory (např. via FTP/SFTP):

```
hosting-root/          ←ваша public_html nebo subdomain folder
├── index.html
├── config.php         ← vyplněná verze (NIGDY necommitujte do git!)
├── seed.php           ← po spuštění vymazáte
├── schema.sql         ← po importu vymazáte (volitelně)
├── config.php.example
├── .gitignore
├── css/
│   └── style.css
├── js/
│   ├── api.js
│   ├── app.js
│   ├── ui.js
│   └── views/
│       ├── dashboard.js
│       ├── properties.js
│       ├── tenants.js
│       ├── contracts.js
│       ├── payments.js
│       └── users.js
└── api/
    ├── _bootstrap.php
    ├── auth.php
    ├── crud.php
    ├── dashboard.php
    ├── migrate.php    ← spouští se při deployi (pokud je nastaven MIGRATE_KEY)
    └── users.php
```

### 4. Vytvořit prvního admin uživatele

Otevřete v browseru:
```
https://vas-hosting.cz/seed.php
```
Strana vypíše:
```
✓  Admin: admin@example.com  /  Admin123!
```

> **Po tom vymazáte `seed.php`** z hostingu (via FTP), aby nikdo nemohl vytvořit další admin.

### 5. Přihlášení

Otevřete:
```
https://vas-hosting.cz/
```
Přihlášte se: `admin@example.com` / `Admin123!`

**Första step po přihlášení:** Změňte heslo (Uživatelé → Heslo).

---

## Lokální development

```bash
# Vyplňte config.php (DB_HOST=127.0.0.1, vaše lokální MySQL)
# Import schema:
mysql -u root -p < schema.sql

# Seed:
php seed.php

# Dev server:
php -S localhost:8000

# Otevřete:
# http://localhost:8000
```

---

## Struktura API

| Endpoint | Metoda | Popis |
|---|---|---|
| `/api/auth.php` | GET | Session check – vrátí current user + csrf |
| `/api/auth.php` | POST | `{action: "login"}` / `{action: "logout"}` |
| `/api/crud.php?table=X` | GET | List active records (+ `&id=N` pro single) |
| `/api/crud.php?table=X` | POST | `{action: "add/edit/delete", ...}` |
| `/api/dashboard.php` | GET | Platební morálka přehled |
| `/api/users.php` | GET | List users (admin) |
| `/api/users.php` | POST | add / edit / delete / change_password |

Supported tables: `properties`, `tenants`, `contracts`, `payments`

---

## Security

- Hesla: bcrypt (`password_hash`)
- CSRF: token v session, verifikace via `X-Csrf-Token` header
- Session: httponly, samesite=Strict, secure na HTTPS
- SQL injection: PDO prepared statements
- XSS: `htmlspecialchars` na všechny outputs
- Soft-delete: žádné fyzické mazání – kompletní audit trail
