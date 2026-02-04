-- Servisní úprava: datumy plateb Tereza Malinčíková – garáž podle bankovního výpisu (screenshot)
-- Platby identifikujeme podle contracts_id (smlouva Malinčíková + garáž) a period_year/period_month.

SET @cid := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t ON t.valid_to IS NULL AND (t.tenants_id = c.tenants_id OR t.id = c.tenants_id)
  JOIN properties p ON p.valid_to IS NULL AND (p.properties_id = c.properties_id OR p.id = c.properties_id)
  WHERE c.valid_to IS NULL
    AND (t.name LIKE '%Malinčíková%' OR t.name LIKE '%Malincikova%')
    AND (t.name LIKE '%Tereza%')
    AND (p.name LIKE '%Garáž%' OR p.name LIKE '%garáž%' OR p.name LIKE '%garaz%')
  ORDER BY c.contract_start ASC, c.id ASC
  LIMIT 1
);

UPDATE payments SET payment_date = '2020-09-08' WHERE contracts_id = @cid AND period_year = 2020 AND period_month = 9  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2020-10-09' WHERE contracts_id = @cid AND period_year = 2020 AND period_month = 10 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2020-10-22' WHERE contracts_id = @cid AND period_year = 2020 AND period_month = 11 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2020-11-16' WHERE contracts_id = @cid AND period_year = 2020 AND period_month = 12 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2020-12-09' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 1  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-01-11' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 2  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-02-08' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 3  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-03-11' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 4  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-04-13' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 5  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-05-20' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 6  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-06-07' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 7  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-07-12' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 8  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-08-10' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 8  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-09-20' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 9  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-10-09' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 10 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-11-24' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 11 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2021-12-09' WHERE contracts_id = @cid AND period_year = 2021 AND period_month = 12 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-01-17' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 1  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-02-18' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 2  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-03-15' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 3  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-04-08' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 4  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-05-13' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 5  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-06-09' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 6  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-07-10' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 7  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-08-09' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 8  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-09-09' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 9  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-10-14' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 10 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-11-11' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 11 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2022-12-09' WHERE contracts_id = @cid AND period_year = 2022 AND period_month = 12 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-01-11' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 1  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-02-11' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 2  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-03-10' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 3  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-04-11' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 4  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-05-11' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 5  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-06-08' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 6  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-07-14' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 7  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-08-14' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 8  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-09-08' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 9  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-10-13' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 10 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-11-16' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 11 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2023-12-09' WHERE contracts_id = @cid AND period_year = 2023 AND period_month = 12 AND valid_to IS NULL;
UPDATE payments SET payment_date = '2024-01-12' WHERE contracts_id = @cid AND period_year = 2024 AND period_month = 1  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2024-02-12' WHERE contracts_id = @cid AND period_year = 2024 AND period_month = 2  AND valid_to IS NULL;
UPDATE payments SET payment_date = '2024-03-09' WHERE contracts_id = @cid AND period_year = 2024 AND period_month = 3  AND valid_to IS NULL;
