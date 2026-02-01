-- ============================================================
-- NEMOVITOSTI – Property Management
-- Soft-update / Soft-delete pattern:
--   valid_from  DATETIME NOT NULL  – kdy záznam začal platit
--   valid_to    DATETIME NULL      – kdy přestal (NULL = platí nyní)
-- ============================================================
CREATE DATABASE IF NOT EXISTS tobolikcz01
  CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
USE tobolikcz01;

-- 1) Uživatelé
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    users_id      INT UNSIGNED NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(150) NOT NULL,
    role          ENUM('admin','user') NOT NULL DEFAULT 'user',
    valid_from      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to        DATETIME NULL DEFAULT NULL,
    valid_user_from INT UNSIGNED NULL,
    valid_user_to   INT UNSIGNED NULL,
    INDEX idx_email (email, valid_to),
    INDEX idx_users_id (users_id, valid_to)
) ENGINE=InnoDB;

-- 2) Nemovitosti
CREATE TABLE IF NOT EXISTS properties (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    properties_id  INT UNSIGNED NULL,
    name           VARCHAR(255) NOT NULL,
    address        TEXT NOT NULL,
    size_m2        DECIMAL(10,2) NULL,
    purchase_price DECIMAL(12,2) NULL,
    purchase_date  DATE NULL,
    purchase_contract_url VARCHAR(500) NULL,
    type           ENUM('apartment','house','commercial','land','garage') NOT NULL DEFAULT 'apartment',
    note           TEXT NULL,
    valid_from      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to        DATETIME NULL DEFAULT NULL,
    valid_user_from INT UNSIGNED NULL,
    valid_user_to   INT UNSIGNED NULL,
    INDEX idx_v (valid_to),
    INDEX idx_properties_id (properties_id, valid_to)
) ENGINE=InnoDB;

-- 3) Nájemníci
CREATE TABLE IF NOT EXISTS tenants (
    id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tenants_id INT UNSIGNED NULL,
    name      VARCHAR(255) NOT NULL,
    type      ENUM('person','company') NOT NULL DEFAULT 'person',
    email     VARCHAR(255) NULL,
    phone     VARCHAR(30)  NULL,
    address   TEXT NULL,
    ic        VARCHAR(20)  NULL,
    dic       VARCHAR(20)  NULL,
    note      TEXT NULL,
    valid_from      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to        DATETIME NULL DEFAULT NULL,
    valid_user_from INT UNSIGNED NULL,
    valid_user_to   INT UNSIGNED NULL,
    INDEX idx_v (valid_to),
    INDEX idx_tenants_id (tenants_id, valid_to)
) ENGINE=InnoDB;

-- 4) Nájemní smlouvy
CREATE TABLE IF NOT EXISTS contracts (
    id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    contracts_id   INT UNSIGNED NULL,
    property_id    INT UNSIGNED NOT NULL,
    tenant_id      INT UNSIGNED NOT NULL,
    contract_start DATE         NOT NULL,
    contract_end   DATE         NULL,         -- NULL = neurčitá doba
    monthly_rent   DECIMAL(12,2) NOT NULL,
    note           TEXT NULL,
    valid_from      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to        DATETIME NULL DEFAULT NULL,
    valid_user_from INT UNSIGNED NULL,
    valid_user_to   INT UNSIGNED NULL,
    INDEX idx_p (property_id, valid_to),
    INDEX idx_t (tenant_id, valid_to),
    INDEX idx_v (valid_to),
    INDEX idx_contracts_id (contracts_id, valid_to)
) ENGINE=InnoDB;

-- 5) Platby (contracts_id = logické ID smlouvy, contracts.contracts_id)
CREATE TABLE IF NOT EXISTS payments (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payments_id   INT UNSIGNED NULL,
    contracts_id  INT UNSIGNED NOT NULL,
    period_year   SMALLINT UNSIGNED NOT NULL,
    period_month  TINYINT UNSIGNED NOT NULL,   -- 1–12
    amount        DECIMAL(12,2) NOT NULL,
    payment_date  DATE NOT NULL,
    note          TEXT NULL,
    valid_from      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to        DATETIME NULL DEFAULT NULL,
    valid_user_from INT UNSIGNED NULL,
    valid_user_to   INT UNSIGNED NULL,
    INDEX idx_contracts_id (contracts_id, valid_to),
    INDEX idx_v (valid_to),
    INDEX idx_payments_id (payments_id, valid_to)
) ENGINE=InnoDB;
