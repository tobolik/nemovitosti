-- payment_imports: soft-update + historie (žádné mazání), approved_at a vazba na vytvořenou platbu
ALTER TABLE payment_imports ADD COLUMN payment_imports_id INT UNSIGNED NULL AFTER id;
ALTER TABLE payment_imports ADD COLUMN valid_from DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER created_at;
ALTER TABLE payment_imports ADD COLUMN valid_to DATETIME NULL DEFAULT NULL AFTER valid_from;
ALTER TABLE payment_imports ADD COLUMN valid_user_from INT UNSIGNED NULL AFTER valid_to;
ALTER TABLE payment_imports ADD COLUMN valid_user_to INT UNSIGNED NULL AFTER valid_user_from;
ALTER TABLE payment_imports ADD COLUMN approved_at DATETIME NULL DEFAULT NULL AFTER valid_user_to;
ALTER TABLE payment_imports ADD COLUMN payments_id INT UNSIGNED NULL AFTER approved_at COMMENT 'entity_id první vytvořené platby po schválení';

ALTER TABLE payment_imports MODIFY payment_type VARCHAR(20) NULL DEFAULT NULL;

UPDATE payment_imports SET payment_imports_id = id WHERE payment_imports_id IS NULL;
UPDATE payment_imports SET valid_from = created_at WHERE valid_from = '0000-00-00 00:00:00' OR valid_from IS NULL;

CREATE INDEX idx_payment_imports_id ON payment_imports (payment_imports_id, valid_to);
CREATE INDEX idx_pi_v ON payment_imports (valid_to);
CREATE INDEX idx_pi_approved ON payment_imports (approved_at);
