# Soft-update, entity_id a verzování

Tento dokument popisuje pravidla pro práci s datovým modelem aplikace (CRUD, migrace, verzování kódu).

---

## 1. Soft-update a soft-delete

### Princip

- Žádný záznam se **fyzicky nemazání**. Místo DELETE se nastaví `valid_to = NOW()` (soft-delete).
- **Úprava** záznamu = uzavření aktuální verze (`valid_to`) + vložení nového řádku se stejným `{tabulka}_id` (entity_id).
- **Čtení** = vždy `WHERE valid_to IS NULL` (jen „aktivní“ verze).

### Povinné sloupce v tabulkách s verzováním

| Sloupec | Typ | Význam |
|---------|-----|--------|
| `id` | INT UNSIGNED AUTO_INCREMENT | Fyzický primární klíč řádku (mění se při každé verzi) |
| `{tabulka}_id` | INT UNSIGNED NULL | **Entity ID** – logická identita záznamu napříč verzemi (např. `contracts_id`, `properties_id`) |
| `valid_from` | DATETIME NOT NULL | Kdy tato verze začala platit |
| `valid_to` | DATETIME NULL | Kdy skončila (NULL = platí nyní) |
| `valid_user_from` | INT UNSIGNED NULL | Uživatel, který verzi vytvořil |
| `valid_user_to` | INT UNSIGNED NULL | Uživatel, který verzi uzavřel |

### Indexy

- `INDEX idx_{tabulka}_id ({tabulka}_id, valid_to)` – vyhledání aktivní verze podle entity_id
- `INDEX idx_v (valid_to)` – filtrování aktivních záznamů

---

## 2. API metody (_bootstrap.php, crud.php)

### softInsert($table, $data)

- **Použití:** přidání nového záznamu (add).
- **Doplní automaticky:** `valid_from`, `valid_to = NULL`, `valid_user_from` (aktuální uživatel), `valid_user_to = NULL`.
- Po INSERTu nastaví `{tabulka}_id = lastInsertId()` pro první verzi entity (pokud byl NULL).
- **Nikdy** nepoužívat přímý `INSERT INTO ...` pro tyto tabulky – chyběla by entity_id a valid_*.

### softUpdate($table, $id, $newData)

- **$id** = fyzické `id` aktuálního řádku (ne entity_id).
- Načte aktuální řádek (`WHERE id=? AND valid_to IS NULL`), získá z něj `entity_id`.
- Uzavře všechny aktivní verze této entity: `UPDATE ... SET valid_to=?, valid_user_to=? WHERE ({eid}=? OR ...) AND valid_to IS NULL`.
- Vloží nový řádek se sloučenými daty (`$merged`), se stejným `{tabulka}_id`, novým `valid_from`, `valid_to=NULL`, `valid_user_from`, `valid_user_to=NULL`.
- Vrací nové `id` (lastInsertId).

### softDelete($table, $id)

- **$id** = fyzické `id` řádku.
- Nastaví `valid_to = NOW()`, `valid_user_to = aktuální uživatel` pro řádek `WHERE id=? AND valid_to IS NULL`.
- Žádné mazání řádku, žádné vkládání nového.

### findActive($table, $id)

- Vrátí řádek `WHERE id=? AND valid_to IS NULL` (vyhledání podle fyzického id).

### findActiveByEntityId($table, $entityId)

- Vrátí **aktivní** řádek podle entity_id: `WHERE {tabulka}_id=? AND valid_to IS NULL`.
- Používá se pro GET ?id=N (kde N je entity_id), pro vazby mezi tabulkami a pro ověření existence záznamu před softUpdate/softDelete.

### findAllActive($table, $order)

- `WHERE valid_to IS NULL ORDER BY $order`. Řazení musí být whitelistované (pouze znaky [a-zA-Z0-9_, ]).

---

## 3. Entity_id a vazby mezi tabulkami

- **properties_id, tenants_id, contracts_id** v API a dotazech = vždy **entity_id** (logický identifikátor), ne fyzické `id`.
- Při JOINu mezi tabulkami: `JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL` (odkaz na stejnou entitu, aktivní verze).
- Při přidávání/úpravě: klient posílá `properties_id`, `tenants_id`, `contracts_id` jako entity_id; nikdy nespoléhat na to, že by to bylo fyzické id (po soft-update se id mění, entity_id zůstává).

---

## 4. Nové tabulky (migrace)

Při vytváření nové tabulky s verzováním:

1. Přidat sloupce: `id`, `{tabulka}_id`, obchodní pole, `valid_from`, `valid_to`, `valid_user_from`, `valid_user_to`.
2. Přidat indexy `idx_{tabulka}_id`, `idx_v`.
3. V crud.php: použít **pouze** `softInsert`, `softUpdate`, `softDelete`; přidat tabulku do `$FIELDS`, `$REQUIRED`, `$FIELD_LABELS`.
4. Všechny SELECTy pro „aktuální data“ musí obsahovat `WHERE valid_to IS NULL` (nebo JOIN na jinou tabulku s tímto filtrem).

Příklad viz `.cursor/rules/db-new-tables.mdc` a migrace `013_bank_accounts_soft_update.sql`.

---

## 5. Verzování aplikace (index.html)

- Při **každé** úpravě kódu (funkce, opravy, UI) zvýšit verzi v `index.html`.
- Formát: `vMAJOR.MINOR.PATCH` (např. v1.2.7). Při běžné změně zvyšovat PATCH.
- **Cache busting:** Stejná hodnota (bez „v“) u všech odkazů na CSS a JS: `?v=1.2.7`.
- Místa: `<span class="footer-version">`, všechny `<link href="css/style.css?v=...">`, všechny `<script src="...?v=...">`.

---

## 6. Shrnutí pravidel

| Akce | Metoda | Poznámka |
|------|--------|----------|
| Přidat záznam | `softInsert($table, $data)` | Doplní valid_*, entity_id |
| Upravit záznam | `softUpdate($table, $id, $data)` | $id = fyzické id; uzavře starou verzi, vloží novou |
| Smazat záznam | `softDelete($table, $id)` | $id = fyzické id; nastaví valid_to |
| Načíst podle id řádku | `findActive($table, $id)` | |
| Načíst podle entity_id | `findActiveByEntityId($table, $entityId)` | |
| Seznam aktivních | `findAllActive($table, $order)` | |
| Čtení v SQL | Vždy `WHERE valid_to IS NULL` (nebo JOIN s tímto) | |
| Verze v HTML | Zvýšit PATCH a ?v= v index.html při každé změně | |
