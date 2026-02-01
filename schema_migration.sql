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
