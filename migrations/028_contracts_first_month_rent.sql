-- Smlouva: poměrná část za první měsíc (když smlouva nezačíná 1. v měsíci)
-- Uložená částka se použije jako předpis pro ten měsíc místo dopočítávání.
ALTER TABLE contracts ADD COLUMN first_month_rent DECIMAL(12,2) NULL AFTER monthly_rent;
