-- Odhadní cena nemovitosti k datu (pro výpočet ROI – míra návratnosti)
ALTER TABLE properties
    ADD COLUMN valuation_date   DATE NULL AFTER purchase_contract_url,
    ADD COLUMN valuation_amount DECIMAL(12,2) NULL AFTER valuation_date;
