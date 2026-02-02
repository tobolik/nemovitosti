-- Oprava: doplnit contract_rent_changes_id tam, kde je NULL (záznamy z přímého INSERT před opravou)
UPDATE contract_rent_changes SET contract_rent_changes_id = id WHERE contract_rent_changes_id IS NULL;
