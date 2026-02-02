-- contracts: property_id/tenant_id → properties_id/tenants_id (odkazy na entity_id)
-- Vždy se používá pouze entity_id, nikdy fyzické id řádku

ALTER TABLE contracts
    CHANGE COLUMN property_id properties_id INT UNSIGNED NOT NULL,
    CHANGE COLUMN tenant_id   tenants_id   INT UNSIGNED NOT NULL;

-- Indexy – přejmenovat na nové sloupce
DROP INDEX idx_p ON contracts;
DROP INDEX idx_t ON contracts;
CREATE INDEX idx_properties_id ON contracts (properties_id, valid_to);
CREATE INDEX idx_tenants_id ON contracts (tenants_id, valid_to);
