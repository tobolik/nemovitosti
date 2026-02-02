-- Změny výše nájemného k určitému datu (provázáno přes contracts_id)
CREATE TABLE IF NOT EXISTS contract_rent_changes (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contracts_id  INT UNSIGNED NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    effective_from DATE NOT NULL COMMENT 'Od kdy se platí nové nájemné (první den měsíce)',
    INDEX idx_contracts_effective (contracts_id, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;
