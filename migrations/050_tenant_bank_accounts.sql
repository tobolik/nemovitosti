-- Bankovní účty nájemníka (seznam – pro import z FIO); tenants_id = entity_id nájemníka
CREATE TABLE IF NOT EXISTS tenant_bank_accounts (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenants_id     INT UNSIGNED NOT NULL,
    account_number VARCHAR(100) NOT NULL,
    INDEX idx_tenants_id (tenants_id)
) ENGINE=InnoDB;
