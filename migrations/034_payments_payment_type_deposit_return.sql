-- payments: přidat typ platby „Vrácení kauce“ (pro záporné částky)
ALTER TABLE payments
  MODIFY COLUMN payment_type ENUM('rent','deposit','deposit_return','energy','other') NOT NULL DEFAULT 'rent';
