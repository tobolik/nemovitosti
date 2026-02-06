-- Pronajímáno od: od kdy se nemovitost započítává do statistik (vytížení, heatmapa)
-- NULL = vždy / od koupě; vyplněno = statistiky jen od tohoto data
ALTER TABLE properties ADD COLUMN rented_from DATE NULL AFTER purchase_date;
