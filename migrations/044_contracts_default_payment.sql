-- Smlouva: výchozí způsob platby a účet pro navádění platby
ALTER TABLE contracts ADD COLUMN default_payment_method VARCHAR(20) NULL AFTER note;
ALTER TABLE contracts ADD COLUMN default_bank_accounts_id INT UNSIGNED NULL AFTER default_payment_method;
