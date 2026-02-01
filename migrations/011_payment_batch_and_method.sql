-- Platby: propojení plateb z jedné transakce (payment_batch_id) + způsob platby (účet/hotovost)
ALTER TABLE payments ADD COLUMN payment_batch_id VARCHAR(36) NULL AFTER note;
ALTER TABLE payments ADD COLUMN payment_method ENUM('account','cash') NULL AFTER payment_batch_id;
ALTER TABLE payments ADD COLUMN account_number VARCHAR(50) NULL AFTER payment_method;
