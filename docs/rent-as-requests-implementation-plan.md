# Nájem jako požadavky na platbu – plán implementace

Plán zásadní předělávky: nájem = požadavky typu `rent` s obdobím, propojení plateb s požadavky jednotně, kauce a vrácení kauce. **Master zůstává nedotčen až do schválení a merge.**

---

## 1. Stav: máme kompletní informace pro implementaci a migraci

### Sjednaná pravidla (zdroj pravdy)

- **Požadavky:** Nájem = požadavek typu `rent` s `period_year`, `period_month`. UNIQUE(contracts_id, period_year, period_month) pro typ rent (jedna smlouva = max jeden rent na měsíc).
- **Při ukládání smlouvy:** Pro každý měsíc v rozsahu find by contract+period → pokud existuje a **něco se změnilo**, UPDATE; jinak ponechat. Pokud neexistuje, INSERT. Měsíce mimo nový rozsah: **smazat jen neuhrazené** požadavky; uhrazené nechat.
- **Propojení:** Libovolná platba může být propojena s libovolným požadavkem. Jedna vazba: `payment_requests.payments_id` (bez tabulky `payment_allocations`). Jedna platba může být uvedená u více požadavků (stejné `payments_id`).
- **Kauce:** Část kauce se „kryje“ propojením s požadavky (nájem, energie…). Zbytek = jeden požadavek „Vrácení kauce“; ten se uhradí až reálnou odchozí platbou (propojit s tímto požadavkem).
- **Import z banky:** `payment_imports` → schválení → vytvoření `payments` → volitelně propojení s `payment_request_id` (nastavení `payment_requests.payments_id`). Žádná změna konceptu.

### Co implementovat (shrnutí kroků z dřívějšího plánu)

1. **DB:** `payment_requests` – doplnit `period_year`, `period_month`; typ `rent`; UNIQUE pro rent (contracts_id, period_year, period_month).
2. **Backend:** Sync rent požadavků při uložení smlouvy (find → UPDATE jen při změně / INSERT; mimo rozsah mazat jen neuhrazené).
3. **Backend:** Heatmapa/předpis = součet požadavků za měsíc (včetně rent); uhrazeno = platby propojené s požadavky.
4. **Migrace dat:** Vygenerovat rent požadavky pro existující smlouvy; propojit existující rent platby s odpovídajícím rent požadavkem (contract + period).
5. **Backend:** Při ukládání platby typu rent s obdobím auto-propojit s rent požadavkem.
6. **API/Frontend:** Smlouva → sync; Požadavky zobrazit rent; platba kauce → propojit s požadavky, zbytek = požadavek Vrácení kauce; vrácení = odchozí platba propojená s tímto požadavkem.

---

## 2. Řízení projektu: větev, staging, ochrana masteru

### Zásady

- **Master se nesmí porušit.** Žádné přímé commity do `main`/`master` související s touto předělávkou.
- **Všechna vývojová práce jen ve feature větvi.** Merge do master až po odladění na stagingu a explicitním schválení.
- **Staging = Railway** (nebo jiný hosting) s **kopií produkční databáze**. Migrace a změny se nejdřív testují na kopii; při problémech lze porovnávat s produkcí.

### Doporučená větev

- Název: **`feature/rent-as-payment-requests`** (nebo `epic/rent-as-requests`).
- Vytvořit z aktuálního **master** po zálohování / označení stavu (tag `pre-rent-as-requests` na master před prvním merge zpět).

### Railway (staging)

- **Účel:** Nasazení kódu z feature větve na veřejnou URL, napojení na **kopii** produkční DB.
- **Kroky nastavení:**
  1. Projekt na [Railway](https://railway.app): nový projekt napojený na tento repo.
  2. **Build/Deploy:** zdroj = větev `feature/rent-as-payment-requests` (ne master). Při pushu do této větve se přebuildí a nasadí staging.
  3. **Databáze:** V Railway vytvořit MySQL (nebo použít externí). **Důležité:** Naplnit ji **kopií** produkční databáze (export z produkce → import do Railway DB). Periodicky podle potřeby obnovovat kopii, aby staging odpovídal reálným datům.
  4. **Env:** Staging app má `DATABASE_URL` (nebo stávající DB proměnné) ukazující na tuto **kopii**. Produkce používá původní DB.
- **Výhody:** Odladění migrací a chování bez rizika pro živá data; možnost porovnat výsledky (export z staging DB vs export z prod) a ověřit konzistenci.

### Konzistence masteru

- Na **master** se merguje až když:
  - všechny plánované fáze jsou hotové a otestované na stagingu,
  - migrace proběhla na **kopii** DB bez chyb a data jsou ověřená,
  - je připraven migrační postup pro **produkční** DB (stejné migrační skripty, záloha před migrací).
- Před merge: **záloha produkční DB**. Po merge: deploy na produkci (stávající GitHub Actions/FTP), potom **jednorázové spuštění migrace** na produkční DB (např. přes `migrate.php` nebo ručně).

---

## 3. Fáze implementace (pořadí)

### Fáze 0: Příprava (bez změn v masteru)

- [x] Vytvořit větev `feature/rent-as-payment-requests` z master.
- [ ] Označit master tagem `pre-rent-as-requests` (volitelně).
- [ ] Nastavit Railway: projekt, deploy z feature větve, DB = kopie produkce.
- [ ] Ověřit, že na stagingu běží aktuální stav aplikace s kopií DB.

### Fáze 1: Datový model a migrace schématu

- [x] Migrace: `payment_requests` – sloupce `period_year`, `period_month` (pokud chybí).
- [x] Migrace: typ `rent` v ENUM (pokud chybí).
- [x] Migrace: UNIQUE constraint pro rent (contracts_id, period_year, period_month) – pouze pro řádky s type='rent'.
- [ ] Spustit **jen na kopii DB (Railway)**. Ověřit, že aplikace po deployi z větve stále funguje (čtení, zápis bez nové logiky).

### Fáze 2: Backend – generování a sync rent požadavků

- [x] Funkce sync rent požadavků pro smlouvu: pro každý měsíc v rozsahu find → porovnat hodnoty → UPDATE jen při změně, jinak INSERT. Mimo rozsah: smazat jen neuhrazené.
- [x] Volání sync při ukládání/změně smlouvy (API). Sync se volá i po add/edit contract_rent_changes.
- [ ] Test na stagingu: úprava smlouvy (nájem, rozsah) → kontrola, že vznikají/aktualizují se jen očekávané řádky, žádné zbytečné soft-update.

### Fáze 3: Heatmapa a předpisy

- [x] Rent požadavky vyloučeny z `paymentRequestsByContractMonth/PropertyMonth` (type!='rent') aby nedocházelo k dvojímu počítání.
- [x] Nájem zatím z `getExpectedRentForMonth`, rent požadavky slouží pro propojení platba↔požadavek.
- [x] Uhrazeno = platby propojené s požadavky (heatmapPaymentsByContract).

### Fáze 4: Migrace dat (jen na kopii DB)

- [x] PHP skript `migrations/062_generate_rent_requests.php` – volá syncRentPaymentRequests + propojuje platby.
- [x] Web endpoint `api/migrate-062.php?key=MIGRATE_KEY` pro spuštění 062 na Railway (kde není CLI).
- [ ] Spustit na kopii DB. Kontrola heatmapy před a po.

**Jak spustit na Railway dev:** (1) Nejdřív spusť SQL migrace: `GET api/migrate.php?key=MIGRATE_KEY`. (2) Pak spusť 062: `GET api/migrate-062.php?key=MIGRATE_KEY`. Bez provedené migrace 060 sloupce `period_year`/`period_month` v `payment_requests` chybí a 062 i Zúčtování kauce selžou.

### Fáze 5: Backend – auto-propojení platby s rent požadavkem

- [x] Při ukládání platby typu rent: auto-link s rent požadavkem (`crud.php`).
- [x] Při schvalování importu z banky: auto-link (`payment-imports-approve.php`).

### Fáze 6: API a frontend

- [x] Sync rent požadavků při add/edit smlouvy i contract_rent_changes.
- [x] Sekce Požadavky: typ rent v labelu a type dropdown (dashboard.js, contracts.js, index.html).
- [ ] Platba kauce: UI „Propojit s požadavky“, zobrazení zbývajícího z kauce, vytvoření požadavku „Vrácení kauce“.
- [x] UI Vyúčtování energií – modal, backend api/settlement.php.
- [x] UI Zúčtování kauce – modal, backend api/settlement.php.

### Fáze 7: Testování a příprava na merge

- [ ] Projít kritické scénáře na stagingu (nová smlouva, změna nájmu, kauce, vrácení, import z banky, vyúčtování, zúčtování kauce).
- [ ] Migrační postup: záloha DB → migrace 060+061 → PHP skript 062 → rollback plán.
- [ ] Code review, schválení, merge do master.
- [ ] Záloha produkční DB. Deploy. Migrace.

---

## 4. Rollback

- **Před merge:** Stačí nemergovat a zůstat na větvi; master beze změn.
- **Po merge a migraci na prod:** Rollback = obnova DB ze zálohy + deploy předchozí verze z master (revert merge). Proto je záloha před migrací povinná.

---

## 5. Dokumentace a odkazy

- Koncepce plateb a požadavků: tento plán + `docs/najemni-smlouva-platby.md`, `docs/heatmap-predpis-platby-logika.md`.
- Stávající deploy: `.github/workflows/deploy.yml`, README – produkce zůstává na stávajícím mechanismu; Railway pouze pro staging z feature větve.
