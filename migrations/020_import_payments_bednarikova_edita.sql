-- Import plateb: Bednaříková Edita (bankovní výpisy)
-- Pozn.: migrace běží jen jednou (api/migrate.php), přesto je zde ochrana proti duplicitám.

-- Najdi aktivní smlouvu pro nájemníka (nejnovější podle contract_start)
SET @tenant_name := 'Bednaříková Edita';
SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t ON t.tenants_id = c.tenants_id AND t.valid_to IS NULL
  WHERE c.valid_to IS NULL AND t.name = @tenant_name
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

-- Vlož platby (jen pokud existuje smlouva)
INSERT INTO payments
  (payments_id, contracts_id, period_year, period_month, amount, payment_date, note, payment_method)
SELECT
  NULL,
  @contracts_id,
  d.period_year,
  d.period_month,
  d.amount,
  d.payment_date,
  d.note,
  'account'
FROM (
  -- 2023
  SELECT 2023 AS period_year,  2 AS period_month, 10175.00 AS amount, DATE('2023-02-01') AS payment_date, NULL AS note UNION ALL
  SELECT 2023,  3, 10175.00, DATE('2023-03-01'), NULL UNION ALL
  SELECT 2023,  4, 10175.00, DATE('2023-04-03'), NULL UNION ALL
  SELECT 2023,  5, 10175.00, DATE('2023-05-02'), NULL UNION ALL
  SELECT 2023,  6, 10175.00, DATE('2023-06-01'), NULL UNION ALL
  SELECT 2023,  7, 10175.00, DATE('2023-07-03'), NULL UNION ALL
  SELECT 2023,  8, 10175.00, DATE('2023-08-01'), NULL UNION ALL
  SELECT 2023,  9, 10175.00, DATE('2023-09-01'), NULL UNION ALL
  SELECT 2023, 10, 10175.00, DATE('2023-10-02'), NULL UNION ALL
  SELECT 2023, 11, 10175.00, DATE('2023-11-01'), NULL UNION ALL
  SELECT 2023, 12, 10175.00, DATE('2023-12-01'), NULL UNION ALL

  -- 2024
  SELECT 2024,  1, 10175.00, DATE('2024-01-02'), NULL UNION ALL
  SELECT 2024,  2, 10175.00, DATE('2024-02-01'), NULL UNION ALL
  SELECT 2024,  3, 10175.00, DATE('2024-03-01'), NULL UNION ALL
  SELECT 2024,  4, 10175.00, DATE('2024-04-02'), NULL UNION ALL
  SELECT 2024,  4,  3225.00, DATE('2024-04-12'), 'Okamžitá příchozí platba' UNION ALL
  SELECT 2024,  5, 10175.00, DATE('2024-05-02'), NULL UNION ALL
  SELECT 2024,  6, 10175.00, DATE('2024-06-03'), NULL UNION ALL
  SELECT 2024,  6,   650.00, DATE('2024-06-03'), 'Okamžitá příchozí platba' UNION ALL
  SELECT 2024,  7, 10825.00, DATE('2024-07-01'), NULL UNION ALL
  SELECT 2024,  8, 10825.00, DATE('2024-08-01'), NULL UNION ALL
  SELECT 2024,  9, 10825.00, DATE('2024-09-02'), NULL UNION ALL
  SELECT 2024, 10, 10825.00, DATE('2024-10-01'), NULL UNION ALL
  SELECT 2024, 11, 10825.00, DATE('2024-11-01'), NULL UNION ALL
  SELECT 2024, 12, 10825.00, DATE('2024-12-02'), NULL UNION ALL

  -- 2025
  SELECT 2025,  1, 10825.00, DATE('2025-01-02'), NULL UNION ALL
  SELECT 2025,  1,   500.00, DATE('2025-01-02'), 'Okamžitá příchozí platba' UNION ALL
  SELECT 2025,  2, 11325.00, DATE('2025-02-03'), NULL UNION ALL
  SELECT 2025,  3, 11325.00, DATE('2025-03-03'), NULL UNION ALL
  SELECT 2025,  4,-16000.00, DATE('2025-04-25'), 'Odchozí platba na 1875883103/0800'
) d
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.contracts_id = @contracts_id
      AND p.period_year = d.period_year
      AND p.period_month = d.period_month
      AND p.payment_date = d.payment_date
      AND p.amount = d.amount
      AND (p.note <=> d.note)
  );

-- Doplnění entity_id pro vložené řádky (soft-update)
UPDATE payments
SET payments_id = id
WHERE payments_id IS NULL
  AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2023-02-01' AND '2025-04-25';

