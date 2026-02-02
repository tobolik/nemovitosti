-- Import plateb: Jiří Zich
-- - Najde aktivní smlouvu nájemníka Jiří Zich
-- - Použije primární bankovní účet (7770101774)
-- - Vloží platby idempotentně (2 000 Kč/měsíc dle výpisu)

SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (t.tenants_id = c.tenants_id OR t.id = c.tenants_id)
  WHERE c.valid_to IS NULL
    AND t.name LIKE '%Zich%'
    AND (t.name LIKE '%Jiří%' OR t.name LIKE '%Jiri%')
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

SET @ba_id := (
  SELECT bank_accounts_id
  FROM bank_accounts
  WHERE valid_to IS NULL
    AND (account_number LIKE '7770101774%' OR is_primary = 1)
  ORDER BY is_primary DESC, sort_order ASC, id ASC
  LIMIT 1
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
  SELECT 2026 AS period_year,  1 AS period_month, 2000.00 AS amount, DATE('2026-01-21') AS payment_date, 'ZICH JIŘÍ' AS note UNION ALL
  SELECT 2025, 12, 2000.00, DATE('2025-12-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025, 11, 2000.00, DATE('2025-11-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025, 10, 2000.00, DATE('2025-10-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  9, 2000.00, DATE('2025-09-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  8, 2000.00, DATE('2025-08-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  7, 2000.00, DATE('2025-07-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  6, 2000.00, DATE('2025-06-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  5, 2000.00, DATE('2025-05-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  4, 2000.00, DATE('2025-04-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  3, 2000.00, DATE('2025-03-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  2, 2000.00, DATE('2025-02-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2025,  1, 2000.00, DATE('2025-01-24'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024, 12, 2000.00, DATE('2024-12-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024, 11, 2000.00, DATE('2024-11-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024, 10, 2000.00, DATE('2024-10-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024,  9, 2000.00, DATE('2024-09-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024,  8, 2000.00, DATE('2024-08-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024,  7, 2000.00, DATE('2024-07-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024,  6, 2000.00, DATE('2024-06-21'), 'ZICH JIŘÍ' UNION ALL
  SELECT 2024,  5, 2000.00, DATE('2024-05-22'), 'ZICH JIŘÍ'
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

UPDATE payments
SET payments_id = id
WHERE payments_id IS NULL
  AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2024-05-22' AND '2026-01-21';
