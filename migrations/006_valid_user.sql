-- Audit: kdo změnu provedl
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
