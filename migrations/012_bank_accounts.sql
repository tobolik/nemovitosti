-- Bankovní účty pro výběr při platbách
CREATE TABLE IF NOT EXISTS bank_accounts (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name         VARCHAR(100) NOT NULL COMMENT 'Popis účtu např. Hlavní účet',
    account_number VARCHAR(50) NOT NULL COMMENT 'Číslo účtu ve formátu 123456789/0800',
    is_primary   TINYINT(1) NOT NULL DEFAULT 0,
    sort_order   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    INDEX idx_primary (is_primary),
    INDEX idx_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

-- Účty se přidávají přes UI v sekci Bankovní účty
