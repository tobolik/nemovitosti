-- Platby: stav schválení (NULL = ke schválení, např. po načtení z FIO)
ALTER TABLE payments ADD COLUMN approved_at DATETIME NULL DEFAULT NULL AFTER payment_type;
-- Stávající platby považovat za schválené
UPDATE payments SET approved_at = COALESCE(valid_from, NOW()) WHERE valid_to IS NULL AND approved_at IS NULL;
