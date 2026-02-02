-- Import plateb: Martin Konečný (účet 7770101774/2010)
-- - Vytvoří (pokud chybí) bankovní účet v bank_accounts
-- - Nastaví bank_accounts_id na tento účet pro importované platby
-- - Vloží chybějící platby (idempotentně)
-- - Kauce (18 000 Kč) se vloží jako payment_type='deposit' (nepočítá se do nájmu)

-- Zajistit sloupce (pokud DB není kompletně migrovaná)
ALTER TABLE payments ADD COLUMN bank_accounts_id INT UNSIGNED NULL AFTER payment_method;
ALTER TABLE payments ADD COLUMN payment_type ENUM('rent','deposit','energy','other') NOT NULL DEFAULT 'rent' AFTER bank_accounts_id;

-- Najdi aktivní smlouvu pro nájemníka (nejnovější podle contract_start)
SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (t.tenants_id = c.tenants_id OR t.id = c.tenants_id)
  WHERE c.valid_to IS NULL
    AND t.name LIKE '%Konečn%'
    AND t.name LIKE '%Martin%'
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

-- Zajistit bankovní účet 7770101774/2010
INSERT INTO bank_accounts (name, account_number, is_primary, sort_order)
SELECT 'Import – Martin Konečný', '7770101774/2010', 0, 999
WHERE NOT EXISTS (
  SELECT 1 FROM bank_accounts ba
  WHERE ba.valid_to IS NULL
    AND ba.account_number = '7770101774/2010'
);
UPDATE bank_accounts SET bank_accounts_id = id WHERE bank_accounts_id IS NULL;
SET @ba_id := (
  SELECT bank_accounts_id
  FROM bank_accounts
  WHERE valid_to IS NULL
    AND account_number = '7770101774/2010'
  ORDER BY is_primary DESC, sort_order ASC, id ASC
  LIMIT 1
);

-- Kauce evidovaná ve smlouvě (ať sedí i formulář smlouvy)
UPDATE contracts
SET deposit_amount = COALESCE(deposit_amount, 18000),
    deposit_paid_date = COALESCE(deposit_paid_date, '2025-04-23')
WHERE @contracts_id IS NOT NULL
  AND valid_to IS NULL
  AND (contracts_id = @contracts_id OR id = @contracts_id);

-- Fix: pokud už byly platby importované bez bank_accounts_id (nebo s jiným), nastav tento účet
UPDATE payments
SET bank_accounts_id = @ba_id
WHERE @contracts_id IS NOT NULL
  AND @ba_id IS NOT NULL
  AND valid_to IS NULL
  AND contracts_id = @contracts_id
  AND payment_method = 'account'
  AND payment_date BETWEEN '2025-04-18' AND '2026-01-29'
  AND (bank_accounts_id IS NULL OR bank_accounts_id <> @ba_id);

-- Vložit platby (idempotentně)
INSERT INTO payments
  (payments_id, contracts_id, period_year, period_month, amount, payment_date, note, payment_method, bank_accounts_id, payment_type)
SELECT
  NULL,
  @contracts_id,
  d.period_year,
  d.period_month,
  d.amount,
  d.payment_date,
  d.note,
  'account',
  @ba_id,
  d.payment_type
FROM (
  -- Duben 2025 (poměrné nájemné za část měsíce) – dvě příchozí platby
  SELECT 2025 AS period_year, 4 AS period_month, 4667.00 AS amount, DATE('2025-04-18') AS payment_date, 'Poměrné nájemné (od 18.4.2025) – platba 1' AS note, 'rent' AS payment_type UNION ALL
  SELECT 2025, 4, 1176.00, DATE('2025-04-18'), 'Poměrné nájemné (od 18.4.2025) – platba 2', 'rent' UNION ALL

  -- Kauce (bankovní transakce) – nepočítat do nájmu
  SELECT 2025, 4, 18000.00, DATE('2025-04-23'), 'Kauce', 'deposit' UNION ALL

  -- Pravidelné měsíční platby 12 520 Kč
  SELECT 2025, 5, 12520.00, DATE('2025-05-16'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2025, 6, 12520.00, DATE('2025-06-17'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2025, 7, 12520.00, DATE('2025-07-21'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2025, 8, 12520.00, DATE('2025-08-25'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2025, 9, 12520.00, DATE('2025-09-30'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2025,10, 12520.00, DATE('2025-10-30'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2025,12, 12520.00, DATE('2025-12-17'), 'Nájemné + energie', 'rent' UNION ALL
  SELECT 2026, 1, 12520.00, DATE('2026-01-29'), 'Nájemné + energie', 'rent'
) d
WHERE @contracts_id IS NOT NULL
  AND @ba_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.contracts_id = @contracts_id
      AND p.period_year = d.period_year
      AND p.period_month = d.period_month
      AND p.payment_date = d.payment_date
      AND p.amount = d.amount
      AND (p.note <=> d.note)
      AND (p.payment_type <=> d.payment_type)
  );

-- Doplnění entity_id pro vložené řádky (soft-update)
UPDATE payments
SET payments_id = id
WHERE payments_id IS NULL
  AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2025-04-18' AND '2026-01-29';

