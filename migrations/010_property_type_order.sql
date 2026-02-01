-- Pořadí typů nemovitostí: Byt, garáž, dům, komerční, pozemek
ALTER TABLE properties MODIFY COLUMN type ENUM('apartment','garage','house','commercial','land') NOT NULL DEFAULT 'apartment';
