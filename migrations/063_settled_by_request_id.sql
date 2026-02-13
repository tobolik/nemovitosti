-- Migration 063: Add settled_by_request_id column to payment_requests
-- Marks energy advances that have been covered by a settlement (vyúčtování energií).
-- These remain visible for historical context but are excluded from Expected calculations.

ALTER TABLE payment_requests ADD COLUMN settled_by_request_id INT DEFAULT NULL AFTER payments_id;

-- Back-populate: for each contract that has a settlement request,
-- mark unpaid energy advances CREATED BEFORE the settlement as settled.
-- Only advances with payment_requests_id < settlement entity_id are covered;
-- advances created after the settlement (higher entity_id) are new obligations.
UPDATE payment_requests pr
JOIN (
  SELECT contracts_id, MIN(payment_requests_id) AS settlement_pr_id
  FROM payment_requests
  WHERE type = 'settlement' AND valid_to IS NULL
  GROUP BY contracts_id
) s ON pr.contracts_id = s.contracts_id
SET pr.settled_by_request_id = s.settlement_pr_id
WHERE pr.type = 'energy'
  AND pr.paid_at IS NULL
  AND pr.valid_to IS NULL
  AND pr.payment_requests_id < s.settlement_pr_id;
