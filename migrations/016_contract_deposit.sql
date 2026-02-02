-- Kauce – evidovat platbu a potřebu vrácení po skončení smlouvy
ALTER TABLE contracts ADD COLUMN deposit_amount DECIMAL(12,2) NULL AFTER contract_url;
ALTER TABLE contracts ADD COLUMN deposit_paid_date DATE NULL AFTER deposit_amount;
ALTER TABLE contracts ADD COLUMN deposit_return_date DATE NULL AFTER deposit_paid_date;
