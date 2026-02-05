# Obecné UX/UI konvence

Tento dokument popisuje **obecné zásady** pro vzhled a chování UI v celé aplikaci. Dodržování těchto pravidel zajišťuje konzistenci a předchází problémům (např. vodorovné scrollbary, nečitelný dlouhý text).

Odraz v kódu: Cursor pravidlo `.cursor/rules/ux-ui-conventions.mdc` (alwaysApply).

---

## 1. Sloupec / pole Poznámka

### Pravidla

- **V tabulkách** (Nájemníci, Nemovitosti, Smlouvy, Platby) je sloupec „Poznámka“ vždy zobrazen **max. na jeden řádek**. Delší text se ořezává s `...` (ellipsis).
- **Celý text** musí být dostupný při najetí myší – pomocí **nativního tooltipu** (`title` u elementu). Uživatel tak vidí celý řádek včetně textu bez rozbalování.
- **Nerozbalujte** obsah poznámky při hoveru (žádné přepnutí na více řádků ani `overflow: visible`). Rozbalení způsobuje zvětšení buňky a může vyvolat vodorovné rolování stránky.

### Implementace

- Buňka: `<td class="col-note cell-note-wrap">`.
- Obsah: `<span class="cell-note-truncate" title="ESC(celý text)">ESC(text)</span>`.
- CSS: `.cell-note-truncate` má `white-space: nowrap`, `overflow: hidden`, `text-overflow: ellipsis`. **Žádné** pravidlo pro `:hover` které by měnilo `white-space` nebo `overflow`.

---

## 2. Vodorovné posuvníky (scrollbary)

### Pravidlo

- V aplikaci **nikde** nechceme **spodní (vodorovné) postranní rolovátko**. Layout musí zůstat v šířce viewportu.

### Jak to zajistit

- **`body`**: má `overflow-x: hidden`.
- **`.tbl-wrap`** (obal tabulek): `overflow-x: hidden` (ne `auto`).
- **`.heatmap-wrap`** (obal heatmapy): `overflow-x: hidden` (ne `auto`).
- **Poznámka:** Když poznámka při hoveru nerozbaluje (viz výše), tabulka nezvětší šířku a nevyvolá scroll.
- Při přidávání nových kontejnerů s širokým obsahem (tabulky, kalendáře) vždy zvolit buď `overflow-x: hidden`, nebo úpravu obsahu (ořez, zmenšení písma), nikoli `overflow-x: auto`.

---

## 3. Verzování a cache busting

- Při každé změně kódu aplikace se zvýší verze v `index.html`.
- Formát: **vMAJOR.MINOR.PATCH** (např. v1.3.3).
- Stejná hodnota **bez „v“** se použije u všech odkazů na CSS a JS: `?v=1.3.3`. Tím se zajistí načtení nových souborů po nasazení (cache busting).
- Podrobně: `.cursor/rules/version-increment.mdc` a na konci práce vždy uvést aktuální verzi a stav pushu.

---

## 4. Barvy štítků (tags)

- **Zelená** a **červená** jsou vyhrazené pro **systémový stav** (úspěch / problém, zaplaceno / nezaplaceno atd.).
- Pro **informační štítky** (typ platby, „Úhrada pož.“, kauce, energie atd.) používat **jiné barvy** (modrá, tyrkysová, šedá), aby nedocházelo ke kolizi se stavem a uživatel neinterpretoval informační štítek jako chybu nebo varování.

---

## 5. Vyhledávací select (searchable select)

- **Tabulátor:** Nativní `<select>` uvnitř komponenty má `tabindex="-1"`, aby při tabulátoru fokus šel na viditelný input, ne na skrytý select.
- **Focus na input:** Když pole už má hodnotu, při focusu se **označí celý text** (`input.select()`), aby ho uživatel mohl snadno přepsat jedním tahem.

---

## 6. Tabulky – řazení a pruhování

### Řazení

- U tabulek s řazením musí být **graficky jasné**, podle kterého sloupce a v jakém směru je řazeno.
- **Klik** na záhlaví sloupce: řazení podle tohoto sloupce. První klik = vzestupně (↑), druhý klik = sestupně (↓). Klik na jiný sloupec přepne řazení na ten sloupec.
- **Ctrl+Klik** (nebo Cmd+Klik): ponechat stávající sloupce v řazení a **přidat** tento sloupec jako další úroveň. Ctrl+Klik na již zařazený sloupec přepne u něj směr (asc/desc).
- V záhlaví řazeného sloupce zobrazit **šipku** (↑ vzestupně / ↓ sestupně). Při více úrovních řazení zobrazit u každého řazeného sloupce **číslo priority** (1, 2, 3…) vedle šipky.
- **Implementace:** `UI.renderTable(…, { sortable: { order: [ { key, dir }, … ] }, striped: true })`. Zpětná kompatibilita: `sortable: { currentKey, currentDir }` se převede na jednu úroveň.

### Pruhování řádků

- Tabulky s řazením nebo dlouhým seznamem mají mít **`striped: true`** (třída `tbl-striped`), aby se řádky vizuálně střídaly (každý sudý řádek mírně odlišené pozadí) a zlepšila se čitelnost.

---

## Související dokumenty

- `ux-ui.md` – celková designová specifikace (barvy, layout, komponenty).
- `.cursor/rules/version-increment.mdc` – verzování a závěrečná hláška.
- `.cursor/rules/soft-update-and-versioning.mdc` – pravidla pro API a databázi.
