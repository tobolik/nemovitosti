-- bank_accounts: soft-update logika (valid_*, bank_accounts_id = entity_id) – stejně jako ostatní tabulky
-- Pokud 012 neproběhla, vytvoříme tabulku nejdřív
CREATE TABLE IF NOT EXISTS bank_accounts (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    is_primary     TINYINT(1) NOT NULL DEFAULT 0,
    sort_order     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_primary (is_primary),
    INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

ALTER TABLE bank_accounts ADD COLUMN bank_accounts_id INT UNSIGNED NULL AFTER id;
ALTER TABLE bank_accounts ADD COLUMN valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER sort_order;
ALTER TABLE bank_accounts ADD COLUMN valid_to DATETIME NULL DEFAULT NULL AFTER valid_from;
ALTER TABLE bank_accounts ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE bank_accounts ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;

UPDATE bank_accounts SET bank_accounts_id = id WHERE bank_accounts_id IS NULL;

CREATE INDEX idx_bank_accounts_id ON bank_accounts (bank_accounts_id, valid_to);
CREATE INDEX idx_v ON bank_accounts (valid_to);
