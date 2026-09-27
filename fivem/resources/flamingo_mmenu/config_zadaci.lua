-- ============================================================
--  FLAMINGO M MENI - ZADACI (leva traka -> Zadaci)
--
--  * Dnevni zadaci se menjaju svaki dan u ponoć (vreme servera).
--  * Nedeljni zadaci se menjaju svakog ponedeljka u ponoć.
--  * Nagrada je SAMO novac - zadaci NE daju XP ni nivo
--    (nivo i dalje ide preko flamingo_payday, XP na svakih 1h).
--  * Svaki igrač dobija svoj nasumičan izbor iz liste (pool-a).
--    Neki zadaci su "stalni" (fixed) i uvek su tu, ostali se
--    menjaju - rotiraju se tako da svi dođu na red, a isti se
--    retko ponavlja dva dana zaredom.
-- ============================================================
Config = Config or {}

Config.Tasks = {
    MoneyAccount     = 'money',  -- 'money' (keš) ili 'bank'
    NotifyOnComplete = true,     -- esx_notify kad igrač završi zadatak ("pokupi u M meniju")
    PerPlayer        = true,     -- true = svako ima svoj izbor | false = svi igrači imaju iste zadatke
    AvoidRepeat      = true,     -- rotacija: zadaci se menjaju iz dana u dan i svi dođu na red (false = čist random)
    Seed             = 'flamingo-2026', -- promeni tekst da "promešaš" sve izbore od danas
    MaxPerType       = 2,        -- najviše ovoliko zadataka ISTOG tipa (npr. 2x vožnja) u jednom danu/nedelji

    Daily = {
        fixed       = { 'd_play_60' },   -- uvek aktivni dnevni zadaci
        randomCount = 4,                 -- + ovoliko nasumičnih iz liste
    },

    Weekly = {
        fixed       = { 'w_play_600' },
        randomCount = 4,
    },

    -- Koliko dana se čuva stari napredak u bazi (posle se briše sam)
    CleanupDays = 21,
}

-- ============================================================
--  TIPOVI ZADATAKA
--  enabled = false -> zadaci tog tipa se NE dele igračima.
--
--  "Ugrađeno" = radi odmah, meri ga sam flamingo_mmenu.
--  "Hook"     = posao mora da javi napredak jednom linijom:
--      exports['flamingo_mmenu']:AddTaskProgress(source, 'mining', 1)
--  Uključi (enabled = true) tek kad je linija dodata u taj posao,
--  inače igrač dobije zadatak koji ne može da završi.
--
--  unit:    'min' (minuti), 'km' (meri se u metrima), 'm', ili tekst ('kom', 'vožnji'...)
-- ============================================================
Config.TaskTypes = {
    -- UGRAĐENO
    playtime     = { enabled = true,  unit = 'min' },          -- minuti na serveru
    drive        = { enabled = true,  unit = 'km' },           -- vožnja kola/motora (vozač)
    walk         = { enabled = true,  unit = 'km' },           -- hodanje/trčanje peške
    swim         = { enabled = true,  unit = 'm' },            -- plivanje
    cycle        = { enabled = true,  unit = 'km' },           -- bicikl
    daily_reward = { enabled = true,  unit = 'put' },          -- Nagrade -> Dnevne Nagrade (pokupi)

    -- HOOK (posao mora da pozove AddTaskProgress)
    mining       = { enabled = false, unit = 'kom',    resource = 'flamingo_miner' },      -- iskopana ruda
    woodcutting  = { enabled = false, unit = 'kom',    resource = 'flamingo_drvoseca' },   -- posečeno drvo
    fishing      = { enabled = false, unit = 'kom',    resource = 'flamingo_ribar' },      -- ulovljena riba
    electrician  = { enabled = false, unit = 'kvar',   resource = 'flamingo_elektricar' }, -- popravljen kvar
    garbage      = { enabled = false, unit = 'kesa',   resource = 'flamingo_smecar' },     -- pokupljene kese
    farming      = { enabled = false, unit = 'kom',    resource = 'flamingo_farmer' },     -- ubrani plodovi
    bus          = { enabled = false, unit = 'stanica',resource = 'flamingo_busvozac' },   -- završene stanice
    taxi         = { enabled = false, unit = 'vožnja', resource = 'flamingo_taxi' },       -- završene vožnje
    transport    = { enabled = false, unit = 'tura',   resource = 'flamingo_transport' },  -- završene dostave
    market_sell  = { enabled = false, unit = 'kom',    resource = 'pijace' },              -- prodato na pijacama
    casino       = { enabled = false, unit = 'partija',resource = 'flamingo_kazino' },     -- odigrane partije
    payday       = { enabled = false, unit = 'plata',  resource = 'flamingo_payday' },     -- primljene plate
}

-- ============================================================
--  LISTA ZADATAKA
--  target = koliko treba (km tipovi se pišu u METRIMA: 5000 = 5 km)
--  money  = nagrada ($)
--  icon   = Font Awesome ikonica
-- ============================================================
Config.TaskPool = {

    -- ====================== DNEVNI ======================
    daily = {
        -- Vreme na serveru
        { id = 'd_play_30',  type = 'playtime', target = 30,  money = 3000,  icon = 'fa-clock',          label = 'Pola sata',            description = 'Provedi 30 minuta na serveru danas.' },
        { id = 'd_play_60',  type = 'playtime', target = 60,  money = 6000,  icon = 'fa-clock',          label = 'Sat vremena',          description = 'Provedi 1 sat na serveru danas.' },
        { id = 'd_play_120', type = 'playtime', target = 120, money = 12000, icon = 'fa-hourglass-half', label = 'Dva sata igre',        description = 'Provedi 2 sata na serveru danas.' },
        { id = 'd_play_180', type = 'playtime', target = 180, money = 18000, icon = 'fa-hourglass-end',  label = 'Maraton',              description = 'Provedi 3 sata na serveru danas.' },

        -- Vožnja
        { id = 'd_drive_5',  type = 'drive', target = 5000,  money = 3000,  icon = 'fa-car-side',   label = 'Kratka tura',          description = 'Pređi 5 km za volanom.' },
        { id = 'd_drive_15', type = 'drive', target = 15000, money = 7000,  icon = 'fa-car-side',   label = 'Gradska vožnja',       description = 'Pređi 15 km za volanom.' },
        { id = 'd_drive_30', type = 'drive', target = 30000, money = 12000, icon = 'fa-road',       label = 'Put pod točkovima',    description = 'Pređi 30 km za volanom.' },

        -- Peške / plivanje / bicikl
        { id = 'd_walk_1',   type = 'walk',  target = 1000,  money = 2500,  icon = 'fa-person-walking', label = 'Šetnja',           description = 'Pređi 1 km peške.' },
        { id = 'd_walk_3',   type = 'walk',  target = 3000,  money = 6000,  icon = 'fa-person-running', label = 'Jutarnje trčanje',  description = 'Pređi 3 km peške.' },
        { id = 'd_swim_200', type = 'swim',  target = 200,   money = 4000,  icon = 'fa-person-swimming', label = 'Plivač',           description = 'Preplivaj 200 metara.' },
        { id = 'd_cycle_3',  type = 'cycle', target = 3000,  money = 4000,  icon = 'fa-person-biking', label = 'Na dva točka',      description = 'Pređi 3 km biciklom.' },

        -- Nagrade
        { id = 'd_reward',   type = 'daily_reward', target = 1, money = 2000, icon = 'fa-calendar-check', label = 'Ne propusti dan', description = 'Pokupi dnevnu nagradu u meniju (Nagrade).' },

        -- Poslovi (rade kad se uključi hook)
        { id = 'd_mine_25',   type = 'mining',      target = 25, money = 6000,  icon = 'fa-gem',          label = 'Rudar',               description = 'Iskopaj 25 komada rude.' },
        { id = 'd_mine_60',   type = 'mining',      target = 60, money = 12000, icon = 'fa-gem',          label = 'Duboko u rudniku',    description = 'Iskopaj 60 komada rude.' },
        { id = 'd_wood_20',   type = 'woodcutting', target = 20, money = 6000,  icon = 'fa-tree',         label = 'Drvoseča',            description = 'Poseci 20 stabala.' },
        { id = 'd_wood_50',   type = 'woodcutting', target = 50, money = 12000, icon = 'fa-tree',         label = 'Gospodar šume',       description = 'Poseci 50 stabala.' },
        { id = 'd_fish_15',   type = 'fishing',     target = 15, money = 6000,  icon = 'fa-fish',         label = 'Pecaroš',             description = 'Ulovi 15 riba.' },
        { id = 'd_fish_40',   type = 'fishing',     target = 40, money = 12000, icon = 'fa-fish',         label = 'Dobar ulov',          description = 'Ulovi 40 riba.' },
        { id = 'd_elec_5',    type = 'electrician', target = 5,  money = 6000,  icon = 'fa-bolt',         label = 'Majstor za struju',   description = 'Popravi 5 kvarova kao električar.' },
        { id = 'd_elec_12',   type = 'electrician', target = 12, money = 12000, icon = 'fa-bolt',         label = 'Grad bez mraka',      description = 'Popravi 12 kvarova kao električar.' },
        { id = 'd_trash_40',  type = 'garbage',     target = 40, money = 6000,  icon = 'fa-trash-can',    label = 'Čist grad',           description = 'Pokupi 40 kesa smeća.' },
        { id = 'd_trash_100', type = 'garbage',     target = 100,money = 12000, icon = 'fa-trash-can',    label = 'Smećar godine',       description = 'Pokupi 100 kesa smeća.' },
        { id = 'd_farm_30',   type = 'farming',     target = 30, money = 6000,  icon = 'fa-wheat-awn',    label = 'Berba',               description = 'Uberi 30 plodova na farmi.' },
        { id = 'd_farm_80',   type = 'farming',     target = 80, money = 12000, icon = 'fa-tractor',      label = 'Vredni farmer',       description = 'Uberi 80 plodova na farmi.' },
        { id = 'd_bus_20',    type = 'bus',         target = 20, money = 6000,  icon = 'fa-bus',          label = 'Na liniji',           description = 'Završi 20 autobuskih stanica.' },
        { id = 'd_bus_50',    type = 'bus',         target = 50, money = 12000, icon = 'fa-bus',          label = 'Gradski prevoz',      description = 'Završi 50 autobuskih stanica.' },
        { id = 'd_taxi_5',    type = 'taxi',        target = 5,  money = 7000,  icon = 'fa-taxi',         label = 'Taksi, molim',        description = 'Završi 5 taksi vožnji.' },
        { id = 'd_taxi_12',   type = 'taxi',        target = 12, money = 14000, icon = 'fa-taxi',         label = 'Noćna smena',         description = 'Završi 12 taksi vožnji.' },
        { id = 'd_trans_2',   type = 'transport',   target = 2,  money = 10000, icon = 'fa-truck',        label = 'Dostava',             description = 'Završi 2 dostave kamionom.' },
        { id = 'd_market_50', type = 'market_sell', target = 50, money = 5000,  icon = 'fa-store',        label = 'Na pijaci',           description = 'Prodaj 50 komada robe na pijacama.' },
        { id = 'd_casino_10', type = 'casino',      target = 10, money = 4000,  icon = 'fa-dice',         label = 'Sreća u kazinu',      description = 'Odigraj 10 partija u kazinu.' },
        { id = 'd_payday_2',  type = 'payday',      target = 2,  money = 5000,  icon = 'fa-money-check-dollar', label = 'Dve plate',     description = 'Primi 2 plate danas.' },
    },

    -- ====================== NEDELJNI ======================
    weekly = {
        -- Vreme na serveru
        { id = 'w_play_600',  type = 'playtime', target = 600,  money = 50000,  icon = 'fa-clock',          label = 'Vikend igrač',      description = 'Provedi 10 sati na serveru ove nedelje.' },
        { id = 'w_play_1200', type = 'playtime', target = 1200, money = 100000, icon = 'fa-hourglass-half', label = 'Stalni stanovnik',  description = 'Provedi 20 sati na serveru ove nedelje.' },

        -- Kretanje
        { id = 'w_drive_100', type = 'drive', target = 100000, money = 40000, icon = 'fa-road',            label = 'Sto kilometara',    description = 'Pređi 100 km za volanom ove nedelje.' },
        { id = 'w_drive_250', type = 'drive', target = 250000, money = 80000, icon = 'fa-road',            label = 'Drumski vuk',       description = 'Pređi 250 km za volanom ove nedelje.' },
        { id = 'w_walk_15',   type = 'walk',  target = 15000,  money = 30000, icon = 'fa-person-running',  label = 'Maratonac',         description = 'Pređi 15 km peške ove nedelje.' },
        { id = 'w_swim_2000', type = 'swim',  target = 2000,   money = 35000, icon = 'fa-person-swimming', label = 'Morski vuk',        description = 'Preplivaj 2 km ove nedelje.' },
        { id = 'w_cycle_25',  type = 'cycle', target = 25000,  money = 35000, icon = 'fa-person-biking',   label = 'Biciklista',        description = 'Pređi 25 km biciklom ove nedelje.' },

        -- Nagrade
        { id = 'w_reward_5',  type = 'daily_reward', target = 5, money = 30000, icon = 'fa-calendar-check', label = 'Redovan igrač', description = 'Pokupi dnevnu nagradu 5 puta ove nedelje.' },

        -- Poslovi (rade kad se uključi hook)
        { id = 'w_mine_300',   type = 'mining',      target = 300,  money = 60000, icon = 'fa-gem',       label = 'Rudnik je tvoj',    description = 'Iskopaj 300 komada rude ove nedelje.' },
        { id = 'w_wood_250',   type = 'woodcutting', target = 250,  money = 60000, icon = 'fa-tree',      label = 'Sekira ne staje',   description = 'Poseci 250 stabala ove nedelje.' },
        { id = 'w_fish_200',   type = 'fishing',     target = 200,  money = 60000, icon = 'fa-fish',      label = 'Kralj reke',        description = 'Ulovi 200 riba ove nedelje.' },
        { id = 'w_elec_50',    type = 'electrician', target = 50,   money = 60000, icon = 'fa-bolt',      label = 'Elektrodistribucija',description = 'Popravi 50 kvarova ove nedelje.' },
        { id = 'w_trash_400',  type = 'garbage',     target = 400,  money = 60000, icon = 'fa-trash-can', label = 'Komunalac',         description = 'Pokupi 400 kesa smeća ove nedelje.' },
        { id = 'w_farm_300',   type = 'farming',     target = 300,  money = 60000, icon = 'fa-tractor',   label = 'Bogata žetva',      description = 'Uberi 300 plodova ove nedelje.' },
        { id = 'w_bus_200',    type = 'bus',         target = 200,  money = 60000, icon = 'fa-bus',       label = 'Vozač godine',      description = 'Završi 200 stanica ove nedelje.' },
        { id = 'w_taxi_40',    type = 'taxi',        target = 40,   money = 70000, icon = 'fa-taxi',      label = 'Taksi legenda',     description = 'Završi 40 taksi vožnji ove nedelje.' },
        { id = 'w_trans_15',   type = 'transport',   target = 15,   money = 80000, icon = 'fa-truck',     label = 'Kamiondžija',       description = 'Završi 15 dostava kamionom ove nedelje.' },
        { id = 'w_market_500', type = 'market_sell', target = 500,  money = 45000, icon = 'fa-store',     label = 'Trgovac',           description = 'Prodaj 500 komada robe na pijacama.' },
        { id = 'w_casino_100', type = 'casino',      target = 100,  money = 35000, icon = 'fa-dice',      label = 'Stalni gost kazina',description = 'Odigraj 100 partija u kazinu.' },
        { id = 'w_payday_15',  type = 'payday',      target = 15,   money = 40000, icon = 'fa-money-check-dollar', label = 'Vredan radnik', description = 'Primi 15 plata ove nedelje.' },
    },
}
