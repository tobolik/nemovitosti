# Přenos znalostí a pravidel do jiného projektu

Tento projekt používá **Cursor rules** (soubory v `.cursor/rules/`) a dokumentaci v `docs/`. Níže je návod, jak je přenést do nového projektu.

**Firemní sdílení na GitHubu:** Repozitář je na [github.com/tobolik/cursor-rules](https://github.com/tobolik/cursor-rules). Když v tomto projektu upravíte pravidla v **`.cursor/rules/`** a chcete je dostat na GitHub, spusťte **`scripts/sync-cursor-rules-to-github.ps1`** (nebo `sync-cursor-rules-to-github.sh`). Podrobný workflow je v **`docs/CURSOR-RULES-SYNC-WORKFLOW.md`**.

---

## 1. Zkopírovat pravidla Cursoru

**Nejjednodušší:** Zkopíruj celou složku s pravidly do nového projektu:

```text
zdroj:  nemovitosti.tobolik.cz/.cursor/rules/
cíl:   NOVY_PROJEKT/.cursor/rules/
```

Soubory ve složce `rules/`:

| Soubor | Popis |
|--------|--------|
| `version-increment.mdc` | Verze v index.html, cache busting `?v=`, závěrečná hláška (verze + push). **Uprav** cestu k souboru s verzí, pokud nový projekt nemá `index.html` (např. SPA s `package.json` version). |
| `ux-ui-conventions.mdc` | Poznámka (ořez + tooltip), scrollbary, formuláře. Obecně použitelné. |
| `soft-update-and-versioning.mdc` | Soft-update v API (softInsert/softUpdate/softDelete), entity_id, valid_*. **Použij jen pokud** nový projekt má stejný PHP/DB model. |
| `db-new-tables.mdc` | Konvence pro nové tabulky (sloupce, indexy). **Použij jen pokud** nový projekt používá stejný soft-update. |

V novém projektu můžeš část pravidel **vypnout** (smazat nebo upravit `globs`), pokud se tam něco nepoužívá.

---

## 2. Upravit cesty a konvence

- **version-increment.mdc:** Pokud nový projekt nemá `index.html` s `footer-version` a `?v=`, uprav v pravidle cestu (např. `package.json` → `version`) a způsob cache bustingu (např. build hash).
- **globs v .mdc:** Cesty jako `migrations/*.sql`, `api/crud.php` uprav na odpovídající strukturu nového projektu (nebo globs smaž pro „platí všude“).
- **soft-update pravidla:** Pokud nový projekt nemá PHP backend s `valid_to` / entity_id, soubory `soft-update-and-versioning.mdc` a `db-new-tables.mdc` nepřenášej, nebo je zjednoduš na „dokumentaci pro budoucí použití“.

---

## 3. Přenesení dokumentace (volitelné)

Můžeš zkopírovat i vybrané dokumenty z `docs/`:

- `docs/SOFT-UPDATE-AND-VERSIONING.md` – pokud nový projekt bude používat soft-update.
- `docs/UX-UI-CONVENTIONS.md` – pokud existuje a chceš stejné UX konvence.
- `ux-ui.md` / `funcioncionality.md` – specifika tohoto projektu; do nového projektu jen jako inspirace nebo šablona.

---

## 4. Rychlý checklist pro nový projekt

1. Vytvoř v novém projektu složku `.cursor/rules/` (pokud neexistuje).
2. Zkopíruj z tohoto projektu soubory `*.mdc` z `.cursor/rules/`.
3. V každém `.mdc` zkontroluj a případně uprav:
   - `globs` (cesty k souborům),
   - odkazy na konkrétní soubory (např. `index.html`).
4. Pravidla specifická pro „nemovitosti“ (soft-update, DB tabulky) buď uprav na nový stack, nebo odstraň.
5. Otestuj v Cursoru, že se pravidla nabízejí / aplikují (např. úpravou verze nebo poznámky v tabulce).

---

## 5. Jednorázový export (složka k zkopírování)

Můžeš si připravit složku jen s pravidly a s tímto návodem:

```text
cursor-rules-export/
  README.md                    ← zkopíruj tento návod (zkrácený)
  version-increment.mdc
  ux-ui-conventions.mdc
  soft-update-and-versioning.mdc
  db-new-tables.mdc
```

Tu složku zkopíruješ do nového projektu jako `.cursor/rules/` (obsah souborů do `NOVY_PROJEKT/.cursor/rules/`).

---

Shrnutí: **základ přenosu = zkopírovat `.cursor/rules/*.mdc` do nového projektu a v nich upravit cesty a konvence na nový projekt.** Pravidla pro soft-update a DB přenášej jen tehdy, pokud nový projekt bude používat stejný model.
