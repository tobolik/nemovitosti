# Changelog

Seznam změn podle verzí. Při každém zvýšení verze v aplikaci sem doplň novou položku.

---

## v2.6.12 (aktuální)

- **Railway:** Nový workflow `railway-migrate.yml` – automaticky spouští SQL migrace po pushu do větve (např. feature/rent-as-payment-requests); vyžaduje Secrets `RAILWAY_URL` a `MIGRATE_KEY` v GitHubu

## v2.6.11

- **Fix:** Heatmapa – zbytek platby (remainder) po alokaci se přidává do měsíce i když je záporný (např. refund); podmínka změněna z `$remainder > 0` na `$remainder != 0` v PHP i v JS (amountContributingToMonth a zobrazení breakdown)

## v2.6.10

- **Fix:** Migrace 062 (rent požadavky) propojuje pouze platby s vyplněným `payments_id` (entity_id); do `payment_requests.payments_id` se ukládá jen logické ID, ne fyzické `id` při NULL

## v2.6.9

- **Fix:** Kontrola neuhrazených dluhů před auto-vytvořením deposit_return používá pouze `settled_by_request_id IS NULL` (bez porovnání s `''`); integer pole se v MySQL neporovnává s prázdným řetězcem, jinak by se mohly nesprávně vytvářet požadavky na vrácení kauce i při existujících neuhrazených položkách

## v2.6.8

- **Fix:** Jednotná verze v celém index.html – sidebar footer zobrazoval v2.6.6, nyní v souladu s login a cache busting
- **Fix:** Při automatickém vytvoření platby za vrácení kauce (vyplnění data vrácení kauce na smlouvě) se ukládá `payment_type = 'deposit_return'` místo `'deposit'`; kontrola existence platby a heatmapa tak správně rozlišují příjem vs. vrácení kauce

## v2.6.7

- **Fix:** Při načtení požadavku na platbu typu „nájem“ (rent) do modalu pro úpravu se typ správně zobrazí a nezmění na „energie“

## v2.6.6

- **Fix:** Neuhrazený nájem se zobrazuje v nevyřízených požadavcích (oranžový okraj heatmapy a tooltip)
- **Fix:** Depozitní statistiky – u ukončených smluv se kauce započítá jen do „K vrácení“, ne do „Držené“ (odstraněno dvojí započtení)

## v2.6.5

- **Fix:** Před automatickým vytvořením požadavku na vrácení kauce se z kontroly neuhrazených dluhů vyřazují settled zálohy (settled_by_request_id IS NOT NULL)

## v2.6.4

- **Fix:** Smlouva končící 1. v měsíci – nájem za ten měsíc se neúčtuje (syncRentPaymentRequests nepřidá rent request pro ten měsíc)

## v2.6.3

- **Fix:** Odstraněn mrtvý kód (zpětná kompatibilita deposit_return) v součtu Expected v dashboard.php

## v2.6.2

- **Fix:** Smyčka syncRentPaymentRequests – horní mez pomocí skaláru (y*12+m) <= limit; ochrana při start > end

## v2.6.1

- **Fix:** Kontrola neuhrazených dluhů před auto-vytvořením deposit_return vylučuje i typ deposit_return (type NOT IN ('deposit','deposit_return'))

## v2.6.0

- **Redesign vyúčtování energií i kauce:** nahrazeny původní modaly za tabulkový výpis (`UI.renderTable`) s auditní stopou
- **Nové DB tabulky:** `settlements` a `settlement_items` (migrace 064) uchovávají kompletní historii vyúčtování
- **Lock/unlock mechanismus:** vyúčtování je po uložení editovatelné, lze zamknout pro readonly; odemknutí umožňuje editaci
- **Nové API akce:** `settlement_save`, `settlement_update`, `settlement_lock`, `settlement_unlock`, `settlement_delete`, `settlements_list`
- **Formulář pro vyúčtování:** výběr konkrétních záloh (checkboxy), skutečná částka, automatický výpočet rozdílu, editovatelný název požadavku na platbu
- **Migrace existujících dat:** skript 065 migruje stávající settlement požadavky do nové struktury
- **Přejmenování:** „Zúčtovat kauci" → „Vyúčtování kauce" v UI
- **CSS:** nové styly pro badge zamčeno/otevřeno, readonly inputy

## v2.5.10

- **Částečné vrácení kauce:** tooltip u oranžové K ikony i v buňce rozlišuje plné vs. částečné vrácení (např. „Kauce vrácena částečně: 16 000 Kč z 18 000 Kč")

## v2.5.9

- **Tooltip kaucí: jméno nájemníka:** v tooltipu K ikony i v tooltipu buňky se zobrazuje jméno nájemníka (od koho kauce přijata / komu vrácena)

## v2.5.8

- **Fix: K ikony podle znaménka částky:** rozlišení přijetí/vrácení kauce se řídí znaménkem částky (kladná = přijata, záporná = vrácena), ne typem platby – opravuje případ, kdy záporná kauce měla `payment_type=deposit` místo `deposit_return`
- **Fix: tooltip kauce:** správně zobrazuje „Kauce přijata" vs „Kauce vrácena" podle znaménka a ukazuje absolutní hodnotu u vrácení

## v2.5.5

- **Heatmap deposit indicator fix:** při dvou kaucích v jednom měsíci (přijetí + vrácení) se zobrazí dvě K ikony vedle sebe (modrá + oranžová); ikony jsou v řádku vedle fajfky/křížku, ne pod ní

## v2.5.4

- **Heatmap deposit indicator:** v buňce heatmapy se zobrazí modré „K" v kroužku při přijetí kauce, oranžové „K" při vrácení kauce; tooltip ukazuje detail (částka, datum)
- **Depozitní účet:** nahrazeny dvě jednoduché stat karty jednou „Držené kauce" kartou s rozbalovacím detailem per smlouva (nájemník, nemovitost, částka, datum přijetí, stav: Aktivní / K vrácení / Vrácena)
- **Deposit badge v Přehledu smluv:** u každé smlouvy s kaucí se zobrazuje malý badge „K 18 000" (modrý = aktivní, oranžový = k vrácení)
- **Tooltip heatmapy:** generický text o kaucích nahrazen dynamickými informacemi o konkrétních kaucích v daném měsíci

## v2.5.0

- **Redesign Expected/Paid:** nový sloupec `settled_by_request_id` pro vyúčtované zálohy na energie – zůstávají v DB pro historii, ale neovlivňují Očekáváno
- **Deposit/deposit_return vyloučeny z Očekáváno:** kauce a vrácení kauce nejsou závazky nájemce; v Uhrazeno se vzájemně kompenzují
- **Heatmap alokace kauce:** platba kauce se alokuje na pokryté položky (nájem, settlement), nikoli na deposit request; remainder z kauce se zahazuje (kompenzuje se s deposit_return)
- **Neuhrazené požadavky (oranžové):** vyřazeny settled zálohy a deposit/deposit_return; řazení dle data splatnosti
- **Migrace 063:** nový sloupec `settled_by_request_id` + zpětná aktualizace existujících dat
- **settlement.php:** energy_settlement automaticky označí nezaplacené zálohy jako settled
- **Pozn.:** v2.4.1 (commit f4c007f) a v2.4.2 byly revertovány; v2.5.0 nahrazuje přístup z v2.4.x novým konceptem

## v2.4.1 (revertováno → nahrazeno v2.5.0)

- Vyúčtování kauce: rozpad v modalech (uhrazené zálohy / z kauce již uhrazeno / nedoplatek-přeplatek)
- paid_at při zúčtování kauce z data úhrady platby kauce (payment_date), ne z dneška
- Energy settlement: nezaplacené zálohy se nemažou, zůstávají v historii

## v2.4.0

- Energy settlement: nemazat zálohy, přeskakovat je v expected po vyúčtování

## v2.3.8

- deposit_return: vynucení záporné částky (validace backend + frontend), alokační testy

## v2.3.6

- Cap allocation to payment amount (fix false overpayment)

## v2.3.5

- Fix heatmap alokace, klikatelný modal, oprava přeplatku

## v2.3.4

- Fix async onSaved, settlement due_date/period, heatmap remainder, filter paid requests

## v2.3.3

- Ukončená smlouva: neautomatizovat deposit_return při dluzích; po uložení nabídnout zúčtování kauce / vyúčtování energií
