-- Kolace databáze a tabulek: utf8mb4_czech_ci
-- Při instalaci nebo po změně collation spusťte pro konzistenci.
-- Databáze: ALTER DATABASE `název_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
-- Tabulky: CONVERT TO pro jednotnou kolaci (zamezí chybě "Illegal mix of collations")

ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE properties CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE tenants CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE contracts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE payments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE bank_accounts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE contract_rent_changes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
ALTER TABLE _migrations CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci;
