-- Tenants: typ FO/PO, adresa, IČO, DIČ
ALTER TABLE tenants ADD COLUMN type ENUM('person','company') NOT NULL DEFAULT 'person' AFTER name;
ALTER TABLE tenants ADD COLUMN address TEXT NULL AFTER phone;
ALTER TABLE tenants ADD COLUMN ic VARCHAR(20) NULL AFTER address;
ALTER TABLE tenants ADD COLUMN dic VARCHAR(20) NULL AFTER ic;
