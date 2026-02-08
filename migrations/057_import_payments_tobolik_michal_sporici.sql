-- Servisní import plateb: Tobolík Michal → spořicí účet (entity id=2)
-- Platby 5 700 Kč/měsíc na Honza - Spořicí účet (2700043553), období 1/2013–2/2014.
-- Idempotentní přes NOT EXISTS.

SET @contracts_id := (
  SELECT COALESCE(c.contracts_id, c.id)
  FROM contracts c
  JOIN tenants t
    ON t.valid_to IS NULL
   AND (t.tenants_id = c.tenants_id OR t.id = c.tenants_id)
  WHERE c.valid_to IS NULL
    AND (t.name LIKE '%Tobolík%' OR t.name LIKE '%Tobolik%')
    AND t.name LIKE '%Michal%'
  ORDER BY c.contract_start DESC, c.id DESC
  LIMIT 1
);

-- Spořicí účet: entity id = 2 (bank_accounts_id = 2)
SET @ba_id := 2;

INSERT INTO payments
  (payments_id, contracts_id, period_year, period_month, amount, currency, payment_date, note, counterpart_account, payment_method, bank_accounts_id, payment_type)
SELECT
  NULL,
  @contracts_id,
  d.period_year,
  d.period_month,
  d.amount,
  'CZK',
  d.payment_date,
  d.note,
  '43-4179620207/0100',
  'account',
  @ba_id,
  'rent'
FROM (
  SELECT 2013 AS period_year,  1 AS period_month, 5700.00 AS amount, DATE('2013-01-16') AS payment_date, 'TOBOLÍK MICHAL' AS note UNION ALL
  SELECT 2013,  2, 5700.00, DATE('2013-02-17'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  3, 5700.00, DATE('2013-03-17'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  4, 5700.00, DATE('2013-04-16'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  5, 5700.00, DATE('2013-05-17'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  6, 5700.00, DATE('2013-06-17'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  7, 5700.00, DATE('2013-07-16'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  8, 5700.00, DATE('2013-08-16'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013,  9, 5700.00, DATE('2013-09-17'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013, 10, 5700.00, DATE('2013-10-16'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013, 11, 5700.00, DATE('2013-11-15'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2013, 12, 5700.00, DATE('2013-12-16'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2014,  1, 5700.00, DATE('2014-01-17'), 'TOBOLÍK MICHAL' UNION ALL
  SELECT 2014,  2, 5700.00, DATE('2014-02-18'), 'TOBOLÍK MICHAL'
) d
WHERE @contracts_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM payments p
    WHERE p.contracts_id = @contracts_id
      AND p.valid_to IS NULL
      AND p.period_year = d.period_year
      AND p.period_month = d.period_month
      AND p.payment_date = d.payment_date
      AND p.amount = d.amount
  );

UPDATE payments
SET payments_id = id
WHERE payments_id IS NULL
  AND contracts_id = @contracts_id
  AND payment_date BETWEEN '2013-01-16' AND '2014-02-18';
