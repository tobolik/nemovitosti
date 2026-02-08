# Simona Benová – Byt Interbrigadistů: výpočty podle tabulky

Období smlouvy: **14. 9. 2020 – 7. 1. 2021**

## Předpis (co měla zaplatit)

| Měsíc   | Nájem | Energie | Celkem |
|---------|------:|--------:|-------:|
| září    | 4 500 | 300     | 4 800  |
| říjen   | 9 000 | 600     | 9 600  |
| listopad| 9 000 | 600     | 9 600  |
| prosinec| 9 000 | 600     | 9 600  |
| leden   | 4 500 | 300     | 4 800  |
| **Celkem** | **36 000** | **2 400** | **38 400** |

- **Kauce:** 18 000 Kč  
- **Předpis celkem (nájem + energie + kauce):** 38 400 + 18 000 = **56 400 Kč**

## Platby (co reálně zaplatila)

| Datum    | Částka  | Účel        |
|----------|--------:|-------------|
| 15. 9.   | 4 500   | září (hotovost) |
| 30. 9.   | 8 000   | září (hotovost) |
| 2. 11.   | 9 000   | říjen (hotovost) |
| 11. 11.  | 2 200   | dluh 1 000 + energie 600 + 600 |
| 30. 9.   | 18 000  | kauce (hotovost) |
| **Příjmy celkem** | **41 700** | |
| 8. 1. 2021 | −4 000 | vrácení zbytku kauce |
| **Čistý příjem** | **37 700** | |

- **Na nájem + energie:** 4 500 + 8 000 + 9 000 + 2 200 = **24 700 Kč**
- **Na kauce:** 18 000 Kč

## Shrnutí

- **Měla zaplatit (nájem + energie):** 38 400 Kč  
- **Reálně zaplatila (nájem + energie):** 24 700 Kč  
- **Rozdíl (dluh krytý z kauce):** 38 400 − 24 700 = **13 700 Kč**  
- Z kauce 18 000 Kč bylo tedy 13 700 Kč použito na doplatek, **vráceno 4 000 Kč** (zbytek po vyúčtování).

---

## Co migrace 059 konkrétně vytvoří

### Platby (`payments`) – 6 záznamů

| # | Datum     | Částka   | Období  | Typ            | Způsob   | Poznámka |
|---|-----------|----------|---------|----------------|----------|----------|
| 1 | 15. 9. 2020  | 4 500  | 2020-09 | nájem (rent)   | hotovost | Září (hotovost) |
| 2 | 30. 9. 2020  | 8 000  | 2020-09 | nájem (rent)   | hotovost | Září (hotovost) |
| 3 | 2. 11. 2020  | 9 000  | 2020-10 | nájem (rent)   | hotovost | Říjen (hotovost) |
| 4 | 11. 11. 2020 | 2 200  | 2020-11 | nájem (rent)   | účet     | Dluh 1000 + energie 600+600 |
| 5 | 30. 9. 2020  | 18 000 | 2020-09 | kauce (deposit)| hotovost | Kauce (hotovost) |
| 6 | 8. 1. 2021   | −4 000 | 2021-01 | vrácení kauce  | účet     | Vrácení zbytku kauce po odečtení vyúčtování a dlužných nájmů |

---

### Požadavky na platbu (`payment_requests`)

**Nájem (předpis):** Aplikace neukládá nájem jako řádky v `payment_requests`. Předpis nájmu za každý měsíc se počítá ze smlouvy: `first_month_rent` (září), `monthly_rent` (říjen–prosinec), `last_month_rent` (leden) → 4 500 + 9 000 + 9 000 + 9 000 + 4 500 = 36 000 Kč.

**Energie (5 požadavků)** – migrace vloží tyto řádky (bez propojení na platbu; 2 200 Kč lze později v UI přiřadit na konkrétní požadavky):

| Typ    | Částka | Splatnost (due_date) | Poznámka |
|--------|--------|----------------------|----------|
| energy | 300    | 1. 10. 2020          | Energie (záloha září) |
| energy | 600    | 1. 11. 2020          | Energie (záloha říjen) |
| energy | 600    | 1. 12. 2020          | Energie (záloha listopad) |
| energy | 600    | 1. 1. 2021           | Energie (záloha prosinec) |
| energy | 300    | 1. 2. 2021           | Energie (záloha leden) |

**Kauce a vrácení (2 požadavky)** – každý propojený s platbou (`payments_id`, `paid_at`):

| Typ           | Částka   | Splatnost  | Uhrazeno   | Propojeno s platbou |
|---------------|----------|------------|------------|----------------------|
| deposit       | 18 000   | 14. 9. 2020| 30. 9. 2020| ano (platba 18 000, 30. 9.) |
| deposit_return| −4 000   | 7. 1. 2021 | 8. 1. 2021 | ano (platba −4 000, 8. 1.) |

---

### Smlouva (`contracts`)

- **Období:** 14. 9. 2020 – 7. 1. 2021  
- **monthly_rent:** 9 000  
- **first_month_rent:** 4 500 (září)  
- **last_month_rent:** 4 500 (leden)  
- **deposit_amount:** 18 000, **deposit_paid_date:** 30. 9. 2020, **deposit_return_date:** 8. 1. 2021  

---

Migrace: `migrations/059_benova_simona_interbrigadistu.sql`  
– platba 4 500 Kč ze 15. 9., první/poslední měsíc 4 500, požadavky na energie 300/600/600/600/300, kauce a vrácení kauce.
