-- Aktualizace čísla protiúčtu u plateb podle nájemníka (smlouvy)
-- Bednáříková, Mráček, Zich, Ondič Gejza – nastavení podle bankovního výpisu

UPDATE payments pay
JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
JOIN tenants t ON (t.tenants_id = c.tenants_id OR t.id = c.tenants_id) AND t.valid_to IS NULL
SET pay.counterpart_account = '1875883103/0800'
WHERE pay.valid_to IS NULL
  AND (t.name LIKE '%Bedna%' AND t.name LIKE '%Edita%');

UPDATE payments pay
JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
JOIN tenants t ON (t.tenants_id = c.tenants_id OR t.id = c.tenants_id) AND t.valid_to IS NULL
SET pay.counterpart_account = '1272973003/5500'
WHERE pay.valid_to IS NULL
  AND (t.name LIKE '%Mráček%' OR t.name LIKE '%Mracek%');

UPDATE payments pay
JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
JOIN tenants t ON (t.tenants_id = c.tenants_id OR t.id = c.tenants_id) AND t.valid_to IS NULL
SET pay.counterpart_account = '240287426/0600'
WHERE pay.valid_to IS NULL
  AND t.name LIKE '%Zich%';

UPDATE payments pay
JOIN contracts c ON c.contracts_id = pay.contracts_id AND c.valid_to IS NULL
JOIN tenants t ON (t.tenants_id = c.tenants_id OR t.id = c.tenants_id) AND t.valid_to IS NULL
SET pay.counterpart_account = '5586679083/0800'
WHERE pay.valid_to IS NULL
  AND (t.name LIKE '%Ondič%' AND t.name LIKE '%Gejza%');
