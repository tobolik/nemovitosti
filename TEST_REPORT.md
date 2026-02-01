# Test Report – Nemovitosti

**Datum:** 2025-02-01  
**Typ:** Statická analýza kódu (bez PHP na systému nelze spustit live testy)

---

## Opravené chyby

### 1. **properties.js – chybějící `purchase_date` v getValues()**
- **Problém:** Pole datum koupě se při ukládání nemovitosti neodesílalo do API.
- **Oprava:** Přidán `purchase_date` do `getValues()` a `resetForm()`.

### 2. **payments.js – překlep v placeholderu**
- **Problém:** „Wyberte smlouvu“ (slovensky) místo „Vyberte smlouvu“ (česky).
- **Oprava:** Opraven text na „Vyberte smlouvu“.

---

## Ověřené funkce

### API (PHP)
| Endpoint | Stav | Poznámka |
|----------|------|----------|
| auth.php | OK | Login, logout, session check |
| crud.php | OK | CRUD pro properties, tenants, contracts, payments |
| dashboard.php | OK | Stats, heatmap, contracts overview |
| address-suggest.php | OK | Nominatim / Mapy.cz proxy |
| ares-lookup.php | OK | ARES API proxy pro IČ |
| migrate.php | OK | SQL migrace při deployi |
| users.php | OK | Správa uživatelů (admin) |

### Frontend – views
| View | Stav | Funkce |
|------|------|--------|
| Dashboard | OK | Stats, heatmap, rok, platby z kalendáře |
| Nemovitosti | OK | CRUD, výměra, kupní cena, datum koupě |
| Nájemníci | OK | CRUD, typ FO/PO, ARES lookup (tlačítko u IČ) |
| Smlouvy | OK | CRUD, dropdowny, modal „+ Nájemník“, ARES v modalu |
| Platby | OK | CRUD, filtr smlouvy, auto-fill nájemného |
| Uživatelé | OK | Admin only, CRUD, změna hesla |

### Modaly
| Modal | Stav |
|-------|------|
| modal-payment | OK – platba z heatmapy |
| modal-tenant | OK – nový nájemník ze smluv |
| modal-pass | OK – změna hesla |

### Závislosti
- **api.js:** authCheck, crudList/Add/Edit/Delete, dashboardLoad, aresLookup ✓
- **ui.js:** esc, fmt, fmtDate, MONTHS, alertShow, modalOpen/Close, renderTable, createCrudForm, confirmDelete ✓
- **Script order:** api → ui → address-autocomplete → app → views ✓

---

## Doporučení pro manuální test

1. **Přihlášení** – ověřit session po CTRL+F5
2. **Nemovitost** – přidat s datumem koupě, zkontrolovat zobrazení v tabulce
3. **Nájemník FO** – přidat fyzickou osobu
4. **Nájemník PO** – přidat právnickou osobu, IČ 00006947, tlačítko „Načíst z ARES“
5. **Smlouva** – vybrat nemovitost a nájemníka, tlačítko „+ Nájemník“ otevře modal
6. **Platba** – přidat platbu, ověřit filtr
7. **Dashboard** – heatmapa, klik na Volno → nová smlouva, klik na buňku s platbou → modal platby
8. **Adresa** – autocomplete u nemovitosti a nájemníka
