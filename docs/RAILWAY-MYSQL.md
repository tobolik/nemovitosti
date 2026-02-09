# Railway – aplikace + MySQL (postup propojení)

Nasazení aplikace a databáze celé na [Railway](https://railway.app): PHP app + MySQL ve stejném projektu.

---

## Postup krok za krokem

### Krok 1: Účet a nový projekt

1. Přihlas se na [railway.app](https://railway.app) (GitHub účet).
2. **New Project** → **Deploy from GitHub repo**.
3. Vyber repozitář (např. `tobolik/nemovitosti`) a **branch** např. `feature/rent-as-payment-requests` (nebo `main` pro aktuální stav).
4. Railway vytvoří službu a začne první deploy. Po dokončení máš běžící službu (URL u **Settings** → **Generate Domain**).

### Krok 2: Přidat MySQL

1. V tom samém projektu klikni **+ New**.
2. Zvol **Database** → **Add MySQL** (nebo **MySQL**).
3. Railway vytvoří MySQL službu a nastaví u ní proměnné: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.

### Krok 3: Propojit aplikaci s MySQL

1. Klikni na **PHP službu** (ta z Kroku 1), pak **Variables** (nebo **Settings** → **Variables**).
2. Přidej **Reference** na proměnné z MySQL: **Add Variable** → **Add Reference** → vyber **MySQL** službu a přidej např. `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.  
   (Některé šablony to dělají automaticky – pokud už tam reference na MySQL jsou, nic nedělej.)
3. Aplikace načte tyto proměnné díky `config.default.php` (podporuje jak `DB_*`, tak Railway `MYSQL*`).  
   `config.php` na Railway nepotřebuješ.

### Krok 4: PHP a veřejná URL

- Aplikace má v kořeni `index.html` (SPA) a API v `api/*.php`. Railway/Nixpacks by měl PHP detekovat (např. podle `index.php` nebo struktury). Pokud by deploy nefungoval, v **Settings** služby zkus nastavit **Root Directory** na `/` a **Start Command** dle dokumentace Railway pro PHP.
- U služby v **Settings** → **Networking** → **Generate Domain** vygeneruj veřejnou URL (např. `xxx.up.railway.app`).

### Krok 5: Spustit migrace

1. U **PHP služby** → **Variables** přidej proměnnou **`MIGRATE_KEY`** (libovolný tajný řetězec, např. z `openssl rand -hex 16`).
2. V prohlížeči nebo přes curl zavolej:  
   `https://TVAJE-DOMENA.up.railway.app/api/migrate.php?key=TVOJ_MIGRATE_KEY`  
3. Měla by přijít JSON odpověď a v DB se vytvoří tabulky podle `migrations/*.sql`.

### Krok 5b: Session v DB (aby vás po deployi neodhlašovalo)

Na Railway je disk **ephemeral** – po každém deployi se soubory (včetně PHP session) ztratí. Přihlášení proto nepřežije redeploy.

1. Po spuštění migrací (Krok 5) je v DB tabulka **`_sessions`** (migrace `061_sessions_table.sql`).
2. U **PHP služby** → **Variables** přidej proměnnou **`SESSION_USE_DB`** = **`1`**.
3. Aplikace pak ukládá session do MySQL; přihlášení přežije deploy i více instancí.

### Krok 6 (volitelně): Import SQL dumpu do Railway MySQL

Dump z projektu (např. `sql-dump-2026-02-09.sql`) vytváří databázi `tobolikcz01` a naplní ji. Postup:

1. **Získej připojení k MySQL na Railway**  
   U MySQL služby → **Variables**. Použij hodnotu **`MYSQL_PUBLIC_URL`** (tvar `mysql://root:HESLO@host:port/railway`) nebo jednotlivé proměnné: `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE` (nebo `MYSQL_DATABASE`).

2. **Import z příkazové řádky (PowerShell / CMD)**  
   V adresáři s dumpem (např. `sql-dump-2026-02-09.sql`) spusť (nahraď host, port, uživatele a heslo podle Railway):

   ```bash
   mysql -h interchange.proxy.rlwy.net -P 14653 -u root -p railway < sql-dump-2026-02-09.sql
   ```

   Heslo zadáš po výzvě (nebo použij `-pTVOJE_HESLO`; na Windows může být nutné uvozovky).  
   **Poznámka:** Dump uvnitř obsahuje `CREATE DATABASE tobolikcz01` a `USE tobolikcz01`, takže při připojení na **railway** se vytvoří druhá databáze `tobolikcz01` a data půjdou do ní.

3. **Aby aplikace používala importovaná data**  
   Po importu budou tabulky v databázi **tobolikcz01**. U **PHP služby** → **Variables** přidej proměnnou **`DB_NAME`** = **`tobolikcz01`** (nebo nastav **`MYSQLDATABASE`** na `tobolikcz01`, pokud to Railway u PHP služby dovolí přepsat). Aplikace pak načte DB z `config.default.php` jako `getenv('DB_NAME') ?: getenv('MYSQLDATABASE')` a připojí se na `tobolikcz01`.

4. **Alternativa: import přímo do databáze `railway`**  
   Pokud nechceš měnit konfiguraci PHP, můžeš dump upravit: v souboru nahraď `tobolikcz01` za `railway` (řádky s `CREATE DATABASE` a `USE \`…\``) a importuj do již existující databáze `railway`. Pak aplikace může zůstat na výchozím `MYSQLDATABASE` = `railway`.

---

## Shrnutí

| Krok | Akce |
|------|------|
| 1 | New Project → Deploy from GitHub (repo + větev). |
| 2 | + New → Database → MySQL. |
| 3 | U PHP služby Variables → přidat reference na MySQL proměnné (MYSQLHOST, MYSQLUSER, …). |
| 4 | Generate Domain pro veřejnou URL. |
| 5 | Nastavit MIGRATE_KEY a zavolat `/api/migrate.php?key=...`. |
| 6 | (Volitelně) Import dumpu do Railway MySQL. |

- **config.default.php** v repu načítá `MYSQL*` z prostředí; lokálně dál můžeš používat `config.php` (gitignore).
