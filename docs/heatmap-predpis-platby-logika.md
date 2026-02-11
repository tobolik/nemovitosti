# Heatmapa a přehledy – algoritmus výpočtu Očekáváno / Uhrazeno

> **Verze dokumentu:** v2.5.0 (únor 2026)
> **Platí pro:** `api/dashboard.php`, `js/views/dashboard.js`, `api/settlement.php`

Tento dokument popisuje **kompletní logiku** výpočtu částek „Očekáváno" (Expected) a „Uhrazeno" (Paid) v heatmapě platebního kalendáře a v přehledu smluv. Je určen pro budoucí agenty/vývojáře, aby při úpravách nerozbili stávající chování.

---

## Obsah

1. [Přehled architektury](#1-přehled-architektury)
2. [Tabulka payment_requests – typy a pravidla](#2-tabulka-payment_requests--typy-a-pravidla)
3. [Výpočet „Očekáváno" (Expected)](#3-výpočet-očekáváno-expected)
4. [Výpočet „Uhrazeno" (Paid) – heatmap alokace](#4-výpočet-uhrazeno-paid--heatmap-alokace)
5. [Vyúčtování energií (energy_settlement)](#5-vyúčtování-energií-energy_settlement)
6. [Zúčtování kauce (deposit_settlement)](#6-zúčtování-kauce-deposit_settlement)
7. [Nesplněné požadavky (unfulfilled / oranžový badge)](#7-nesplněné-požadavky-unfulfilled--oranžový-badge)
8. [Frontend: modal breakdown a mirror logika](#8-frontend-modal-breakdown-a-mirror-logika)
9. [Kritická pravidla – NIKDY NEROZBIJ](#9-kritická-pravidla--nikdy-nerozbij)

---

## 1. Přehled architektury

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  payment_requests (DB)  │     │     payments (DB)         │
│  typy: rent, energy,    │     │  payment_type: rent,      │
│  deposit, deposit_return│     │  deposit, deposit_return,  │
│  settlement, other      │     │  energy, other             │
└────────────┬────────────┘     └────────────┬─────────────┘
             │                               │
             │  LEFT JOIN pr ON payments_id   │
             ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   api/dashboard.php                          │
│                                                             │
│  paymentRequestsSumByContract   ── celkové Expected (suma)  │
│  paymentRequestsByContractMonth ── měsíční Expected (suma)  │
│  paymentRequestsListByContractMonth ── měsíční display list │
│  heatmapPaymentsByContract      ── měsíční Paid (alokace)   │
│  hasUnfulfilledByContractMonth  ── oranžové badges           │
└─────────────────────────┬───────────────────────────────────┘
                          │ JSON API
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 js/views/dashboard.js                         │
│                                                             │
│  Heatmapa buněk: barva, tooltip, Expected vs Paid           │
│  Modal breakdown: amountContributingToMonth, renderExisting │
│  Přehled smluv: total_paid / expected_total, progress bar   │
└─────────────────────────────────────────────────────────────┘
```

### Tok dat

1. Backend (`dashboard.php`) načte `payment_requests` a `payments` z DB.
2. Aplikuje **filtrační pravidla** (viz sekce 2) a spočítá Expected i Paid částky za smlouvu a za měsíc.
3. Výsledek posílá jako JSON do frontendu.
4. Frontend (`dashboard.js`) renderuje heatmapu a při kliknutí na buňku otevírá modal, kde **znovu spočítá** příspěvek každé platby k danému měsíci pomocí funkce `amountContributingToMonth` (mirror PHP logiky).

---

## 2. Tabulka `payment_requests` – typy a pravidla

### Sloupce relevantní pro výpočty

| Sloupec | Popis |
|---------|-------|
| `contracts_id` | Entity ID smlouvy |
| `amount` | Částka (kladná = dluh nájemce, záporná = přeplatek/vrácení) |
| `type` | Typ požadavku (viz tabulka níže) |
| `due_date` | Datum splatnosti – klíč pro přiřazení k měsíci (`YYYY-MM`) |
| `paid_at` | Datum úhrady (NULL = neuhrazeno) |
| `payments_id` | Propojení se záznamem platby (entity_id z `payments`) |
| `settled_by_request_id` | ID settlement požadavku, který tuto zálohu „uzavřel" |
| `period_year`, `period_month` | Období (u rent, settlement) |
| `valid_to` | Soft-delete (NULL = aktivní záznam) |

### Typy a jejich role ve výpočtech

| Typ | Počítá se do Expected? | Počítá se do Paid? | Popis |
|-----|------------------------|--------------------|----|
| `rent` | ANO (přes `getExpectedRentForMonth`, ne přes `paymentRequestsSumByContract`) | ANO | Měsíční nájem – zpracovává se zvlášť |
| `energy` | ANO (pokud nemá `settled_by_request_id`) | ANO | Záloha na energie |
| `settlement` | ANO | ANO | Vyúčtování energií (nedoplatek/přeplatek) |
| `deposit` | **NE** | informačně (remainder zahozen) | Kauce – není závazek nájemce |
| `deposit_return` | **NE** | informačně (remainder zahozen) | Vrácení kauce – není závazek nájemce |
| `other` | ANO | ANO | Ostatní požadavky |

### Role `settled_by_request_id`

- Pokud má energy advance nenulové `settled_by_request_id`, znamená to, že tato záloha byla **pokryta vyúčtováním** energií.
- Takový záznam **zůstává v DB** (pro historii a zobrazení v modalu), ale je **vyloučen z Expected** a z **nesplněných požadavků**.
- Nastavuje se automaticky při akci `energy_settlement` (viz sekce 5).

---

## 3. Výpočet „Očekáváno" (Expected)

Expected se skládá ze dvou částí: **nájem** + **předpisy** (payment_requests).

### 3.1 Celkový Expected za smlouvu (`expectedTotalIncl`)

Používá se v přehledu smluv (progress bar „Uhrazeno / Očekáváno").

```
expectedTotalIncl = rentTotal + paymentRequestsSumByContract[contractId]
```

- **`rentTotal`**: součet `getExpectedRentForMonth(c, year, month)` za všechny měsíce trvání smlouvy.
- **`paymentRequestsSumByContract`**: viz níže.

### 3.2 `paymentRequestsSumByContract` (celkový součet předpisů)

**Soubor:** `api/dashboard.php`, řádky ~146–172

**SQL:**
```sql
SELECT contracts_id, type, amount, paid_at, settled_by_request_id
FROM payment_requests
WHERE valid_to IS NULL AND type != 'rent'
```

**PHP filtrace (v cyklu):**
```php
if (!empty($pr['settled_by_request_id'])) continue;  // settled zálohy
if (in_array($type, ['deposit', 'deposit_return'])) continue;  // kauce
```

**Výsledek:** `$paymentRequestsSumByContract[$cid]` = suma všech non-rent, non-deposit, non-settled požadavků dané smlouvy.

### 3.3 Měsíční Expected (`paymentRequestsByContractMonth`)

**Soubor:** `api/dashboard.php`, řádky ~415–464

**SQL:**
```sql
SELECT id, payment_requests_id, contracts_id, due_date, amount, type, note, paid_at, settled_by_request_id
FROM payment_requests
WHERE valid_to IS NULL AND due_date IS NOT NULL AND type != 'rent'
```

**PHP logika:**

1. **Vždy** se přidá do `paymentRequestsListByContractMonth` (display list pro modal).
2. **Jen pokud** NENÍ settled a NENÍ deposit/deposit_return, přidá se do `paymentRequestsByContractMonth` (Expected suma).

```php
$skipFromExpected = !empty($pr['settled_by_request_id']) || in_array($type, ['deposit', 'deposit_return']);
// display list: VŽDY
$paymentRequestsListByContractMonth[$cid][$monthKey][] = [...];
// Expected suma: JEN pokud $skipFromExpected === false
if ($skipFromExpected) continue;
$paymentRequestsByContractMonth[$cid][$monthKey] += $amt;
```

### 3.4 `getExpectedTotalForMonth` (nájem + předpisy za měsíc)

**Soubor:** `api/dashboard.php`, řádky ~80–86

```php
function getExpectedTotalForMonth($c, $year, $m, $rentChangesByContract, $paymentRequestsByContractMonth) {
    $rent = getExpectedRentForMonth($c, $year, $m, $rentChangesByContract);
    $requests = $paymentRequestsByContractMonth[$entityId][$monthKey] ?? 0;
    return round($rent + $requests, 2);
}
```

### 3.5 Rozlišení dvou datových struktur

| Struktura | Obsah | Účel |
|-----------|-------|------|
| `paymentRequestsByContractMonth` | Číselná suma za měsíc (float) | Výpočet Expected |
| `paymentRequestsListByContractMonth` | Pole objektů (id, amount, type, note, settled_by_request_id) | Zobrazení v modalu (včetně settled a deposit položek) |

**Důvod:** Modal potřebuje zobrazit **všechny** položky (i settled zálohy jako informační), ale do Expected se počítají pouze aktivní závazky.

---

## 4. Výpočet „Uhrazeno" (Paid) – heatmap alokace

### 4.1 Princip

Jedna platba (`payments`) může pokrývat **více měsíců** a **více požadavků** (linked requests). Alokace probíhá podle `due_date` propojených požadavků, nikoliv podle `period_year`/`period_month` platby.

### 4.2 `heatmapPaymentsByContract` (alokační smyčka)

**Soubor:** `api/dashboard.php`, řádky ~212–321

#### Krok 1: Načtení dat

```sql
SELECT p.payments_id, p.contracts_id, p.period_year, p.period_month,
       p.amount, p.payment_date, p.payment_type, p.bank_transaction_id,
       pr.due_date, pr.amount AS pr_amount, pr.type AS pr_type,
       pr.settled_by_request_id AS pr_settled_by
FROM payments p
JOIN contracts c ON c.contracts_id = p.contracts_id AND c.valid_to IS NULL
LEFT JOIN payment_requests pr ON pr.payments_id = p.payments_id AND pr.valid_to IS NULL
WHERE p.valid_to IS NULL
  AND (p.approved_at IS NOT NULL OR p.payment_type IN ('deposit','deposit_return','other'))
```

#### Krok 2: Seskupení po platbách

Výsledek se seskupí do `$heatmapByPayment[contractId_paymentId]`, každá skupina obsahuje:
- Metadata platby (`amount`, `period_year`, `period_month`, `payment_date`, `payment_type`)
- Pole `linked[]` – propojené požadavky (`due_date`, `amount`, `type`, `settled_by_request_id`)

#### Krok 3: Alokace linked requests

Pro každou platbu se iteruje přes `linked[]`:

```php
$isDepositPayment = in_array($group['payment_type'], ['deposit', 'deposit_return']);

foreach ($group['linked'] as $pr) {
    // SKIP: deposit/deposit_return linked requests
    if (in_array($prType, ['deposit', 'deposit_return'])) continue;
    // SKIP: settled zálohy
    if (!empty($pr['settled_by_request_id'])) continue;

    $monthKey = date('Y-m', strtotime($pr['due_date']));
    $amt = (float)$pr['amount'];

    // CAP: pro non-deposit platby, částka nesmí přesáhnout zbývající budget
    $shouldCap = !$isDepositPayment;
    if ($shouldCap && $payAmt >= 0 && $amt > 0) {
        $amt = min($amt, max(0, round($payAmt - $allocated, 2)));
    }
    $allocated += $amt;

    $heatmapPaymentsByContract[$eid][$monthKey]['amount'] += $amt;
}
```

**Proč se deposit linked requests přeskakují?**
Platba kauce (18 000 Kč) pokrývá různé požadavky (nájem, energie, settlement). Linked requests u deposit platby zahrnují i samotný `deposit` request, který se **nesmí** počítat do Paid, protože kauce není závazek – je to složená jistota.

#### Krok 4: Remainder (zbytek)

```php
$remainder = round($payAmt - $allocated, 2);

// Deposit/deposit_return: remainder se ZAHAZUJE
if (!$isDepositPayment && $remainder > 0) {
    $monthKey = $periodKey ?: $fallbackMonthKey;
    $heatmapPaymentsByContract[$eid][$monthKey]['amount'] += $remainder;
}
```

**Proč se zahazuje remainder u deposit?**
Kauce 18 000 Kč pokrývá např. nájmy za 4 500 + 4 500 + settlement 649 = 9 649 Kč. Remainder 8 351 Kč je **vrácená kauce** (bude pokrytá `deposit_return` platbou). Kdybychom remainder přičetli do měsíce platby, uměle by nafoukl „Uhrazeno" v září.

### 4.3 Schéma alokace (příklad)

```
Platba: 18 000 Kč (deposit), payment_date=2025-09-01
Linked requests:
  - deposit 18 000 (type=deposit)     → SKIP (deposit type)
  - rent 4 500 (due_date=2025-10-01)  → alokace 4 500 do 2025-10
  - rent 4 500 (due_date=2025-11-01)  → alokace 4 500 do 2025-11
  - settlement 649 (due_date=2026-01) → alokace 649 do 2026-01
  - energy 300 (settled_by=555)        → SKIP (settled)
Allocated: 9 649
Remainder: 8 351 → ZAHOZEN (deposit payment)
```

---

## 5. Vyúčtování energií (`energy_settlement`)

**Soubor:** `api/settlement.php`, akce `energy_settlement`

### Postup

1. Načte všechny `energy` advance požadavky pro smlouvu.
2. Sečte **uhrazené** zálohy (`paid_at IS NOT NULL`) → `$paidSum`.
3. Spočítá rozdíl: `settlementAmount = actualAmount - paidSum`.
   - `> 0` → nedoplatek (nájemce dluží)
   - `< 0` → přeplatek (nájemci vrátit)
   - `= 0` → vyrovnáno
4. Vytvoří nový požadavek typu `settlement` s částkou `settlementAmount` a splatností = `contract_end`.
5. **Označí neuhrazené a nepropojené energy advances:**

```sql
UPDATE payment_requests
SET settled_by_request_id = ?
WHERE contracts_id = ? AND type = 'energy'
  AND paid_at IS NULL AND payments_id IS NULL AND valid_to IS NULL
```

### Efekt `settled_by_request_id`

- Neuhrazené energy advances **zůstávají v DB** (viditelné v modalu jako informační položky).
- Jsou **vyloučeny** z:
  - Expected sumací (`paymentRequestsSumByContract`, `paymentRequestsByContractMonth`)
  - Heatmap alokace (linked requests se přeskakují)
  - Nesplněných požadavků (oranžový badge)
- **Uhrazené** energy advances (`paid_at IS NOT NULL`) se `settled_by_request_id` nenastavuje – ty se počítají do Expected normálně (byly zaplaceny, takže představovaly skutečný závazek).

---

## 6. Zúčtování kauce (`deposit_settlement`)

**Soubor:** `api/settlement.php`, akce `deposit_settlement`

### Postup

1. Najde platbu kauce (`payments` s `payment_type = 'deposit'`).
2. Uživatel vybere požadavky, které má kauce pokrýt (`request_ids`).
3. Propojí vybrané požadavky s platbou kauce:
   ```php
   softUpdate('payment_requests', $pr['id'], [
       'payments_id' => $depositPaymentEntityId,
       'paid_at'     => $paidAt,
   ]);
   ```
4. Spočítá zbývající kauci: `toReturn = depositAmount - coveredSum`.
5. Pokud `toReturn > 0`, vytvoří/aktualizuje požadavek `deposit_return` s částkou `-toReturn`.
6. Pokud je celá kauce spotřebována, smaže neuhrazený `deposit_return`.

### Vazba na heatmapu

- Po zúčtování jsou pokryté požadavky propojeny s deposit platbou (`payments_id`).
- V heatmap alokaci se deposit platba zpracuje: linked requests typu `deposit`/`deposit_return` se přeskočí, ale linked requests typu `rent`, `settlement`, `energy` (non-settled) se alokují do příslušných měsíců.
- Remainder deposit platby se zahazuje (nekončí v žádném měsíci).

### Stav „kauce nezúčtována"

Pokud kauce ještě **nebyla zúčtována** (deposit platba nemá žádné linked requests kromě samotného deposit requestu):
- V heatmapě se **nepočítá** do Paid žádného měsíce (deposit request se přeskočí, remainder se zahodí).
- V modalu za měsíc platby se zobrazí jako informační položka: „Kauce přijata: 18 000 Kč".

---

## 7. Nesplněné požadavky (unfulfilled / oranžový badge)

**Soubor:** `api/dashboard.php`, řádky ~352–413

### SQL

```sql
SELECT contracts_id, due_date, amount, type, note, settled_by_request_id
FROM payment_requests
WHERE valid_to IS NULL AND due_date IS NOT NULL AND paid_at IS NULL AND type != 'rent'
ORDER BY due_date ASC
```

### PHP filtrace

```php
if (!empty($pr['settled_by_request_id'])) continue;  // settled zálohy
if (in_array($type, ['deposit', 'deposit_return'])) continue;  // kauce
```

### Výsledek

- `hasUnfulfilledByContractMonth[$cid][$monthKey] = true` — pro oranžový okraj buňky.
- `unfulfilledListByContractMonth[$cid][$monthKey][]` — seznam s `label` a `amount` pro tooltip.
- Agregováno i na úroveň nemovitosti (`hasUnfulfilledByPropertyMonth`, `unfulfilledRequestsByPropertyMonth`).

### Řazení

Požadavky jsou řazeny dle `due_date ASC` (nejstarší první).

---

## 8. Frontend: modal breakdown a mirror logika

### 8.1 `effectiveMonthKey(p)` – měsíc platby

**Soubor:** `js/views/dashboard.js`, řádky ~870–876

- `deposit` a `deposit_return`: měsíc = `payment_date` (kauce se řadí do měsíce skutečného přijetí/výplaty).
- Ostatní: měsíc = `period_year-period_month`.

### 8.2 `amountContributingToMonth(p)` – příspěvek platby k měsíci

**Soubor:** `js/views/dashboard.js`, řádky ~1005–1043

Tato funkce **zrcadlí PHP logiku** z `heatmapPaymentsByContract`. Klíčová pravidla:

1. **Bez linked requests:** pokud `effectiveMonthKey(p) === monthKey`, vrátí celou `payAmt`; jinak 0.
2. **S linked requests (budget-based allocation):**
   - Inicializuje `budget = payAmt`.
   - Iteruje přes linked requests:
     - **SKIP** `deposit` a `deposit_return` typy.
     - **SKIP** pokud `settled_by_request_id` je nastaveno.
     - **CAP** (jen pro non-deposit platby): `rAmt = min(rAmt, budget)`.
     - Odečte `rAmt` z `budget`.
     - Pokud `reqMonthKey === monthKey`, přičte k `sum`.
   - **Remainder:** pokud `!isDepositPayment && budget > 0 && paymentMonthKey === monthKey`, přičte k `sum`.
   - Pro deposit platby: remainder = 0 (zahozen).

### 8.3 `renderExisting()` – breakdown v modalu

**Soubor:** `js/views/dashboard.js`, řádky ~1178–1279

- Zobrazuje seznam plateb pro daný měsíc.
- Pro každou platbu zobrazuje `contributingAmt` (z `amountContributingToMonth`) a `fullAmt` v závorce, pokud se liší.
- Breakdown po linked requests: **stejná skip logika** jako v `amountContributingToMonth`.
- Deposit platby se zobrazují jako informační položky (příspěvek = 0, ale v modalu viditelné).
- CSS třída `pay-modal-existing-item--outside-month` pro platby, které nepřispívají k danému měsíci.

### 8.4 Display list v modalu (`month_breakdown`)

Backend posílá `paymentRequestsListByContractMonth` jako `month_breakdown` v JSON odpovědi. Obsahuje **všechny** položky (včetně settled a deposit), aby modal mohl zobrazit:
- Aktivní požadavky (bílé/normální) – počítají se do Expected.
- Settled zálohy (informační, šedé) – nepočítají se do Expected.
- Deposit/deposit_return (informační) – nepočítají se do Expected.

### 8.5 Barvy buněk heatmapy

| Stav | CSS třída | Barva |
|------|-----------|-------|
| Uhrazeno přesně | `exact` | Zelená |
| Přeplatek | `overpaid` | Oranžová |
| Neuhrazeno (minulost) | `unpaid` / `overdue` | Červená |
| Neuhrazeno (budoucnost) | `future-unpaid` | Neutrální |
| Uhrazeno předem (budoucnost) | `paid-advance` | Zelená |
| Nesplněné požadavky | `heatmap-cell-has-requests` | Oranžový okraj |

---

## 9. Kritická pravidla – NIKDY NEROZBIJ

Následující invarianty musí **vždy platit**. Při jakékoliv úpravě kódu v `dashboard.php`, `dashboard.js` nebo `settlement.php` ověř, že žádný z nich není porušen.

### INV-1: Deposit a deposit_return se NIKDY nepočítají do Expected

```
Požadavky typu 'deposit' a 'deposit_return' jsou VŽDY vyloučeny z:
- paymentRequestsSumByContract
- paymentRequestsByContractMonth
- hasUnfulfilledByContractMonth / unfulfilledListByContractMonth
```

**Důvod:** Kauce není závazek nájemce (nájem, energie). Je to složená jistota, která se vrací. Kdyby se počítala do Expected, zkreslila by bilanci smlouvy.

### INV-2: Settled zálohy (settled_by_request_id IS NOT NULL) se NIKDY nepočítají do Expected

```
Požadavky s neprázdným settled_by_request_id jsou VŽDY vyloučeny z:
- paymentRequestsSumByContract
- paymentRequestsByContractMonth
- heatmap alokace (linked requests)
- hasUnfulfilledByContractMonth / unfulfilledListByContractMonth
```

**Důvod:** Settled zálohy byly nahrazeny settlement požadavkem. Počítání obojího by zdvojnásobilo Expected.

### INV-3: Settled zálohy ZŮSTÁVAJÍ v display listu

```
paymentRequestsListByContractMonth obsahuje VŠECHNY požadavky
(včetně settled a deposit), protože modal je potřebuje zobrazit
jako informační položky.
```

### INV-4: Remainder deposit platby se VŽDY zahazuje

```
V PHP: if (!$isDepositPayment && $remainder > 0) { ... }
V JS:  if (!isDepositPayment && budget > 0 && ...) sum += budget;
```

**Důvod:** Remainder deposit platby = nevyužitá kauce → bude vrácena přes `deposit_return`. Přičtení do měsíce by uměle nafouklo Paid.

### INV-5: Capping se NEPROVÁDÍ u deposit plateb

```
$shouldCap = !$isDepositPayment;
```

**Důvod:** Deposit platba (18 000 Kč) pokrývá požadavky v součtu nižším než kauce. Capping by ořízl alokaci na částku platby a zabránil správnému rozložení.

### INV-6: Frontend ZRCADLÍ backend logiku

```
amountContributingToMonth() v JS musí mít IDENTICKOU skip/cap/remainder
logiku jako heatmap alokace v PHP. Stejně tak renderExisting().
```

Při jakékoliv změně v PHP alokaci MUSÍ být provedena odpovídající změna v JS.

### INV-7: Nesplněné požadavky jsou řazeny dle due_date ASC

```sql
ORDER BY due_date ASC
```

### INV-8: energy_settlement označí neuhrazené zálohy jako settled

```sql
UPDATE payment_requests SET settled_by_request_id = ?
WHERE contracts_id = ? AND type = 'energy'
  AND paid_at IS NULL AND payments_id IS NULL AND valid_to IS NULL
```

Pouze **neuhrazené** a **nepropojené** zálohy. Uhrazené zálohy (`paid_at IS NOT NULL`) zůstávají normálně v Expected (byly skutečně zaplaceny).

### INV-9: Přiřazení k měsíci

```
Expected (payment_requests): měsíc = date('Y-m', due_date)
Paid (heatmap alokace):
  - Linked request existuje: měsíc = date('Y-m', linked_request.due_date)
  - Bez linked request: měsíc = period_year-period_month (nebo payment_date jako fallback)
  - Deposit/deposit_return (effectiveMonthKey v JS): měsíc = payment_date
```

---

## Příloha: Mapování proměnných PHP ↔ JS

| PHP (dashboard.php) | JS (dashboard.js) | Popis |
|---------------------|--------------------|-------|
| `paymentRequestsSumByContract` | `d.expected_total` (přes API) | Celkový Expected za smlouvu |
| `paymentRequestsByContractMonth` | `month_breakdown` (nepřímo) | Měsíční Expected |
| `paymentRequestsListByContractMonth` | `month_breakdown` | Display list pro modal |
| `heatmapPaymentsByContract` | `amountContributingToMonth()` | Měsíční Paid |
| `hasUnfulfilledByContractMonth` | `has_unfulfilled_requests` | Oranžový badge |
| `getExpectedTotalForMonth()` | heatmap cell tooltip | Expected za buňku (nájem + předpisy) |

---

*Dokument vytvořen při redesignu v2.5.0 (settled_by_request_id, deposit exclusion). Nahrazuje předchozí verzi dokumentu.*
