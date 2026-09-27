-- Ukupno vreme igraca na serveru u minutima (raste dok je online, nikad se
-- ne resetuje - koristi ga Nagrade -> Nagrade za Vreme tab).
CREATE TABLE IF NOT EXISTS `flamingo_playtime` (
  `identifier` VARCHAR(60) NOT NULL,
  `minutes` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Koji pragovi iz Config.PlaytimeMilestones (broj sati) su vec pokupljeni -
-- svaki prag se pokuplja SAMO JEDNOM, zauvek (ne resetuje se kao dnevne
-- nagrade). Kombinovani PK sprecava dupliranje.
CREATE TABLE IF NOT EXISTS `flamingo_playtime_milestones` (
  `identifier` VARCHAR(60) NOT NULL,
  `milestone` INT NOT NULL,
  `claimed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`, `milestone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
