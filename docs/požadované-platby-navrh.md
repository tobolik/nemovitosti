# Požadované platby (doplatek energie, vyúčtování) – návrh řešení

## Cíl
Mít možnost **vložit požadavek na doplatek** (např. 906,96 Kč za energie / vyúčtování) tak, aby to **bylo vidět v „požadovaných platbách“** – dokud nájemce nezaplatí.

## Současný stav
- **Platby** (`payments`) evidují jen **skutečně provedené** platby (nájem, kauce, doplatek energie, jiné) – vždy s datumem platby a obdobím (rok/měsíc).
- Typ platby: `rent`, `deposit`, `energy`, `other`.
- Neexistuje koncept „požadované, ale ještě neuhrazené“ částky.

## Návrh řešení

### 1) Nová tabulka: `payment_requests` (požadované platby)
- **Účel:** Evidence „požadavků na platbu“ (doplatek energie, vyúčtování, jiné), které mají nájemci zaplatit. Zobrazí se v přehledu, dokud nejsou označeny jako zaplacené.
- **Sloupce (základ):**
  - `id` (PK)
  - `contracts_id` (FK – ke které smlouvě/nájemníkovi se vztahuje)
  - `amount` DECIMAL(12,2) – požadovaná částka (např. 906.96)
  - `type` ENUM('energy','settlement','other') – např. „Doplatek energie“, „Vyúčtování“, „Jiné“
  - `note` TEXT – volitelný popis (např. „Vyúčtování 2025“)
  - `created_at` – kdy byl požadavek vložen
  - `due_date` DATE NULL – volitelné datum splatnosti
  - **`paid_at`** DATE NULL – když je vyplněno = považujeme za zaplaceno (a skryjeme z „požadovaných“)
  - **`payment_id`** INT NULL – odkaz na záznam v `payments`, až nájemce opravdu zaplatí (propojení)
  - `valid_from` / `valid_to` – soft-delete jako u ostatních tabulek

### 2) Kde to zobrazit („aby mi to svítilo“)
- **Sekce „Požadované platby“** na dashboardu (např. pod tabulkou smluv nebo v rozšířeném režimu):
  - Seznam všech **nezaplacených** požadavků (`paid_at IS NULL`): nájemník, nemovitost, částka, typ, poznámka, datum vložení.
  - U každého: tlačítko **„Zapsat platbu“** (otevře modal / přesměruje na Platby s předvyplněnou smlouvou, částkou a typem).
- Případně i krátký **souhrn v hlavních statistikách** (např. „X požadovaných plateb celkem Y Kč“).

### 3) Přidání požadavku
- Formulář (na dashboardu, v sekci Smlouvy, nebo v Platy):
  - Smlouva (nájemník + nemovitost) – výběr z aktivních smluv
  - Částka (Kč)
  - Typ: Doplatek energie / Vyúčtování / Jiné
  - Poznámka (volitelně)
  - Splatnost (volitelně)
- Uložení = nový řádek v `payment_requests` s `paid_at = NULL` → objeví se v „Požadované platby“.

### 4) Když nájemce zaplatí
- **Varianta A:** U požadavku klik na **„Zapsat platbu“** → otevře se stávající modal pro zápis platby s předvyplněnou smlouvou, částkou a typem (energy/settlement/other). Po uložení platby v `payments` se automaticky u příslušného `payment_requests` nastaví `paid_at = NOW()` a `payment_id = id` nové platby → požadavek zmizí z „Požadované platby“.
- **Varianta B:** Uživatel jde do Platby a ručně přidá platbu (typ „Doplatek energie“ atd.). Pak v seznamu požadovaných plateb u daného řádku klikne „Označit jako zaplaceno“ a případně vybere, kterou platbu k tomu přiřadit (nebo se přiřadí poslední odpovídající platba).  
  **Doporučení:** Varianta A – méně kroků, konzistentní propojení.

### 5) API a migrace
- **Migrace:** nová tabulka `payment_requests` (+ případně `payment_requests_id` pro soft-update, konzistentně se zbytkem DB).
- **API:** CRUD pro `payment_requests` (list, add, edit, delete). List pro dashboard filtrovat `paid_at IS NULL AND valid_to IS NULL`.
- Endpoint nebo rozšíření dashboardu: vracet seznam nezaplacených požadavků pro sekci „Požadované platby“.

### 6) Shrnutí toků
| Krok | Akce |
|------|------|
| 1 | Pronajímatel vloží požadavek (smlouva, 906.96 Kč, Doplatek energie, poznámka). |
| 2 | Požadavek se uloží do `payment_requests` s `paid_at = NULL`. |
| 3 | V dashboardu („Požadované platby“) se zobrazí řádek: např. „Nájemník X, Nemovitost Y – 906,96 Kč – Doplatek energie“. |
| 4 | Nájemce zaplatí. Pronajímatel klikne „Zapsat platbu“, doplní datum/účet, uloží. |
| 5 | Vytvoří se záznam v `payments` (typ energy) a u požadavku se nastaví `paid_at`, `payment_id`. |
| 6 | Požadavek zmizí z „Požadované platby“ (zůstane v historii, pokud budeme chtít zobrazovat i zaplacené). |

---

## Rozsah implementace (až budeme kódovat)
1. Migrace: vytvoření tabulky `payment_requests`.
2. Backend: CRUD pro `payment_requests` v `api/crud.php`, endpoint pro list nezaplacených (nebo filtr v listu).
3. Dashboard: sekce „Požadované platby“ (seznam + tlačítko „Přidat požadavek“).
4. Formulář pro přidání/úpravu požadavku (smlouva, částka, typ, poznámka, splatnost).
5. Propojení „Zapsat platbu“ s platbou: předvyplnění modalu platby a po uložení nastavení `paid_at` + `payment_id` u požadavku.
6. Volitelně: v sekci Platby zobrazit u platby odkaz na požadavek, pokud byla vytvořena z „Zapsat platbu“.

Pokud s tímto návrhem souhlasíš, můžeme přejít na konkrétní migrace, úpravy API a frontendu.
