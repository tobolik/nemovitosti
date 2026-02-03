/*
SQLyog Ultimate v12.09 (64 bit)
MySQL - 10.11.14-MariaDB-0+deb12u2-log : Database - tobolikcz01
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
CREATE DATABASE /*!32312 IF NOT EXISTS*/`tobolikcz01` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_czech_ci */;

USE `tobolikcz01`;

/*Table structure for table `_migrations` */

DROP TABLE IF EXISTS `_migrations`;

CREATE TABLE `_migrations` (
  `name` varchar(255) NOT NULL,
  `applied_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `_migrations` */

insert  into `_migrations`(`name`,`applied_at`) values ('001_properties_extra.sql','2026-02-01 19:54:35'),('002_tenants_extra.sql','2026-02-01 19:54:35'),('003_logical_ids.sql','2026-02-01 19:54:35'),('004_logical_ids_data.sql','2026-02-01 19:54:35'),('005_indexes.sql','2026-02-01 19:54:35'),('006_valid_user.sql','2026-02-01 19:54:35'),('007_purchase_contract_url.sql','2026-02-01 19:54:35'),('008_contract_url.sql','2026-02-01 19:54:35'),('009_payments_contracts_id.sql','2026-02-01 19:54:35'),('010_property_type_order.sql','2026-02-01 20:04:23'),('011_payment_batch_and_method.sql','2026-02-01 20:52:27'),('012_bank_accounts.sql','2026-02-01 21:22:33'),('012_bank_accounts.sql.old','2026-02-01 21:09:14'),('013_bank_accounts_soft_update.sql','2026-02-01 21:22:33'),('014_contract_rent_changes.sql','2026-02-02 13:45:14'),('015_tenants_birth_date.sql','2026-02-02 14:12:04'),('016_contract_deposit.sql','2026-02-02 14:29:43'),('017_contracts_entity_id_refs.sql','2026-02-02 14:54:10'),('018_contract_rent_changes_soft_update.sql','2026-02-02 15:12:59'),('019_contract_rent_changes_id_fix.sql','2026-02-02 15:22:14'),('020_import_payments_bednarikova_edita.sql','2026-02-02 16:03:43'),('021_import_payments_bednarikova_edita_fix.sql','2026-02-02 16:13:27'),('022_import_payments_martin_konecny.sql','2026-02-02 16:37:12'),('022_payments_bank_accounts_id.sql','2026-02-02 17:37:15'),('023_import_payments_set_bank_account_1.sql','2026-02-02 16:49:12'),('023_payments_payment_type.sql','2026-02-02 16:54:02'),('024_collation_utf8mb4_czech_ci.sql','2026-02-02 17:06:06'),('025_import_payments_bank_account_1.sql','2026-02-02 17:24:40'),('026_import_payments_martin_konecny_account_2010.sql','2026-02-02 20:06:11'),('027_import_payments_richard_zamoravec.sql','2026-02-03 00:39:09'),('028_contracts_first_month_rent.sql','2026-02-03 00:39:09'),('029_payment_requests.sql','2026-02-03 00:39:09'),('030_import_payments_jiri_zich.sql','2026-02-03 00:39:09'),('031_import_payments_ondic_gejza.sql','2026-02-03 00:40:57'),('032_payment_requests_payments_id.sql','2026-02-03 03:02:30'),('033_payment_requests_type_deposit.sql','2026-02-03 11:40:33'),('034_payments_payment_type_deposit_return.sql','2026-02-03 12:34:01');

/*Table structure for table `bank_accounts` */

DROP TABLE IF EXISTS `bank_accounts`;

CREATE TABLE `bank_accounts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `bank_accounts_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(100) NOT NULL COMMENT 'Popis účtu např. Hlavní účet',
  `account_number` varchar(50) NOT NULL COMMENT 'Číslo účtu ve formátu 123456789/0800',
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order` smallint(5) unsigned NOT NULL DEFAULT 0,
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_primary` (`is_primary`),
  KEY `idx_sort` (`sort_order`),
  KEY `idx_bank_accounts_id` (`bank_accounts_id`,`valid_to`),
  KEY `idx_v` (`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `bank_accounts` */

insert  into `bank_accounts`(`id`,`bank_accounts_id`,`name`,`account_number`,`is_primary`,`sort_order`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'FIO běžný účet','7770101774/2010',0,0,'2026-02-01 21:24:03','2026-02-01 21:24:50',1,1),(2,2,'FIO spořicí účet','2700043553/2010',0,1,'2026-02-01 21:24:44',NULL,1,NULL),(3,1,'FIO běžný účet','7770101774/2010',1,0,'2026-02-01 21:24:50',NULL,1,NULL);

/*Table structure for table `contract_rent_changes` */

DROP TABLE IF EXISTS `contract_rent_changes`;

CREATE TABLE `contract_rent_changes` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `contract_rent_changes_id` int(10) unsigned DEFAULT NULL,
  `contracts_id` int(10) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `effective_from` date NOT NULL COMMENT 'Od kdy se platí nové nájemné (první den měsíce)',
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_contracts_effective` (`contracts_id`,`effective_from`),
  KEY `idx_contract_rent_changes_id` (`contract_rent_changes_id`,`valid_to`),
  KEY `idx_v` (`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `contract_rent_changes` */

insert  into `contract_rent_changes`(`id`,`contract_rent_changes_id`,`contracts_id`,`amount`,`effective_from`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,2,'10825.00','2024-06-01','2026-02-02 15:12:59',NULL,1,NULL),(2,2,2,'11325.00','2025-01-01','2026-02-02 15:16:48','2026-02-02 15:22:46',1,1),(3,2,2,'11326.00','2025-01-01','2026-02-02 15:22:46','2026-02-02 15:23:01',1,1),(4,2,2,'11325.00','2025-01-01','2026-02-02 15:23:01',NULL,1,NULL),(5,5,8,'13520.00','2026-05-01','2026-02-03 09:35:32',NULL,1,NULL);

/*Table structure for table `contracts` */

DROP TABLE IF EXISTS `contracts`;

CREATE TABLE `contracts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `contracts_id` int(10) unsigned DEFAULT NULL,
  `properties_id` int(10) unsigned NOT NULL,
  `tenants_id` int(10) unsigned NOT NULL,
  `contract_start` date NOT NULL,
  `contract_end` date DEFAULT NULL,
  `monthly_rent` decimal(12,2) NOT NULL,
  `first_month_rent` decimal(12,2) DEFAULT NULL,
  `contract_url` varchar(500) DEFAULT NULL,
  `deposit_amount` decimal(12,2) DEFAULT NULL,
  `deposit_paid_date` date DEFAULT NULL,
  `deposit_return_date` date DEFAULT NULL,
  `note` text DEFAULT NULL,
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_contracts_id` (`contracts_id`,`valid_to`),
  KEY `idx_properties_id` (`properties_id`,`valid_to`),
  KEY `idx_tenants_id` (`tenants_id`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `contracts` */

insert  into `contracts`(`id`,`contracts_id`,`properties_id`,`tenants_id`,`contract_start`,`contract_end`,`monthly_rent`,`first_month_rent`,`contract_url`,`deposit_amount`,`deposit_paid_date`,`deposit_return_date`,`note`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,1,1,'2025-01-01',NULL,'3000.00',NULL,NULL,NULL,NULL,NULL,'','2026-02-01 19:46:01','2026-02-02 14:26:15',1,1),(2,2,2,2,'2026-01-01',NULL,'10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 14:15:43','2026-02-02 14:22:26',1,1),(3,2,2,2,'2023-01-01',NULL,'10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 14:22:26','2026-02-02 15:14:39',1,1),(4,1,1,1,'2025-01-01',NULL,'3000.00',NULL,NULL,NULL,NULL,NULL,'','2026-02-02 14:26:15',NULL,1,NULL),(5,2,2,2,'2023-01-01',NULL,'10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link','16000.00','2022-12-30','2025-04-25','','2026-02-02 15:14:39','2026-02-02 15:16:20',1,1),(6,2,2,2,'2023-01-01','2025-03-31','10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link','16000.00','2022-12-30','2025-04-25','','2026-02-02 15:16:20','2026-02-02 15:16:50',1,1),(7,2,2,2,'2023-01-01','2025-03-31','10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link','16000.00','2022-12-30','2025-04-25','','2026-02-02 15:16:50','2026-02-03 11:47:52',1,1),(8,8,2,4,'2025-04-18',NULL,'12529.00',NULL,NULL,'18000.00','2025-04-23',NULL,'','2026-02-02 19:21:45','2026-02-02 19:22:49',1,1),(9,8,2,4,'2025-04-18',NULL,'12520.00',NULL,NULL,'18000.00','2025-04-23',NULL,'','2026-02-02 19:22:49','2026-02-02 23:08:05',1,1),(10,10,3,6,'2025-07-15',NULL,'2200.00',NULL,'https://drive.google.com/file/d/1Ns9kTZCDRdjdUyU3Xu0OcrxIng8vGcwu/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 22:36:05','2026-02-02 23:02:54',1,1),(11,10,3,6,'2025-07-15',NULL,'2200.00','1100.00','https://drive.google.com/file/d/1Ns9kTZCDRdjdUyU3Xu0OcrxIng8vGcwu/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 23:02:54',NULL,1,NULL),(12,8,2,4,'2025-04-17',NULL,'12520.00','5843.00','https://drive.google.com/file/d/1zfUIO_Uee0jKAMZdVAOfunFLENdxVxmm/view?usp=drive_link','18000.00','2025-04-23',NULL,'','2026-02-02 23:08:05','2026-02-02 23:16:18',1,1),(13,8,2,4,'2025-04-16',NULL,'12520.00','5843.00','https://drive.google.com/file/d/1zfUIO_Uee0jKAMZdVAOfunFLENdxVxmm/view?usp=drive_link','18000.00','2025-04-23',NULL,'','2026-02-02 23:16:18','2026-02-03 01:21:59',1,1),(14,14,4,9,'2025-11-21',NULL,'2200.00','700.00','https://drive.google.com/file/d/1kgAE7Wa8gmNJ5NZh0ngtdIirrXxH1CO7/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 23:47:10',NULL,1,NULL),(15,15,5,11,'2024-05-01',NULL,'2000.00',NULL,NULL,NULL,NULL,NULL,'nemám zatím podepsanou smlouvu k dispozici, jen formulář s jeho údaji v https://docs.google.com/document/d/11-o-8mqefnzh_FiuziblkCmoQjv_rCjFHb8Wn0oIF_Q/edit?tab=t.0','2026-02-03 00:10:16',NULL,1,NULL),(16,16,7,14,'2026-01-01',NULL,'2200.00',NULL,'https://drive.google.com/file/d/1vJcSbRid04CYcAgJVRt6Bj6kwleG1pm7/view?usp=drive_link',NULL,NULL,NULL,'Ateliér DUA, s.r.o.\nSídlo: Šaldova 408/30, 186 00 Praha 8 – Karlín\nIČO: 47123486\nZapsaná u Městského soudu v Praze, oddíl C, vložka 12787\nDatová schránka: xy4u69e\nZastoupená: Petrem Zajícem, jednatelem\nE-mail: zajic@dua.cz\nTelefon: 724 742 076','2026-02-03 00:29:05',NULL,1,NULL),(17,17,6,15,'2025-08-06',NULL,'2200.00','2200.00','https://drive.google.com/file/d/1726I5H8naCZ6ssmMIfxQbrzNr06RRVv3/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-03 00:38:34',NULL,1,NULL),(18,8,2,4,'2025-04-16',NULL,'12520.00','5843.00','https://drive.google.com/file/d/1zfUIO_Uee0jKAMZdVAOfunFLENdxVxmm/view?usp=drive_link','18000.00','2025-04-23',NULL,'','2026-02-03 01:21:59','2026-02-03 09:35:57',1,1),(19,19,7,1,'2025-10-01','2025-12-31','2800.00',NULL,NULL,NULL,NULL,NULL,'','2026-02-03 09:25:17',NULL,1,NULL),(20,8,2,4,'2025-04-16',NULL,'12520.00','5843.00','https://drive.google.com/file/d/1zfUIO_Uee0jKAMZdVAOfunFLENdxVxmm/view?usp=drive_link','18000.00','2025-04-23',NULL,'','2026-02-03 09:35:57',NULL,1,NULL),(21,2,2,2,'2023-01-01','2025-03-31','10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link','16000.00','2022-12-30',NULL,'','2026-02-03 11:47:52','2026-02-03 11:48:07',1,1),(22,2,2,2,'2023-01-01','2025-03-31','10175.00',NULL,'https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link','16000.00','2022-12-30','2025-04-25','','2026-02-03 11:48:07',NULL,1,NULL);

/*Table structure for table `payment_requests` */

DROP TABLE IF EXISTS `payment_requests`;

CREATE TABLE `payment_requests` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `payment_requests_id` int(10) unsigned DEFAULT NULL,
  `contracts_id` int(10) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `type` enum('energy','settlement','other','deposit','deposit_return') NOT NULL DEFAULT 'energy',
  `note` text DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `paid_at` date DEFAULT NULL,
  `payments_id` int(10) unsigned DEFAULT NULL,
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_payment_requests_id` (`payment_requests_id`,`valid_to`),
  KEY `idx_contracts_id` (`contracts_id`,`valid_to`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_paid` (`paid_at`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `payment_requests` */

insert  into `payment_requests`(`id`,`payment_requests_id`,`contracts_id`,`amount`,`type`,`note`,`due_date`,`paid_at`,`payments_id`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,16,'3300.00','energy','Fond oprav a energie','2026-01-06',NULL,178,'2026-02-03 02:03:45','2026-02-03 03:03:21',1,1),(2,1,16,'3300.00','energy','Fond oprav a energie','2026-01-06','2026-01-06',179,'2026-02-03 03:03:21',NULL,1,NULL),(3,3,15,'906.96','energy','Elektřina 2025','2026-02-20',NULL,NULL,'2026-02-03 03:16:11','2026-02-03 13:50:33',1,1),(4,4,2,'3225.00','energy','Vyúčtování 2023','2024-04-20',NULL,NULL,'2026-02-03 11:25:23','2026-02-03 11:27:00',1,1),(5,4,2,'3225.00','energy','Vyúčtování 2023','2024-04-20','2024-04-12',184,'2026-02-03 11:27:00',NULL,1,NULL),(6,6,2,'16000.00','deposit_return','Vrácení kauce','2025-04-30','2025-04-20',90,'2026-02-03 11:47:52','2026-02-03 13:25:15',1,1),(7,6,2,'-16000.00','deposit_return','Vrácení kauce','2025-04-30','2025-04-20',90,'2026-02-03 13:25:14',NULL,1,NULL),(8,3,15,'906.96','energy','Elektřina 2025','2026-02-20','2026-02-20',186,'2026-02-03 13:50:33',NULL,1,NULL),(9,9,2,'16000.00','deposit','kauce','2022-12-31','2022-12-31',91,'2026-02-03 15:08:58',NULL,1,NULL),(10,10,8,'18000.00','deposit','Kauce','2025-04-30',NULL,NULL,'2026-02-03 15:27:31','2026-02-03 15:28:20',1,1),(11,10,8,'18000.00','deposit','Kauce','2025-04-30','2025-04-23',94,'2026-02-03 15:28:20',NULL,1,NULL);

/*Table structure for table `payments` */

DROP TABLE IF EXISTS `payments`;

CREATE TABLE `payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `payments_id` int(10) unsigned DEFAULT NULL,
  `contracts_id` int(10) unsigned NOT NULL,
  `period_year` smallint(5) unsigned NOT NULL,
  `period_month` tinyint(3) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date NOT NULL,
  `note` text DEFAULT NULL,
  `payment_batch_id` varchar(36) DEFAULT NULL,
  `payment_method` enum('account','cash') DEFAULT NULL,
  `bank_accounts_id` int(10) unsigned DEFAULT NULL,
  `payment_type` enum('rent','deposit','deposit_return','energy','other') NOT NULL DEFAULT 'rent',
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_c` (`contracts_id`,`valid_to`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_payments_id` (`payments_id`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=188 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `payments` */

insert  into `payments`(`id`,`payments_id`,`contracts_id`,`period_year`,`period_month`,`amount`,`payment_date`,`note`,`payment_batch_id`,`payment_method`,`bank_accounts_id`,`payment_type`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,1,2026,1,'36000.00','2026-12-23',NULL,NULL,'account',NULL,'rent','2026-02-01 21:33:42','2026-02-01 21:48:06',1,1),(2,2,1,2026,1,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(3,3,1,2026,2,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(4,4,1,2026,3,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(5,5,1,2026,4,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(6,6,1,2026,5,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(7,7,1,2026,6,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(8,8,1,2026,7,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(9,9,1,2026,8,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(10,10,1,2026,9,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(11,11,1,2026,10,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(12,12,1,2026,11,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(13,13,1,2026,12,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:38:38','2026-02-01 21:55:52',1,1),(14,13,1,2026,12,'3000.00','2025-02-01','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 21:55:52','2026-02-01 22:03:55',1,1),(15,15,1,2026,11,'3000.00','2025-12-23',NULL,NULL,'account',NULL,'rent','2026-02-01 21:58:50','2026-02-01 22:03:28',1,1),(16,2,1,2026,1,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(17,3,1,2026,2,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(18,4,1,2026,3,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(19,5,1,2026,4,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(20,6,1,2026,5,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(21,7,1,2026,6,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(22,8,1,2026,7,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(23,9,1,2026,8,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(24,10,1,2026,9,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:17:09',1,1),(25,11,1,2026,10,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:10:38',1,1),(26,12,1,2026,11,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:10:14',1,1),(27,13,1,2026,12,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account',NULL,'rent','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(28,28,1,2025,1,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(29,29,1,2025,2,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(30,30,1,2025,3,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(31,31,1,2025,4,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(32,32,1,2025,5,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(33,33,1,2025,6,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(34,34,1,2025,7,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(35,35,1,2025,8,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(36,36,1,2025,9,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(37,37,1,2025,10,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(38,38,1,2025,11,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(39,39,1,2025,12,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account',1,'rent','2026-02-01 22:09:41',NULL,1,NULL),(40,40,1,2026,5,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:25:56','2026-02-01 22:52:03',1,1),(41,41,1,2026,6,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:28:18','2026-02-01 22:51:52',1,1),(42,42,1,2026,2,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:31:51','2026-02-01 22:37:15',1,1),(43,43,1,2026,1,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:37:57','2026-02-01 22:55:04',1,1),(44,44,1,2026,2,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:38:05','2026-02-01 22:52:11',1,1),(45,45,1,2026,2,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:52:22','2026-02-01 22:54:59',1,1),(46,46,1,2026,3,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:52:29','2026-02-01 22:54:22',1,1),(47,47,1,2026,5,'3000.00','2026-02-01',NULL,NULL,'account',NULL,'rent','2026-02-01 22:54:04','2026-02-01 22:54:49',1,1),(48,48,1,2026,1,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(49,49,1,2026,2,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(50,50,1,2026,3,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(51,51,1,2026,4,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(52,52,1,2026,5,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(53,53,1,2026,6,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(54,54,1,2026,7,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(55,55,1,2026,8,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(56,56,1,2026,9,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(57,57,1,2026,10,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(58,58,1,2026,11,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(59,59,1,2026,12,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-02 07:52:39','2026-02-03 00:46:16',1,1),(60,60,2,2023,1,'10175.00','2022-12-31',NULL,NULL,'account',1,'rent','2026-02-02 14:23:42',NULL,1,NULL),(61,61,2,2023,2,'10175.00','2023-02-01',NULL,NULL,'account',1,'rent','2026-02-02 14:24:03',NULL,1,NULL),(62,62,2,2023,3,'10175.00','2023-03-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(63,63,2,2023,4,'10175.00','2023-04-03',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(64,64,2,2023,5,'10175.00','2023-05-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(65,65,2,2023,6,'10175.00','2023-06-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(66,66,2,2023,7,'10175.00','2023-07-03',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(67,67,2,2023,8,'10175.00','2023-08-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(68,68,2,2023,9,'10175.00','2023-09-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(69,69,2,2023,10,'10175.00','2023-10-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(70,70,2,2023,11,'10175.00','2023-11-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(71,71,2,2023,12,'10175.00','2023-12-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(72,72,2,2024,1,'10175.00','2024-01-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(73,73,2,2024,2,'10175.00','2024-02-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(74,74,2,2024,3,'10175.00','2024-03-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(75,75,2,2024,4,'10175.00','2024-04-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(76,76,2,2024,4,'3225.00','2024-04-12','Okamžitá příchozí platba',NULL,'account',1,'energy','2026-02-02 16:13:27','2026-02-03 11:26:55',NULL,1),(77,77,2,2024,5,'10175.00','2024-05-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(78,78,2,2024,6,'10175.00','2024-06-03',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(79,79,2,2024,6,'650.00','2024-06-03','Okamžitá příchozí platba',NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(80,80,2,2024,7,'10825.00','2024-07-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(81,81,2,2024,8,'10825.00','2024-08-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(82,82,2,2024,9,'10825.00','2024-09-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(83,83,2,2024,10,'10825.00','2024-10-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(84,84,2,2024,11,'10825.00','2024-11-01',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(85,85,2,2024,12,'10825.00','2024-12-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(86,86,2,2025,1,'10825.00','2025-01-02',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(87,87,2,2025,1,'500.00','2025-01-02','Okamžitá příchozí platba',NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(88,88,2,2025,2,'11325.00','2025-02-03',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(89,89,2,2025,3,'11325.00','2025-03-03',NULL,NULL,'account',1,'rent','2026-02-02 16:13:27',NULL,NULL,NULL),(90,90,2,2025,4,'-16000.00','2025-04-25','Odchozí platba na 1875883103/0800',NULL,'account',1,'deposit','2026-02-02 16:13:27','2026-02-03 12:00:52',NULL,1),(91,91,2,2023,1,'16000.00','2025-04-25','Kauce',NULL,'account',1,'deposit','2026-02-02 16:13:27','2026-02-03 15:08:09',1,1),(92,92,8,2025,4,'4667.00','2025-04-18','Poměrné nájemné (od 18.4.2025) – platba 1',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(93,93,8,2025,4,'1176.00','2025-04-18','Poměrné nájemné (od 18.4.2025) – platba 2',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(94,94,8,2025,4,'18000.00','2025-04-23','Kauce',NULL,'account',1,'deposit','2026-02-02 20:13:19',NULL,NULL,NULL),(95,95,8,2025,5,'12520.00','2025-05-16','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(96,96,8,2025,6,'12520.00','2025-06-17','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(97,97,8,2025,7,'12520.00','2025-07-21','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(98,98,8,2025,8,'12520.00','2025-08-25','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(99,99,8,2025,9,'12520.00','2025-09-30','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(100,100,8,2025,10,'12520.00','2025-10-30','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(101,101,8,2025,12,'12520.00','2025-12-17','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(102,102,8,2026,1,'12520.00','2026-01-29','Nájemné + energie',NULL,'account',1,'rent','2026-02-02 20:13:19',NULL,NULL,NULL),(103,103,10,2026,1,'2200.00','2026-01-30','Nájem garáže – Zámoravcová Renata',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(104,104,10,2025,12,'2200.00','2025-12-19','Pronájem garáže, Richard Zámoravec',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(105,105,10,2025,11,'2200.00','2025-11-28','Nájem garáže',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(106,106,10,2025,10,'2200.00','2025-10-18','Nájem garáže',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(107,107,10,2025,9,'2200.00','2025-09-13','Nájem garáže',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(108,108,10,2025,8,'2200.00','2025-08-14','Nájem za srpen',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(109,109,10,2025,7,'1100.00','2025-07-25','Nájem garáže',NULL,'account',1,'rent','2026-02-02 22:43:22',NULL,NULL,NULL),(110,110,14,2025,11,'700.00','2025-11-21',NULL,NULL,'cash',NULL,'rent','2026-02-02 23:47:49',NULL,1,NULL),(111,111,14,2025,12,'2200.00','2025-11-21',NULL,NULL,'cash',NULL,'rent','2026-02-02 23:48:00',NULL,1,NULL),(112,112,14,2026,1,'2200.00','2026-01-18',NULL,NULL,'cash',NULL,'rent','2026-02-02 23:48:23',NULL,1,NULL),(113,113,15,2026,1,'2000.00','2026-01-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(114,114,15,2025,12,'2000.00','2025-12-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(115,115,15,2025,11,'2000.00','2025-11-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(116,116,15,2025,10,'2000.00','2025-10-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(117,117,15,2025,9,'2000.00','2025-09-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(118,118,15,2025,8,'2000.00','2025-08-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(119,119,15,2025,7,'2000.00','2025-07-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(120,120,15,2025,6,'2000.00','2025-06-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(121,121,15,2025,5,'2000.00','2025-05-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(122,122,15,2025,4,'2000.00','2025-04-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(123,123,15,2025,3,'2000.00','2025-03-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(124,124,15,2025,2,'2000.00','2025-02-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(125,125,15,2025,1,'2000.00','2025-01-24','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(126,126,15,2024,12,'2000.00','2024-12-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(127,127,15,2024,11,'2000.00','2024-11-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(128,128,15,2024,10,'2000.00','2024-10-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(129,129,15,2024,9,'2000.00','2024-09-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(130,130,15,2024,8,'2000.00','2024-08-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(131,131,15,2024,7,'2000.00','2024-07-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(132,132,15,2024,6,'2000.00','2024-06-21','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(133,133,15,2024,5,'2000.00','2024-05-22','ZICH JIŘÍ',NULL,'account',1,'rent','2026-02-03 00:16:21',NULL,NULL,NULL),(134,134,16,2026,1,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(135,135,16,2026,2,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(136,136,16,2026,3,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(137,137,16,2026,4,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(138,138,16,2026,5,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(139,139,16,2026,6,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(140,140,16,2026,7,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(141,141,16,2026,8,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(142,142,16,2026,9,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(143,143,16,2026,10,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(144,144,16,2026,11,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(145,145,16,2026,12,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'rent','2026-02-03 00:33:24',NULL,1,NULL),(146,146,17,2026,1,'2200.00','2026-01-07','Pronájem garáže – Ondič Gejza',NULL,'account',1,'rent','2026-02-03 00:44:02',NULL,NULL,NULL),(147,147,17,2025,12,'2200.00','2025-12-07','Pronájem garáže – Ondič Gejza',NULL,'account',1,'rent','2026-02-03 00:44:02',NULL,NULL,NULL),(148,148,17,2025,11,'2200.00','2025-11-11','Pronájem garáže – Ondič Gejza',NULL,'account',1,'rent','2026-02-03 00:44:02',NULL,NULL,NULL),(149,149,17,2025,10,'2200.00','2025-10-06','Pronájem garáže – Ondič Gejza',NULL,'account',1,'rent','2026-02-03 00:44:02',NULL,NULL,NULL),(150,150,17,2025,9,'2200.00','2025-09-05','Pronájem garáže – Ondič Gejza',NULL,'account',1,'rent','2026-02-03 00:44:02',NULL,NULL,NULL),(151,151,17,2025,8,'2200.00','2025-08-06','Pronájem garáže – Ondič Gejza',NULL,'account',1,'rent','2026-02-03 00:44:02',NULL,NULL,NULL),(152,48,1,2026,1,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(153,49,1,2026,2,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(154,50,1,2026,3,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(155,51,1,2026,4,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(156,52,1,2026,5,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(157,53,1,2026,6,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(158,54,1,2026,7,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(159,55,1,2026,8,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(160,56,1,2026,9,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(161,57,1,2026,10,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(162,58,1,2026,11,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(163,59,1,2026,12,'3000.00','2026-02-03',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account',1,'rent','2026-02-03 00:46:16',NULL,1,NULL),(164,134,16,2026,1,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:54',1,1),(165,135,16,2026,2,'3000.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:55',1,1),(166,136,16,2026,3,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:55',1,1),(167,137,16,2026,4,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:56',1,1),(168,138,16,2026,5,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:56',1,1),(169,139,16,2026,6,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:56',1,1),(170,140,16,2026,7,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:57',1,1),(171,141,16,2026,8,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:57',1,1),(172,142,16,2026,9,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:57',1,1),(173,143,16,2026,10,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:57',1,1),(174,144,16,2026,11,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:59',1,1),(175,145,16,2026,12,'2200.00','2026-01-10',NULL,'637f49a2405a15882e3ca0fec3f36e25','account',1,'energy','2026-02-03 02:04:13','2026-02-03 02:14:59',1,1),(176,176,16,2026,2,'3300.00','2026-01-06',NULL,NULL,'account',1,'energy','2026-02-03 02:16:59','2026-02-03 02:37:43',1,1),(177,177,16,2026,1,'3300.00','2026-01-06',NULL,NULL,'account',1,'energy','2026-02-03 02:38:32','2026-02-03 02:38:42',1,1),(178,178,16,2026,2,'3300.00','2026-01-06',NULL,NULL,'account',1,'energy','2026-02-03 02:43:16','2026-02-03 03:03:55',1,1),(179,179,16,2026,1,'3300.00','2026-01-06',NULL,NULL,'account',1,'energy','2026-02-03 03:03:21',NULL,1,NULL),(180,180,14,2026,2,'2200.00','2026-02-03',NULL,NULL,'account',1,'rent','2026-02-03 03:14:31','2026-02-03 03:14:45',1,1),(181,181,19,2025,10,'2800.00','2025-12-23',NULL,'ca9016fea7a39ff51fdb49d9497af0cb','account',1,'rent','2026-02-03 09:25:54',NULL,1,NULL),(182,182,19,2025,11,'2800.00','2025-12-23',NULL,'ca9016fea7a39ff51fdb49d9497af0cb','account',1,'rent','2026-02-03 09:25:54',NULL,1,NULL),(183,183,19,2025,12,'2800.00','2025-12-23',NULL,'ca9016fea7a39ff51fdb49d9497af0cb','account',1,'rent','2026-02-03 09:25:54',NULL,1,NULL),(184,184,2,2024,4,'3225.00','2024-04-12',NULL,NULL,'account',1,'energy','2026-02-03 11:27:00',NULL,1,NULL),(185,90,2,2025,4,'-16000.00','2025-04-25','Odchozí platba na 1875883103/0800',NULL,'account',1,'deposit','2026-02-03 12:00:52',NULL,1,NULL),(186,186,15,2026,2,'906.96','2026-02-20',NULL,NULL,'account',1,'energy','2026-02-03 13:50:33',NULL,1,NULL),(187,91,2,2023,1,'16000.00','2022-12-31','Kauce',NULL,'account',1,'deposit','2026-02-03 15:08:08',NULL,1,NULL);

/*Table structure for table `properties` */

DROP TABLE IF EXISTS `properties`;

CREATE TABLE `properties` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `properties_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `address` text NOT NULL,
  `size_m2` decimal(10,2) DEFAULT NULL,
  `purchase_price` decimal(12,2) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `purchase_contract_url` varchar(500) DEFAULT NULL,
  `type` enum('apartment','garage','house','commercial','land') NOT NULL DEFAULT 'apartment',
  `note` text DEFAULT NULL,
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_properties_id` (`properties_id`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `properties` */

insert  into `properties`(`id`,`properties_id`,`name`,`address`,`size_m2`,`purchase_price`,`purchase_date`,`purchase_contract_url`,`type`,`note`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'Garáž Jaselská 12','3215/12, Jaselská, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko','18.58','360000.00','2020-04-20','https://drive.google.com/file/d/1yfypIpfkKyqhIXijWt7y2TIagxrRgtRQ/view?usp=drive_link','garage','Cena 240 000 Kč, zbytek v hotovosti bokem','2026-02-01 19:44:10',NULL,1,NULL),(2,2,'Byt Interbrigadistů','590/6, Interbrigadistů, Šířava, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko','54.00','549000.00','2004-10-26','https://drive.google.com/file/d/1VBB7lwrUwP8Dw_p40y7eUku0pgoldP0O/view?usp=drive_link','apartment','','2026-02-02 11:33:45',NULL,1,NULL),(3,3,'Garáž Na Hrázi 65 (Skopalova)','Na Hrázi 65, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 00, Česko','18.00','240000.00','2020-08-31','https://drive.google.com/file/d/1V2E8pXo3KUb8x_rhvQxco4h9Sk_NQJ1N/view?usp=drive_link','garage','','2026-02-02 21:53:09',NULL,1,NULL),(4,4,'Garáž Na Hrázi 140 (za firmou)','Na Hrázi 140, 750 00, Česko','18.00','450000.00','2022-08-29','https://drive.google.com/file/d/1aSwgMoS8E1ZguFax--LLg0Ah804WF7CQ/view?usp=drive_link','garage','','2026-02-02 23:43:29',NULL,1,NULL),(5,5,'Garáž Nábř. Dr. E. Beneše','nábř. Dr. Edvarda Beneše 27, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 00, Česko','21.00','305000.00','2024-03-11','https://drive.google.com/file/d/1wbDOT8vPgzDQIe-eLLmvqWBQ-_sRmn0v/view?usp=drive_link','garage','','2026-02-02 23:56:22',NULL,1,NULL),(6,6,'Garáž Na Hrázi 3146 (SBD)','3146, Na Hrázi, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko','18.00','470000.00','2025-07-17','https://drive.google.com/file/d/1od6kAEwWQqblHV9IMVecJsI1XefGC9ZC/view?usp=drive_link','garage','Družstevní vlastnictví','2026-02-03 00:20:35',NULL,1,NULL),(7,7,'Garáž Gen. Rakovčíka','Gen. Rakovčíka 3044, Jižní čtvrť, Přerov-historické jádro, Přerov, Újezdec, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko','18.00','500000.00','2025-10-02','https://drive.google.com/file/d/1YZloKtIpBiABU-wBVRNcHRpFmiq6_xsh/view?usp=drive_link','garage','Osobní vlastnictví','2026-02-03 00:26:21',NULL,1,NULL);

/*Table structure for table `tenants` */

DROP TABLE IF EXISTS `tenants`;

CREATE TABLE `tenants` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `tenants_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('person','company') NOT NULL DEFAULT 'person',
  `birth_date` date DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `ic` varchar(20) DEFAULT NULL,
  `dic` varchar(20) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_tenants_id` (`tenants_id`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `tenants` */

insert  into `tenants`(`id`,`tenants_id`,`name`,`type`,`birth_date`,`email`,`phone`,`address`,`ic`,`dic`,`note`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'Sensio.cz s.r.o.','company',NULL,'faktury@sensio.cz','+420777010177','Na Hrázi 1139/13, Přerov I-Město, 75002 Přerov','04004621','CZ04004621','','2026-02-01 19:45:42',NULL,1,NULL),(2,2,'Edita Bednaříková','person',NULL,'bedina@email.cz','704739152','238, Dolní, Dřevohostice, okres Přerov, Olomoucký kraj, Střední Morava, 751 14, Česko',NULL,NULL,'','2026-02-02 14:09:56','2026-02-02 14:24:34',1,1),(3,2,'Edita Bednaříková','person','1972-02-01','bedina@email.cz','704739152','238, Dolní, Dřevohostice, okres Přerov, Olomoucký kraj, Střední Morava, 751 14, Česko',NULL,NULL,'','2026-02-02 14:24:34',NULL,1,NULL),(4,4,'Konečný','person',NULL,'','','',NULL,NULL,'','2026-02-02 18:22:11','2026-02-02 20:12:26',1,1),(5,4,'Martin Konečný','person',NULL,'','','',NULL,NULL,'','2026-02-02 20:12:26','2026-02-02 23:19:40',1,1),(6,6,'Richard Zámoravec','person',NULL,'zamoravec.r@seznam.cz','735875537','68, Říkovice, okres Přerov, Olomoucký kraj, Střední Morava, 751 18, Česko',NULL,NULL,'','2026-02-02 22:34:54','2026-02-02 22:35:14',1,1),(7,6,'Richard Zámoravec','person','1978-01-06','zamoravec.r@seznam.cz','735875537','68, Říkovice, okres Přerov, Olomoucký kraj, Střední Morava, 751 18, Česko',NULL,NULL,'','2026-02-02 22:35:14',NULL,1,NULL),(8,4,'Martin Konečný','person','1984-06-21','martin.konecny.eps@seznam.cz','736632445','286/29, Dědina, Troubky nad Bečvou, Troubky, okres Přerov, Olomoucký kraj, Střední Morava, 751 02, Česko',NULL,NULL,'','2026-02-02 23:19:40',NULL,1,NULL),(9,9,'Michal Horvát','person',NULL,'marketka.gaborova1@seznam.cz','602676572','314/15, Velká Dlážka, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko',NULL,NULL,'','2026-02-02 23:46:06','2026-02-02 23:47:27',1,1),(10,9,'Michal Horvát','person','1992-06-01','marketka.gaborova1@seznam.cz','602676572','314/15, Velká Dlážka, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko',NULL,NULL,'','2026-02-02 23:47:27',NULL,1,NULL),(11,11,'Jiří Zich','person','2005-07-08','','','Veselíčko u Lipníka nad Bečvou 118, Veselíčko, okres Přerov, Olomoucký kraj, Střední Morava, 751 25, Česko',NULL,NULL,'','2026-02-02 23:58:15','2026-02-03 00:00:21',1,1),(12,11,'Jiří Zich','person','2005-07-08','zichj855@seznam.cz','','Veselíčko u Lipníka nad Bečvou 118, Veselíčko, okres Přerov, Olomoucký kraj, Střední Morava, 751 25, Česko',NULL,NULL,'','2026-02-03 00:00:21','2026-02-03 00:03:34',1,1),(13,11,'Jiří Zich','person','2005-07-08','zichj855@seznam.cz','731771504','Veselíčko u Lipníka nad Bečvou 118, Veselíčko, okres Přerov, Olomoucký kraj, Střední Morava, 751 25, Česko',NULL,NULL,'','2026-02-03 00:03:34',NULL,1,NULL),(14,14,'Ateliér DUA, s.r.o.','company',NULL,'zajic@dua.cz','724742076','Šaldova 408/30, Karlín, 18600 Praha 8','47123486','CZ47123486','Ateliér DUA, s.r.o.\nSídlo: Šaldova 408/30, 186 00 Praha 8 – Karlín\nIČO: 47123486\nZapsaná u Městského soudu v Praze, oddíl C, vložka 12787\nDatová schránka: xy4u69e\nZastoupená: Petrem Zajícem, jednatelem\nE-mail: zajic@dua.cz\nTelefon: 724 742 076','2026-02-03 00:28:34',NULL,1,NULL),(15,15,'Gejza Ondič','person',NULL,'gejzaondic@senzam.cz','792357037','1406/34, Komenského, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko',NULL,NULL,'','2026-02-03 00:36:05',NULL,1,NULL);

/*Table structure for table `users` */

DROP TABLE IF EXISTS `users`;

CREATE TABLE `users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `users_id` int(10) unsigned DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `name` varchar(150) NOT NULL,
  `role` enum('admin','user') NOT NULL DEFAULT 'user',
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `users` */

insert  into `users`(`id`,`users_id`,`email`,`password_hash`,`name`,`role`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'honza@tobolik.cz','$2y$10$9IZ0nXx.wREyZe1Kt7BiNONH4r.aluEniiTY9QBwCLnC.FLnuwH56','Správce','admin','2026-02-01 14:28:29',NULL,1,NULL),(2,2,'terka@tobolikova.cz','$2y$10$ESrgqToJ3vM5GjadHNA.eex7UD15869KsMnbJMx0vdl2nacVpMYdG','Tereza','user','2026-02-01 18:27:46','2026-02-01 18:28:08',1,1),(3,2,'terka@tobolikova.cz','$2y$10$CeM7bJlR7f16PeUhs4Gu3O5V0Xh9xjU25utAle3ZzzOXRMNhwF2XS','Tereza','user','2026-02-01 18:28:08',NULL,1,NULL);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
