Config = {}

Config.Debug = false

-- Kojim redosledom se pokusava placanje: 1 = bankovni racun, 2 = kes
Config.PayAccounts = {
    [1] = 'bank',
    [2] = 'money'
}

Config.Blip = {
    enabled = true,
    sprite = 52,
    color = 2,
    scale = 0.7,
    name = 'Market 24/7',
}

Config.DefaultPed = {
    model = 'mp_m_shopkeep_01'
}

-- Distanca sa koje se prikazuje prompt i moze da se pritisne E
Config.InteractDistance = 2.2

-- Tekstovi / izgled
Config.Locales = {
    welcomeTitle = 'Dobrodošli u',
    promptText = 'Otvori market',
    payCard = 'Plati karticom',
    payCash = 'Plati kešom',
    total = 'Ukupno',
    cart = 'Korpa',
    emptyCart = 'Vaša korpa je prazna',
}

-- ============================================================
--  Biznis (flamingo_biznisi): svaki market iz Config.Shops je poseban biznis.
--  Market se prepoznaje po poziciji prodavca (ped.coords) - ne pomeraj je posle kupovine.
--  Cena marketa: dodaj u market  bizPrice = 900000  (bez toga vazi Config.Market.defaultPrice u flamingo_biznisi).
--  Svaki artikal iz liste ispod krece sa 100 kom. u magacinu svakog marketa,
--  vlasnik ga narucuje na tabletu za pola cene (1000$ -> 500$).
-- ============================================================
Config.DefaultItems = {
    { name = 'simcard', label = 'Sim Kartica', price = 100 },

}

Config.Shops = {
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(-706.0657, -914.5693, 19.2156, 86.8891), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'David Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(24.47, -1346.62, 28.50, 266.77), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Marko Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(372.99, 326.53, 102.57, 256.86), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Nikola Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(549.05, 2671.41, 41.16, 99.38), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Petar Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(2678.0405, 3279.3718, 54.2411, 338.5852), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Ilija Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(1960.0715, 3740.0469, 31.3437, 292.5739), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Nikola Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(1727.7933, 6415.2388, 34.0372, 238.6502), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Jovan Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(1166.2969, 2710.8469, 37.1577, 180.0419), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Stefan Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(-47.34, -1758.72, 28.42, 45.23), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Knele Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(1164.87, -323.63, 68.21, 101.54), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Aleksandar Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(1697.9906, 4922.9116, 41.0637, 322.6054), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Ivan Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(-1486.67, -377.58, 39.16, 139.12), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Luka Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(-2966.38, 390.90, 14.04, 85.34), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Dominik Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(-3038.9048, 584.5085, 6.9089, 17.5286), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Filip Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(1134.25, -982.45, 45.42, 276.12), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Mila Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(-3242.28, 999.98, 11.83, 351.63), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Vuk Flamingo' },
        items = Config.DefaultItems
    },
    {
        id = 'flamingo_market',
        label = 'Flamingo Market',
        ped = { model = 'mp_m_shopkeep_01', coords = vec4(2557.50, 380.82, 107.62, 1.77), scenario = 'WORLD_HUMAN_STAND_IMPATIENT', name = 'Dusan Flamingo' },
        items = Config.DefaultItems
    },
}
