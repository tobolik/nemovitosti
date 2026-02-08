-- Bc. Dominika Kinclová – byt Interbrigadistů 6 (smlouva od 7.3.2021)
-- Nájemné = nájem + zálohy 1 400 Kč. První měsíc zkrácená platba, kauce 15 000, vyúčtování (přeplatek).
-- Idempotentní: pokud již existuje nájemce „Kinclová“ a nemovitost „Interbrigadistů“, použije je.

-- 1) Nájemce (pokud neexistuje)
INSERT INTO tenants (tenants_id, name, type, birth_date, email, phone, address, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, 'Bc. Dominika Kinclová', 'person', DATE('1994-02-06'), 'kincdo@seznam.cz', '605 086 443',
       'Radiměř 290, 569 07 Radiměř', NOW(), NULL, NULL, NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.valid_to IS NULL AND (t.name LIKE '%Kinclová%' AND t.name LIKE '%Dominika%'));

UPDATE tenants SET tenants_id = id WHERE valid_to IS NULL AND tenants_id IS NULL AND name = 'Bc. Dominika Kinclová';

SET @tenants_id := (SELECT COALESCE(tenants_id, id) FROM tenants WHERE valid_to IS NULL AND name LIKE '%Kinclová%' AND name LIKE '%Dominika%' LIMIT 1);

-- 2) Nemovitost (pokud neexistuje)
INSERT INTO properties (properties_id, name, address, type, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, 'Byt Interbrigadistů 6', 'Interbrigadistů 6', 'apartment', NOW(), NULL, NULL, NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM properties p WHERE p.valid_to IS NULL AND (p.name LIKE '%Interbrigadistů%' OR p.address LIKE '%Interbrigadistů%'));

UPDATE properties SET properties_id = id WHERE valid_to IS NULL AND properties_id IS NULL AND name = 'Byt Interbrigadistů 6';

SET @properties_id := (SELECT COALESCE(properties_id, id) FROM properties WHERE valid_to IS NULL AND (name LIKE '%Interbrigadistů%' OR address LIKE '%Interbrigadistů%') LIMIT 1);

-- 3) Bankovní účet pronajímatele (7770101774)
SET @ba_id := (
  SELECT COALESCE(bank_accounts_id, id) FROM bank_accounts
  WHERE valid_to IS NULL AND (account_number LIKE '7770101774%' OR (account_number LIKE '%7770101774%'))
  ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1
);

-- 4) Smlouva (pokud neexistuje): nájem 7 500 + zálohy 1 400 = 8 900; od 4/2022 nájem 8 000 + 1 400 = 9 400
-- first_month_rent = 5 806 + 1 400 = 7 206 (dle smlouvy); kauce 15 000, vrácena 10.1.2023
INSERT INTO contracts (contracts_id, properties_id, tenants_id, contract_start, contract_end, monthly_rent, first_month_rent,
  deposit_amount, deposit_paid_date, deposit_return_date, default_payment_method, default_bank_accounts_id, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @properties_id, @tenants_id, DATE('2021-03-07'), DATE('2022-12-31'),
  8900.00, 7206.00, 15000.00, DATE('2021-03-08'), DATE('2023-01-10'), 'account', @ba_id, NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @tenants_id IS NOT NULL AND @properties_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contracts c
    WHERE c.valid_to IS NULL AND c.tenants_id = @tenants_id AND c.properties_id = @properties_id
      AND c.contract_start = '2021-03-07'
  );

UPDATE contracts SET contracts_id = id
WHERE valid_to IS NULL AND contracts_id IS NULL AND tenants_id = @tenants_id AND properties_id = @properties_id AND contract_start = '2021-03-07';

SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id) FROM contracts c
  WHERE c.valid_to IS NULL AND c.tenants_id = @tenants_id AND c.properties_id = @properties_id AND c.contract_start = '2021-03-07'
  LIMIT 1
);

-- 5) Změna nájmu od 4/2022: 9 400 Kč (8 000 + 1 400)
INSERT INTO contract_rent_changes (contract_rent_changes_id, contracts_id, amount, effective_from, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, 9400.00, DATE('2022-04-01'), NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contract_rent_changes crc WHERE crc.contracts_id = @contracts_id AND crc.valid_to IS NULL AND crc.effective_from = '2022-04-01');

-- 6) Účet nájemce (pro protiúčet z výpisu)
INSERT INTO tenant_bank_accounts (tenant_bank_accounts_id, tenants_id, account_number, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @tenants_id, '2799423133/0800', NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @tenants_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM tenant_bank_accounts tba WHERE tba.valid_to IS NULL AND tba.tenants_id = @tenants_id AND TRIM(tba.account_number) = '2799423133/0800');

UPDATE tenant_bank_accounts SET tenant_bank_accounts_id = id WHERE valid_to IS NULL AND tenant_bank_accounts_id IS NULL AND tenants_id = @tenants_id AND TRIM(account_number) = '2799423133/0800';

-- 7) Platby: první měsíc zkrácená (6 890), kauce (15 000), nájemné měsíčně, vrácení kauce (-15 000), vyúčtování (-1 657)
INSERT INTO payments (payments_id, contracts_id, period_year, period_month, amount, currency, payment_date, note, payment_method, bank_accounts_id, payment_type, approved_at)
SELECT NULL, @contracts_id, d.period_year, d.period_month, d.amount, 'CZK', d.payment_date, d.note, 'account', @ba_id, d.payment_type, d.payment_date
FROM (
  SELECT 2021 AS period_year,  3 AS period_month,  6890.00 AS amount, DATE('2021-03-08') AS payment_date, 'První měsíc (zkrácená platba)' AS note, 'rent' AS payment_type UNION ALL
  SELECT 2021,  3, 15000.00, DATE('2021-03-08'), 'Kauce', 'deposit' UNION ALL
  SELECT 2021,  4,  8900.00, DATE('2021-04-06'), NULL, 'rent' UNION ALL
  SELECT 2021,  5,  8900.00, DATE('2021-05-03'), NULL, 'rent' UNION ALL
  SELECT 2021,  6,  8900.00, DATE('2021-06-03'), NULL, 'rent' UNION ALL
  SELECT 2021,  7,  8900.00, DATE('2021-07-07'), NULL, 'rent' UNION ALL
  SELECT 2021,  8,  8900.00, DATE('2021-08-03'), NULL, 'rent' UNION ALL
  SELECT 2021,  9,  8900.00, DATE('2021-09-03'), NULL, 'rent' UNION ALL
  SELECT 2021, 10,  8900.00, DATE('2021-10-04'), NULL, 'rent' UNION ALL
  SELECT 2021, 11,  8900.00, DATE('2021-11-03'), NULL, 'rent' UNION ALL
  SELECT 2021, 12,  8900.00, DATE('2021-12-03'), NULL, 'rent' UNION ALL
  SELECT 2022,  1,  8900.00, DATE('2022-01-03'), NULL, 'rent' UNION ALL
  SELECT 2022,  2,  8900.00, DATE('2022-02-03'), NULL, 'rent' UNION ALL
  SELECT 2022,  3,  8900.00, DATE('2022-03-08'), NULL, 'rent' UNION ALL
  SELECT 2022,  4,  9400.00, DATE('2022-04-04'), NULL, 'rent' UNION ALL
  SELECT 2022,  5,  9400.00, DATE('2022-05-04'), NULL, 'rent' UNION ALL
  SELECT 2022,  6,  9400.00, DATE('2022-06-06'), NULL, 'rent' UNION ALL
  SELECT 2022,  7,  9400.00, DATE('2022-07-04'), NULL, 'rent' UNION ALL
  SELECT 2022,  8,  9400.00, DATE('2022-08-04'), NULL, 'rent' UNION ALL
  SELECT 2022,  9,  9400.00, DATE('2022-09-05'), NULL, 'rent' UNION ALL
  SELECT 2022, 10,  9400.00, DATE('2022-10-04'), NULL, 'rent' UNION ALL
  SELECT 2022, 11,  9400.00, DATE('2022-11-04'), NULL, 'rent' UNION ALL
  SELECT 2022, 12,  9400.00, DATE('2022-12-05'), NULL, 'rent' UNION ALL
  SELECT 2023,  1, -15000.00, DATE('2023-01-10'), 'Vrácení kauce Dominika Kinclová, pronájem bytu Interbrigadistů 6', 'deposit_return' UNION ALL
  SELECT 2023,  6, -1657.00, DATE('2023-06-14'), 'Preplatek byt Interbrigadistu 2021 (1375), 2022 (282)', 'other'
) d
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM payments p
    WHERE p.contracts_id = @contracts_id AND p.valid_to IS NULL
      AND p.period_year = d.period_year AND p.period_month = d.period_month
      AND p.payment_date = d.payment_date AND p.amount = d.amount
  );

UPDATE payments SET payments_id = id
WHERE payments_id IS NULL AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2021-03-08' AND '2023-06-14';

-- 8) Požadavky na platbu provázané s platbami (kauce, vrácení kauce, vyúčtování)
SET @pay_deposit_id := (SELECT payments_id FROM payments WHERE contracts_id = @contracts_id AND valid_to IS NULL AND payment_type = 'deposit' AND amount = 15000.00 LIMIT 1);
SET @pay_deposit_return_id := (SELECT payments_id FROM payments WHERE contracts_id = @contracts_id AND valid_to IS NULL AND payment_type = 'deposit_return' AND amount = -15000.00 LIMIT 1);
SET @pay_settlement_id := (SELECT payments_id FROM payments WHERE contracts_id = @contracts_id AND valid_to IS NULL AND payment_type = 'other' AND amount = -1657.00 LIMIT 1);

-- Kauce 15 000 (uhrazeno 8.3.2021)
INSERT INTO payment_requests (payment_requests_id, contracts_id, amount, type, note, due_date, paid_at, payments_id, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, 15000.00, 'deposit', 'Kauce', DATE('2021-03-08'), DATE('2021-03-08'), @pay_deposit_id, NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL AND @pay_deposit_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_requests pr WHERE pr.contracts_id = @contracts_id AND pr.valid_to IS NULL AND pr.type = 'deposit' AND pr.amount = 15000.00);

UPDATE payment_requests SET payment_requests_id = id WHERE valid_to IS NULL AND payment_requests_id IS NULL AND contracts_id = @contracts_id AND type = 'deposit' AND amount = 15000.00;

-- Vrácení kauce (uhrazeno 10.1.2023)
INSERT INTO payment_requests (payment_requests_id, contracts_id, amount, type, note, due_date, paid_at, payments_id, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, 15000.00, 'deposit_return', 'Vrácení kauce', DATE('2023-01-10'), DATE('2023-01-10'), @pay_deposit_return_id, NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL AND @pay_deposit_return_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_requests pr WHERE pr.contracts_id = @contracts_id AND pr.valid_to IS NULL AND pr.type = 'deposit_return');

UPDATE payment_requests SET payment_requests_id = id WHERE valid_to IS NULL AND payment_requests_id IS NULL AND contracts_id = @contracts_id AND type = 'deposit_return';

-- Vyúčtování – vrácení přeplatku (uhrazeno 14.6.2023)
INSERT INTO payment_requests (payment_requests_id, contracts_id, amount, type, note, due_date, paid_at, payments_id, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @contracts_id, -1657.00, 'settlement', 'Preplatek byt Interbrigadistu 2021 (1375), 2022 (282)', DATE('2023-06-14'), DATE('2023-06-14'), @pay_settlement_id, NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @contracts_id IS NOT NULL AND @pay_settlement_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM payment_requests pr WHERE pr.contracts_id = @contracts_id AND pr.valid_to IS NULL AND pr.type = 'settlement' AND pr.amount = -1657.00);

UPDATE payment_requests SET payment_requests_id = id WHERE valid_to IS NULL AND payment_requests_id IS NULL AND contracts_id = @contracts_id AND type = 'settlement' AND amount = -1657.00;
