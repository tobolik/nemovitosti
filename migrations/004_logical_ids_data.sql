-- Doplnění logických ID pro existující data
UPDATE users SET users_id = id WHERE users_id IS NULL;
UPDATE properties SET properties_id = id WHERE properties_id IS NULL;
UPDATE tenants SET tenants_id = id WHERE tenants_id IS NULL;
UPDATE contracts SET contracts_id = id WHERE contracts_id IS NULL;
UPDATE payments SET payments_id = id WHERE payments_id IS NULL;
