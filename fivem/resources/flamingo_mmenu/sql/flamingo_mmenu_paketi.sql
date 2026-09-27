-- "Moji paketi" - sve što igrač kupi ili dobije iz kutije stoji ovde
-- dok ga ne aktivira (uzme) ili proda za Flamingo Coine.
--
-- `kind`  - 'kutija' | 'vozilo' | 'predmet' | 'novac'
-- `ref`   - id kutije, model vozila, naziv predmeta ili 'money'
-- `qty`   - koliko komada (kutije se stekuju, vozila su uvek 1)
-- `value` - koliko para/municije nosi paket (za novac i predmete sa količinom)
-- `coin_value` - osnovna vrednost za prodaju (procenat je u configu)
CREATE TABLE IF NOT EXISTS `flamingo_mmenu_paketi` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `identifier` VARCHAR(60) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `ref` VARCHAR(64) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `rarity` VARCHAR(20) NOT NULL DEFAULT 'obicno',
    `qty` INT NOT NULL DEFAULT 1,
    `value` INT NOT NULL DEFAULT 0,
    `coin_value` INT NOT NULL DEFAULT 0,
    `source` VARCHAR(64) NULL,
    `created_at` INT NOT NULL,
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
