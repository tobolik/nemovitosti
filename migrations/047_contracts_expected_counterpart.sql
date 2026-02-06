-- Smlouva: očekávaný protiúčet (účet nájemníka) – import z FIO stáhne jen pohyby z těchto účtů
ALTER TABLE contracts ADD COLUMN expected_counterpart_account VARCHAR(100) NULL AFTER default_bank_accounts_id;
