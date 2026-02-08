# Heatmapa – skládání předpisů a započtení plateb

Popis toho, jak se v heatmapě (platební kalendář po měsících a nemovitostech) skládá **očekávaná částka** (předpis) a **uhrazená částka** (platby), a kde byl nalezen rozpor oproti datům v dumpu.

---

## 1. Požadavky na platbu (předpisy) – `payment_requests`

- **Zdroj:** Tabulka `payment_requests`, řádky s `valid_to IS NULL` a `due_date IS NOT NULL`.
- **Přiřazení k měsíci:** Měsíc = **`date('Y-m', due_date)`** – tedy předpis se vždy přiřadí do měsíce podle **splatnosti** (`due_date`).
- **Indexace:**
  - `paymentRequestsByContractMonth[contracts_id][monthKey]` = součet částek předpisů dané smlouvy se splatností v daném měsíci.
  - `paymentRequestsByPropertyMonth[properties_id][monthKey]` = součet předpisů všech smluv dané nemovitosti se splatností v daném měsíci (přes `contractToProperty`).
- **Typy:** `deposit`, `deposit_return`, `energy`, `settlement`, `other`; u `deposit_return` se kladná částka v kódu otočí na zápornou.

**Pro buňku heatmapy (nemovitost + měsíc):**  
Očekávaná částka z předpisů = **`paymentRequestsByPropertyMonth[propEntityId][monthKey]`** – tedy **všechny** předpisy s `due_date` v tom měsíci u **libovolné** smlouvy dané nemovitosti.

---

## 2. Platby – `payments`

- **Zdroj:** Tabulka `payments`, JOIN na `contracts` (`c.contracts_id = p.contracts_id`, `c.valid_to IS NULL`), `p.valid_to IS NULL`, a buď `p.approved_at IS NOT NULL`, nebo `p.payment_type IN ('deposit','deposit_return','other')`.
- **Přiřazení k měsíci (klíč `monthKey`):**
  - **Kauce a vrácení kauce** (`payment_type` = `deposit` / `deposit_return`) a platba má `payment_date`:  
    **`monthKey = date('Y-m', payment_date)`** – měsíc podle data skutečné platby.
  - **Ostatní** (nájem, energie, vyúčtování atd.):  
    **`monthKey = period_year + '-' + period_month`** – měsíc podle období (period).
- **Indexace:** `paymentsByContract[contracts_id][monthKey]` – platby jsou seskupeny jen **po smlouvách** (entity id smlouvy).

**Pro buňku heatmapy (nemovitost + měsíc):**  
V současné implementaci se „uhrazeno“ skládá **pouze z plateb smluv, které jsou v daném měsíci aktivní** (viz krok 3 – candidates).

---

## 3. Výběr smluv pro měsíc (candidates)

Pro danou nemovitost a měsíc (např. prosinec 2022) se určí **candidates** = smlouvy, které:
- patří dané nemovitosti (`properties_id` = id nemovitosti),
- mají alespoň jeden den v tom měsíci:  
  **`contract_start <= lastDayOfMonth`** a **`contract_end` je NULL nebo `contract_end >= firstOfMonth`**.

Příklad (Byt Interbrigadistů, prosinec 2022):
- Smlouva **42** (Kinclová): 2021-03-01 až 2022-12-31 → **je candidate**.
- Smlouva **2** (Bednaříková): začátek 2023-01-01 → **není candidate** (smlouva v prosinci 2022 ještě neběžela).

---

## 4. Skládání buňky heatmapy

### Když **není** žádný candidate (měsíc bez aktivní smlouvy)

- Použije se větev „jen platba / jen předpis“.
- **Očekávané:** pouze `paymentRequestsByPropertyMonth` (nájem 0).
- **Uhrazené:** platby **všech** smluv dané nemovitosti v tom měsíci (projede se `contractsForProperty` a sčítá se z `paymentsByContract`).  
→ Kauce zaplacená před začátkem smlouvy se zde započítá správně.

### Když **je** alespoň jeden candidate

- **Očekávané:**
  - Nájem: součet `getExpectedRentForMonth(c, year, m)` pouze pro **candidates**.
  - Předpisy: **`paymentRequestsByPropertyMonth[propEntityId][monthKey]`** – tedy celá nemovitost, **včetně** předpisů smluv, které v tom měsíci nejsou aktivní (např. kauce splatná 31.12. u smlouvy začínající 1.1.).
- **Uhrazené (BUG):**  
  Sčítají se **jen** platby z **candidates** (`$paid = $paymentsByContract[$entityId][$monthKey]` pro každého candidate).  
  Platby smluv, které v tom měsíci **nejsou** candidates (např. kauce zaplacená 31.12. u smlouvy 2), se **nezapočítají**.

---

## 5. Konkrétní rozpor (dump sql-dump-2026-02-08a.sql)

- **Nemovitost:** Byt Interbrigadistů (properties_id = 2).
- **Měsíc:** 2022-12 (prosinec 2022).

**Předpisy (očekávané):**
- Předpis kauce smlouvy 2: `contracts_id=2`, `due_date=2022-12-31`, 16 000 Kč → jde do `paymentRequestsByPropertyMonth[2]['2022-12']`.
- Smlouva 42 v 12/2022: nájem (getExpectedRentForMonth) = 8 900 Kč (nebo 9 400 podle změn nájmu).
- **Celkem očekávané:** nájem (Kinclová) + 16 000 ≈ 25 400 Kč.

**Platby:**
- Platba 91: smlouva 2, kauce 16 000, `payment_date=2022-12-31` → v kódu jde do `paymentsByContract[2]['2022-12']`.
- Platba 458 (nebo odpovídající): smlouva 42, nájem 9 400 za 2022-12 → `paymentsByContract[42]['2022-12']`.

**Co kód dělá:**
- Candidates pro 2022-12 = jen smlouva 42 (smlouva 2 v prosinci ještě neběží).
- **Očekávané:** 9 400 + 16 000 = 25 400 ✓ (předpis kauce se bere z property měsíce).
- **Uhrazené:** bere se jen z candidates → jen platby smlouvy 42 → 9 400. Platba 91 (16 000) se **nezapočítá**, protože smlouva 2 není candidate.
- **Výsledek:** buňka ukazuje očekávané 25 400, uhrazené 9 400 → „nedoplaceno“ 16 000, i když kauce v dumpu je zaplacená a přiřazená k 12/2022.

**Příčina:** Předpisy se berou na úrovni **nemovitosti + měsíce** (všechny smlouvy), zatímco uhrazené platby se berou jen od **smluv aktivních v tom měsíci**. Kauce (a případně jiné platby) s `payment_date` v daném měsíci, které patří smlouvě ještě neaktivní v tom měsíci, se do „uhrazeno“ nedostanou.

---

## 6. Oprava (implementováno)

- **Heatmapa – varianta B:** Pro buňky heatmapy se „uhrazeno“ za měsíc bere z **heatmapPaymentsByPropertyMonth**: platby jsou přiřazeny k měsíci podle **splatnosti (due_date)** propojeného požadavku (`payment_requests.due_date`), ne podle period/payment_date. Má-li platba propojený požadavek, měsíc = `date('Y-m', due_date)`; jinak fallback: platné období → period, jinak payment_date. Kauce se splatností 31. 12. tak spadá do prosince. Ostatní logika (přehled smluv, statistiky) používá dál `paymentsByContract` / `paymentsByPropertyMonth` (period/payment_date).

- Součet „uhrazeno“ zahrnuje kladné i záporné částky (žádné filtrování podle znaménka).

Dokument vytvořen při hledání chyby mezi zobrazením heatmapy a daty v `sql-dump-2026-02-08a.sql`.
