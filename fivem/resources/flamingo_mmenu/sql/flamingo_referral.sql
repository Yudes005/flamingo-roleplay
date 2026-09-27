-- Svaki igrac moze da ima najvise JEDAN sopstveni pozivni kod (identifier je PK).
-- `code` je UNIQUE - dva igraca ne mogu imati isti kod.
-- `earned`  - ukupno kesa koje je VLASNIK koda ikad zaradio od svih iskoriscenja
--             (istorijski broj, NIKAD se ne smanjuje - samo za prikaz "ukupno zaradio").
-- `pending` - kesa koju je vlasnik zaradio a JOS NIJE pokupio dugmetom "Pokupi Novac"
--             u meniju. Novac se NIKAD ne dodaje automatski na racun (ni ako je
--             vlasnik online kad se kod iskoristi) - samo se ovde nagomilava dok
--             ga igrac sam ne pokupi (server.lua, flamingo_mmenu:collectReferralEarnings).
CREATE TABLE IF NOT EXISTS `flamingo_referral_codes` (
  `identifier` VARCHAR(60) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `uses` INT NOT NULL DEFAULT 0,
  `earned` INT NOT NULL DEFAULT 0,
  `pending` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`),
  UNIQUE KEY `flamingo_referral_codes_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ako vec imas ovu tabelu iz ranije verzije, pokreni rucno (ne smeta ako neka
-- od kolona vec postoji - samo preskoci taj red):
-- ALTER TABLE `flamingo_referral_codes` ADD COLUMN `earned` INT NOT NULL DEFAULT 0;
-- ALTER TABLE `flamingo_referral_codes` ADD COLUMN `pending` INT NOT NULL DEFAULT 0;
-- DROP TABLE IF EXISTS `flamingo_referral_pending_payouts`; -- vise se ne koristi (stari sistem)

-- Svaki igrac moze da iskoristi najvise JEDAN pozivni kod, ikad (identifier je PK)
-- - sprecava da isti nalog vrti nagradu vise puta.
CREATE TABLE IF NOT EXISTS `flamingo_referral_redeems` (
  `identifier` VARCHAR(60) NOT NULL,
  `code` VARCHAR(20) NOT NULL,
  `redeemed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "Traka sa nivoima" (Config.ReferralMilestones u config.lua) - beleze se
-- pokupljeni nivoi VLASNIKA koda (identifier + milestone = broj ljudi
-- potreban za taj nivo, npr. 5/10/30/50). Kombinovani PK sprecava da isti
-- igrac pokupi isti nivo dvaput.
CREATE TABLE IF NOT EXISTS `flamingo_referral_milestones` (
  `identifier` VARCHAR(60) NOT NULL,
  `milestone` INT NOT NULL,
  `claimed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`identifier`, `milestone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
