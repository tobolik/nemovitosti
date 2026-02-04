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
- Při přidávání nových kontejnerů s širokým obsahem (tabulky, kalendáře) vždy zvolit buď `overflow-x: hidden`, nebo úpravu obsahu (zmenšení písma, ořez), nikoli `overflow-x: auto`.

---

## 3. Heatmapa (platební kalendář)

### Buňky měsíců

- V buňce se zobrazuje **pouze číslo** (částka). **Text „Kč“ v buňce není** – šetří místo a na mobilu je to čitelnější. Jednotka „Kč“ může být v tooltipu (title).

### Mobil (malé obrazovky, např. max-width: 480px)

- **Hlavička měsíců** (leden, únor, …): písmo zmenšit na **90 %** oproti výchozí velikosti, aby názvy měsíců nezabíraly zbytečně moc místa.
- V CSS např.: `.heatmap-table th:nth-child(n+2):nth-child(-n+13) { font-size: 90%; }` v příslušném media query.

---

## 4. Verzování a cache busting

- Při každé změně kódu aplikace se zvýší verze v `index.html`.
- Formát: **vMAJOR.MINOR.PATCH** (např. v1.3.3).
- Stejná hodnota **bez „v“** se použije u všech odkazů na CSS a JS: `?v=1.3.3`. Tím se zajistí načtení nových souborů po nasazení (cache busting).
- Podrobně: `.cursor/rules/version-increment.mdc` a na konci práce vždy uvést aktuální verzi a stav pushu.

---

## 5. Barvy štítků (tags)

- **Zelená** a **červená** jsou vyhrazené pro **systémový stav** (úspěch / problém, zaplaceno / nezaplaceno atd.).
- Pro **informační štítky** (typ platby, „Úhrada pož.“, kauce, energie atd.) používat **jiné barvy** (modrá, tyrkysová, šedá), aby nedocházelo ke kolizi se stavem a uživatel neinterpretoval informační štítek jako chybu nebo varování.

---

## 6. Vyhledávací select (searchable select)

- **Tabulátor:** Nativní `<select>` uvnitř komponenty má `tabindex="-1"`, aby při tabulátoru fokus šel na viditelný input, ne na skrytý select.
- **Focus na input:** Když pole už má hodnotu, při focusu se **označí celý text** (`input.select()`), aby ho uživatel mohl snadno přepsat jedním tahem.

---

## Související dokumenty

- `ux-ui.md` – celková designová specifikace (barvy, layout, komponenty).
- `.cursor/rules/version-increment.mdc` – verzování a závěrečná hláška.
- `.cursor/rules/soft-update-and-versioning.mdc` – pravidla pro API a databázi.
