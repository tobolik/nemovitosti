# Demo data pro veřejnou beta

Pro veřejné beta testování je potřeba vytvořit **anonymizovaná demo data**, aby testeři viděli reálný stav aplikace bez reálných osobních údajů.

---

## Zdroj

- **sql-dump-2026-02-04.sql** – export produkční (nebo vývojové) databáze s reálnými tabulkami a vztahy.

---

## Cíl

- Nový soubor (např. **demo-data.sql** nebo **seed-demo.sql**) nebo skript, který:
  1. Vytvoří strukturu DB (schema + migrace) nebo použije prázdnou DB.
  2. Vloží **anonymizovaná** data odvozená z dumpu:
     - **users:** 1–2 demo účty (např. admin@propmanager.demo / heslo „demo“, user / „demo“).
     - **properties:** nemovitosti s generickými názvy („Byt Praha 1“, „Garáž Brno“, …), adresy zkrácené nebo náhradní (ulice bez čísla, nebo fiktivní).
     - **tenants:** nájemníci s fiktivními jmény („Jan Demo“, „Firma s.r.o.“), anonymizované e-maily (demo@example.com), telefon/IC/DIC nahrazeny nebo vynechány.
     - **contracts:** vazby properties_id, tenants_id zachovat (entity_id), datumy a částky lze zjednodušit (např. poslední 2 roky).
     - **payments:** vzorové platby přiřazené ke smlouvám; částky a datumy konzistentní s nájmem.
     - **bank_accounts, contract_rent_changes, payment_requests:** zredukovat na minimum (1–2 účty, pár změn nájmu, pár požadavků), všechna citlivá data nahradit.

---

## Anonymizační pravidla

| Tabulka / pole | Akce |
|----------------|------|
| users.email | např. admin@propmanager.demo, user@propmanager.demo |
| users.name | „Demo Admin“, „Demo User“ |
| users.password_hash | hash pro známé heslo (např. „demo“) |
| properties.name | „Byt 1“, „Garáž A“, „Dům demo“ |
| properties.address | zkrácená / generická („Hlavní 1, Praha“, „U Garáží 2“) |
| properties.note | vyprázdnit nebo obecný text |
| tenants.name | „Jan Demo“, „Marie Demo“, „Firma Demo s.r.o.“ |
| tenants.email | demo@example.com nebo tenant1@demo.local |
| tenants.phone, .ic, .dic, .address | vyprázdnit nebo fiktivní (např. 111222333, 00000000) |
| contracts.contract_url, note | vyprázdnit nebo „Demo smlouva“ |
| payments.note, counterpart_account | vyprázdnit nebo generické |
| bank_accounts.account_number | např. 1234567890/0800 (fiktivní) |
| bank_accounts.name | „Demo účet“ |

---

## Postup vytvoření demo dat

1. **Z dumpu vybrat jen aktivní záznamy**  
   Všechny dotazy berou jen `valid_to IS NULL`; do demo dát pouze tyto řádky (nebo jejich rozumnou podmnožinu).

2. **Změnit citlivé sloupce**  
   Pro každou tabulku projít výše uvedená pole a přepsat na demo hodnoty. Lze to udělat:
   - ručně v SQL (UPDATE po importu), nebo
   - skriptem (PHP/Python), který načte dump, upraví řádky a vypíše nový SQL, nebo
   - připraveným „demo“ dumpem, kde už jsou hodnoty nahrazené.

3. **Zredukovat objem**  
   - Např. max. 5–7 nemovitostí, 10 nájemníků, 10–15 smluv, platby za posledních 12–24 měsíců.
   - _migrations nechat tak, aby odpovídaly schema; nebo demo DB naplnit jen z `schema.sql` + jeden „demo“ seed soubor bez historie migrací.

4. **Uživatelé**  
   - Smazat reálné uživatele z dumpu a vložit 1–2 demo účty s předem známým heslem (uvedeným v README nebo na přihlašovací stránce pro beta).

---

## Výstup

- **docs/demo-data-instructions.md** – krátký návod pro správce: jak naplnit DB demo daty (např. `mysql ... < demo-data.sql`).
- **demo-data.sql** (nebo **seed-demo.sql**) – samotný SQL soubor s anonymizovanými daty, připravený k importu do čisté DB (po schema + migracích).

Tím bude možné nabídnout veřejné beta s předvyplněnou demo databází bez úniku reálných údajů.
