-- Platby: odkaz na bank_accounts místo přímého account_number
-- 1) Přidat sloupec bank_accounts_id
ALTER TABLE payments ADD COLUMN bank_accounts_id INT UNSIGNED NULL AFTER account_number;

-- 2) Pro každé unikátní account_number v platbách, které není v bank_accounts, vytvořit záznam
INSERT INTO bank_accounts (name, account_number, is_primary, sort_order)
SELECT DISTINCT CONCAT('Import – ', p.account_number), p.account_number, 0, 999
FROM payments p
WHERE p.valid_to IS NULL
  AND p.account_number IS NOT NULL
  AND p.account_number != ''
  AND NOT EXISTS (
    SELECT 1 FROM bank_accounts ba
    WHERE ba.account_number = p.account_number AND ba.valid_to IS NULL
  );
UPDATE bank_accounts SET bank_accounts_id = id WHERE bank_accounts_id IS NULL;

-- 3) Doplnit bank_accounts_id podle account_number
UPDATE payments p
JOIN bank_accounts ba ON ba.account_number = p.account_number AND ba.valid_to IS NULL
SET p.bank_accounts_id = ba.bank_accounts_id
WHERE p.valid_to IS NULL AND p.account_number IS NOT NULL AND p.account_number != '';

-- 3b) Platby s payment_method='account' a bez account_number → primární účet
SET @ba_id = (SELECT bank_accounts_id FROM bank_accounts WHERE valid_to IS NULL ORDER BY is_primary DESC, sort_order ASC LIMIT 1);
UPDATE payments SET bank_accounts_id = @ba_id WHERE valid_to IS NULL AND bank_accounts_id IS NULL AND payment_method = 'account';

-- 4) Odstranit sloupec account_number
ALTER TABLE payments DROP COLUMN account_number;
