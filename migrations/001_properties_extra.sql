-- Properties: výměra m², kupní cena, datum koupě
ALTER TABLE properties ADD COLUMN size_m2 DECIMAL(10,2) NULL AFTER address;
ALTER TABLE properties ADD COLUMN purchase_price DECIMAL(12,2) NULL AFTER size_m2;
ALTER TABLE properties ADD COLUMN purchase_date DATE NULL AFTER purchase_price;
