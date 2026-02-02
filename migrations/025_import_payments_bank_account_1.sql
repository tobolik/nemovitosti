-- Importy: vynutit bank_accounts_id = 1 (specifický případ)
-- Použije se pro importované platby, aby se správně propisoval účet v UI.

-- Bednaříková Edita – najdi aktivní smlouvu (nejnovější)
SET @contracts_bedn := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (
        t.tenants_id = c.tenants_id
        OR t.id = c.tenants_id
       )
  WHERE c.valid_to IS NULL
    AND t.name LIKE '%Bedna%'
    AND t.name LIKE '%Edita%'
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

UPDATE payments
SET bank_accounts_id = 1
WHERE @contracts_bedn IS NOT NULL
  AND valid_to IS NULL
  AND contracts_id = @contracts_bedn
  AND payment_method = 'account'
  AND payment_date BETWEEN '2023-02-01' AND '2025-04-25'
  AND (bank_accounts_id IS NULL OR bank_accounts_id <> 1);

-- Martin Konečný – najdi aktivní smlouvu (nejnovější)
SET @contracts_kon := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (
        t.tenants_id = c.tenants_id
        OR t.id = c.tenants_id
       )
  WHERE c.valid_to IS NULL
    AND t.name LIKE '%Konečn%'
    AND t.name LIKE '%Martin%'
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

UPDATE payments
SET bank_accounts_id = 1
WHERE @contracts_kon IS NOT NULL
  AND valid_to IS NULL
  AND contracts_id = @contracts_kon
  AND payment_method = 'account'
  AND payment_date BETWEEN '2025-04-18' AND '2026-01-29'
  AND (bank_accounts_id IS NULL OR bank_accounts_id <> 1);

