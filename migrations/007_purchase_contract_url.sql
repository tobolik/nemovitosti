-- Properties: odkaz na kupní smlouvu (např. Google Drive)
ALTER TABLE properties ADD COLUMN purchase_contract_url VARCHAR(500) NULL AFTER purchase_date;
