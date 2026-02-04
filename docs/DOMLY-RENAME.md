# Přejmenování na Domly (domly.cz)

Návrh, co obnáší změna značky na **Domly** a doménu **domly.cz**: repozitář, struktura domén, branding v aplikaci a drobný design „na míru“ názvu.

---

## 1. Struktura domén

| Doména | Účel |
|--------|------|
| **domly.cz** (hlavní) | Prodejní / marketingový web (prezentace produktu Domly). |
| **demo.domly.cz** | **Demo** – aplikace s demo daty pro vyzkoušení. |
| **tobolik.domly.cz** | **Ostrá data** – produkční instance aplikace (vaše reálná data). |

Aplikace (tento repozitář) se tedy nasazuje na **subdomény** (demo a tobolik). Hlavní doména slouží jinému webu (prodejní stránka), ne této SPA.

---

## 2. Repozitář a nasazení

| Položka | Akce |
|---------|------|
| **GitHub repo** | Přejmenovat např. `tobolik/nemovitosti` → `tobolik/domly`. Po přejmenování: `git remote set-url origin https://github.com/tobolik/domly.git` |
| **Nasazení aplikace** | Dvě instance: **demo.domly.cz** (demo) a **tobolik.domly.cz** (ostrá). Na serveru dvě složky (nebo virtuální hosty), každá s vlastním `config.php` (jiná DB pro demo vs. ostrá). |
| **GitHub Actions / Secrets** | Pro automatický deploy: buď dva workflow (např. `main` → tobolik.domly.cz, tag `demo` nebo jiná větev → demo.domly.cz), nebo jeden workflow a ruční přepínání. V Secrets pak dvě sady: `FTP_SERVER_DIR`, `SITE_URL` (a případně DB) – např. `SITE_URL=https://tobolik.domly.cz` pro ostré a `SITE_URL=https://demo.domly.cz` pro demo. |
| **DNS / hosting** | Hlavní doména **domly.cz** → prodejní web. Subdomény **demo.domly.cz** a **tobolik.domly.cz** → nasměrovat na složky/servery s touto aplikací. |

---

## 3. Název aplikace (uživatelsky viditelný)

| Místo | Současný stav | Změna na Domly |
|-------|----------------|-----------------|
| **index.html** | `<title>Nemovitosti – Správa nemovitostí</title>` | `<title>Domly – Správa nemovitostí</title>` |
| **Login** | `login-logo`: „Nemovitosti“ + „Správa nemovitostí & platební morálka“ | „Domly“ + tagline (viz níže) |
| **Sidebar** | `sidebar-brand`: „Nemovitosti“ | „Domly“ |
| **README.md** | „Nemovitosti – Správa nemovitostí“ | „Domly – Správa nemovitostí“ |
| **Ostatní dokumentace** | Odkazy na PropManager / nemovitosti | Domly |

Žádná změna funkcí ani URL v API – pouze texty a branding.

---

## 4. Design „pro Domly“

Název **Domly** je krátký a přátelský. Níže jsou návrhy, jak ho vizuálně podpořit bez velkého redesignu.

### 4.1 Co nechat

- **Purple gradient** – stále funguje a nepůsobí „korporátně“; dává aplikaci jednotný vzhled.
- **Glassmorphism, sidebar, struktura stránky** – beze změny.

### 4.2 Úpravy pro značku Domly

- **Logo / název v sidebaru a na přihlášení**  
  - Zobrazovat **„Domly“** jako hlavní název (větší, tučně).  
  - Případně přidat jednoduchý znak (ikona domečku 🏠 nebo vlastní SVG) vlevo od textu „Domly“ v sidebaru a v login boxu.

- **Tagline (podtitul)**  
  - Přihlášení / úvod: místo „Správa nemovitostí & platební morálka“ např.:  
    - **„Správa nemovitostí na jednom místě“**  
    - **„Domov pro vaše nájmy a platby“**  
    - nebo krátce **„Správa nemovitostí“**.

- **Barva akcentu (volitelně)**  
  - Zachovat fialovou (`--purple-600`, `--accent`) nebo ji mírně sjednotit s doménou (např. jeden odstín pro „Domly“). Není nutné měnit, pokud chcete minimální zásah.

- **Patička**  
  - Text typu „Navajbkódováno by …“ může zůstat; případně doplnit odkaz na domly.cz: „Domly © …“ nebo „domly.cz“.

- **Favicon (volitelně)**  
  - Výměna `favicon.ico` za jednoduchou ikonu s „D“ nebo symbolem domu, aby v záložce vystupoval Domly.

Shrnutí designu: **minimální změna** = jen nahradit texty „Nemovitosti“ → „Domly“ a upravit tagline. **Trochu víc designu** = + ikona u názvu, nový favicon, případně jemné doladění barvy.

---

## 5. Co změnit v souborech (checklist)

- **index.html**  
  - `title`, `.login-logo h1`, `.login-logo p`, `.sidebar-brand`
- **README.md**  
  - Nadpis, popis, odkazy na repo (po přejmenování), zmínky o doméně / SITE_URL
- **.github/workflows/deploy.yml**  
  - Komentář u SITE_URL: „např. https://domly.cz“
- **docs/**  
  - V dokumentech jednotně „Domly“ (a odkazy na domly.cz kde je to relevantní)
- **config.php.example** (pokud obsahuje SITE_URL nebo název)  
  - Uvést příklad domly.cz
- **funcioncionality.md, ux-ui.md**  
  - Úvod / název projektu: Domly

---

## 6. Co neměnit

- Názvy tabulek a sloupců v DB.
- API endpointy a URL v aplikaci.
- Logika (soft-update, entity_id, verzování, přihlášení).
- Názvy souborů (api/, js/, index.html).

---

## 7. Doporučený pořad kroků

1. **Dokumentace a UI** – index.html (title, login, sidebar), README, docs – název „Domly“ a tagline.
2. **Design (volitelně)** – ikona u názvu, favicon, případně barva.
3. **Repo** – přejmenovat repozitář na GitHubu na `domly`; u všech vývojářů aktualizovat `git remote`.
4. **Domény** – hlavní **domly.cz** → prodejní web; **demo.domly.cz** a **tobolik.domly.cz** → DNS a hosting pro tuto aplikaci (dvě instance, dvě DB).
5. **Deploy** – nastavit deploy do obou subdomén (dvě sady Secrets nebo dva joby: `SITE_URL=https://demo.domly.cz` + odpovídající `FTP_SERVER_DIR` pro demo, `SITE_URL=https://tobolik.domly.cz` pro ostré).

Rozsah je tedy hlavně **branding a texty**; změny v kódu jsou malé. Design pro Domly může zůstat střídmý (jen název + tagline) nebo se rozšířit o ikonu a favicon.
