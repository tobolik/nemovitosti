-- Smlouva: poměrná část za poslední měsíc (když smlouva nekončí poslední den v měsíci)
-- Umožňuje zadat přesnou dohodnutou částku místo dopočtu; vhodné i pro odpuštění dluhu.
ALTER TABLE contracts ADD COLUMN last_month_rent DECIMAL(12,2) NULL AFTER first_month_rent;
