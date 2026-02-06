-- Protiúčty u nájemníka (více účtů – platby z FIO se importují jen z těchto)
ALTER TABLE tenants ADD COLUMN expected_counterpart_accounts TEXT NULL AFTER note;
