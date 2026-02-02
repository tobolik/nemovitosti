-- Platby: typ platby (nájem, kauce, doplatek energie, jiné)
-- Do očekávaného nájmu a neuhrazených měsíců vstupují jen platby typu 'rent'
ALTER TABLE payments ADD COLUMN payment_type ENUM('rent','deposit','energy','other') NOT NULL DEFAULT 'rent' AFTER bank_accounts_id;
