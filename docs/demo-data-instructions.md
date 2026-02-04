# Návod: Demo data pro beta

## Rychlé demo (bez dumpu)

Soubor **seed-demo.sql** (v kořeni projektu) vytvoří minimální demo data: 2 uživatele, 3 nemovitosti, 3 nájemníky, několik smluv a plateb.  
Vhodné pro rychlé vyzkoušení aplikace.

**Použití:**

1. DB již existuje (schema + migrace aplikované).
2. `mysql -u USER -p DB_NAME < seed-demo.sql`
3. Přihlášení: **admin@propmanager.demo** / **demo** (nebo user z seed-demo.sql).

---

## Plné demo z sql-dump-2026-02-04.sql (anonymizace)

Chcete-li vytvořit demo data **odvozená od reálného dumpu** (zachovat strukturu a vztahy, ale anonymizovat údaje):

### Krok 1: Import do dočasné DB

```bash
mysql -u root -p -e "CREATE DATABASE demo_source;"
mysql -u root -p demo_source < sql-dump-2026-02-04.sql
```

### Krok 2: Anonymizace (SQL)

Spusťte v DB `demo_source` např.:

```sql
-- Uživatelé: demo účty
UPDATE users SET email = CONCAT('user', id, '@propmanager.demo'), name = CONCAT('Demo ', name) WHERE valid_to IS NULL;
-- (nebo smazat a vložit 2 nové řádky s heslem hash pro 'demo')

-- Nemovitosti
UPDATE properties SET name = CONCAT('Nemovitost ', id), address = CONCAT('Adresa ', id), note = NULL WHERE valid_to IS NULL;

-- Nájemníci
UPDATE tenants SET name = CONCAT('Nájemník ', id), email = CONCAT('tenant', id, '@demo.local'), phone = NULL, ic = NULL, dic = NULL WHERE valid_to IS NULL;

-- Bankovní účty
UPDATE bank_accounts SET name = CONCAT('Účet ', id), account_number = CONCAT('000000000', id, '/0800') WHERE valid_to IS NULL;
```

(Pro úplnost je vhodné přidat i úpravy u contracts.contract_url, payments.note, payment_requests.note – nastavit na NULL nebo „Demo“.)

### Krok 3: Export

```bash
mysqldump -u root -p demo_source > demo-data.sql
```

Tím získáte **demo-data.sql** připravený k nasazení na beta prostředí.  
Detaily a pravidla anonymizace jsou v [DEMO-DATA.md](DEMO-DATA.md).
