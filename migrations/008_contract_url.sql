-- Contracts: odkaz na nájemní smlouvu (PDF, např. Google Drive)
ALTER TABLE contracts ADD COLUMN contract_url VARCHAR(500) NULL AFTER monthly_rent;
