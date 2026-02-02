-- Soft-update: entity_id pro provázání verzí
ALTER TABLE users ADD COLUMN users_id INT UNSIGNED NULL AFTER id;
ALTER TABLE properties ADD COLUMN properties_id INT UNSIGNED NULL AFTER id;
ALTER TABLE tenants ADD COLUMN tenants_id INT UNSIGNED NULL AFTER id;
ALTER TABLE contracts ADD COLUMN contracts_id INT UNSIGNED NULL AFTER id;
ALTER TABLE payments ADD COLUMN payments_id INT UNSIGNED NULL AFTER id;
