# Workflow: interní pravidla → Pull request → firemní cursor-rules

Pravidla si upravujete v **projektu** (nemovitosti) v **`.cursor/rules/`** – to jsou vaše **interní pravidla**. Když z nich chcete něco dostat do **firemního** repozitáře (tobolik/cursor-rules), jdete cestou **Pull requestů**: sync pushne na větev, vy (nebo někdo jiný) na GitHubu otevře PR a po kontrole/merge se změny dostanou do `main`. Stejně mohou dělat kolegové – každý z vlastního projektu pushne na svoji větev a otevře PR; merguje se až když to dává smysl (eventuálně sloučení s jinými PR).

---

## Kde co editovat

| Kde | Účel |
|-----|------|
| **`.cursor/rules/*.mdc`** | **Interní pravidla** – tady v projektu pravidla upravujete a Cursor je používá. |
| **`docs/cursor-rules-firemni/`** | Klon repa cursor-rules (vlastní `.git`). Slouží jen jako cíl pro sync a push na větev. Needitujte tady přímo. |

---

## Doporučený postup (cesta Pull requestů)

1. **Upravte pravidlo** v **`.cursor/rules/`** v tomto projektu (nemovitosti). Otestujte, že to funguje.
2. **Sync a push na větev** (z kořene projektu):
   - **Windows:** `.\scripts\sync-cursor-rules-to-github.ps1`
   - **Linux/macOS:** `./scripts/sync-cursor-rules-to-github.sh`
3. Skript zkopíruje `.cursor/rules/*.mdc` do `docs/cursor-rules-firemni/rules/`, udělá commit a **pushne na větev `sync-from-nemovitosti`** (ne na `main`).
4. Na konci skriptu se zobrazí odkaz na vytvoření PR. Otevřete na GitHubu **Pull request** z větve `sync-from-nemovitosti` do `main`.
5. Po kontrole (a případném sloučení s jinými PR od kolegů) PR **mergnete**. Teprve pak jsou změny ve firemním `main` a ostatní si je stáhnou přes `git pull` + znovu spuštění instalace.

**Proč PR:** Můžete sloučit více změn (vlastní + od kolegů), před mergem zkontrolovat diff a případně řešit konflikty na jednom místě.

---

## Přímo na main (výjimečně)

Chcete-li pushnout rovnou na `main` bez PR (např. drobná úprava, jen vy přispíváte):

- **PowerShell:** `.\scripts\sync-cursor-rules-to-github.ps1 -PushBranch "main"`
- **Bash:** `./scripts/sync-cursor-rules-to-github.sh main`

---

## Stažení aktuální verze od kolegů (z GitHubu k sobě)

Když někdo zmergnul změny do firemního `main` a vy si je chcete stáhnout do svého projektu:

- **Windows:** `.\scripts\pull-cursor-rules-from-github.ps1`
- **Linux/macOS:** `./scripts/pull-cursor-rules-from-github.sh`

Skript v `docs/cursor-rules-firemni` udělá `git fetch` + `checkout main` + `pull`, pak zkopíruje `rules/*.mdc` do **`.cursor/rules/`**. Před přepsáním vytvoří zálohu do **`.cursor/rules-backup-YYYYMMDD-HHMM`**, takže při rozporech můžete porovnat a ručně doplnit.

---

## Rozpory mezi firemní verzí a vaší – jak to propojit?

Skript **neprovádí automatické sloučení** (merge) dvou verzí. Propojení se dělá takto:

1. **Merge na GitHubu (doporučené)**  
   Své změny nejdřív pošlete do firemního repa: **sync → větev → Pull request**. V PR na GitHubu se zobrazí rozdíly oproti `main`; tam můžete vyřešit konflikty („Resolve conflicts“), doplnit změny od kolegů a jedním mergem sloučit firemní a vaši verzi. Po mergi do `main` si u vás stačí spustit **pull** – dostanete už sloučený stav.

2. **Lokální rozpor (vy jste měnili, mezitím někdo zmergnul do main)**  
   - Spusťte **pull** (před přepsáním se vytvoří záloha v `.cursor/rules-backup-…`).  
   - Do `.cursor/rules/` se dostane aktuální firemní verze.  
   - Pokud chcete zachovat i svoje úpravy: porovnejte zálohu s novým obsahem (diff / merge tool) a potřebné části ručně doplňte do `.cursor/rules/`.  
   - Případně svoje verze pošlete znovu jako **sync → PR** a v PR na GitHubu je sloučte s aktuálním `main`.

**Shrnutí:** Automatické propojení (merge) se děje **na GitHubu v Pull requestu**, ne při pull skriptu. Pull skript jen přepíše lokální pravidla verzí z `main` a před tím udělá zálohu.

---

## Přidání nového sdíleného pravidla

1. Vytvořte **`.cursor/rules/nazev-pravidla.mdc`** v projektu (interní pravidlo).
2. Spusťte sync (viz výše). Nový soubor pojede s ostatními do větve, pak otevřete PR.
3. Po mergi PR můžete v repu cursor-rules doplnit README (tabulka „Co je v balíku“) – buď v dalším PR, nebo v tomtéž (po syncu upravit README v `docs/cursor-rules-firemni` a znovu commit + push na stejnou větev).

---

## Shrnutí

- **Interní pravidla:** editujete **`.cursor/rules/`** v tomto projektu.
- **Do firemního repa:** spustíte sync skript → push na větev **sync-from-nemovitosti** → na GitHubu **Pull request** do `main` → po kontrole/merge. Kolegové mohou dělat totéž ze svých projektů; PR se dají sloučit a mergovat společně.
