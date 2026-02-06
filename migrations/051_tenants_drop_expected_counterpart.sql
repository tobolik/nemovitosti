-- Bankovní účty nájemníka jsou v tabulce tenant_bank_accounts
ALTER TABLE tenants DROP COLUMN expected_counterpart_accounts;
