# Zavedení nájemní smlouvy včetně plateb

Návod pro vytváření migrace, která do systému zavede novou nájemní smlouvu včetně nájemce, nemovitosti, plateb a požadavků na platbu. **Vzorová migrace:** `migrations/058_kinclova_dominika_interbrigadistu.sql`.

---

## Pravidla před zápisem do SQL (AI/agent)

1. **Datum smlouvy a datumy plateb**  
   Vždy pohlídej a ověř:
   - **contract_start**, **contract_end** – odpovídají smlouvě.
   - **deposit_paid_date**, **deposit_return_date** – podle smlouvy nebo výpisu.
   - Datumy všech plateb (payment_date) – musí být konzistentní s obdobím smlouvy a bankovním výpisem.  
   Při rozporu nebo nejasnosti nehádej – zeptej se nebo upozorni.

2. **Soupis před vložením**  
   Před samotným zápisem do souboru migrace (.sql) **vždy** předlož uživateli **soupis detekovaných hodnot**, např.:
   - Nájemce (jméno, údaje)
   - Nemovitost (název, adresa)
   - Smlouva (od–do, měsíční nájem, first_month_rent, kauce, datum úhrady/vrácení kauce)
   - Změny nájmu (od kdy, částka)
   - Účet nájemce (protiúčet)
   - Přehled plateb (první měsíc, kauce, měsíční, vrácení kauce, vyúčtování)
   - Požadavky na platbu (kauce, vrácení kauce, vyúčtování)  
   Teprve **po explicitním souhlasu** uživatele napiš nebo doplň SQL do migrace.

3. **Kde si nejsi jistý**  
   Kdykoli si nejsi jistý (nejasný údaj ve smlouvě, chybějící údaj, rozpor mezi smlouvou a výpisem, nejasné období), **informuj o tom uživatele** a nepředpokládej hodnoty bez potvrzení.

---

## Checklist (nic nevynechat)

1. [ ] **Nájemce** (tenants) – INSERT jen když neexistuje, doplnit tenants_id
2. [ ] **Nemovitost** (properties) – INSERT jen když neexistuje, doplnit properties_id
3. [ ] **Bankovní účet** pronajímatele – @ba_id podle čísla účtu nebo is_primary
4. [ ] **Smlouva** (contracts) – monthly_rent = nájem + zálohy, first_month_rent, kauce, deposit_return_date, default_bank_accounts_id
5. [ ] **Změny nájmu** (contract_rent_changes) – pokud během smlouvy nájem roste
6. [ ] **Účet nájemce** (tenant_bank_accounts) – číslo protiúčtu pro FIO párování
7. [ ] **Platby** (payments) – první měsíc, kauce, měsíční nájemné, vrácení kauce, vyúčtování; všechny s approved_at
8. [ ] **Požadavky na platbu** (payment_requests) – kauce, vrácení kauce, vyúčtování; každý provázaný na platbu (payments_id, paid_at)

---

## 1. Nájemce (tenants)

- **Kdy:** Jen pokud v DB ještě není (NOT EXISTS podle jména, např. obě části LIKE).
- **Sloupce:** tenants_id (NULL), name, type ('person'), birth_date, email, phone, address, valid_from, valid_to, valid_user_*, …
- **Po INSERT:** `UPDATE tenants SET tenants_id = id WHERE tenants_id IS NULL AND name = '...'`.
- **Proměnná:** `SET @tenants_id := (SELECT COALESCE(tenants_id, id) FROM tenants WHERE valid_to IS NULL AND name LIKE '%X%' AND name LIKE '%Y%' LIMIT 1)`.

---

## 2. Nemovitost (properties)

- **Kdy:** Jen pokud neexistuje (NOT EXISTS podle name nebo address).
- **Sloupce:** properties_id (NULL), name, address, type ('apartment', 'garage', …), valid_*.
- **Po INSERT:** UPDATE properties_id = id.
- **Proměnná:** @properties_id.

---

## 3. Bankovní účet pronajímatele

- `SET @ba_id := (SELECT COALESCE(bank_accounts_id, id) FROM bank_accounts WHERE valid_to IS NULL AND (account_number LIKE '7770101774%' OR is_primary = 1) ORDER BY is_primary DESC, sort_order, id LIMIT 1)`.

---

## 4. Smlouva (contracts)

- **monthly_rent:** Pokud smlouva uvádí „nájem + zálohy“, ukládej **součet** (např. 7 500 + 1 400 = 8 900).
- **first_month_rent:** Zkrácená platba za první měsíc (poměrný nájem + zálohy, nebo jen nájem – dle smlouvy).
- **deposit_amount, deposit_paid_date, deposit_return_date:** Kauce a datum její úhrady a vrácení.
- **default_payment_method:** 'account'.
- **default_bank_accounts_id:** @ba_id.
- INSERT jen pokud pro danou dvojici tenant+property a contract_start smlouva neexistuje.
- Po INSERT: UPDATE contracts SET contracts_id = id.
- **Proměnná:** @contracts_id.

---

## 5. Změny nájmu (contract_rent_changes)

- Pokud v průběhu smlouvy nájem roste (např. od 4/2022), vložit řádek: contracts_id, amount (celkové nájemné v Kč, např. 9 400), effective_from (první den měsíce, např. 2022-04-01).
- NOT EXISTS podle contracts_id a effective_from.
- Po INSERT doplnit contract_rent_changes_id = id.

---

## 6. Účet nájemce (tenant_bank_accounts)

- Číslo protiúčtu z bankovního výpisu (např. 2799423133/0800) pro párování importů z FIO.
- INSERT s tenants_id, account_number, valid_*.
- NOT EXISTS podle tenants_id a TRIM(account_number).
- Po INSERT: UPDATE tenant_bank_accounts_id = id.

---

## 7. Platby (payments)

- **payment_type:** rent | deposit | deposit_return | energy | other.
- **První měsíc:** jedna platba typu rent se skutečnou částkou (zkrácená).
- **Kauce:** jedna platba deposit, kladná částka.
- **Měsíční nájemné:** po měsících, rent; částka podle období (před/po změně nájmu).
- **Vrácení kauce:** jedna platba deposit_return, **záporná** částka (např. -15000).
- **Vyúčtování / přeplatek:** other (nebo dle konvence), záporná částka, note.
- **approved_at:** vyplnit (např. payment_date), aby se platby braly jako uhrazené v kalendáři.
- **currency:** 'CZK'.
- **payment_method:** 'account'.
- **bank_accounts_id:** @ba_id.
- Idempotence: NOT EXISTS podle contracts_id, period_year, period_month, payment_date, amount.
- Po vložení všech plateb: `UPDATE payments SET payments_id = id WHERE payments_id IS NULL AND contracts_id = @contracts_id AND payment_date BETWEEN '...' AND '...'`.

---

## 8. Požadavky na platbu (payment_requests) – důležité

Bez propojení s payment_requests zůstanou kauce a vyúčtování v aplikaci „neuzavřené“. Pro každou relevantní platbu vytvoř záznam v payment_requests a propoj ho.

1. **Po vložení plateb** načti entity_id plateb:
   - @pay_deposit_id – platba type deposit, amount např. 15000
   - @pay_deposit_return_id – platba type deposit_return, amount -15000
   - @pay_settlement_id – platba vyúčtování (type other, amount např. -1657)

2. **INSERT payment_requests:**
   - **Kauce:** type 'deposit', amount 15000, due_date a paid_at = datum úhrady, payments_id = @pay_deposit_id.
   - **Vrácení kauce:** type 'deposit_return', amount 15000 (co vracíme), paid_at = datum vrácení, payments_id = @pay_deposit_return_id.
   - **Vyúčtování:** type 'settlement' (nebo 'other'), amount může být záporné (-1657), note (např. přeplatek 2021+2022), paid_at, payments_id = @pay_settlement_id.

3. NOT EXISTS pro každý typ, aby se nekladly duplicity.
4. Po každém INSERT: `UPDATE payment_requests SET payment_requests_id = id WHERE payment_requests_id IS NULL AND ...`.

---

## Idempotence a soft-update

- Všechny INSERTy chránit NOT EXISTS (nebo ekvivalentem), aby opakované spuštění migrace nekladlo duplicity.
- U tabulek se soft-update po INSERT vždy doplnit `{tabulka}_id = id` pro nové řádky (tenants_id, properties_id, contracts_id, payments_id, payment_requests_id, tenant_bank_accounts_id, contract_rent_changes_id).

---

## Číslování a popis

- Soubor: `migrations/NNN_popis.sql`, kde NNN je další volné číslo.
- V úvodním komentáři uvést: nájemce, nemovitost, zvláštnosti (nájem+zálohy, první měsíc zkrácený, kauce, vyúčtování).
