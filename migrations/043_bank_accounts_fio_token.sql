-- Propojení bankovního účtu s FIO bankou přes API token (pro budoucí načítání plateb)
ALTER TABLE bank_accounts ADD COLUMN fio_token VARCHAR(255) NULL DEFAULT NULL AFTER sort_order;
