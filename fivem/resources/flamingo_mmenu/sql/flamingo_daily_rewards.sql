-- Kalendar dnevnih nagrada (Nagrade -> Dnevne Nagrade, Config.DailyRewards).
-- Jedan red po igracu (identifier je PK).
--
-- `current_day`     - koji dan (1-30) je SLEDECI na redu za pokupljanje.
--                      Kad igrac pokupi Dan 30, vraca se na 1 (ide ispocetka).
-- `last_claim_date` - datum (bez vremena) poslednjeg pokupljanja. Koristi se
--                      da server proveri: da li je danas vec pokupljeno
--                      (last_claim_date = CURDATE()), i da li je igrac
--                      PROPUSTIO dan (last_claim_date < juce -> niz se
--                      resetuje na Dan 1 pri sledecem pokupljanju).
CREATE TABLE IF NOT EXISTS `flamingo_daily_rewards` (
  `identifier` VARCHAR(60) NOT NULL,
  `current_day` INT NOT NULL DEFAULT 1,
  `last_claim_date` DATE DEFAULT NULL,
  PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
