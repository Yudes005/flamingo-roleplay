-- ============================================================
-- ZADACI (dnevni / nedeljni) - flamingo_mmenu
-- Brojač napretka po tipu za svaki dan ('2026-09-26') i svaku
-- nedelju ('W2026-09-21' = ponedeljak te nedelje). Stari redovi se
-- brišu sami (Config.Tasks.CleanupDays).
-- ============================================================
CREATE TABLE IF NOT EXISTS `flamingo_task_counters` (
  `identifier` VARCHAR(60) NOT NULL,
  `period_key` VARCHAR(16) NOT NULL,
  `task_type` VARCHAR(32) NOT NULL,
  `value` INT NOT NULL DEFAULT 0,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`, `period_key`, `task_type`),
  KEY `idx_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Pokupljene nagrade - PK sprečava duplu isplatu istog zadatka u istom periodu
CREATE TABLE IF NOT EXISTS `flamingo_task_claims` (
  `identifier` VARCHAR(60) NOT NULL,
  `period_key` VARCHAR(16) NOT NULL,
  `task_id` VARCHAR(40) NOT NULL,
  `claimed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`, `period_key`, `task_id`),
  KEY `idx_claimed` (`claimed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stari sistem zadataka (Nivo -> Zadaci, davao XP) se više ne koristi.
-- Ako hoćeš da obrišeš stare tabele, odkomentariši:
-- DROP TABLE IF EXISTS `flamingo_daily_tasks`;
-- DROP TABLE IF EXISTS `flamingo_daily_task_claims`;
