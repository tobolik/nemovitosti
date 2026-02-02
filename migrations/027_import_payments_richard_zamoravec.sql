-- Import plateb: Richard Zámoravec (garáž)
-- - Najde aktivní smlouvu nájemníka Richard Zámoravec (garáž)
-- - Použije primární bankovní účet (7770101774)
-- - Vloží platby idempotentně

SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (t.tenants_id = c.tenants_id OR t.id = c.tenants_id)
  WHERE c.valid_to IS NULL
    AND t.name LIKE '%Zámoravec%'
    AND t.name LIKE '%Richard%'
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
  SELECT 2026 AS period_year,  1 AS period_month, 2200.00 AS amount, DATE('2026-01-30') AS payment_date, 'Nájem garáže – Zámoravcová Renata' AS note UNION ALL
  SELECT 2025, 12, 2200.00, DATE('2025-12-19'), 'Pronájem garáže, Richard Zámoravec' UNION ALL
  SELECT 2025, 11, 2200.00, DATE('2025-11-28'), 'Nájem garáže' UNION ALL
  SELECT 2025, 10, 2200.00, DATE('2025-10-18'), 'Nájem garáže' UNION ALL
  SELECT 2025,  9, 2200.00, DATE('2025-09-13'), 'Nájem garáže' UNION ALL
  SELECT 2025,  8, 2200.00, DATE('2025-08-14'), 'Nájem za srpen' UNION ALL
  SELECT 2025,  7, 1100.00, DATE('2025-07-25'), 'Nájem garáže'
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
  AND payment_date BETWEEN '2025-07-25' AND '2026-01-30';
