# Návrh rozdělení plateb: Adam Mráček – garáž (7770101774)

Nájem garáže **2 000 Kč/měsíc**. Výpis z účtu (od nejstarších):

| Datum výpisu | Částka (Kč) | Poznámka v bance | Navržené období | Částka | Poznámka v DB |
|--------------|-------------|------------------|-----------------|--------|----------------|
| 12.04.2024   | 2 000       | Garaž            | **duben 2024**  | 2 000  | Garaž |
| 13.07.2024   | 2 000       | Cerven           | **červen 2024** | 2 000  | Červen |
| 13.07.2024   | 1 000       | 1000/4000 najem dluh garaz | **květen 2024** (doplatek) | 1 000 | Doplatek dluh (1000/4000) |
| 07.08.2024   | 2 000       | Srpen            | **srpen 2024**  | 2 000  | Srpen |
| 07.08.2024   | 1 500       | 2500/4000 najem dluh garaz | **červenec 2024** (částečně) | 1 500 | Doplatek dluh (1500/2000 za červenec) |
| 27.09.2024   | 2 000       | —                | **září 2024**   | 2 000  | — |
| 15.10.2024   | 2 000       | —                | **říjen 2024**  | 2 000  | — |
| 15.11.2024   | 2 000       | —                | **listopad 2024** | 2 000 | — |
| 16.12.2024   | 2 000       | —                | **prosinec 2024** | 2 000 | — |
| 15.01.2025   | 2 000       | Garaz            | **leden 2025**  | 2 000  | Garaz |
| 17.02.2025   | 2 000       | —                | **únor 2025**   | 2 000  | — |
| 19.02.2025   | 500         | —                | **červenec 2024** (doplatek) | 500 | Doplatek za červenec 2024 |
| 13.03.2025   | 2 500       | —                | **březen 2025** | 2 500  | Nájem březen (příp. 2000+500 doplatek) |
| 09.09.2025   | 6 250       | —                | **Doplatek dluhu** (rozpuštěno do chybějících měsíců, smlouva do 30.6.2025) | viz níže | — |

**Rozpuštění 6 250 Kč (09.09.2025) do dluhů v období smlouvy:**

Smlouva končí 30.6.2025. Chybějící měsíce před touto platbou:
- **Květen 2024:** už zaplaceno jen 1 000 → zbývalo 1 000 Kč  
- **Duben 2025:** 0 Kč → dluh 2 000 Kč  
- **Květen 2025:** 0 Kč → dluh 2 000 Kč  
- **Červen 2025:** 0 Kč → dluh 2 000 Kč  
Celkem dluh 7 000 Kč, k úhradě přišlo 6 250 Kč → rozepsáno:

| Období       | Částka | Poznámka |
|--------------|--------|----------|
| květen 2024  | 1 000  | Doplatek dluh (platba 09.09.2025) |
| duben 2025   | 2 000  | Doplatek dluh (platba 09.09.2025) |
| květen 2025  | 2 000  | Doplatek dluh (platba 09.09.2025) |
| červen 2025  | 1 250  | Doplatek dluh (platba 09.09.2025), červen 2025 zbývá 750 Kč |

**Shrnutí logiky:**
- Květen 2024: nejdřív 1 000 (13.07.2024), doplatek 1 000 z platby 09.09.2025 → celkem 2 000 ✓  
- Červenec 2024: 1 500 + 500 = 2 000 ✓  
- Platba 6 250 (09.09.2025): **jde do dluhů** za květen 2024 (1 000) + duben–červen 2025 (2 000 + 2 000 + 1 250). Červen 2025 zůstane částečně neuhrazen (750 Kč).

**Jak to řešit v aplikaci (obecně):**  
Jedna hromadná platba = více záznamů v tabulce `payments`: každý záznam má **období** (period_year, period_month) = měsíc, na který se částka vztahuje, a **datum úhrady** = skutečné datum přijetí platby. V modalu platby: u každého neuhrazeného/částečně neuhrazeného měsíce zvolíte „+ Přidat novou platbu“, zadáte částku (alokovanou z hromadné platby) a datum úhrady. Migrace to pro tento import dělá v SQL stejným způsobem.

---

## Klíč: Rozdělení plateb po měsících (period_year, period_month)

Přehled, **které platby** (datum úhrady, částka) patří **do kterého měsíce**:

| Období (měsíc) | Očekávaný nájem | Platby přiřazené k měsíci (payment_date, amount, note) | Součet plateb |
|----------------|-----------------|--------------------------------------------------------|---------------|
| **2024-03** březen | 1 000 (1. měsíc) | 14.03.2024 · 1 000 · hotovost | 1 000 ✓ |
| **2024-04** duben | 2 000 | 12.04.2024 · 2 000 · Garaž | 2 000 ✓ |
| **2024-05** květen | 2 000 | 13.07.2024 · 1 000 · Doplatek (1000/4000) · **09.09.2025 · 1 000 · dávka** | 2 000 ✓ |
| **2024-06** červen | 2 000 | 13.07.2024 · 2 000 · Červen | 2 000 ✓ |
| **2024-07** červenec | 2 000 | 07.08.2024 · 1 500 · Doplatek červenec · 19.02.2025 · 500 · Doplatek červenec | 2 000 ✓ |
| **2024-08** srpen | 2 000 | 07.08.2024 · 2 000 · Srpen | 2 000 ✓ |
| **2024-09** září | 2 000 | 27.09.2024 · 2 000 | 2 000 ✓ |
| **2024-10** říjen | 2 000 | 15.10.2024 · 2 000 | 2 000 ✓ |
| **2024-11** listopad | 2 000 | 15.11.2024 · 2 000 | 2 000 ✓ |
| **2024-12** prosinec | 2 000 | 16.12.2024 · 2 000 | 2 000 ✓ |
| **2025-01** leden | 2 000 | 15.01.2025 · 2 000 · Garaz | 2 000 ✓ |
| **2025-02** únor | 2 000 | 17.02.2025 · 2 000 | 2 000 ✓ |
| **2025-03** březen | 2 000 | 13.03.2025 · 2 500 | 2 500 ✓ |
| **2025-04** duben | 2 000 | **09.09.2025 · 2 000 · dávka** | 2 000 ✓ |
| **2025-05** květen | 2 000 | **09.09.2025 · 2 000 · dávka** | 2 000 ✓ |
| **2025-06** červen | 2 000 | **09.09.2025 · 1 250 · dávka** | 1 250 (zbývá 750) |

**Dávka** = platba 6 250 Kč (09.09.2025) má v DB `payment_batch_id`; všechny 4 záznamy (květen 2024 + duben–červen 2025) jsou v aplikaci označené jako „dávka“.
