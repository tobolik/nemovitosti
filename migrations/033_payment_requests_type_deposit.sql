-- Požadované platby: typy Kauce (zaplacení) a Vrácení kauce

ALTER TABLE payment_requests
    MODIFY COLUMN type ENUM('energy','settlement','other','deposit','deposit_return') NOT NULL DEFAULT 'energy';
