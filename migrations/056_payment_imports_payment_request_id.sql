-- Párování importu na konkrétní požadavek (energie, doplatek…) pro provázání platby a požadavku
ALTER TABLE payment_imports ADD COLUMN payment_request_id INT UNSIGNED NULL DEFAULT NULL COMMENT 'entity_id požadavku na platbu (pro úhradu energie, doplatku…)' AFTER payment_type;
