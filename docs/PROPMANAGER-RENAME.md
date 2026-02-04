# Přejmenování projektu na PropManager

Návrh, co všechno přejmenování z „nemovitosti“ / „tobolik“ na **PropManager** obnáší.

---

## 1. Název aplikace (uživatelsky viditelný)

| Místo | Současný stav | Změna |
|-------|----------------|-------|
| **index.html** | `<title>`, záhlaví, patička | Např. „PropManager“ nebo „PropManager – správa nemovitostí“ |
| **README.md** | Název projektu, popis | PropManager |
| **Ostatní dokumentace** | Odkazy na „aplikace nemovitosti“ | PropManager |

---

## 2. Repozitář a deployment

| Položka | Akce |
|---------|------|
| **GitHub repo** | Přejmenovat např. `tobolik/nemovitosti` → `tobolik/PropManager` (nebo nový org/repo) |
| **Git remote** | Po přejmenování repa aktualizovat `git remote set-url origin ...` u lokálních klonů |
| **Deploy (GitHub Actions, server)** | Cesty a názvy složek mohou zůstat; pokud je v konfiguraci název projektu (např. složka `nemovitosti.tobolik.cz`), zvážit přejmenování na `propmanager` nebo nechat kvůli kompatibilitě |

---

## 3. Databáze

| Položka | Doporučení |
|---------|------------|
| **DB name** | Např. `tobolikcz01` – může zůstat (interní); nebo nová DB `propmanager` / `propmanager_demo` pro demo |
| **config.php.example** | Pokud je v dokumentaci zmínka o názvu DB, uvést jako volitelný „PropManager“ |

Není nutné měnit názvy tabulek (properties, contracts, …) – jsou obecné.

---

## 4. Kód (PHP, JS)

- **Názvy souborů:** Nemusí se měnit (api/, js/, index.html).
- **Namespace / komentáře:** V hlavičkách souborů (např. „Property Management“, „PropManager API“) nahradit starý název za PropManager.
- **Konstanty / konfigurace:** Pokud existuje např. `APP_NAME`, nastavit na „PropManager“.

---

## 5. Dokumentace a soubory v repozitáři

| Soubor / složka | Změna |
|------------------|--------|
| **README.md** | Název „PropManager“, popis, odkaz na docs |
| **funcioncionality.md**, **ux-ui.md** | V úvodu uvést PropManager |
| **docs/** | V dokumentech jednotně používat „PropManager“ |
| **schema.sql** | Komentář v hlavičce: „PropManager“ |
| **.github/workflows/deploy.yml** | Pokud je tam název projektu (path, job name), přejmenovat na PropManager |

---

## 6. Externí služby a domény

- **Doména:** např. `nemovitosti.tobolik.cz` → zvážit `propmanager.tobolik.cz` nebo novou doménu (volitelné; záleží na rozhodnutí).
- **OAuth / třetí strany:** Pokud je někde zaregistrovaný název aplikace, aktualizovat na PropManager.

---

## 7. Doporučený pořad kroků

1. **Dokumentace a UI** – README, index.html (title, záhlaví), případně config.example (APP_NAME).
2. **Repozitář** – přejmenovat repo na GitHubu; aktualizovat remote u vývojářů.
3. **Deploy** – upravit workflow a cestu na serveru, pokud se mění název složky nebo projektu.
4. **Doména / branding** – podle potřeby změnit doménu a zmínky v dokumentaci.

---

## 8. Co neměnit

- Názvy tabulek a sloupců v DB (properties, contracts, payments, …).
- Názvy API endpointů (api/crud.php, api/auth.php) – URL mohou zůstat.
- Logiku aplikace (soft-update, entity_id, verzování) – pouze „kosmetické“ nahrazení názvů v textech a dokumentaci.

Přejmenování je tedy hlavně **branding a dokumentace**; rozsah změn v kódu je malý (řádově jednotky souborů).
