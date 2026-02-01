# PropManager CZ — UX/UI Design Specification

## 1. Celkový vzhled & téma

### Pozadí
- **Gradient pozadí** celé aplikace: `from-purple-900 via-purple-800 to-indigo-900` (tmavá fialová › indigo)
- Gradient se rozprostírá na celou výšku viewport
- Žádná bílá plocha jako pozadí — vše je na dark purple gradientu

### Typografie
- Font: systémový sans-serif (Inter, -apple-system, Arial)
- Nadpisy (h1–h3): **bílá**, bold
- Popis / labels: `text-purple-200` nebo `text-purple-300` (bledá fialová)
- Èísla v kartách: `text-white`, font-size 3xl–5xl, bold

### Barevná paleta
| Barva | Použití |
|-------|---------|
| `#9333ea` (purple-600) | Primární tlaèítka, aktivní tabs |
| `#16a34a` (green-600) | Zaplaceno, úspìšné stavy, tlaèítka save |
| `#dc2626` (red-600) | Nezaplaceno / dluhy / po splatnosti |
| `#475569` (slate-700) | Sidebar pozadí |
| `#1e293b` (slate-900) | Sidebar dark |
| `white/10` – `white/20` | Prùhledné karty (glassmorphism) |
| `gray-50` | Pozadí info boxù v modalech |

---

## 2. Layout — Sidebar + Main

### Sidebar (levá strana)
- Šíøka: **256px** (`w-64`)
- Pozadí: `bg-slate-900` (very dark blue-gray)
- Text: bílý
- **Zavírací tlaèítko** (?) v pravém horním rohu sidebaru
- Položky navigace:
  - Ikonou + textem
  - Aktivní položka: `bg-slate-800` (lehèe lighter)
  - Hover: `hover:bg-slate-800`
  - Gap mezi ikonou a textem: 12px

### Sidebar skryty › Hamburger menu
- Když je sidebar zavøen, zobrazí se **hamburger button** (?)
- Pozice: `fixed top-4 left-4`
- Styling: `bg-slate-900 text-white p-3 rounded-lg shadow-lg`
- Kliknutím se sidebar znovu otevøe

### Menu položky
```
?? Dashboard          › hlavní pøehled
?? Nemovitosti        › seznam nemovitostí + "Nová nemovitost"
?? Nájemci            › seznam nájemcù + "Nový nájemce"
```

---

## 3. Dashboard — Statistické karty

### Layout
- Grid: `grid-cols-4` na desktop, responsive down to `grid-cols-1`
- Gap: 16px

### Karta design (glassmorphism)
```
-¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬
-  [ikona]  99.0%             -  ‹ text-5xl font-bold text-white
-  Obsazenost                 -  ‹ text-purple-200, text-sm
L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-
```
- Background: `bg-white/10 backdrop-blur-sm`
- Border: `border border-white/20`
- Border-radius: `rounded-xl`
- Padding: `p-6`

### 4 karty:
| Karta | Ikona barva | Label |
|-------|-------------|-------|
| Obsazenost | `text-purple-300` + symbol `%` | Obsazenost |
| Mìsíèní výnos | `text-green-300` + symbol `$` | Mìsíèní výnos |
| ROI (roèní) | `text-yellow-300` + symbol `?` | ROI (roèní) |
| Míra inkasa | `text-blue-300` + `<FileText>` ikona | Míra inkasa |

---

## 4. Pøehled nemovitostí

### Kontajner
- `bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6`
- Nadpis: `?? Pøehled nemovitostí` — bílý, 2xl, bold

### Karta nemovitosti (clickable)
```
-¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬
-  Byt 2+kk                        ? (green)   -
-  byt • 55 m2                                  -
-  Hlavní 123, Praha                            -
-                          ?? 2  ?? 1           -
-                       Zaplaceno  Dluhy        -
L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-
```
- Background: `bg-white/5` › hover: `bg-white/10`
- Border: `border border-white/10`
- Rounded: `rounded-lg`
- **Kliknutím** otevírá editaèní modal nemovitosti
- Zelená checkmark vpravo nahoøe
- Èísla zaplaceno/dluhy: `text-2xl font-bold text-green-400` / `text-red-400`

---

## 5. Platební kalendáø (Heatmapa)

### Layout
- Horizontální scrollable table
- **Øádky = nemovitosti**, **Sloupce = mìsíce**
- Nemovitost column: sticky left, `bg-purple-900/50` (semi-transparent overlay)

### Header (mìsíce)
- Text: bílý, `text-xs`, font-semibold
- Formát: `leden\n25` (mìsíc + rok na dvou øádcích)
- Min-width per column: `90px`

### Buòky — 3 stavy:

#### ?? Volno (bez smlouvy)
```
-¦¦¦¦¦¦¦¦¦¦¬
-          -
-  Volno   -  ‹ text-gray-400, text-xs, centered
-          -
L¦¦¦¦¦¦¦¦¦¦-
```
- `bg-gray-600/30` (dark transparent gray)
- **Kliknutím** › otevírá formuláø nové smlouvy pro tuto nemovitost + mìsíc

#### ?? Zaplaceno
```
-¦¦¦¦¦¦¦¦¦¦¬
-  3 000   -  ‹ text-white, font-bold, text-xs
-    ?     -  ‹ text-white/90, text-xs
L¦¦¦¦¦¦¦¦¦¦-
```
- `bg-green-600`
- **Kliknutím** › otevírá modal editace platby

#### ?? Nezaplaceno / Po splatnosti
```
-¦¦¦¦¦¦¦¦¦¦¬
-  3 000   -  ‹ text-white, font-bold, text-xs
-    ?     -  ‹ text-white/90, text-xs
L¦¦¦¦¦¦¦¦¦¦-
```
- `bg-red-600`
- **Kliknutím** › otevírá modal editace platby

### Buòka styling (spoleèné)
- Min-height: `50px`
- Padding: `p-2`
- Border-radius: `rounded`
- Hover: `opacity-80`
- Èástka: bez "Kè", bez desetinných míst (jen èíslo)

---

## 6. Modální okna (Modal Design System)

### Spoleèné pravidla
- **Overlay**: `fixed inset-0 bg-black/50 flex items-center justify-center z-50`
- **Kliknutím na overlay** › zavøe modal
- **ESC klíè** › zavøe modal
- **Vnitøní kontejner**: `bg-white rounded-xl`, max-width varies, `max-h-[90vh] overflow-y-auto`
- Header: flex justify-between, title vlevo, ? button vpravo (gray-400)

---

### 6A. Modal — Platba (NEJDÙLEŽITÌJŠÍ)

```
-¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬
-  Platba                  ?  -  ‹ h3 text-2xl font-bold
+¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦+
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  - Nemovitost          -    -  ‹ bg-gray-50 p-3 rounded-lg
-  - Byt 2+kk            -    -    space-y-1
-  - Nájemce             -    -
-  - Jan Novák           -    -
-  - Období              -    -
-  - 2025-11             -    -
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  Èástka (Kè)                -  ‹ label: font-semibold
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  - 12520               -    -  ‹ input type=number, border rounded-lg px-3 py-2
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬   -  ‹ bg-green-50 p-3 rounded-lg
-  - ?  Zaplaceno         -   -  ‹ checkbox w-5 h-5 accentColor green
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-   -    label: font-semibold text-green-900
-                             -
-  Datum úhrady               -  ‹ zobrazí se POUZE když checkbox = true
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  - 13.11.2025     ??   -    -  ‹ input type=date
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  -¦¦¦¦¦¦¦¦¦¦¬  -¦¦¦¦¦¦¦¦¬   -
-  -  Uložit  -  - Zrušit -   -  ‹ Uložit: bg-green-600 text-white flex-1
-  L¦¦¦¦¦¦¦¦¦¦-  L¦¦¦¦¦¦¦¦-   -    Zrušit: bg-gray-300 px-6
L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-
```

**Klíèové detaily:**
- Checkbox má **zelený accent** (`accentColor: '#16a34a'`)
- Checkbox wrapper má `bg-green-50 p-3 rounded-lg` pozadí
- "Datum úhrady" field se zobrazuje **animovanì** po zaškrtnuti checkbox
- Tlaèítka: gap-3, mt-6

---

### 6B. Modal — Nová nemovitost / Editace nemovitosti

```
-¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬
-  Nová nemovitost         ?  -
+¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦+
-  Název                      -
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  -                     -    -
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  Typ                        -
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  - Byt              ¡  -    -  ‹ select: Byt / Garáž
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  Adresa                     -
-  Výmìra (m2)                -
-  Kupní cena (Kè)            -
-                             -
-  -¦¦¦¦¦¦¦¦¦¦¬  -¦¦¦¦¦¦¦¦¬   -
-  -Uložit zm.-  - Zrušit -   -  ‹ Uložit: bg-purple-600
-  L¦¦¦¦¦¦¦¦¦¦-  L¦¦¦¦¦¦¦¦-   -
L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-
```

---

### 6C. Modal — Nová smlouva

```
-¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬
-  Nová smlouva            ?  -
+¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦+
-  Nemovitost                 -
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  - Byt 2+kk            -    -  ‹ readOnly, bg-gray-100
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  Nájemce                    -
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬ -¦¦¦¦¦¬  -
-  - Vyberte    ¡  - -+Nový-  -  ‹ select + zelené tlaèítko "+ Nový"
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦- L¦¦¦¦¦-  -    "+ Nový" otevírá sub-modal nového nájemce
-                             -
-  Datum od      Datum do     -  ‹ grid-cols-2 gap-4
-  -¦¦¦¦¦¦¦¦¦¦¬  -¦¦¦¦¦¦¦¦¦¦¬ -
-  - 01.12.25 -  - (prázdné)- -  ‹ prázdné = neurèitá doba
-  L¦¦¦¦¦¦¦¦¦¦-  L¦¦¦¦¦¦¦¦¦¦- -
-                             -
-  Nájemné (Kè/mìsíc)        -
-  -¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬    -
-  - 12520               -    -
-  L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-    -
-                             -
-  -¦¦¦¦¦¦¦¦¦¦¬  -¦¦¦¦¦¦¦¦¬   -
-  -  Uložit  -  - Zrušit -   -  ‹ Uložit: bg-purple-600
-  L¦¦¦¦¦¦¦¦¦¦-  L¦¦¦¦¦¦¦¦-   -
L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-
```

---

### 6D. Modal — Nový/Edit nájemce

- Pole: Typ (FO/PO select), Jméno/Název, Email, Telefon
- Uložit: `bg-purple-600`
- Mùže se zobrazit **nad** jiným modalem (z-60) pøi pøidávání nájemce ze smlouvy

---

## 7. Seznam nemovitostí (view)

- Nadpis: `Nemovitosti` bílý text-3xl
- Tlaèítko `+ Nová nemovitost` vpravo: `bg-purple-600 text-white px-4 py-2 rounded-lg`
- Grid karty: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`
- Karta design = stejný jako v dashboardu (glassmorphism purple)

---

## 8. Seznam nájemcù (view)

- Nadpis: `Nájemci` bílý text-3xl
- Tlaèítko `+ Nový nájemce`: `bg-purple-600`
- Tabulka:
  - Container: `bg-white/10 backdrop-blur-sm rounded-xl border border-white/20`
  - Thead: `bg-white/5`, text bílý font-semibold
  - Tbody rows: `border-t border-white/10`, hover: `bg-white/5`
  - Kolony: Jméno, Typ (FO/PO), Email, Telefon
  - Kliknutí na øádek › edit modal

---

## 9. Input styling (globální)

```css
input, select {
  border: 1px solid #e5e7eb;       /* border */
  border-radius: 8px;              /* rounded-lg */
  padding: 8px 12px;               /* px-3 py-2 */
  width: 100%;                     /* w-full */
  font-size: 14px;
}

input:focus {
  outline: none;
  ring: 2px green-500;             /* focus:ring-2 focus:ring-green-500 */
  border-color: green-500;
}
```

---

## 10. Tlaèítka (Button system)

| Typ | Background | Text | Kde |
|-----|-----------|------|-----|
| Primary | `bg-purple-600` hover `bg-purple-700` | white | Uložit nemovitost, smlouvu, nájemce |
| Success | `bg-green-600` hover `bg-green-700` | white | Uložit platbu, "+ Nová smlouva", "+ Nový" nájemce |
| Secondary | `bg-gray-300` hover `bg-gray-400` | gray-700 | Zrušit |

- Border-radius: `rounded-lg`
- Padding: `py-3 px-6` (nebo `flex-1` pro plnou šíøku)
- Font: `font-semibold`

---

## 11. Interakce & UX pravidla

1. **ESC** zavírá aktuální modal (ne sub-modal pokud je otevøen)
2. **Klik mimo modal** (na overlay) zavírá modal
3. **Klik na buòku "Volno"** › otevírá formuláø nové smlouvy s pøedvyplnìným mìsíc?? a nemovitostí
4. **Klik na zelnou/èervenu buòku** › otevírá modal platby s pøedvyplnìným stavem
5. **Klik na název nemovitosti** v dashboardu › otevírá editaèní modal
6. **Checkbox "Zaplaceno"** › dynamicky zobrazuje/skrývá pole "Datum úhrady"
7. **"+ Nový" nájemce** ve formuláøi smlouvy › otevírá sub-modal nad aktuálním modalem (vyšší z-index)
8. Po uložení dat se data okamžitì refreshují (re-fetch ze storage)

---

## 12.Responzivita

- Sidebar: na mobile se skryje, zobrazuje se hamburger menu
- Stats cards: 4 kolony › 2 › 1
- Kalendáø: horizontální scroll na úzkých screens
- Nemovitost grid: 3 › 2 › 1 kolona