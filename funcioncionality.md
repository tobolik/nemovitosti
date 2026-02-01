# PropManager CZ — Kompletní specifikace aplikace

## 1. Pøehled projektu

PropManager CZ je single-page webová aplikace pro správu soukromých nemovitostí (byty, garáže). Slouží pro malé pronájímatele, která potøebují evidovat nemovitosti, nájemce, smlouvy a platby. Hlavní funkci je vizuální platební kalendáø (heatmapa) zobrazující stav plateb po mìsících.

**Aplikace musí bìžet bez instalace** — jediný soubor `index.html`, vše pøes CDN.

---

## 2. Tech stack

| Technologie | Jak se naèítá | Úèel |
|---|---|---|
| React 18 | `<script src="https://unpkg.com/react@18/umd/react.production.min.js">` | UI framework |
| ReactDOM 18 | `<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js">` | Rendering |
| Babel Standalone | `<script src="https://unpkg.com/@babel/standalone/babel.min.js">` | JSX transpilace v prohlížeèi |
| Tailwind CSS | `<script src="https://cdn.tailwindcss.com">` | Styling |

**Kriticky dùležité:**
- Veškerý kód je v jednom `<script type="text/babel">` bloku
- React se používá pøes globální `window.React` — destructuring: `const { useState, useEffect, useMemo } = React;`
- Žádné ESM importy (`import` / `export`) — vše v jednom scope
- Ikony: vlastní inline SVG komponenty (žádná external icon library)
- Žádné `localStorage` / `sessionStorage` volání pøímo — vše pøes `api` helper objekt

---

## 3. Datový model

### Property (nemovitost)
```js
{
  id: Number,            // Date.now() pøi tvorbe
  name: String,          // "Byt 2+kk", "Garáž Jaselská 3"
  type: String,          // "Byt" | "Garáž"
  address: String,       // "Hlavní 123, Praha"
  sizeM2: Number,        // 55
  purchasePrice: Number  // 2500000
}
```

### Tenant (nájemce)
```js
{
  id: Number,
  type: String,          // "person" | "company"
  name: String,          // "Jan Novák" | "ABC s.r.o."
  email: String,
  phone: String,
  address: String,
  ic: String,            // IÈO (pro právnické osoby)
  dic: String            // DIÈ
}
```

### Contract (smlouva)
```js
{
  id: Number,
  propertyId: Number,    // FK › Property.id
  tenantId: Number,      // FK › Tenant.id
  startDate: String,     // "2025-01-01" (ISO date)
  endDate: String|null,  // null = neurèitá doba
  monthlyRent: Number,   // 12520
  status: String,        // "active" | "ended"
  payments: Array        // viz PaymentRecord[]
}
```

### PaymentRecord (platba)
```js
{
  monthKey: String,      // "2025-11" (YYYY-MM)
  date: String|null,     // "2025-11-13" — datum skuteèné úhrady, null = nezaplaceno
  amount: Number         // 12520
}
```

**Klíèová logika:**
- Smlouva má pole `payments` — to je **pole objektù** PaymentRecord
- Pøi ukládání do localStorage se `payments` serializuje jako JSON string
- Pøi ètení se deserializuje zpìt na array
- Mìsíc v kalendáøi má smlouvu, pokud `startDate <= prvni_den_mesice` a `(endDate == null || endDate >= prvni_den_mesice)`

---

## 4. Data layer — API s LocalStorage fallback

### Architektura
```
App › api.call(action, data)
        -
        +¦ checkAPI() › fetch('./api.php') › 404?
        -       -
        -       +¦ OK (200) › volání api.php (PHP backend + MySQL)
        -       L¦ 404 / error › useLocalStorage = true
        -
        L¦ useLocalStorage === true › localStorage metody
```

### Pravidla:
1. `api.checkAPI()` se volá **jen jednou** (flag `checkedAPI`)
2. Pokud api.php neexistuje › automaticky pøepne na LocalStorage
3. V konzoli se vypíšeme info: `?? LocalStorage režim`
4. **Žádné opakované chyby** v konzoli — fetch se provádí jen jednou pro check

### localStorage klíèe:
- `pm_properties` — JSON array of Property
- `pm_tenants` — JSON array of Tenant  
- `pm_contracts` — JSON array of Contract (payments jako JSON string)

### Akce (actions):
```
getProperties / createProperty / updateProperty / deleteProperty
getTenants    / createTenant    / updateTenant    / deleteTenant
getContracts  / createContract  / updateContract  / deleteContract
```

### Klíèový detail — updateContract:
Pøi update smlouvy se posílá celá smlouva, ale `payments` jako JSON **string**:
```js
await api.call('updateContract', { 
  id: contract.id, 
  payments: JSON.stringify(updatedPayments) 
});
```

Pøi ètení (getContracts) se payments deserializuje:
```js
payments: typeof c.payments === 'string' ? JSON.parse(c.payments) : (c.payments || [])
```

---

## 5. Komponenty — struktura

```
App
+¦¦ Sidebar (collapsible)
+¦¦ Views (pøepínání)
-   +¦¦ Dashboard
-   -   +¦¦ StatsCards (4 karty)
-   -   +¦¦ PropertiesOverview (seznam s platby)
-   -   L¦¦ PaymentCalendar (heatmapa)
-   +¦¦ PropertiesList
-   L¦¦ TenantsList
L¦¦ Modals (overlay, ESC, click-outside)
    +¦¦ PropertyForm (nová / editace nemovitosti)
    +¦¦ TenantForm (nový / editace nájemce)
    +¦¦ ContractForm (nová smlouva)
    L¦¦ PaymentModal (editace platby) ?
```

---

## 6. Sidebar & Navigation

### Chování:
- Default: otevøen (`sidebarOpen = true`)
- Zavírací tlaèítko (?) v pravém horním rohu sidebaru
- Když zavøen › zobrazí se hamburger button (?) fixed top-left
- Kliknutím na hamburger › sidebar se otevøe

### Menu položky:
```
?? Dashboard        › setActiveView('dashboard')
?? Nemovitosti      › setActiveView('properties')  
?? Nájemci          › setActiveView('tenants')
```

- Aktivní položka: `bg-slate-800`
- Hover: `hover:bg-slate-800`
- **Menu neobsahuje** "Nová nemovitost" / "Nový nájemce" — ty jsou **uvnitø pøíslušných views** jako tlaèítka

---

## 7. Dashboard

### 7.1 Statistické karty

Výpoèet stats:

```js
// Obsazenost = aktivní smlouvy / celkem nemovitostí * 100
occupancyRate = activeContracts.length / properties.length * 100

// Mìsíèní výnos = souèet nájemných kde máme platbu za AKTUÁLNÍ mìsíc
monthlyIncome = activeContracts.reduce((sum, c) => {
  const payment = c.payments.find(p => p.monthKey === currentMonth && p.date);
  return sum + (payment ? parseFloat(c.monthlyRent) : 0);
}, 0);

// ROI = (pøíjmy za rok / celková investice) * 100
roi = (yearIncome / totalInvestment) * 100

// Míra inkasa = skuteèné pøíjmy / oèekávané pøíjmy * 100
// Oèekávané = pro každou aktivní smlouvu, projdeme mìsíce od zaèátku do teï
```

**Poèítání dluhù (KLÍÈOVÁ LOGIKA):**
```js
propertyContracts.forEach(contract => {
  const startDate = new Date(contract.startDate);
  const endDate = contract.endDate ? new Date(contract.endDate) : new Date();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // "2025-12"
  
  let date = new Date(startDate);
  while (date <= now && date <= endDate) {
    const monthKey = date.toISOString().slice(0, 7);
    const payment = contract.payments.find(p => p.monthKey === monthKey);
    
    if (payment && payment.date) {
      paidCount++;      // ‹ má datum úhrady = zaplaceno
    } else if (monthKey <= currentMonth) {
      unpaidCount++;    // ‹ je to minulý nebo aktuální mìsíc bez platby = dluh
    }
    // BUDOUCÍ mìsíce se NEPOÈÍTAJÍ jako dluhy
    
    date.setMonth(date.getMonth() + 1);
  }
});
```

### 7.2 Pøehled nemovitostí
- Nadpis + tlaèítko "Nová nemovitost" se NEzobrazuje (to je jen na PropertiesList view)
- Klik na nemovitost › otevírá PropertyForm modal
- Zobrazí paidCount / unpaidCount (zelená/èervená èísla)

### 7.3 Platební kalendáø

**Struktura: HTML table**
- `<thead>` — "Nemovitost" + 12 mìsícù
- `<tbody>` — jeden `<tr>` na nemovitost, 12 `<td>` bunìk

**Logika buòky:**
```js
function getCellData(property, monthIndex) {
  const monthKey = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
  
  // Najdeme aktivní smlouvu pro tuto nemovitost v tomto mìsíci
  const contract = contracts.find(c => 
    c.propertyId == property.id && 
    c.status === 'active' &&
    new Date(c.startDate) <= new Date(monthKey + '-01') &&
    (!c.endDate || new Date(c.endDate) >= new Date(monthKey + '-01'))
  );

  if (!contract) return { type: 'empty', monthKey };

  const payment = contract.payments.find(p => p.monthKey === monthKey);
  const isPaid = payment && payment.date;
  const isPast = monthIndex < new Date().getMonth();

  return { 
    type: isPaid ? 'paid' : (isPast ? 'overdue' : 'unpaid'), 
    contract, monthKey, 
    amount: contract.monthlyRent 
  };
}
```

**Click handling na buòce:**
```js
onClick={() => {
  const contract = /* najdeme smlouvu pro property + monthKey */;
  if (contract) {
    // Má smlouvu › otevírá PaymentModal
    setSelectedContract({ contract, monthKey });
  } else {
    // Nemá smlouvu (Volno) › otevírá ContractForm
    setShowNewContract({ property, monthKey });
  }
}}
```

---

## 8. PropertiesList view

- Nadpis "Nemovitosti" + tlaèítko "+ Nová nemovitost" (vpravo)
- Grid karty nemovitostí (glassmorphism style)
- Klik na kartu › PropertyForm modal (editace)
- Tlaèítko "+ Nová nemovitost" › PropertyForm modal (isNew: true)

---

## 9. TenantsList view

- Nadpis "Nájemci" + tlaèítko "+ Nový nájemce"
- HTML table se stylovanou hlavièkou
- Klik na øádek › TenantForm modal (editace)

---

## 10. Modální okna — detaily

### 10.1 Spoleèné pravidla pro VŠECHNY modaly:

```jsx
// KAŽDÝ modal musí mít:

// 1. ESC handler
useEffect(() => {
  const handleEsc = (e) => { 
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(); 
    }
  };
  document.addEventListener('keydown', handleEsc);
  return () => document.removeEventListener('keydown', handleEsc);
}, [onClose]);

// 2. Overlay click to close + stopPropagation na vnitøním contentu
<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
     onClick={onClose}>
  <div className="bg-white rounded-xl ..." 
       onClick={e => e.stopPropagation()}>
    {/* content */}
  </div>
</div>

// 3. ? close button v headeru
<button onClick={onClose} className="text-gray-400 hover:text-gray-600">
  <X size={24} />
</button>
```

**DÙLEŽITÉ:** `document.addEventListener` místo `window.addEventListener` — to zajistí spolehlivé fungování ESC.

---

### 10.2 PaymentModal ??? (nejdùležitìjší modal)

**Toto je modal, který se otevírá po kliknutí na zelnou/èervenu buòku v kalendáøi.**

```jsx
function PaymentModal({ contract, monthKey, property, onClose, onReload }) {
  // Najdeme existující platbu pro tento mìsíc
  const existingPayment = (contract.payments || []).find(p => p.monthKey === monthKey);
  
  // State — JEDEN state object (ne jednotlivé useState pro každé pole!)
  const [formState, setFormState] = useState({
    isPaid: !!existingPayment?.date,           // true/false
    amount: existingPayment?.amount || contract.monthlyRent,
    paymentDate: existingPayment?.date || new Date().toISOString().split('T')[0]
  });

  // ESC handler (viz výše)
  useEffect(() => { /* ... */ }, [onClose]);

  const handleSave = async () => {
    const payments = contract.payments || [];
    let updatedPayments;
    
    if (formState.isPaid) {
      // Zaplaceno — pøidat/updated platbu
      const payment = { 
        monthKey, 
        date: formState.paymentDate, 
        amount: parseFloat(formState.amount) 
      };
      const existingIndex = payments.findIndex(p => p.monthKey === monthKey);
      if (existingIndex >= 0) {
        updatedPayments = [...payments];
        updatedPayments[existingIndex] = payment;
      } else {
        updatedPayments = [...payments, payment];
      }
    } else {
      // Nezaplaceno — odstranit platbu pro tento mìsíc
      updatedPayments = payments.filter(p => p.monthKey !== monthKey);
    }
    
    // Uložit — payments se serializes jako JSON string!
    await api.call('updateContract', { 
      id: contract.id, 
      payments: JSON.stringify(updatedPayments) 
    });
    await onReload();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-2xl font-bold">Platba</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
        </div>
        
        <div className="space-y-4">
          {/* Info box — bg-gray-50 */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1">
            <div className="text-sm text-gray-600">Nemovitost</div>
            <div className="font-semibold">{property?.name}</div>
            <div className="text-sm text-gray-600 mt-2">Nájemce</div>
            <div className="font-semibold">{/* tenant name */}</div>
            <div className="text-sm text-gray-600 mt-2">Období</div>
            <div className="font-semibold">{monthKey}</div>
          </div>

          {/* Èástka */}
          <div>
            <label className="block font-semibold mb-1">Èástka (Kè)</label>
            <input
              type="number"
              value={formState.amount}
              onChange={e => setFormState({...formState, amount: e.target.value})}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Checkbox — v zelenom obdélníku */}
          <div className="flex items-center gap-3 bg-green-50 p-3 rounded-lg">
            <input
              type="checkbox"
              id="isPaidCheckbox"
              checked={formState.isPaid}
              onChange={e => setFormState({...formState, isPaid: e.target.checked})}
              className="w-5 h-5"
              style={{ accentColor: '#16a34a' }}
            />
            <label htmlFor="isPaidCheckbox" className="font-semibold cursor-pointer select-none text-green-900">
              Zaplaceno
            </label>
          </div>

          {/* Datum úhrady — zobrazí se POUZE když isPaid === true */}
          {formState.isPaid && (
            <div>
              <label className="block font-semibold mb-1">Datum úhrady</label>
              <input
                type="date"
                value={formState.paymentDate}
                onChange={e => setFormState({...formState, paymentDate: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          )}
        </div>
        
        {/* Buttons */}
        <div className="flex gap-3 mt-6">
          <button onClick={handleSave} className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-semibold">Uložit</button>
          <button onClick={onClose} className="px-6 bg-gray-300 rounded-lg hover:bg-gray-400">Zrušit</button>
        </div>
      </div>
    </div>
  );
}
```

---

### 10.3 PropertyForm

- Props: `{ property, onClose, onSave }`
- `property.isNew === true` › nová nemovitost (action: createProperty)
- `property.isNew !== true` › editace (action: updateProperty)
- Pole: Název, Typ (select Byt/Garáž), Adresa, Výmìra (m2), Kupní cena (Kè)
- Tlaèítka: "Uložit zmìny" (`bg-purple-600`) + "Zrušit"

---

### 10.4 TenantForm

- Props: `{ tenant, onClose, onSave }`
- `tenant === null` › nový nájemce (action: createTenant)
- `tenant !== null` › editace (action: updateTenant)
- Pole: Typ (select FO/PO), Jméno/Název, Email, Telefon
- Tlaèítka: "Uložit" (`bg-purple-600`) + "Zrušit"
- **Mùže se zobrazit nad jiným modalem** (z-[60]) — v tom pøípadì se ESC handler musí ovìøit

---

### 10.5 ContractForm

- Props: `{ property, tenants, startMonth, onClose, onSave, onReloadTenants }`
- `property` — nemovitost pro kterou se vytvoruje smlouva (read-only pole)
- `startMonth` — pøedvyplnìný mìsíc (z kliknutí na "Volno" v kalendáøi), format "2025-12"
- `startDate` se vyplní jako `${startMonth}-01`
- Pole: Nemovitost (read-only), Nájemce (select + button "+ Nový"), Datum od, Datum do, Nájemné
- **"+ Nový" nájemce:**
  - State: `const [showNewTenant, setShowNewTenant] = useState(false);`
  - Kliknutím se zobrazí TenantForm nad tímto modalem
  - Po uložení nového nájemce se volá `onReloadTenants()` aby se aktualizoval seznam
  - ESC v ContractForm se blokuje pokud je `showNewTenant === true`
- Tlaèítka: "Uložit" (`bg-purple-600`) + "Zrušit"
- Po uložení: `payments: '[]'` (prázdné pole jako string)

---

## 11. UI / Design System

### 11.1 Pozadí & tema
```html
<body class="bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
```

### 11.2 Glassmorphism karty
```
bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 p-6
```

### 11.3 Statistické karty
```
-¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¬
-  [symbol/ikona]  99.0%          -  ‹ text-5xl font-bold text-white
-  Obsazenost                     -  ‹ text-purple-200
L¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦¦-
```

| Karta | Symbol | Symbol color |
|---|---|---|
| Obsazenost | `%` | text-purple-300 |
| Mìsíèní výnos | `$` | text-green-300 |
| ROI | `?` | text-yellow-300 |
| Míra inkasa | FileText ikona | text-blue-300 |

### 11.4 Kalendáø buòky

| Stav | Background | Obsah |
|---|---|---|
| Volno | `bg-gray-600/30` | `Volno` (text-gray-400, text-xs) |
| Zaplaceno | `bg-green-600` | Èástka (text-xs bold) + `?` |
| Nezaplaceno/Po splatnosti | `bg-red-600` | Èástka (text-xs bold) + `?` |

- Min-height: 50px
- Èástka bez "Kè", bez desetinných míst
- Padding: p-2
- Border-radius: rounded
- Hover: opacity-80

### 11.5 Sidebar
- Bg: `bg-slate-900`
- Šíøka: `w-64`
- Aktivní: `bg-slate-800`
- Text: bílý

### 11.6 Tlaèítka

| Typ | Class | Kde |
|---|---|---|
| Primary | `bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-semibold` | Uložit nemovitost/smlouvu/nájemce |
| Success | `bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold` | Uložit platbu, + Nová smlouva |
| Secondary | `bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-3 rounded-lg` | Zrušit |
| Add | `bg-purple-600 text-white px-4 py-2 rounded-lg` | + Nová nemovitost, + Nový nájemce |

### 11.7 Inline SVG Ikony
Needs these icons implemented as inline SVG components:
- `Home` — house shape
- `Building2` — building with windows
- `Users` — two people silhouettes
- `FileText` — document icon
- `Plus` — plus sign (cross)
- `X` — close (two diagonal lines)
- `Check` — checkmark
- `Calendar` — calendar grid
- `Menu` — three horizontal lines (hamburger)

Each icon component:
```jsx
const IconName = ({ size = 24, className = '', onClick }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" 
       fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" 
       strokeLinejoin="round" className={className} onClick={onClick}>
    {/* SVG paths */}
  </svg>
);
```

---

## 12. Responzivita

- Stats cards: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Properties grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Kalendáø: `overflow-x-auto` — horizontální scroll na úzkých screens
- Sidebar: na úzkých screens se zavírá automaticky (hamburger)

---

## 13. Chybné vzory — VYHNÌTE SE

1. ? `window.addEventListener` pro ESC › ? `document.addEventListener`
2. ? Jednotlivé `useState` pro každé pole v modal › ? Jeden `useState` object (`formState`)
3. ? Chybìt `onClick={e => e.stopPropagation()}` na modal content › modal se zavírá pøi kliknutí na content
4. ? Chybìt deserializaci payments pøi getContracts › platby se neukáží
5. ? Volat `onSave()` bez `await` › data se neloading pøed zavøením modalu
6. ? External icon libraries (lucide-react CDN, etc.) › ? Inline SVG komponenty
7. ? `import` / `export` statements › vše v jednom scope
8. ? Chybìt ESC block v ContractForm když je otevøen sub-modal nového nájemce
9. ? Poèítat budoucí mìsíce jako "dluhy" › dluhy jsou jen do aktuálního mìsíce
10. ? Pøesunout PropertyForm/TenantForm definici za místo kde se používá › JSX component musí být definovan PØED prvním použitím (nebo hoisted function declaration)

---

## 14. Kompletní structure kódu

```
index.html
L¦¦ <script type="text/babel">
    +¦¦ Icon components (Home, Building2, Users, ...)
    +¦¦ api object (checkAPI, call, localStorage)
    +¦¦ PaymentModal function          ‹ FIRST (used by App)
    +¦¦ PropertyForm function
    +¦¦ TenantForm function  
    +¦¦ ContractForm function
    +¦¦ PropertiesList function
    +¦¦ TenantsList function
    +¦¦ Dashboard function
    -   L¦¦ uses: getCellData(), stats calculation
    +¦¦ App function                   ‹ orchestrator, state management
    L¦¦ ReactDOM.createRoot().render(<App />)
```

**Doporuèené poøadí definice:**
1. Ikony
2. API helper
3. Leaf components (modals, lists)
4. Dashboard
5. App (hlavní orchestrator)
6. Render

---

## 15. Testování — jak ovìøit správnost

1. **Pøidat nemovitost** › Menu Nemovitosti › + Nová nemovitost › vyplnit › Uložit › musí se zobrazit v seznamu
2. **Pøidat nájemce** › Menu Nájemci › + Nový nájemce › vyplnit › Uložit
3. **Vytvoøit smlouvu** › Dashboard › klik na "Volno" v kalendáøi › vyplnit smlouvu › Uložit › buòka se zmìní na èervenou
4. **Zaplatit** › klik na èervenu buòku › zaškrtnout "Zaplaceno" › zadat datum › Uložit › buòka se zmìní na zelenu
5. **Odplatit** › klik na zelenu buòku › odškatovat "Zaplaceno" › Uložit › buòka se zmìní na èervenou
6. **ESC** › otevøít jakýkoliv modal › stisknut ESC › modal se zavøe
7. **Click outside** › otevøit modal › kliknout na temnou overlay › modal se zavøe
8. **Dluhy counting** › nemovitost se smlouvou od ledna › zaplatit jen leden a bøezen › Zaplaceno: 2, Dluhy: N-2 (kde N = poèet mìsícù od ledna do teï)