# Verze 2.1 – Načítání plateb z FIO banky

Cíl: průběžná kontrola nových plateb + prvotní synchronizace / hromadné načtení s autorizací.

---

## 1. Průběžná kontrola (jednou za den)

### 1.1 Myšlenka
- Jednou denně (cron / naplánovaný job) zkontrolovat přes FIO API, zda na účtech nemáme nové příchozí platby.
- Kontrola podle **čísla protiúčtu** (nájemník): každá aktivní smlouva má nájemníka, nájemník má přiřazená čísla účtů (odkud platí). Pohyb z FIO s daným protiúčtem a částkou se porovná s očekávaným nájmem a případně se vytvoří platba (nebo notifikace).

### 1.2 Čísla účtů u nájemníka
- **Záložka u Nájemníka:** nová záložka např. „Účty“ / „Čísla účtů“ – seznam čísel účtů (formát `123456789/0800`), která nájemník používá pro platby.
- **Zdroj dat:** z historických plateb natáhnout existující `counterpart_account` podle smluv daného nájemníka a uložit je jako „účty nájemníka“. Nájemník jich může mít více (a reálně má).
- **DB:** nová tabulka nebo vazba – viz níže.

### 1.3 Technické
- FIO API: token na účet (náš účet v bance). Token bude potřeba uložit u „našeho“ bankovního účtu (např. `bank_accounts` + sloupec `fio_token` nebo samostatná konfigurace).
- Job: pro každý náš účet s tokenem stáhnout pohyby od poslední kontroly; filtrovat příchozí platby; podle `counterpart_account` určit nájemníka (z nové evidence účtů u nájemníka), podle smlouvy a částky/data přiřadit ke smlouvě a měsíci; nové platby evidovat (viz stav „ke schválení“ níže).

---

## 2. Prvotní načtení / synchronizace stavu

### 2.1 Myšlenka
- Pro **danou smlouvu**: tlačítko „Načíst z FIO“ (nebo „Synchronizovat s bankou“).
- Stáhnout z FIO všechny pohyby v období smlouvy (nebo za zvolené období), porovnat s tím, co už je v evidenci plateb.
- Co v evidenci **není** → založit jako novou platbu ve stavu **„ke schválení“** (pending). Uživatel pak platby schválí (jednou nebo hromadně) a teprve poté jsou „platné“.

### 2.2 Přiřazení k měsíci
- U každé načtené platby z FIO: datum + částka + protiúčet. Podle data a částky (a případně smlouvy) navrhnout `period_year` / `period_month` (např. datum platby → měsíc období). Uživatel může po schválení ještě upravit, pokud by přiřazení bylo špatné.

### 2.3 Stav plateb: ke schválení vs. platná
- **DB:** u plateb zavést stav schválení, např.:
  - `payments.approved_at` DATETIME NULL – NULL = čeká na schválení, po schválení uložit timestamp.
  - Případně `payments.status` ENUM('pending','approved') – podle preferencí.
- Platby s `approved_at IS NULL` se v reportech/dashboardu buď zobrazují s odlišením („ke schválení“), nebo se do součtů nezapočítávají, dokud nejsou schválené.
- **Hromadná autorizace:** v agendě Platby filtr „Ke schválení“ + výběr více řádků + tlačítko „Schválit vybrané“ → nastaví `approved_at = NOW()` (a případně `valid_user_from`).

---

## 3. Návrh změn v DB a API

### 3.1 Čísla účtů nájemníka
- **Možnost A:** nová tabulka `tenant_bank_accounts`  
  - `id`, `tenant_bank_accounts_id` (entity_id), `tenants_id` (odkaz na nájemníka), `account_number` VARCHAR(50), `valid_from`, `valid_to`, …
- **Možnost B:** jednoduchá tabulka `tenant_account_numbers`  
  - `id`, `tenants_id`, `account_number`, `sort_order`, `valid_from`, `valid_to` (soft delete).
- **Naplnění:** jednorázový skript / migrace: z `payments` (valid_to IS NULL) vybrat distinct `counterpart_account` + `contracts_id` → ze smlouvy `tenants_id` → pro každého nájemníka sesbírat unikátní čísla účtů a vložit do nové tabulky.

### 3.2 Platby – schválení
- **Migrace:**  
  `ALTER TABLE payments ADD COLUMN approved_at DATETIME NULL DEFAULT NULL AFTER payment_type;`
- Stávající platby: `UPDATE payments SET approved_at = COALESCE(valid_from, NOW()) WHERE valid_to IS NULL` (považovat za schválené).
- API (crud): při čtení plateb vracet `approved_at`; nové platby z FIO ukládat s `approved_at = NULL`. Endpoint pro hromadné schválení: např. `POST api/payments-approve.php` s tělem `{ "payment_ids": [1,2,3] }` nebo přes PATCH v crud.

### 3.3 FIO token u účtu
- **bank_accounts:** přidat sloupec `fio_token` VARCHAR(255) NULL (nebo šifrovaně v config) – token z FIO internetového bankovnictví pro „sledování účtu“.
- UI: v sekci Bankovní účty u každého účtu volitelně pole „FIO API token“ (typ password).

---

## 4. FIO API – stručně
- Dokumentace: [API Bankovnictví FIO](https://www.fio.cz/bankovni-sluzby/api-bankovnictvi) (PDF).
- Token: vytvoření v IB – Nastavení → API → přidat token, oprávnění „Pouze sledovat účet“.
- Export pohybů: typicky URL ve tvaru  
  `https://www.fio.cz/ib_api/rest/periods/{token}/YYYY-MM-DD/YYYY-MM-DD/transactions.json`  
  (ověřit v aktuální dokumentaci – může být `by-id`, `last`, atd.).
- Odpověď: seznam transakcí (datum, částka, protiúčet, zpráva pro příjemce, …). Podle toho párujeme protiúčet s nájemníkem a smlouvou.

---

## 5. Navržené fáze implementace

| Fáze | Obsah |
|------|--------|
| **A** | DB: tabulka čísel účtů u nájemníka + migrace naplnění z `payments.counterpart_account`. UI: záložka u Nájemníka „Účty“ – CRUD pro čísla účtů. |
| **B** | DB: `payments.approved_at` + migrace. API + UI: filtrovat / zobrazit platby ke schválení, hromadné schválení. |
| **C** | FIO: uložení tokenu u bank_accounts, PHP klient pro FIO API (export pohybů za období). |
| **D** | Prvotní sync: u smlouvy „Načíst z FIO“ → stáhnout pohyby, diff s DB, vložit chybějící jako platby s `approved_at = NULL`. |
| **E** | Průběžná kontrola: cron/job jednou denně, pro aktivní smlouvy + účty nájemníků kontrola FIO, nové platby do evidence ve stavu ke schválení. |

---

## 6. Otevřené body k rozhodnutí
- Přesný formát FIO API (URL, JSON) dle aktuálního PDF.
- Zda platby „ke schválení“ započítávat do součtů na dashboardu (např. šedě) nebo až po schválení.
- Zda průběžnou kontrolu spouštět jako cron na serveru, nebo „tlačítko Zkontrolovat“ v UI (bez cronu).

Pokud budeš chtít, další krok může být konkrétní migrace a změny v kódu pro **fázi A** (účty u nájemníka) a **fáze B** (approved_at + hromadné schválení).
