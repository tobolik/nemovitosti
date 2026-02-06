-- tenant_bank_accounts: soft-update logika (entity_id, valid_*) – dle kritických instrukcí
ALTER TABLE tenant_bank_accounts ADD COLUMN tenant_bank_accounts_id INT UNSIGNED NULL AFTER id;
ALTER TABLE tenant_bank_accounts ADD COLUMN valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER account_number;
ALTER TABLE tenant_bank_accounts ADD COLUMN valid_to DATETIME NULL DEFAULT NULL AFTER valid_from;
ALTER TABLE tenant_bank_accounts ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE tenant_bank_accounts ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;

UPDATE tenant_bank_accounts SET tenant_bank_accounts_id = id WHERE tenant_bank_accounts_id IS NULL;

CREATE INDEX idx_tenant_bank_accounts_id ON tenant_bank_accounts (tenant_bank_accounts_id, valid_to);
CREATE INDEX idx_v ON tenant_bank_accounts (valid_to);
