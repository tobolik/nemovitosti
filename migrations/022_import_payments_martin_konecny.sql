-- Import plateb: Martin Konečný
-- Poznámky od uživatele:
-- - 18 000 Kč je kauce → patří do contracts.deposit_* (ne do payments)
-- - první nájem (duben 2025) je poměrně snížen, protože začátek smlouvy je od 18.4.2025
-- Migrace je idempotentní přes NOT EXISTS.

-- Najdi aktivní smlouvu pro nájemníka (nejnovější podle contract_start)
-- Match na obě části jména bez ohledu na pořadí / diakritiku (kolace utf8mb4_czech_ci).
SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (
        t.tenants_id = c.tenants_id
        OR t.id = c.tenants_id
       )
  WHERE c.valid_to IS NULL
    AND t.name LIKE '%Konečn%'
    AND t.name LIKE '%Martin%'
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

-- Kauce: 18 000 Kč, přijatá 23.4.2025
-- (pokud je smlouva nalezena; nenastavuj, pokud už je v DB vyplněno)
UPDATE contracts
SET deposit_amount = COALESCE(deposit_amount, 18000),
    deposit_paid_date = COALESCE(deposit_paid_date, '2025-04-23')
WHERE @contracts_id IS NOT NULL
  AND valid_to IS NULL
  AND (contracts_id = @contracts_id OR id = @contracts_id);

-- Nájemné/energie: platby
INSERT INTO payments
  (payments_id, contracts_id, period_year, period_month, amount, payment_date, note, payment_method)
SELECT
  NULL,
  @contracts_id,
  d.period_year,
  d.period_month,
  d.amount,
  d.payment_date,
  d.note,
  'account'
FROM (
  -- Duben 2025 (poměrné nájemné za část měsíce) – dvě příchozí platby
  SELECT 2025 AS period_year, 4 AS period_month, 4667.00 AS amount, DATE('2025-04-18') AS payment_date, 'Poměrné nájemné (od 18.4.2025) – platba 1' AS note UNION ALL
  SELECT 2025, 4, 1176.00, DATE('2025-04-18'), 'Poměrné nájemné (od 18.4.2025) – platba 2' UNION ALL

  -- Pravidelné měsíční platby 12 520 Kč
  SELECT 2025, 5, 12520.00, DATE('2025-05-16'), 'Nájemné + energie' UNION ALL
  SELECT 2025, 6, 12520.00, DATE('2025-06-17'), 'Nájemné + energie' UNION ALL
  SELECT 2025, 7, 12520.00, DATE('2025-07-21'), 'Nájemné + energie' UNION ALL
  SELECT 2025, 8, 12520.00, DATE('2025-08-25'), 'Nájemné + energie' UNION ALL
  SELECT 2025, 9, 12520.00, DATE('2025-09-30'), 'Nájemné + energie' UNION ALL
  SELECT 2025,10, 12520.00, DATE('2025-10-30'), 'Nájemné + energie' UNION ALL
  SELECT 2025,12, 12520.00, DATE('2025-12-17'), 'Nájemné + energie' UNION ALL
  SELECT 2026, 1, 12520.00, DATE('2026-01-29'), 'Nájemné + energie'
) d
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.contracts_id = @contracts_id
      AND p.period_year = d.period_year
      AND p.period_month = d.period_month
      AND p.payment_date = d.payment_date
      AND p.amount = d.amount
      AND (p.note <=> d.note)
  );

-- Doplnění entity_id pro vložené řádky (soft-update)
UPDATE payments
SET payments_id = id
WHERE payments_id IS NULL
  AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2025-04-18' AND '2026-01-29';

