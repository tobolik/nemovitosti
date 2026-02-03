-- Import plateb: Adam Mráček – garáž (dle výpisu 7770101774)
-- Návrh rozdělení: docs/import-platby-adam-mracek-garaz-navrh.md
-- První měsíc (březen 2024) 1 000 Kč v hotovosti; zbytek z výpisu na účet.
-- Nájem 2 000 Kč/měsíc; částečné platby a doplatky dle poznámek z výpisu.

SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (t.tenants_id = c.tenants_id OR t.id = c.tenants_id)
  JOIN properties p
    ON p.valid_to IS NULL
   AND (p.properties_id = c.properties_id OR p.id = c.properties_id)
  WHERE c.valid_to IS NULL
    AND (t.name LIKE '%Mráček%' OR t.name LIKE '%Mracek%')
    AND (t.name LIKE '%Adam%')
    AND (p.name LIKE '%Garáž%' OR p.name LIKE '%garaz%' OR p.name LIKE '%Hrázi%' OR p.address LIKE '%Hrázi%')
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

SET @ba_id := (
  SELECT COALESCE(bank_accounts_id, id)
  FROM bank_accounts
  WHERE valid_to IS NULL
    AND (account_number LIKE '7770101774%' OR is_primary = 1)
  ORDER BY is_primary DESC, sort_order ASC, id ASC
  LIMIT 1
);

-- Březen 2024: první měsíc (poměrná část) 1 000 Kč – hotovost (není na výpisu)
INSERT INTO payments
  (payments_id, contracts_id, period_year, period_month, amount, payment_date, note, payment_method, bank_accounts_id, payment_type)
SELECT NULL, @contracts_id, 2024, 3, 1000.00, DATE('2024-03-14'), 'První měsíc (poměrná část), hotovost', 'cash', NULL, 'rent'
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.contracts_id = @contracts_id AND p.valid_to IS NULL
      AND p.period_year = 2024 AND p.period_month = 3 AND p.amount = 1000 AND p.payment_method = 'cash'
  );

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
  'rent'
FROM (
  -- duben 2024
  SELECT 2024 AS period_year,  4 AS period_month, 2000.00 AS amount, DATE('2024-04-12') AS payment_date, 'Garaž' AS note UNION ALL
  -- červen 2024
  SELECT 2024,  6, 2000.00, DATE('2024-07-13'), 'Červen' UNION ALL
  -- květen 2024 (doplatek 1000/4000 dluh)
  SELECT 2024,  5, 1000.00, DATE('2024-07-13'), 'Doplatek dluh (1000/4000)' UNION ALL
  -- srpen 2024
  SELECT 2024,  8, 2000.00, DATE('2024-08-07'), 'Srpen' UNION ALL
  -- červenec 2024 částečně (1500; doplatek 500 až 19.02.2025)
  SELECT 2024,  7, 1500.00, DATE('2024-08-07'), 'Doplatek dluh (1500/2000 červenec)' UNION ALL
  SELECT 2024,  9, 2000.00, DATE('2024-09-27'), NULL UNION ALL
  SELECT 2024, 10, 2000.00, DATE('2024-10-15'), NULL UNION ALL
  SELECT 2024, 11, 2000.00, DATE('2024-11-15'), NULL UNION ALL
  SELECT 2024, 12, 2000.00, DATE('2024-12-16'), NULL UNION ALL
  SELECT 2025,  1, 2000.00, DATE('2025-01-15'), 'Garaz' UNION ALL
  SELECT 2025,  2, 2000.00, DATE('2025-02-17'), NULL UNION ALL
  -- doplatek za červenec 2024
  SELECT 2024,  7,  500.00, DATE('2025-02-19'), 'Doplatek za červenec 2024' UNION ALL
  SELECT 2025,  3, 2500.00, DATE('2025-03-13'), NULL
) d
WHERE @contracts_id IS NOT NULL
  AND @ba_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.contracts_id = @contracts_id
      AND p.valid_to IS NULL
      AND p.period_year = d.period_year
      AND p.period_month = d.period_month
      AND p.payment_date = d.payment_date
      AND p.amount = d.amount
  );

-- Platba 6 250 Kč (09.09.2025) = jedna dávka (payment_batch_id) rozepsaná do 4 měsíců – v UI se zobrazí jako „dávka“
SET @batch_id = LOWER(MD5('adam_mracek_garaz_6250_2025-09-09'));

INSERT INTO payments
  (payments_id, contracts_id, period_year, period_month, amount, payment_date, note, payment_method, bank_accounts_id, payment_type, payment_batch_id)
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
  'rent',
  @batch_id
FROM (
  SELECT 2024 AS period_year,  5 AS period_month, 1000.00 AS amount, DATE('2025-09-09') AS payment_date, 'Doplatek dluh (platba 09.09.2025)' AS note UNION ALL
  SELECT 2025,  4, 2000.00, DATE('2025-09-09'), 'Doplatek dluh (platba 09.09.2025)' UNION ALL
  SELECT 2025,  5, 2000.00, DATE('2025-09-09'), 'Doplatek dluh (platba 09.09.2025)' UNION ALL
  SELECT 2025,  6, 1250.00, DATE('2025-09-09'), 'Doplatek dluh (platba 09.09.2025), červen 2025 zbývá 750 Kč'
) d
WHERE @contracts_id IS NOT NULL
  AND @ba_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.contracts_id = @contracts_id
      AND p.valid_to IS NULL
      AND p.payment_batch_id = @batch_id
  );

UPDATE payments
SET payments_id = id
WHERE payments_id IS NULL
  AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2024-03-14' AND '2025-09-09';
