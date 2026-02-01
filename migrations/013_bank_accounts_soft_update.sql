-- bank_accounts: soft-update logika (valid_*, bank_accounts_id) – stejně jako ostatní tabulky
ALTER TABLE bank_accounts ADD COLUMN bank_accounts_id INT UNSIGNED NULL AFTER id;
ALTER TABLE bank_accounts ADD COLUMN valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER sort_order;
ALTER TABLE bank_accounts ADD COLUMN valid_to DATETIME NULL DEFAULT NULL AFTER valid_from;
ALTER TABLE bank_accounts ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE bank_accounts ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;

UPDATE bank_accounts SET bank_accounts_id = id WHERE bank_accounts_id IS NULL;

CREATE INDEX idx_bank_accounts_id ON bank_accounts (bank_accounts_id, valid_to);
CREATE INDEX idx_v ON bank_accounts (valid_to);
