# Cron – automatický import plateb z FIO

## fio-import-cron.php

Načte platby z FIO API ze **všech bankovních účtů**, které mají vyplněný FIO token, a stejnou logikou jako v aplikaci (Import plateb) je **automaticky spáruje** podle protiúčtu, částky a data. Spárované importy lze zároveň **automaticky schválit** (vytvoření plateb).

- **Načtení:** období zpětně (výchozí 60 dní, přepínač `--days=N`).
- **Párování:** stejná logika jako v UI (nájem 1× měsíc, N měsíců, požadavky, shoda protiúčtu s účty nájemců).
- **Schválení:** u řádků s vyplněnou smlouvou a obdobím se vytvoří platby a import se označí jako schválený. Volitelně vypnout: `--no-approve` (jen načtení + párování, bez vytváření plateb).

FIO API umožňuje max. **1 požadavek za 30 sekund** na účet – mezi jednotlivými účty skript čeká 31 s.

### Příklady

```bash
# Z kořene projektu
php cron/fio-import-cron.php

# Posledních 90 dní, bez automatického schválení
php cron/fio-import-cron.php --days=90 --no-approve
```

### Crontab (Linux)

Např. 1× denně v 6:00 (cesta upravte):

```cron
0 6 * * * cd /cesta/k/nemovitosti.tobolik.cz && php cron/fio-import-cron.php >> /var/log/fio-import-cron.log 2>&1
```

### Požadavky

- PHP s rozšířením PDO MySQL
- `config.php` (přístup k DB) v kořeni projektu
- Bankovní účty s vyplněným FIO API tokenem v aplikaci
