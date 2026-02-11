# Changelog

Seznam změn podle verzí. Při každém zvýšení verze v aplikaci sem doplň novou položku.

---

## v2.5.10 (aktuální)

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
