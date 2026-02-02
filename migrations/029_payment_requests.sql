-- Požadované platby (doplatek energie, vyúčtování) – zobrazí se v přehledu u smlouvy, dokud nejsou zaplaceny

CREATE TABLE IF NOT EXISTS payment_requests (
    id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_requests_id INT UNSIGNED NULL,
    contracts_id        INT UNSIGNED NOT NULL,
    amount              DECIMAL(12,2) NOT NULL,
    type                ENUM('energy','settlement','other') NOT NULL DEFAULT 'energy',
    note                TEXT NULL,
    due_date            DATE NULL,
    paid_at             DATE NULL,
    payment_id          INT UNSIGNED NULL,
    valid_from          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to            DATETIME NULL DEFAULT NULL,
    valid_user_from     INT UNSIGNED NULL,
    valid_user_to       INT UNSIGNED NULL,
    INDEX idx_payment_requests_id (payment_requests_id, valid_to),
    INDEX idx_contracts_id (contracts_id, valid_to),
    INDEX idx_v (valid_to),
    INDEX idx_paid (paid_at, valid_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;
