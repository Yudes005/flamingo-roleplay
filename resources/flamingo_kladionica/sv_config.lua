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
SvConfig.Leagues = {
    -- Fudbal - Evropska takmičenja
    { key = 'soccer_uefa_champs_league',             name = 'UEFA Liga prvaka' },
    { key = 'soccer_uefa_europa_league',             name = 'UEFA Liga Evrope' },
    { key = 'soccer_uefa_europa_conference_league',  name = 'UEFA Liga konferencija' },
    { key = 'soccer_uefa_nations_league',            name = 'UEFA Liga nacija' },
    { key = 'soccer_uefa_european_championship',     name = 'Evropsko prvenstvo' },
    { key = 'soccer_fifa_world_cup',                 name = 'Svjetsko prvenstvo' },
    { key = 'soccer_fifa_world_cup_qualifiers_europe', name = 'SP kvalifikacije - Evropa' },
    -- Fudbal - Top lige
    { key = 'soccer_epl',                            name = 'Engleska - Premier liga' },
    { key = 'soccer_spain_la_liga',                  name = 'Španija - La Liga' },
    { key = 'soccer_italy_serie_a',                  name = 'Italija - Serie A' },
    { key = 'soccer_germany_bundesliga',             name = 'Njemačka - Bundesliga' },
    { key = 'soccer_france_ligue_one',               name = 'Francuska - Ligue 1' },
    -- Fudbal - Ostale lige
    { key = 'soccer_efl_champ',                      name = 'Engleska - Championship' },
    { key = 'soccer_fa_cup',                         name = 'Engleska - FA kup' },
    { key = 'soccer_spain_segunda_division',         name = 'Španija - Segunda' },
    { key = 'soccer_italy_serie_b',                  name = 'Italija - Serie B' },
    { key = 'soccer_germany_bundesliga2',            name = 'Njemačka - 2. Bundesliga' },
    { key = 'soccer_france_ligue_two',               name = 'Francuska - Ligue 2' },
    { key = 'soccer_netherlands_eredivisie',         name = 'Holandija - Eredivisie' },
    { key = 'soccer_portugal_primeira_liga',         name = 'Portugal - Primeira Liga' },
    { key = 'soccer_turkey_super_league',            name = 'Turska - Super Lig' },
    { key = 'soccer_belgium_first_div',              name = 'Belgija - Pro League' },
    { key = 'soccer_austria_bundesliga',             name = 'Austrija - Bundesliga' },
    { key = 'soccer_switzerland_superleague',        name = 'Švicarska - Super League' },
    { key = 'soccer_greece_super_league',            name = 'Grčka - Super League' },
    { key = 'soccer_spl',                            name = 'Škotska - Premiership' },
    { key = 'soccer_denmark_superliga',              name = 'Danska - Superliga' },
    { key = 'soccer_poland_ekstraklasa',             name = 'Poljska - Ekstraklasa' },
    { key = 'soccer_brazil_campeonato',              name = 'Brazil - Serie A' },
    { key = 'soccer_argentina_primera_division',     name = 'Argentina - Primera' },
    { key = 'soccer_usa_mls',                        name = 'SAD - MLS' },
    { key = 'soccer_saudi_arabia_pro_league',        name = 'Saudijska Arabija - Pro liga' },
    -- Košarka
    { key = 'basketball_euroleague',                 name = 'Evroliga' },
    { key = 'basketball_nba',                        name = 'NBA' },
    { key = 'basketball_wnba',                       name = 'WNBA' },
    { key = 'basketball_ncaab',                      name = 'NCAA' },
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
