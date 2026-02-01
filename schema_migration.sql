-- Migrace: rozšíření podle funcioncionality.md
-- RUČNÍ JEDNORÁZOVÝ UPGRADE existující DB: mysql -u user -p tobolikcz01 < schema_migration.sql
-- Při automatickém deployi se používají inkrementální migrace ze složky migrations/ (api/migrate.php).

USE tobolikcz01;

-- Properties: výměra m², kupní cena
ALTER TABLE properties ADD COLUMN size_m2 DECIMAL(10,2) NULL AFTER address;
ALTER TABLE properties ADD COLUMN purchase_price DECIMAL(12,2) NULL AFTER size_m2;
ALTER TABLE properties ADD COLUMN purchase_date DATE NULL AFTER purchase_price;

-- Tenants: typ FO/PO, adresa, IČO, DIČ
ALTER TABLE tenants ADD COLUMN type ENUM('person','company') NOT NULL DEFAULT 'person' AFTER name;
ALTER TABLE tenants ADD COLUMN address TEXT NULL AFTER phone;
ALTER TABLE tenants ADD COLUMN ic VARCHAR(20) NULL AFTER address;
ALTER TABLE tenants ADD COLUMN dic VARCHAR(20) NULL AFTER ic;

-- Soft-update: logická ID pro provázání verzí (payments_id, properties_id, …)
-- Každá verze záznamu sdílí stejné XYZ_id; invalidace probíhá přes něj.
ALTER TABLE users ADD COLUMN users_id INT UNSIGNED NULL AFTER id;
ALTER TABLE properties ADD COLUMN properties_id INT UNSIGNED NULL AFTER id;
ALTER TABLE tenants ADD COLUMN tenants_id INT UNSIGNED NULL AFTER id;
ALTER TABLE contracts ADD COLUMN contracts_id INT UNSIGNED NULL AFTER id;
ALTER TABLE payments ADD COLUMN payments_id INT UNSIGNED NULL AFTER id;

-- Fallback: logická ID chybí (částečná migrace)
ALTER TABLE users ADD COLUMN users_id INT UNSIGNED NULL AFTER id;
ALTER TABLE properties ADD COLUMN properties_id INT UNSIGNED NULL AFTER id;
ALTER TABLE tenants ADD COLUMN tenants_id INT UNSIGNED NULL AFTER id;
ALTER TABLE contracts ADD COLUMN contracts_id INT UNSIGNED NULL AFTER id;
ALTER TABLE payments ADD COLUMN payments_id INT UNSIGNED NULL AFTER id;

-- Doplnění pro existující data: každý řádek zatím = vlastní logický záznam
UPDATE users SET users_id = id WHERE users_id IS NULL;
UPDATE properties SET properties_id = id WHERE properties_id IS NULL;
UPDATE tenants SET tenants_id = id WHERE tenants_id IS NULL;
UPDATE contracts SET contracts_id = id WHERE contracts_id IS NULL;
UPDATE payments SET payments_id = id WHERE payments_id IS NULL;

-- Indexy pro rychlou invalidaci podle logického ID
CREATE INDEX idx_users_id ON users (users_id, valid_to);
CREATE INDEX idx_properties_id ON properties (properties_id, valid_to);
CREATE INDEX idx_tenants_id ON tenants (tenants_id, valid_to);
CREATE INDEX idx_contracts_id ON contracts (contracts_id, valid_to);
CREATE INDEX idx_payments_id ON payments (payments_id, valid_to);

-- Audit: kdo změnu provedl (valid_user_from = kdo vytvořil verzi, valid_user_to = kdo ji uzavřel)
-- Samostatné ALTER – pokud jeden sloupec existuje, druhý se přidá (migrace skočí Duplicate column)
ALTER TABLE users ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE users ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;
ALTER TABLE properties ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE properties ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;
ALTER TABLE tenants ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE tenants ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;
ALTER TABLE contracts ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE contracts ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;
ALTER TABLE payments ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE payments ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;

-- Properties: odkaz na kupní smlouvu (např. Google Drive)
ALTER TABLE properties ADD COLUMN purchase_contract_url VARCHAR(500) NULL AFTER purchase_date;

-- Contracts: odkaz na nájemní smlouvu (PDF, např. Google Drive)
ALTER TABLE contracts ADD COLUMN contract_url VARCHAR(500) NULL AFTER monthly_rent;

-- Platby: přejmenovat contract_id na contracts_id (konvence: tabulka_id)
-- 1) Převést contract_id (řádkové id) na logické
UPDATE payments p
JOIN contracts c ON c.id = p.contract_id
SET p.contract_id = COALESCE(c.contracts_id, c.id)
WHERE p.valid_to IS NULL AND p.contract_id = c.id;

-- 2) Doplnit pro platby s valid_to (starší řádky, contract_id = řádkové id)
UPDATE payments p
JOIN contracts c ON c.id = p.contract_id
SET p.contract_id = COALESCE(c.contracts_id, c.id)
WHERE p.contract_id = c.id;

-- 3) Přejmenovat sloupec
ALTER TABLE payments RENAME COLUMN contract_id TO contracts_id;
