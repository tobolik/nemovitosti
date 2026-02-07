/*
SQLyog Ultimate v12.09 (64 bit)
MySQL - 10.11.14-MariaDB-0+deb12u2-log 
*********************************************************************
*/
/*!40101 SET NAMES utf8 */;

create table `payment_imports` (
	`id` int (10),
	`bank_accounts_id` int (10),
	`payment_date` date ,
	`amount` Decimal (14),
	`counterpart_account` varchar (300),
	`note` text ,
	`fio_transaction_id` varchar (150),
	`contracts_id` int (10),
	`period_year` smallint (5),
	`period_month` tinyint (3),
	`period_year_to` smallint (5),
	`period_month_to` tinyint (3),
	`payment_type` varchar (60),
	`created_at` datetime 
); 
insert into `payment_imports` (`id`, `bank_accounts_id`, `payment_date`, `amount`, `counterpart_account`, `note`, `fio_transaction_id`, `contracts_id`, `period_year`, `period_month`, `period_year_to`, `period_month_to`, `payment_type`, `created_at`) values('1','1','0000-00-00','36000.00','7887654321/2010','nájem garáž Jaselská 12 za rok 2026','27470306523',NULL,NULL,NULL,NULL,NULL,'rent','2026-02-07 19:27:25');
insert into `payment_imports` (`id`, `bank_accounts_id`, `payment_date`, `amount`, `counterpart_account`, `note`, `fio_transaction_id`, `contracts_id`, `period_year`, `period_month`, `period_year_to`, `period_month_to`, `payment_type`, `created_at`) values('2','1','0000-00-00','910.00','240287426/0600','Elektřina garáž','27470813850',NULL,NULL,NULL,NULL,NULL,'rent','2026-02-07 19:27:25');
insert into `payment_imports` (`id`, `bank_accounts_id`, `payment_date`, `amount`, `counterpart_account`, `note`, `fio_transaction_id`, `contracts_id`, `period_year`, `period_month`, `period_year_to`, `period_month_to`, `payment_type`, `created_at`) values('3','1','0000-00-00','600.00','2700043553/2010',NULL,'27472544630',NULL,NULL,NULL,NULL,NULL,'rent','2026-02-07 19:27:25');
insert into `payment_imports` (`id`, `bank_accounts_id`, `payment_date`, `amount`, `counterpart_account`, `note`, `fio_transaction_id`, `contracts_id`, `period_year`, `period_month`, `period_year_to`, `period_month_to`, `payment_type`, `created_at`) values('4','1','0000-00-00','220000.00','2000071086/2010',NULL,'27475734715',NULL,NULL,NULL,NULL,NULL,'rent','2026-02-07 19:27:25');
insert into `payment_imports` (`id`, `bank_accounts_id`, `payment_date`, `amount`, `counterpart_account`, `note`, `fio_transaction_id`, `contracts_id`, `period_year`, `period_month`, `period_year_to`, `period_month_to`, `payment_type`, `created_at`) values('5','1','0000-00-00','30000.00','2700043553/2010','vrácení části financí na ucet BK (400 000)','27475734845',NULL,NULL,NULL,NULL,NULL,'rent','2026-02-07 19:27:25');
