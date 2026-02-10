-- Simona Benová – Byt Interbrigadistů, 14.9.2020–7.1.2021
-- Vloží jen smlouvu (a nájemce/nemovitost/účet nutné pro smlouvu). Platby a požadavky doplníte ručně.
-- Nájem: září/leden poměr 4 500, říjen–prosinec po 9 000. Kauce 18 000 (deposit_paid_date 30.9., deposit_return_date 8.1.).
-- Idempotentní: pokud již existuje nájemce „Benová“ + „Simona“ a smlouva od 14.9.2020 na Interbrigadistů, přeskočí se.

-- 1) Nájemce (pokud neexistuje)
INSERT INTO tenants (tenants_id, name, type, birth_date, email, phone, address, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, 'Simona Benová', 'person', DATE('2000-01-23'), NULL, '728 682 828',
       'V Zahradách 227, 75111 Radslavice', NOW(), NULL, NULL, NULL
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM tenants t WHERE t.valid_to IS NULL AND t.name LIKE '%Benová%' AND t.name LIKE '%Simona%');

UPDATE tenants SET tenants_id = id WHERE valid_to IS NULL AND tenants_id IS NULL AND name = 'Simona Benová';

SET @tenants_id := (SELECT COALESCE(tenants_id, id) FROM tenants WHERE valid_to IS NULL AND name LIKE '%Benová%' AND name LIKE '%Simona%' LIMIT 1);

-- 2) Nemovitost – Byt Interbrigadistů (použít existující)
SET @properties_id := (SELECT COALESCE(properties_id, id) FROM properties WHERE valid_to IS NULL AND (name LIKE '%Interbrigadistů%' OR address LIKE '%Interbrigadistů%') LIMIT 1);

-- 3) Bankovní účet pronajímatele (7770101774)
SET @ba_id := (
  SELECT COALESCE(bank_accounts_id, id) FROM bank_accounts
  WHERE valid_to IS NULL AND (account_number LIKE '7770101774%' OR account_number LIKE '%7770101774%')
  ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1
);

-- 4) Smlouva: 14.9.2020–7.1.2021, nájem 9 000, první/poslední měsíc 4 500 (poměr), kauce 18 000
INSERT INTO contracts (contracts_id, properties_id, tenants_id, contract_start, contract_end, monthly_rent, first_month_rent, last_month_rent,
  deposit_amount, deposit_paid_date, deposit_return_date, default_payment_method, default_bank_accounts_id, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT NULL, @properties_id, @tenants_id, DATE('2020-09-14'), DATE('2021-01-07'),
  9000.00, 4500.00, 4500.00, 18000.00, DATE('2020-09-30'), DATE('2021-01-08'), 'account', @ba_id, NOW(), NULL, NULL, NULL
FROM DUAL
WHERE @tenants_id IS NOT NULL AND @properties_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contracts c
    WHERE c.valid_to IS NULL AND c.tenants_id = @tenants_id AND c.properties_id = @properties_id
      AND c.contract_start = '2020-09-14'
  );

UPDATE contracts SET contracts_id = id
WHERE valid_to IS NULL AND contracts_id IS NULL AND tenants_id = @tenants_id AND properties_id = @properties_id AND contract_start = '2020-09-14';
