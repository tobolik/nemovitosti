-- Indexy pro entity_id
CREATE INDEX idx_users_id ON users (users_id, valid_to);
CREATE INDEX idx_properties_id ON properties (properties_id, valid_to);
CREATE INDEX idx_tenants_id ON tenants (tenants_id, valid_to);
CREATE INDEX idx_contracts_id ON contracts (contracts_id, valid_to);
CREATE INDEX idx_payments_id ON payments (payments_id, valid_to);
