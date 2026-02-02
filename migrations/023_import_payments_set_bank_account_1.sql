-- Import: nastavení bank_accounts_id pro vložené platby (specifický případ)
-- Pro tento případ platí: bank_accounts_id = 1
-- (Řeší importy, které vznikly před mapováním účtů na bank_accounts_id.)

-- Martin Konečný – najdi aktivní smlouvu (nejnovější)
SET @contracts_id := (
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
WHERE @contracts_id IS NOT NULL
  AND valid_to IS NULL
  AND contracts_id = @contracts_id
  AND payment_method = 'account'
  AND payment_date BETWEEN '2025-04-18' AND '2026-01-29'
  AND (bank_accounts_id IS NULL OR bank_accounts_id <> 1);

