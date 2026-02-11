# Changelog

Seznam změn podle verzí. Při každém zvýšení verze v aplikaci sem doplň novou položku.

---

## v2.5.0 (aktuální)

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
