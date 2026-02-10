# Jedna platba → více požadavků na platbu (návrh)

## Požadavek

Při přidání platby mít možnost **zaklikat více požadavků** a přiřadit tak jednu platbu (dávku) k více požadavkům najednou.

**Příklad:** Platba 2 200 Kč = 1 000 Kč doplatek nájmu za říjen 2020 + 600 Kč záloha energie + 600 Kč záloha energie (dva požadavky na energie).

---

## 1. Co už datový model umí

- V tabulce **`payment_requests`** je sloupec **`payments_id`** (odkaz na platbu).
- Jeden záznam **platby** může být odkazován z **více požadavků** – tedy více řádků v `payment_requests` může mít stejné `payments_id`.
- **Žádná změna schématu DB** pro „jedna platba → více požadavků“ tedy není potřeba.

---

## 2. Co by se muselo změnit

### 2.1 UI – přidat platbu

- Místo jednoho selectu **„Propojit s požadavkem“** (— Žádný — / jeden požadavek) umět vybrat **více požadavků** (např. checkboxy u seznamu nevyřízených požadavků).
- Při ukládání: platbu vytvořit a pak **pro každý vybraný požadavek** nastavit `payments_id` a `paid_at` (stejná logika jako dnes, jen v cyklu pro více ID).

### 2.2 Backend – ukládání platby

- Při přidání platby dnes: jeden parametr `payment_request_id` → jeden `link`.
- Rozšíření: přijmout **pole** `payment_request_ids[]` (nebo jeden parametr s více ID). Po vytvoření platby pro každé ID zavolat ekvivalent stávajícího propojení (nastavit u daného `payment_requests` řádku `payments_id` a `paid_at`). Speciální logika pro `deposit_return` (doplnění `deposit_return_date` u smlouvy) už v kódu je – stačí ji volat pro každý propojený požadavek typu `deposit_return`.

### 2.3 Heatmapa (dashboard) – zásadní riziko

- Heatmapa dnes staví „uhrazeno“ z dotazu, kde je **`LEFT JOIN payment_requests pr ON pr.payments_id = p.payments_id`**.
- Pokud je **jedna platba** propojena s **více požadavky**, vznikne **více řádků** (jeden řádek na každý požadavek) se **stejnou částkou platby**.
- V současném kódu se u každého řádku přičítá `p.amount` do součtu za měsíc → **jedna platba by se započítala víckrát** (např. 2 200 Kč × 3 = 6 600 Kč).
- **Nutná úprava:** při sčítání „uhrazeno“ za měsíc **nepřičítat jednu platbu víc než jednou**. Tj. buď:
  - v SQL seskupit podle `p.payments_id` a do měsíce započítat každou platbu jen jednou (měsíc určit z `due_date` některého z požadavků nebo z `period`/`payment_date` platby),  
  - nebo v PHP při procházení výsledků seskupit podle `payments_id` a částku platby přičíst za každou platbu jen jednou.

Bez této úpravy by povolení „více požadavků na jednu platbu“ **rozjelo heatmapu** (přehnané „uhrazeno“).

### 2.4 Ostatní místa v kódu

- **Přehled plateb (payments list):** API vrací `linked_payment_request_id` a `linked_request_note` – bere se jeden požadavek (`ORDER BY pr.id DESC LIMIT 1`). Při více propojených požadavcích by bylo vhodné např. zobrazit „3 požadavky“ nebo výčet (není nutné hned, ale konzistentní zobrazení je lepší).
- **Import z FIO / schvalování importu:** dnes se k jedné platbě váže jeden `payment_request_id`. Pro „přidat platbu“ ručně stačí rozšířit jen formulář Přidat platbu; import může zůstat 1 : 1.
- **Odpojení požadavku od platby** (`unlink_payment_request`) funguje po jednom požadavku – zůstává použitelné i při více propojených (odpojíš jeden konkrétní).

---

## 3. „Část nájmu“ (1 000 Kč) – dva přístupy

- **Nájem** (předpis za měsíc) se v systému neukládá jako požadavek v `payment_requests`, ale se počítá ze smlouvy (`monthly_rent`, `first_month_rent`, `last_month_rent`).
- Tvoje 2 200 = 1 000 (doplatek nájmu říjen) + 600 + 600 (dva požadavky na energie).

**Možnost A – bez zvláštního požadavku na nájem**

- Požadavky v systému jsou jen ty dva na energie (2× 600).
- Platbu 2 200 Kč propojíš jen s těmito dvěma požadavky (1 200 Kč „pokryto“ požadavky).
- „1 000 za nájem“ je jen významová interpretace – v DB nic dalšího neřešíš, platba může být typ „nájem“ a částka 2 200.

**Možnost B – explicitní požadavek na doplatek nájmu**

- Vytvoříš v systému požadavek typu „other“ (nebo v budoucnu „rent_arrears“), např. „Doplatek nájmu říjen 2020“, částka 1 000, splatnost např. 1. 11. 2020.
- Jednu platbu 2 200 Kč pak propojíš se třemi požadavky: tento doplatek + dva požadavky na energie.
- Suma požadavků 1 000 + 600 + 600 = 2 200 odpovídá částce platby.

Oba přístupy jsou s „více požadavků na jednu platbu“ slučitelné; rozdíl je jen v tom, jestli chceš mít doplatek nájmu jako samostatný záznam v Požadavcích, nebo ne.

---

## 4. Částečné uhrazení požadavku (mimo scope)

- Dnes: požadavek je buď neuhrazen (`paid_at` / `payments_id` prázdné), nebo celý uhrazen (jedna platba → jeden požadavek, celá částka).
- Není tu koncept „uhrazeno 300 z 600“ (žádné `paid_amount` ani alokační tabulka).
- Tvé zadání (2 200 = 1 000 + 600 + 600) je „jedna platba rozdělená na několik celých požadavků“, ne „částečné zaplacení jednoho požadavku“. To stávající model bez změny schématu pokryje.

---

## 5. Shrnutí – je to řešitelné a co ne rozbít

| Oblast | Stav | Nutná úprava |
|--------|------|--------------|
| **DB schéma** | OK | Žádná – více požadavků na jednu platbu už jde. |
| **Přidat platbu – UI** | Jen jeden požadavek | Multi-select (checkboxy) pro požadavky. |
| **Přidat platbu – API** | Jen jeden `payment_request_id` | Přijmout více ID a pro každé propojit. |
| **Heatmapa** | Chyba při více propojeních | Počítat každou platbu v „uhrazeno“ jen jednou (deduplikace podle `payments_id`). |
| **Přehled plateb** | Zobrazí jeden požadavek | Volitelně upravit na „N požadavků“ nebo výčet. |
| **Import platby** | 1 : 1 | Není nutné měnit. |

**Závěr:** Funkce „zaklikat více požadavků a přiřadit k jedné platbě“ je **řešitelná** a nerozbije zbytek systému, pokud se **současně upraví agregace v heatmapě** tak, aby se částka jedné platby do „uhrazeno“ započítala jen jednou. Ostatní změny (multi-select v UI, backend pro více ID) jsou přímočaré a zpětně kompatibilní (jedno ID = stávající chování).
