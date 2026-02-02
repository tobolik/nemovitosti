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
CREATE DATABASE /*!32312 IF NOT EXISTS*/`tobolikcz01` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci */;

USE `tobolikcz01`;

/*Table structure for table `_migrations` */

DROP TABLE IF EXISTS `_migrations`;

CREATE TABLE `_migrations` (
  `name` varchar(255) NOT NULL,
  `applied_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `_migrations` */

insert  into `_migrations`(`name`,`applied_at`) values ('001_properties_extra.sql','2026-02-01 19:54:35'),('002_tenants_extra.sql','2026-02-01 19:54:35'),('003_logical_ids.sql','2026-02-01 19:54:35'),('004_logical_ids_data.sql','2026-02-01 19:54:35'),('005_indexes.sql','2026-02-01 19:54:35'),('006_valid_user.sql','2026-02-01 19:54:35'),('007_purchase_contract_url.sql','2026-02-01 19:54:35'),('008_contract_url.sql','2026-02-01 19:54:35'),('009_payments_contracts_id.sql','2026-02-01 19:54:35'),('010_property_type_order.sql','2026-02-01 20:04:23'),('011_payment_batch_and_method.sql','2026-02-01 20:52:27'),('012_bank_accounts.sql','2026-02-01 21:22:33'),('012_bank_accounts.sql.old','2026-02-01 21:09:14'),('013_bank_accounts_soft_update.sql','2026-02-01 21:22:33'),('014_contract_rent_changes.sql','2026-02-02 13:45:14'),('015_tenants_birth_date.sql','2026-02-02 14:12:04'),('016_contract_deposit.sql','2026-02-02 14:29:43');

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
  `contracts_id` int(10) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `effective_from` date NOT NULL COMMENT 'Od kdy se platí nové nájemné (první den měsíce)',
  PRIMARY KEY (`id`),
  KEY `idx_contracts_effective` (`contracts_id`,`effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_czech_ci;

/*Data for the table `contract_rent_changes` */

/*Table structure for table `contracts` */

DROP TABLE IF EXISTS `contracts`;

CREATE TABLE `contracts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `contracts_id` int(10) unsigned DEFAULT NULL,
  `property_id` int(10) unsigned NOT NULL,
  `tenant_id` int(10) unsigned NOT NULL,
  `contract_start` date NOT NULL,
  `contract_end` date DEFAULT NULL,
  `monthly_rent` decimal(12,2) NOT NULL,
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
  KEY `idx_p` (`property_id`,`valid_to`),
  KEY `idx_t` (`tenant_id`,`valid_to`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_contracts_id` (`contracts_id`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `contracts` */

insert  into `contracts`(`id`,`contracts_id`,`property_id`,`tenant_id`,`contract_start`,`contract_end`,`monthly_rent`,`contract_url`,`deposit_amount`,`deposit_paid_date`,`deposit_return_date`,`note`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,1,1,'2025-01-01',NULL,'3000.00',NULL,NULL,NULL,NULL,'','2026-02-01 19:46:01','2026-02-02 14:26:15',1,1),(2,2,2,2,'2026-01-01',NULL,'10175.00','https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 14:15:43','2026-02-02 14:22:26',1,1),(3,2,2,2,'2023-01-01',NULL,'10175.00','https://drive.google.com/file/d/1pM3rALjlx7pHcbrQMk2NqLH9M0h7rcEt/view?usp=drive_link',NULL,NULL,NULL,'','2026-02-02 14:22:26',NULL,1,NULL),(4,1,1,1,'2025-01-01',NULL,'3000.00',NULL,NULL,NULL,NULL,'','2026-02-02 14:26:15',NULL,1,NULL);

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
  `account_number` varchar(50) DEFAULT NULL,
  `valid_from` datetime NOT NULL DEFAULT current_timestamp(),
  `valid_to` datetime DEFAULT NULL,
  `valid_user_from` int(10) unsigned DEFAULT NULL,
  `valid_user_to` int(10) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_c` (`contracts_id`,`valid_to`),
  KEY `idx_v` (`valid_to`),
  KEY `idx_payments_id` (`payments_id`,`valid_to`)
) ENGINE=InnoDB AUTO_INCREMENT=62 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `payments` */

insert  into `payments`(`id`,`payments_id`,`contracts_id`,`period_year`,`period_month`,`amount`,`payment_date`,`note`,`payment_batch_id`,`payment_method`,`account_number`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,1,2026,1,'36000.00','2026-12-23',NULL,NULL,'account','7770101774/2010','2026-02-01 21:33:42','2026-02-01 21:48:06',1,1),(2,2,1,2026,1,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(3,3,1,2026,2,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(4,4,1,2026,3,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(5,5,1,2026,4,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(6,6,1,2026,5,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(7,7,1,2026,6,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(8,8,1,2026,7,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(9,9,1,2026,8,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(10,10,1,2026,9,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(11,11,1,2026,10,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(12,12,1,2026,11,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 22:03:55',1,1),(13,13,1,2026,12,'3000.00','2026-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:38:38','2026-02-01 21:55:52',1,1),(14,13,1,2026,12,'3000.00','2025-02-01','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 21:55:52','2026-02-01 22:03:55',1,1),(15,15,1,2026,11,'3000.00','2025-12-23',NULL,NULL,'account','7770101774/2010','2026-02-01 21:58:50','2026-02-01 22:03:28',1,1),(16,2,1,2026,1,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(17,3,1,2026,2,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(18,4,1,2026,3,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(19,5,1,2026,4,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(20,6,1,2026,5,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(21,7,1,2026,6,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(22,8,1,2026,7,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(23,9,1,2026,8,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(24,10,1,2026,9,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:17:09',1,1),(25,11,1,2026,10,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:10:38',1,1),(26,12,1,2026,11,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:10:14',1,1),(27,13,1,2026,12,'3000.00','2025-12-23','','f41b7ce9a2ab55841e4234c612935576','account','7770101774/2010','2026-02-01 22:03:55','2026-02-01 22:23:17',1,1),(28,28,1,2025,1,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(29,29,1,2025,2,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(30,30,1,2025,3,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(31,31,1,2025,4,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(32,32,1,2025,5,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(33,33,1,2025,6,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(34,34,1,2025,7,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(35,35,1,2025,8,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(36,36,1,2025,9,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(37,37,1,2025,10,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(38,38,1,2025,11,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(39,39,1,2025,12,'3000.00','2025-12-23','','cd76e302a1a880d84caba6c798ca69b4','account','7770101774/2010','2026-02-01 22:09:41',NULL,1,NULL),(40,40,1,2026,5,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:25:56','2026-02-01 22:52:03',1,1),(41,41,1,2026,6,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:28:18','2026-02-01 22:51:52',1,1),(42,42,1,2026,2,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:31:51','2026-02-01 22:37:15',1,1),(43,43,1,2026,1,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:37:57','2026-02-01 22:55:04',1,1),(44,44,1,2026,2,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:38:05','2026-02-01 22:52:11',1,1),(45,45,1,2026,2,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:52:22','2026-02-01 22:54:59',1,1),(46,46,1,2026,3,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:52:29','2026-02-01 22:54:22',1,1),(47,47,1,2026,5,'3000.00','2026-02-01',NULL,NULL,'account','7770101774/2010','2026-02-01 22:54:04','2026-02-01 22:54:49',1,1),(48,48,1,2026,1,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(49,49,1,2026,2,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(50,50,1,2026,3,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(51,51,1,2026,4,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(52,52,1,2026,5,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(53,53,1,2026,6,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(54,54,1,2026,7,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(55,55,1,2026,8,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(56,56,1,2026,9,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(57,57,1,2026,10,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(58,58,1,2026,11,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(59,59,1,2026,12,'3000.00','2026-02-02',NULL,'e4cc51ccece14f4fbc00c5087fa89299','account','7770101774/2010','2026-02-02 07:52:39',NULL,1,NULL),(60,60,2,2023,1,'10175.00','2022-12-31',NULL,NULL,'account','7770101774/2010','2026-02-02 14:23:42',NULL,1,NULL),(61,61,2,2023,2,'10175.00','2023-02-01',NULL,NULL,'account','7770101774/2010','2026-02-02 14:24:03',NULL,1,NULL);

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
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `properties` */

insert  into `properties`(`id`,`properties_id`,`name`,`address`,`size_m2`,`purchase_price`,`purchase_date`,`purchase_contract_url`,`type`,`note`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'Garáž Jaselská 12','3215/12, Jaselská, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko','18.58','360000.00','2020-04-20','https://drive.google.com/file/d/1yfypIpfkKyqhIXijWt7y2TIagxrRgtRQ/view?usp=drive_link','garage','Cena 240 000 Kč, zbytek v hotovosti bokem','2026-02-01 19:44:10',NULL,1,NULL),(2,2,'Byt Interbrigadistů','590/6, Interbrigadistů, Šířava, Přerov-historické jádro, Přerov, okres Přerov, Olomoucký kraj, Střední Morava, 750 02, Česko','54.00','549000.00','2004-10-26','https://drive.google.com/file/d/1VBB7lwrUwP8Dw_p40y7eUku0pgoldP0O/view?usp=drive_link','apartment','','2026-02-02 11:33:45',NULL,1,NULL);

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `tenants` */

insert  into `tenants`(`id`,`tenants_id`,`name`,`type`,`birth_date`,`email`,`phone`,`address`,`ic`,`dic`,`note`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'Sensio.cz s.r.o.','company',NULL,'faktury@sensio.cz','+420777010177','Na Hrázi 1139/13, Přerov I-Město, 75002 Přerov','04004621','CZ04004621','','2026-02-01 19:45:42',NULL,1,NULL),(2,2,'Edita Bednaříková','person',NULL,'bedina@email.cz','704739152','238, Dolní, Dřevohostice, okres Přerov, Olomoucký kraj, Střední Morava, 751 14, Česko',NULL,NULL,'','2026-02-02 14:09:56','2026-02-02 14:24:34',1,1),(3,2,'Edita Bednaříková','person','1972-02-01','bedina@email.cz','704739152','238, Dolní, Dřevohostice, okres Přerov, Olomoucký kraj, Střední Morava, 751 14, Česko',NULL,NULL,'','2026-02-02 14:24:34',NULL,1,NULL);

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
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

/*Data for the table `users` */

insert  into `users`(`id`,`users_id`,`email`,`password_hash`,`name`,`role`,`valid_from`,`valid_to`,`valid_user_from`,`valid_user_to`) values (1,1,'honza@tobolik.cz','$2y$10$9IZ0nXx.wREyZe1Kt7BiNONH4r.aluEniiTY9QBwCLnC.FLnuwH56','Správce','admin','2026-02-01 14:28:29',NULL,1,NULL),(2,2,'terka@tobolikova.cz','$2y$10$ESrgqToJ3vM5GjadHNA.eex7UD15869KsMnbJMx0vdl2nacVpMYdG','Tereza','user','2026-02-01 18:27:46','2026-02-01 18:28:08',1,1),(3,2,'terka@tobolikova.cz','$2y$10$CeM7bJlR7f16PeUhs4Gu3O5V0Xh9xjU25utAle3ZzzOXRMNhwF2XS','Tereza','user','2026-02-01 18:28:08',NULL,1,NULL);

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
