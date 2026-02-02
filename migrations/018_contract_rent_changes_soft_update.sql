-- contract_rent_changes: soft-update logika (entity_id, valid_*) – stejně jako ostatní tabulky
ALTER TABLE contract_rent_changes ADD COLUMN contract_rent_changes_id INT UNSIGNED NULL AFTER id;
ALTER TABLE contract_rent_changes ADD COLUMN valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER effective_from;
ALTER TABLE contract_rent_changes ADD COLUMN valid_to DATETIME NULL DEFAULT NULL AFTER valid_from;
ALTER TABLE contract_rent_changes ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE contract_rent_changes ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;

UPDATE contract_rent_changes SET contract_rent_changes_id = id WHERE contract_rent_changes_id IS NULL;

CREATE INDEX idx_contract_rent_changes_id ON contract_rent_changes (contract_rent_changes_id, valid_to);
CREATE INDEX idx_v ON contract_rent_changes (valid_to);
