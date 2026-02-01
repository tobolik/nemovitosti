-- Platby: přejmenovat contract_id na contracts_id
-- 1) Převést contract_id (řádkové id) na logické
UPDATE payments p
JOIN contracts c ON c.id = p.contract_id
SET p.contract_id = COALESCE(c.contracts_id, c.id)
WHERE p.valid_to IS NULL AND p.contract_id = c.id;

-- 2) Doplnit pro platby s valid_to
UPDATE payments p
JOIN contracts c ON c.id = p.contract_id
SET p.contract_id = COALESCE(c.contracts_id, c.id)
WHERE p.contract_id = c.id;

-- 3) Přejmenovat sloupec
ALTER TABLE payments RENAME COLUMN contract_id TO contracts_id;
