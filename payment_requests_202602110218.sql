INSERT INTO railway.payment_requests (payment_requests_id,contracts_id,amount,`type`,note,due_date,period_year,period_month,paid_at,payments_id,settled_by_request_id,valid_from,valid_to,valid_user_from,valid_user_to) VALUES
	 (64,44,18000.00,'deposit',NULL,'2020-09-15',2020,9,'2020-09-15',462,NULL,'2026-02-08 16:08:35',NULL,1,NULL),
	 (67,44,600.00,'energy','záloha','2020-10-30',2020,10,'2020-11-11',466,NULL,'2026-02-08 16:25:01',NULL,1,NULL),
	 (68,44,600.00,'energy','záloha','2020-11-30',2020,11,'2020-11-11',466,NULL,'2026-02-08 16:25:01',NULL,1,NULL),
	 (66,44,300.00,'energy','záloha','2020-09-30',2020,9,NULL,NULL,555,'2026-02-10 12:27:58',NULL,1,1),
	 (71,44,600.00,'energy','záloha','2020-12-31',2020,12,NULL,NULL,555,'2026-02-10 12:27:58',NULL,1,1),
	 (69,44,300.00,'energy','záloha','2021-01-07',2021,1,NULL,NULL,555,'2026-02-10 12:27:58',NULL,1,1),
	 (314,44,9000.00,'rent',NULL,'2020-10-31',2020,10,'2020-09-30',464,NULL,'2026-02-10 13:30:25',NULL,1,NULL),
	 (315,44,9000.00,'rent',NULL,'2020-11-30',2020,11,'2020-11-02',465,NULL,'2026-02-10 13:30:25',NULL,1,NULL),
	 (313,44,4500.00,'rent',NULL,'2020-09-30',2020,9,'2020-09-15',463,NULL,'2026-02-10 14:03:41',NULL,1,NULL),
	 (316,44,9000.00,'rent',NULL,'2020-12-31',2020,12,'2026-02-10',462,NULL,'2026-02-10 14:07:57',NULL,1,NULL);
INSERT INTO railway.payment_requests (payment_requests_id,contracts_id,amount,`type`,note,due_date,period_year,period_month,paid_at,payments_id,settled_by_request_id,valid_from,valid_to,valid_user_from,valid_user_to) VALUES
	 (317,44,4500.00,'rent',NULL,'2021-01-31',2021,1,'2026-02-10',462,NULL,'2026-02-10 14:07:57',NULL,1,NULL),
	 (555,44,500.00,'settlement','Vyúčtování energií: nedoplatek (skutečnost 1 700 – zálohy 1 200)','2021-01-24',2021,1,'2026-02-10',462,NULL,'2026-02-10 14:07:57',NULL,1,NULL),
	 (551,44,-4000.00,'deposit_return','Vrácení kauce (po zúčtování: 18 000 – pokryto 14 000)','2021-01-24',2021,1,'2021-01-24',476,NULL,'2026-02-10 19:29:48',NULL,1,NULL),
	 (565,44,649.00,'energy',NULL,'2021-01-01',2021,1,NULL,NULL,NULL,'2026-02-10 21:53:25',NULL,1,NULL);
