-- Datum narození u fyzické osoby
ALTER TABLE tenants ADD COLUMN birth_date DATE NULL AFTER type;
