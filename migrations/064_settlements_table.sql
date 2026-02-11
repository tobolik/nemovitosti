-- Migration 064: Tabulky pro vyúčtování energií a kauce
-- settlements = hlavní záznam o vyúčtování (auditní stopa, lock/unlock, skutečná částka)
-- settlement_items = junction: které zálohy/požadavky byly do vyúčtování zahrnuty

CREATE TABLE IF NOT EXISTS settlements (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    settlements_id        INT UNSIGNED NULL,
    contracts_id          INT UNSIGNED NOT NULL,
    type                  VARCHAR(20) NOT NULL DEFAULT 'energy',  -- 'energy' nebo 'deposit'
    label                 VARCHAR(255) DEFAULT NULL,              -- popis, napr. "Elektřina 2024"
    actual_amount         DECIMAL(12,2) NOT NULL,                 -- skutečná částka (energie/pokrytí z kauce)
    advances_sum          DECIMAL(12,2) NOT NULL,                 -- součet vybraných záloh v době vyúčtování
    settlement_amount     DECIMAL(12,2) NOT NULL,                 -- rozdíl: actual - advances (kladný = nedoplatek)
    settlement_request_id INT UNSIGNED DEFAULT NULL,              -- FK na payment_requests entity_id (vytvořený nedoplatek/přeplatek)
    settled_at            DATETIME NOT NULL,                      -- kdy bylo vyúčtování provedeno
    locked_at             DATETIME DEFAULT NULL,                  -- kdy bylo zamknuto (NULL = editovatelné)
    locked_by             INT UNSIGNED DEFAULT NULL,              -- kdo zamknul (users_id)
    note                  TEXT DEFAULT NULL,
    valid_from            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to              DATETIME DEFAULT NULL,
    valid_user_from       INT UNSIGNED DEFAULT NULL,
    valid_user_to         INT UNSIGNED DEFAULT NULL,
    INDEX idx_settlements_id (settlements_id, valid_to),
    INDEX idx_contracts (contracts_id, valid_to),
    INDEX idx_type (type)
);

CREATE TABLE IF NOT EXISTS settlement_items (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    settlement_items_id   INT UNSIGNED NULL,
    settlements_id        INT UNSIGNED NOT NULL,                  -- FK na settlements.settlements_id
    payment_requests_id   INT UNSIGNED NOT NULL,                  -- FK na payment_requests entity_id
    valid_from            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to              DATETIME DEFAULT NULL,
    valid_user_from       INT UNSIGNED DEFAULT NULL,
    valid_user_to         INT UNSIGNED DEFAULT NULL,
    INDEX idx_settlement_items_id (settlement_items_id, valid_to),
    INDEX idx_settlement (settlements_id, valid_to)
);
