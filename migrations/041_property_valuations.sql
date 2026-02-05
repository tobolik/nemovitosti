-- Tržní cena nemovitosti v čase (podobně jako změny nájmu) – pro procentuální zhodnocení
CREATE TABLE IF NOT EXISTS property_valuations (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    property_valuations_id INT UNSIGNED NULL,
    properties_id          INT UNSIGNED NOT NULL,
    amount                 DECIMAL(12,2) NOT NULL,
    effective_from         DATE NOT NULL,
    valid_from             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to               DATETIME NULL DEFAULT NULL,
    valid_user_from        INT UNSIGNED NULL,
    valid_user_to          INT UNSIGNED NULL,
    INDEX idx_property_valuations_id (property_valuations_id, valid_to),
    INDEX idx_properties_id (properties_id, valid_to),
    INDEX idx_effective (effective_from, valid_to),
    INDEX idx_v (valid_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;
