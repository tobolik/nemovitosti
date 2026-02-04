# Automatizované testy

Návrh a postup pro zavedení automatizovaných testů (API a základní UI).

---

## 1. Testování API (PHP)

### Nástroj

- **PHPUnit** (nebo jednoduché PHP skripty s `assert`) pro unit/integration testy.
- Testy volají API endpointy (auth, crud, dashboard) s testovací DB nebo mockem.

### Co testovat

1. **auth.php**
   - GET bez session → 401.
   - POST login s nesprávným heslem → chyba.
   - POST login s správnými údaji → 200, vrací user + csrf.
   - POST logout s platným CSRF → 200.

2. **crud.php**
   - GET bez přihlášení → 401.
   - GET ?table=properties s přihlášením → 200, pole záznamů.
   - GET ?table=properties&id=1 s přihlášením → 200, jeden záznam (nebo 404).
   - POST add (properties) s platným CSRF a povinnými poli → 201, vrací záznam.
   - POST edit s neexistujícím id → 404.
   - POST delete → 200; následný GET téhož id (entity) podle soft-delete buď 404, nebo prázdný.

3. **dashboard.php**
   - GET bez přihlášení → 401.
   - GET s přihlášením a rokem → 200, struktura s contracts, properties, heatmap, stats.

4. **CSRF**
   - POST add/edit/delete bez hlavičky X-CSRF-Token nebo s neplatným tokenem → 403.

### Struktura

```
tests/
  bootstrap.php    # načte config pro test DB, session
  ApiAuthTest.php
  ApiCrudTest.php
  ApiDashboardTest.php
```

### Spuštění

```bash
composer require --dev phpunit/phpunit
./vendor/bin/phpunit tests
```

(Pokud projekt nepoužívá Composer, lze psát jednoduché PHP skripty a spouštět je přes `php tests/ApiAuthTest.php` s vlastním assertem.)

---

## 2. Testování frontendu (JS / E2E)

### Možnosti

- **Manuální:** Checklist v README nebo TEST_REPORT.md pro kritické cesty (přihlášení, přidání nemovitosti, smlouvy, platby).
- **Automatizované E2E:** Playwright nebo Cypress – otevření aplikace, přihlášení, kliknutí na sekce, ověření že se načtou data a že formuláře fungují.

### Doporučené E2E scénáře

1. Přihlášení → zobrazení dashboardu.
2. Navigace na Nemovitosti → seznam nemovitostí.
3. Přidání platby (vybrat smlouvu, vyplnit částku, uložit) → platba se objeví v seznamu.
4. Platební kalendář (heatmap) → zobrazení měsíců a částek.

### Struktura (příklad s Playwright)

```
tests/
  e2e/
    auth.spec.js
    payments.spec.js
playwright.config.js
```

---

## 3. CI (GitHub Actions)

- Workflow: na push/PR spustit PHPUnit (a případně E2E proti testovací instanci).
- Testovací DB: např. SQLite pro rychlé testy nebo izolovaná MySQL/MariaDB s fixture z `schema.sql` + seed.

---

## 4. Současný stav projektu

- V repozitáři existuje **TEST_REPORT.md** (manuální testování).
- Automatizované testy (PHPUnit / Playwright) zatím nejsou v repozitáři zavedeny.

**Další krok:** Přidat `tests/` s bootstrapem a alespoň základními API testy (auth, crud GET + jeden POST), poté rozšířit podle potřeby.
