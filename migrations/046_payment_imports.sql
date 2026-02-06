-- Importy z FIO: naimportované pohyby před párováním a schválením
CREATE TABLE IF NOT EXISTS payment_imports (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bank_accounts_id    INT UNSIGNED NOT NULL,
    payment_date        DATE NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    counterpart_account VARCHAR(100) NULL,
    note                TEXT NULL,
    fio_transaction_id  VARCHAR(50) NULL,
    contracts_id        INT UNSIGNED NULL,
    period_year         SMALLINT UNSIGNED NULL,
    period_month        TINYINT UNSIGNED NULL,
    period_year_to      SMALLINT UNSIGNED NULL,
    period_month_to     TINYINT UNSIGNED NULL,
    payment_type        VARCHAR(20) NULL DEFAULT 'rent',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bank_fio (bank_accounts_id, fio_transaction_id),
    INDEX idx_bank_created (bank_accounts_id, created_at)
) ENGINE=InnoDB;
