-- payment_requests: období (period_year, period_month) pro nájemní požadavky a typ rent
-- UNIQUE zahrnuje valid_to, aby softUpdate (zavření starého řádku + INSERT nového) neporušil unique.
-- U nerent požadavků zůstávají period_* NULL (unique index v MySQL povoluje více řádků s NULL).

ALTER TABLE payment_requests
    ADD COLUMN period_year SMALLINT UNSIGNED NULL DEFAULT NULL AFTER due_date,
    ADD COLUMN period_month TINYINT UNSIGNED NULL DEFAULT NULL AFTER period_year;

ALTER TABLE payment_requests
    MODIFY COLUMN type ENUM('energy','settlement','other','deposit','deposit_return','rent') NOT NULL DEFAULT 'energy';

ALTER TABLE payment_requests
    ADD UNIQUE KEY idx_rent_contract_period (contracts_id, period_year, period_month, valid_to);
