-- Ovaj fajl se učitava SAMO na serveru (igrači ga ne vide).
SvConfig = {}

--------------------------------------------------------------------------------
-- THE ODDS API (https://the-odds-api.com)
--------------------------------------------------------------------------------
-- Ključ je najbolje staviti u server.cfg:   set kladionica_api_key "TVOJ_KLJUC"
-- Ako to ne želiš, upiši ga ovdje (server.cfg ima prednost).
SvConfig.ApiKey = ''

-- Koliko kredita mjesečno ima tvoj paket (besplatni = 500, 20K paket = 20000 ...).
-- Skripta sama računa koliko često smije osvježavati kvote da ne potroši kredite prije kraja mjeseca.
SvConfig.MonthlyCredits = 500

-- Dio kredita koji se čuva za rezultate (bez rezultata nema isplate tiketa!).
SvConfig.ScoresReserve = 0.30

-- 'auto' = računa se iz MonthlyCredits, ili upiši broj minuta (npr. 60) da ručno odrediš.
SvConfig.RefreshMinutes = 'auto'
SvConfig.MinRefreshMinutes = 30        -- nikad češće od ovoga

-- Kad preostane ovoliko kredita, prestaje osvježavanje kvota (rezultati i isplate i dalje rade).
SvConfig.StopOddsBelowCredits = 25

-- Regija kladionica: 'eu' (evropske), 'uk', 'us', 'au'. Svaka regija = +1 kredit po zahtjevu.
SvConfig.Regions = 'eu'

-- Redoslijed kladionica sa kojih se uzimaju kvote (prva koja ima kvotu se koristi).
SvConfig.Bookmakers = {
    'pinnacle', 'unibet_eu', 'williamhill', 'betfair_ex_eu', 'marathonbet',
    'onexbet', 'betsson', 'nordicbet', 'sport888', 'betclic',
}
SvConfig.AnyBookmakerFallback = true   -- ako nijedna sa liste nema kvotu, uzmi bilo koju

-- 1.0 = kvote iste kao u stvarnosti. 0.95 = server uzima 5% od dobitka u kvoti (kvota 2.00 -> 1.95).
SvConfig.OddsFactor = 1.0

-- Prikazuj utakmice koje počinju u narednih X dana.
SvConfig.DaysAhead = 7

-- Sportovi. markets = koje opklade se povlače (svako tržište = +1 kredit po zahtjevu).
--   h2h = konačan ishod (1 X 2), totals = ukupno golova/poena (manje/više), spreads = hendikep
SvConfig.Sports = {
    soccer = {
        label = 'Fudbal',
        markets = 'h2h,totals',
        doubleChance = true,        -- 1X / 12 / X2 (računa se iz 1X2 kvota, ne troši kredite)
        scoresDelayMinutes = 110,   -- koliko nakon početka se traže rezultati
    },
    basketball = {
        label = 'Košarka',
        markets = 'h2h,totals,spreads',
        scoresDelayMinutes = 150,
    },
}

-- 'list' = samo lige iz SvConfig.Leagues
-- 'all'  = SVE fudbalske i košarkaške lige koje API ima (treba plaćeni paket, ~20K kredita)
SvConfig.LeagueMode = 'list'

-- Lige (redoslijed = redoslijed u meniju). Lige van sezone se automatski sakrivaju.
-- flag = zastava (kod države: gb-eng, es, de...; 'uefa' / 'world' = pehar), top = ide u "Top utakmice"
SvConfig.Leagues = {
    -- Fudbal - Evropska takmičenja
    { key = 'soccer_uefa_champs_league',             name = 'UEFA Liga prvaka', flag = 'uefa', top = true },
    { key = 'soccer_uefa_europa_league',             name = 'UEFA Liga Evrope', flag = 'uefa', top = true },
    { key = 'soccer_uefa_europa_conference_league',  name = 'UEFA Liga konferencija', flag = 'uefa' },
    { key = 'soccer_uefa_nations_league',            name = 'UEFA Liga nacija', flag = 'uefa', top = true },
    { key = 'soccer_uefa_european_championship',     name = 'Evropsko prvenstvo', flag = 'uefa', top = true },
    { key = 'soccer_fifa_world_cup',                 name = 'Svjetsko prvenstvo', flag = 'world', top = true },
    { key = 'soccer_fifa_world_cup_qualifiers_europe', name = 'SP kvalifikacije - Evropa', flag = 'world' },
    -- Fudbal - Top lige
    { key = 'soccer_epl',                            name = 'Engleska - Premier liga', flag = 'gb-eng', top = true },
    { key = 'soccer_spain_la_liga',                  name = 'Španija - La Liga', flag = 'es', top = true },
    { key = 'soccer_italy_serie_a',                  name = 'Italija - Serie A', flag = 'it', top = true },
    { key = 'soccer_germany_bundesliga',             name = 'Njemačka - Bundesliga', flag = 'de', top = true },
    { key = 'soccer_france_ligue_one',               name = 'Francuska - Ligue 1', flag = 'fr', top = true },
    -- Fudbal - Ostale lige
    { key = 'soccer_efl_champ',                      name = 'Engleska - Championship', flag = 'gb-eng' },
    { key = 'soccer_fa_cup',                         name = 'Engleska - FA kup', flag = 'gb-eng' },
    { key = 'soccer_spain_segunda_division',         name = 'Španija - Segunda', flag = 'es' },
    { key = 'soccer_italy_serie_b',                  name = 'Italija - Serie B', flag = 'it' },
    { key = 'soccer_germany_bundesliga2',            name = 'Njemačka - 2. Bundesliga', flag = 'de' },
    { key = 'soccer_france_ligue_two',               name = 'Francuska - Ligue 2', flag = 'fr' },
    { key = 'soccer_netherlands_eredivisie',         name = 'Holandija - Eredivisie', flag = 'nl' },
    { key = 'soccer_portugal_primeira_liga',         name = 'Portugal - Primeira Liga', flag = 'pt' },
    { key = 'soccer_turkey_super_league',            name = 'Turska - Super Lig', flag = 'tr' },
    { key = 'soccer_belgium_first_div',              name = 'Belgija - Pro League', flag = 'be' },
    { key = 'soccer_austria_bundesliga',             name = 'Austrija - Bundesliga', flag = 'at' },
    { key = 'soccer_switzerland_superleague',        name = 'Švicarska - Super League', flag = 'ch' },
    { key = 'soccer_greece_super_league',            name = 'Grčka - Super League', flag = 'gr' },
    { key = 'soccer_spl',                            name = 'Škotska - Premiership', flag = 'gb-sct' },
    { key = 'soccer_denmark_superliga',              name = 'Danska - Superliga', flag = 'dk' },
    { key = 'soccer_poland_ekstraklasa',             name = 'Poljska - Ekstraklasa', flag = 'pl' },
    { key = 'soccer_brazil_campeonato',              name = 'Brazil - Serie A', flag = 'br' },
    { key = 'soccer_argentina_primera_division',     name = 'Argentina - Primera', flag = 'ar' },
    { key = 'soccer_usa_mls',                        name = 'SAD - MLS', flag = 'us' },
    { key = 'soccer_saudi_arabia_pro_league',        name = 'Saudijska Arabija - Pro liga', flag = 'sa' },
    -- Košarka
    { key = 'basketball_euroleague',                 name = 'Evroliga', flag = 'eu', top = true },
    { key = 'basketball_nba',                        name = 'NBA', flag = 'us', top = true },
    { key = 'basketball_wnba',                       name = 'WNBA', flag = 'us' },
    { key = 'basketball_ncaab',                      name = 'NCAA', flag = 'us' },
}

--------------------------------------------------------------------------------
-- SLIKE (grbovi klubova i zastave)
--------------------------------------------------------------------------------
-- Grbovi klubova se automatski traže na TheSportsDB (besplatno) i pamte u bazi.
SvConfig.TeamLogos = true
SvConfig.TeamLogoApiKey = '3'          -- besplatni javni ključ TheSportsDB
-- Ako se neki klub ne pronađe (drugačije ime), dodaj alias ili direktan link slike:
SvConfig.TeamSearchAliases = {
    ['Paris Saint Germain'] = 'Paris SG',
    ['Inter Milan'] = 'Inter',
    ['Atlético Madrid'] = 'Atletico Madrid',
    ['Crvena Zvezda'] = 'Red Star Belgrade',
}
SvConfig.TeamLogoOverrides = {
    -- ['Partizan'] = 'https://link-do-slike.png',
}

-- Lige koje se preskaču kad je LeagueMode = 'all'
SvConfig.Blacklist = {
    -- ['soccer_china_superleague'] = true,
}

--------------------------------------------------------------------------------
-- UPLATE I LIMITI
--------------------------------------------------------------------------------
SvConfig.Account = 'money'             -- 'money' = keš
SvConfig.MinStake = 10
SvConfig.MaxStake = 50000
SvConfig.MaxWin = 1000000              -- maksimalan dobitak po tiketu
SvConfig.MaxSelections = 15            -- maksimalan broj parova na tiketu
SvConfig.MaxTotalOdds = 10000
SvConfig.QuickStakes = { 100, 500, 1000, 5000 }
SvConfig.CloseMinutesBefore = 1        -- uplata se zatvara X minuta prije početka
SvConfig.VoidAfterHours = 72           -- ako rezultat ne stigne za X sati, par se stornira (kvota 1.00)
SvConfig.BetCooldown = 3               -- sekunde između dvije uplate
SvConfig.MaxDistance = 10.0            -- koliko igrač mora biti blizu NPC-a

-- Ko može koristiti /kladionica_status i /kladionica_sync
SvConfig.AdminGroup = 'group.admin'
