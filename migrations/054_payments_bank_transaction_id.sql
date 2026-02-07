-- Platby z bankovního importu: identifikátor transakce u banky (FIO i jiné)
ALTER TABLE payments ADD COLUMN bank_transaction_id VARCHAR(50) NULL AFTER counterpart_account;
CREATE INDEX idx_payments_bank_tx ON payments (bank_transaction_id);
