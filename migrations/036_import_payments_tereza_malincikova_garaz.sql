-- Import plateb: Tereza Malinčíková – garáž (smlouva 10.9.2020 – 13.3.2024)
-- První 4 platby posunuté o měsíc (platba za měsíc M přiřazena k datu v M+1), od 2021 pak platba = daný měsíc.
-- Poslední platba 800 Kč = polovina nájmu za březen 2024 (konec smlouvy 13.3.2024).
-- Navyšování nájmu: 1 100 → 1 300 (od 1.11.2021) → 1 600 (od 1.9.2022).

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
    AND (t.name LIKE '%Malinčíková%' OR t.name LIKE '%Malincikova%')
    AND (t.name LIKE '%Tereza%')
    AND (p.name LIKE '%Garáž%' OR p.name LIKE '%garáž%' OR p.name LIKE '%garaz%')
  ORDER BY c.contract_start ASC, c.id ASC
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

-- Změny nájmu (1 100 od začátku, 1 300 od 1.11.2021, 1 600 od 1.9.2022) – idempotentní
INSERT INTO contract_rent_changes (contract_rent_changes_id, contracts_id, amount, effective_from, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, 1100.00, DATE('2020-09-01'), NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contract_rent_changes crc WHERE crc.contracts_id = @contracts_id AND crc.valid_to IS NULL AND crc.effective_from = '2020-09-01');

INSERT INTO contract_rent_changes (contract_rent_changes_id, contracts_id, amount, effective_from, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, 1300.00, DATE('2021-11-01'), NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contract_rent_changes crc WHERE crc.contracts_id = @contracts_id AND crc.valid_to IS NULL AND crc.effective_from = '2021-11-01');

INSERT INTO contract_rent_changes (contract_rent_changes_id, contracts_id, amount, effective_from, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, 1600.00, DATE('2022-09-01'), NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contract_rent_changes crc WHERE crc.contracts_id = @contracts_id AND crc.valid_to IS NULL AND crc.effective_from = '2022-09-01');

-- Platby (první 4 = posun o měsíc: za září 2020 platba říjen, atd.; od 2021 platba = daný měsíc)
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
  SELECT 2020 AS period_year,  9 AS period_month, 1100.00 AS amount, DATE('2020-10-10') AS payment_date, 'Tereza Malinčíková – nájem garáž' AS note UNION ALL
  SELECT 2020, 10, 1100.00, DATE('2020-11-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2020, 11, 1100.00, DATE('2020-12-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2020, 12, 1100.00, DATE('2021-01-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  1, 1100.00, DATE('2021-01-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  2, 1100.00, DATE('2021-02-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  3, 1100.00, DATE('2021-03-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  4, 1100.00, DATE('2021-04-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  5, 1100.00, DATE('2021-05-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  6, 1100.00, DATE('2021-06-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  7, 1100.00, DATE('2021-07-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  8, 1100.00, DATE('2021-08-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021,  9, 1100.00, DATE('2021-09-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021, 10, 1100.00, DATE('2021-10-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021, 11, 1300.00, DATE('2021-11-24'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2021, 12, 1300.00, DATE('2021-12-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  1, 1300.00, DATE('2022-01-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  2, 1300.00, DATE('2022-02-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  3, 1300.00, DATE('2022-03-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  4, 1300.00, DATE('2022-04-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  5, 1300.00, DATE('2022-05-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  6, 1300.00, DATE('2022-06-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  7, 1300.00, DATE('2022-07-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  8, 1300.00, DATE('2022-08-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022,  9, 1600.00, DATE('2022-09-09'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022, 10, 1600.00, DATE('2022-10-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022, 11, 1600.00, DATE('2022-11-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2022, 12, 1600.00, DATE('2022-12-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  1, 1600.00, DATE('2023-01-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  2, 1600.00, DATE('2023-02-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  3, 1600.00, DATE('2023-03-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  4, 1600.00, DATE('2023-04-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  5, 1600.00, DATE('2023-05-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  6, 1600.00, DATE('2023-06-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  7, 1600.00, DATE('2023-07-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  8, 1600.00, DATE('2023-08-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023,  9, 1600.00, DATE('2023-09-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023, 10, 1600.00, DATE('2023-10-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023, 11, 1600.00, DATE('2023-11-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2023, 12, 1600.00, DATE('2023-12-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2024,  1, 1600.00, DATE('2024-01-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2024,  2, 1600.00, DATE('2024-02-10'), 'Tereza Malinčíková – nájem garáž' UNION ALL
  SELECT 2024,  3,  800.00, DATE('2024-03-09'), 'Tereza Malinčíková – nájem garáž (polovina, konec 13.3.2024)'
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
  AND payment_date BETWEEN '2020-10-10' AND '2024-03-09';

UPDATE contract_rent_changes
SET contract_rent_changes_id = id
WHERE contract_rent_changes_id IS NULL
  AND contracts_id = @contracts_id
  AND effective_from IN ('2020-09-01', '2021-11-01', '2022-09-01');
