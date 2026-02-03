-- payment_requests: přejmenování payment_id na payments_id (entity_id konvence)
-- Odkaz na tabulku payments má být payments_id (entity_id platby).

ALTER TABLE payment_requests
    CHANGE COLUMN payment_id payments_id INT UNSIGNED NULL;
