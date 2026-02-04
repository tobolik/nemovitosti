-- ============================================================
-- PropManager – minimální demo data pro beta testování
-- Před použitím: 1) Aplikujte schema + migrace. 2) Nastavte heslo (viz níže).
-- ============================================================
-- Heslo pro oba účty: demo
-- Nastavení: php hash-password.php demo
-- Pak v DB: UPDATE users SET password_hash = '<vygenerovaný_hash>' WHERE email LIKE '%@propmanager.demo';
-- ============================================================

-- Uživatelé (po INSERT spusťte UPDATE users SET users_id = id WHERE users_id IS NULL)
INSERT INTO users (email, password_hash, name, role, valid_from, valid_to, valid_user_from, valid_user_to) VALUES
('admin@propmanager.demo', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo Admin', 'admin', NOW(), NULL, NULL, NULL),
('user@propmanager.demo', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Demo User', 'user', NOW(), NULL, NULL, NULL);
UPDATE users SET users_id = id WHERE users_id IS NULL;

-- Nemovitosti
INSERT INTO properties (name, address, type, valid_from, valid_to, valid_user_from, valid_user_to) VALUES
('Byt demo 1', 'Demo ulice 1, Praha', 'apartment', NOW(), NULL, 1, NULL),
('Garáž demo', 'Demo parkoviště 2', 'garage', NOW(), NULL, 1, NULL),
('Dům demo', 'Demo náměstí 3, Brno', 'house', NOW(), NULL, 1, NULL);
UPDATE properties SET properties_id = id WHERE properties_id IS NULL;

-- Nájemníci
INSERT INTO tenants (name, type, valid_from, valid_to, valid_user_from, valid_user_to) VALUES
('Jan Demo', 'person', NOW(), NULL, 1, NULL),
('Marie Demo', 'person', NOW(), NULL, 1, NULL),
('Firma Demo s.r.o.', 'company', NOW(), NULL, 1, NULL);
UPDATE tenants SET tenants_id = id WHERE tenants_id IS NULL;

-- Bankovní účet (pokud tabulka existuje z migrace 012+013)
INSERT INTO bank_accounts (name, account_number, is_primary, sort_order, valid_from, valid_to, valid_user_from, valid_user_to)
SELECT 'Demo účet', '1234567890/0800', 1, 0, NOW(), NULL, 1, NULL
FROM DUAL WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bank_accounts');
UPDATE bank_accounts SET bank_accounts_id = id WHERE bank_accounts_id IS NULL AND valid_to IS NULL;

-- Smlouvy (properties_id, tenants_id = entity_id z prvních řádků)
INSERT INTO contracts (contracts_id, properties_id, tenants_id, contract_start, monthly_rent, valid_from, valid_to, valid_user_from, valid_user_to) VALUES
(1, 1, 1, '2024-01-01', 15000.00, NOW(), NULL, 1, NULL),
(2, 2, 2, '2024-06-01', 2000.00, NOW(), NULL, 1, NULL);
UPDATE contracts SET contracts_id = id WHERE contracts_id IS NULL OR contracts_id = 0;

-- Platby (contracts_id = 1 a 2 = entity_id smluv)
INSERT INTO payments (payments_id, contracts_id, period_year, period_month, amount, payment_date, payment_type, valid_from, valid_to, valid_user_from, valid_user_to) VALUES
(1, 1, 2025, 1, 15000.00, '2025-01-15', 'rent', NOW(), NULL, 1, NULL),
(2, 1, 2025, 2, 15000.00, '2025-02-10', 'rent', NOW(), NULL, 1, NULL),
(3, 2, 2025, 1, 2000.00, '2025-01-20', 'rent', NOW(), NULL, 1, NULL);
UPDATE payments SET payments_id = id WHERE payments_id IS NULL OR payments_id = 0;

-- ============================================================
-- Přihlášení: admin@propmanager.demo / password  (nebo po úpravě hash: demo)
-- ============================================================
