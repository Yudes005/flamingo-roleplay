-- ============================================================
--  FLAMINGO M MENI - glavni config
--  (kutije i "Moji paketi" su u config_kutije.lua)
--
--  VAŽNO: ovaj fajl mora postojati - bez njega ne rade dnevne
--  nagrade, pozivni kod, nagrade za vreme ni veštine.
--  ZADACI (dnevni/nedeljni) su u config_zadaci.lua
-- ============================================================
Config = Config or {}

-- ============================================================
--  ZAJEDNICA (Početna + dno leve trake)
--  Prazno = dugme se ne prikazuje
-- ============================================================
Config.SocialLinks = {
    discord = '',   -- npr. 'https://discord.gg/tvojserver'
    tiktok  = '',   -- npr. 'https://www.tiktok.com/@flamingoroleplay'
}

-- ============================================================
--  NIVO
--  Nivo/XP radi flamingo_payday (XP na svaku platu, tj. na 1h).
--  Ovo je samo za prikaz na Početnoj ("Novi nivo = $...") - upiši
--  isti iznos kao u flamingo_payday.
-- ============================================================
Config.LevelUpRewardDisplay = 10000

-- ============================================================
--  VEŠTINE (Statistika -> Skillovi / Karijera)
--  skill id iz flamingo_skills  =  resurs posla
--  (iz resursa posla se čita "Kako funkcioniše" i album riba)
-- ============================================================
Config.SkillJobs = {
    mining      = 'flamingo_miner',
    woodcutting = 'flamingo_drvoseca',
    electrician = 'flamingo_elektricar',
    sanitation  = 'flamingo_smecar',
    farming     = 'flamingo_farmer',
    transport   = 'flamingo_busvozac',
    fishing     = 'flamingo_ribar',
    taxi        = 'flamingo_taxi',
}

-- ============================================================
--  PRODAVNICA -> NOVAC
--  price = cena u Flamingo Coinima, image = fajl u html/img/money/
-- ============================================================
Config.MoneyPackageAccount = 'bank'   -- 'bank' ili 'money' (keš)

Config.MoneyPackages = {
    { id = 'money_100k', amount = 100000,   price = 10,  image = 'money_100k.png' },
    { id = 'money_250k', amount = 250000,   price = 20,  image = 'money_250k.png' },
    { id = 'money_500k', amount = 500000,   price = 30,  image = 'money_500k.png' },
    { id = 'money_1m',   amount = 1000000,  price = 50,  image = 'money_1m.png' },
    { id = 'money_2_5m', amount = 2500000,  price = 100, image = 'money_2_5m.png' },
    { id = 'money_5m',   amount = 5000000,  price = 185, image = 'money_5m.png' },
    { id = 'money_10m',  amount = 10000000, price = 355, image = 'money_10m.png' },
}

-- Stari sistem kutija (pre "Moji paketi"). Nove kutije su u config_kutije.lua.
Config.Crates = {}

-- ============================================================
--  NAGRADE -> POZIVNI KOD
-- ============================================================
Config.Referral = {
    codeMinLength    = 3,      -- min dužina koda (samo slova i brojevi)
    codeMaxLength    = 12,     -- max dužina koda
    rewardMoney      = 25000,  -- keš igraču koji UNESE tuđi kod
    rewardCoins      = 10,     -- Coini igraču koji UNESE tuđi kod
    ownerRewardMoney = 15000,  -- vlasnik koda dobija ovo po svakom korišćenju ("Pokupi Novac")
}

-- Traka nagrada: koliko ljudi mora da iskoristi tvoj kod
-- money = keš, coins = Flamingo Coini, xp = XP, levels = odmah +N nivoa
Config.ReferralMilestones = {
    { uses = 5,  money = 50000 },
    { uses = 10, money = 100000, coins = 50 },
    { uses = 30, coins = 150,    xp = 5000 },
    { uses = 50, money = 500000, coins = 300, levels = 2 },
}

-- ============================================================
--  NAGRADE -> DNEVNE NAGRADE (30 dana zaredom)
--  Ako igrač propusti dan, kreće ispočetka od Dana 1.
--  Posle Dana 30 kreće ponovo od Dana 1.
-- ============================================================
Config.DailyRewards = {
    { money = 5000 },                          -- Dan 1
    { xp = 250 },                              -- Dan 2
    { money = 7500 },                          -- Dan 3
    { coins = 5 },                             -- Dan 4
    { money = 10000, xp = 250 },               -- Dan 5
    { xp = 500 },                              -- Dan 6
    { money = 25000, coins = 10 },             -- Dan 7
    { money = 10000 },                         -- Dan 8
    { xp = 500 },                              -- Dan 9
    { money = 12500 },                         -- Dan 10
    { coins = 10 },                            -- Dan 11
    { money = 15000, xp = 500 },               -- Dan 12
    { xp = 750 },                              -- Dan 13
    { money = 50000, coins = 20 },             -- Dan 14
    { money = 15000 },                         -- Dan 15
    { xp = 750 },                              -- Dan 16
    { money = 17500 },                         -- Dan 17
    { coins = 15 },                            -- Dan 18
    { money = 20000, xp = 750 },               -- Dan 19
    { xp = 1000 },                             -- Dan 20
    { money = 75000, coins = 30 },             -- Dan 21
    { money = 20000 },                         -- Dan 22
    { xp = 1000 },                             -- Dan 23
    { money = 25000 },                         -- Dan 24
    { coins = 20 },                            -- Dan 25
    { money = 30000, xp = 1000 },              -- Dan 26
    { xp = 1500 },                             -- Dan 27
    { money = 40000, coins = 25 },             -- Dan 28
    { money = 50000, xp = 1500 },              -- Dan 29
    { money = 150000, coins = 50, levels = 1 },-- Dan 30
}

-- ============================================================
--  NAGRADE -> NAGRADE ZA VREME (ukupno vreme na serveru)
--  Ne resetuje se. Sezona služi samo za oznaku "Sezona ističe za XD".
-- ============================================================
Config.PlaytimeSeasonStart = '2026-09-25'  -- GGGG-MM-DD
Config.PlaytimeSeasonDays  = 60

Config.PlaytimeMilestones = {
    { hours = 5,  money = 25000 },
    { hours = 10, money = 50000,  coins = 10 },
    { hours = 20, xp = 1500,      coins = 20 },
    { hours = 30, money = 100000, coins = 30 },
    { hours = 40, levels = 1,     coins = 50 },
}
