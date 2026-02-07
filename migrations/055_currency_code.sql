-- Měna: kód ISO 4217 (CZK, EUR, …) u účtů, importů a plateb
ALTER TABLE bank_accounts ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'CZK' AFTER account_number;
ALTER TABLE payment_imports ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'CZK' AFTER amount;
ALTER TABLE payments ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'CZK' AFTER amount;
