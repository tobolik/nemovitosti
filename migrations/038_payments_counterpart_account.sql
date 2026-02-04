-- Platby: číslo protiúčtu (od koho přišla platba / na který šla)
ALTER TABLE payments ADD COLUMN counterpart_account VARCHAR(50) NULL AFTER note;
