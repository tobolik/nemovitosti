-- Migrace: rozšíření podle funcioncionality.md
-- Spustit na existující DB: mysql -u user -p tobolikcz01 < schema_migration.sql
-- Pokud sloupec již existuje, příkaz selže – lze přeskočit.

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
