-- Odstranit protiúčet ze smluv (přesunuto na nájemníka v 048); spusťte jen pokud jste měli 047
ALTER TABLE contracts DROP COLUMN expected_counterpart_account;
