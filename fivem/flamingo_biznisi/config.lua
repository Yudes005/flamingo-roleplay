Config = {}

-- ============================================================
--  Opste
-- ============================================================
Config.NotifyTitle = 'Biznis'
Config.NotifyIcon  = 'fa-solid fa-briefcase'

Config.ServerDistance   = 6.0   -- server provera: koliko daleko od bankomata sme da bude igrac kad kupuje

-- TEST: kupovina direktno iz menija bankomata (kategorija "Biznis").
-- Kad napravis aukciju stavi na false - dugme "Kupi" nestaje, a vlasnika postavlja
-- aukcija preko exports['flamingo_biznisi']:SetOwner(id, identifier, ime)
Config.AllowDirectBuy = true
Config.BuyFrom        = 'bank'  -- 'bank' | 'money' | 'any' (prvo racun pa gotovina)
Config.MaxPerPlayer   = 1       -- koliko biznisa sme da ima jedan igrac (0 = bez limita)

-- ============================================================
--  Prodaja biznisa
-- ============================================================
-- Prodaja drzavi (tablet -> Moj biznis): dobijas ovaj deo cene biznisa (0.5 = pola)
Config.SellToStateRatio = 0.5

-- Prodaja igracu (radial meni G -> "Prodaj biznis")
Config.PlayerSale = {
    distance = 3.0,          -- koliko blizu mora biti kupac
    timeout  = 30,           -- sekundi da kupac prihvati ponudu
    minPrice = 1,
    maxPrice = 100000000,
}

-- Deo provizije koji ide drzavi (0 = cela provizija ide u kasu biznisa)
Config.StateCut = 0

-- Blip na mapi samo za TVOJE biznise
Config.Blip = {
    enabled = true,
    sprite  = 500,
    color   = 48,     -- roze
    scale   = 0.65,
    label   = 'Moj biznis'
}

-- Koliko poslednjih transakcija se salje u tablet
Config.LogLimit = 40

-- Grupe koje mogu da koriste admin komande (/biznis_*)
Config.AdminGroups = { 'admin', 'superadmin' }

-- ============================================================
--  Bankomati
-- ============================================================
Config.ATM = {
    label       = 'Bankomat',
    maxCash     = 2500000,   -- najvise gotovine u jednom bankomatu
    startCash   = 2500000,   -- sa koliko gotovine bankomat krece kad se prvi put napravi
    lowCash     = 250000,    -- ispod ovoga je "Malo gotovine" (upozorenje vlasniku)
    defaultPrice = 350000,   -- cena za bankomat bez cene (npr. dodat komandom bez cene)

    -- Uplata na bankomatu puni bankomat gotovinom (do maxCash).
    depositFillsAtm = true,

    -- Koliko daleko (od mesta gde igrac stoji) trazimo biznis-bankomat kad igrac koristi bankomat
    linkRadius = 3.0,

    -- Pravi bankomat (prop) se trazi u ovom radijusu oko koordinata iz liste
    snapRadius = 3.0,
    models = {
        `prop_atm_01`,
        `prop_atm_02`,
        `prop_atm_03`,
        `prop_fleeca_atm`
    }
}

-- Provizije po kartici ako flamingo_banke nije pokrenut (inace se citaju iz njega)
Config.CardFallback = {
    { id = 'standard', label = 'Standard', atmFee = 15, theme = 'green' },
    { id = 'premium',  label = 'Premium',  atmFee = 10, theme = 'dark'  },
    { id = 'gold',     label = 'Gold',     atmFee = 5,  theme = 'gold'  },
}

-- ============================================================
--  Supermarketi (flamingo_supermarket)
--  Marketi se registruju sami iz flamingo_supermarket configa (svaki market = poseban biznis).
-- ============================================================
Config.Market = {
    label        = 'Market',
    defaultPrice = 750000,   -- cena marketa ako u flamingo_supermarket configu nema bizPrice
    startStock   = 100,      -- svaki artikal krece sa ovoliko komada (i svaki novi artikal dodat u config)
    maxStock     = 100,      -- najvise komada jednog artikla u magacinu
    lowStock     = 10,       -- ispod ovoga vlasnik dobija upozorenje
    orderRatio   = 0.5,      -- narudzbina kosta ovaj deo prodajne cene (0.5 = pola: 1000$ u marketu -> 500$)
    stateCut     = 0,        -- % od prodaje koji ide drzavi (0 = sve ide u kasu)
}

-- ============================================================
--  Perionice (flamingo_perionica)
--  Svaka perionica iz flamingo_perionica configa je poseban biznis.
-- ============================================================
Config.Carwash = {
    label        = 'Perionica',
    defaultPrice = 500000,   -- cena perionice ako u flamingo_perionica configu nema bizPrice
    share        = 35,       -- % od cene pranja koji ide u kasu vlasnika
    distance     = 14.0,     -- server provera za kupovinu iz menija (igrac je u vozilu na perionici)
}

-- Dostava robe (transport) - TVOJA skripta
-- resource = nil  -> narucena roba stize odmah (za test)
-- resource = 'ime_skripte' -> narudzbina ceka dostavu:
--     AddEventHandler('flamingo_biznisi:orderCreated', function(src, orderId, bizId, item, amount) ... end)
--     exports['flamingo_biznisi']:DeliverOrder(orderId, 'Ime vozaca')   -- kad je roba dovezena
Config.Supply = {
    resource = nil,
}

-- ============================================================
--  Dopuna bankomata (transport) - TVOJA skripta
--  Kad vlasnik na tabletu klikne "Dopuni bankomat", poziva se na serveru:
--      TriggerEvent('flamingo_biznisi:refillRequested', src, bizId, nedostaje)
--  Tvoja skripta posle zavrsenog transporta zove:
--      exports['flamingo_biznisi']:RefillAtm(bizId, iznos)
-- ============================================================
Config.Refill = {
    resource = nil,   -- ime tvoje transport skripte, npr. 'flamingo_transport' (nil = dugme pise "Uskoro")
}

-- ============================================================
--  Bankomati koji su biznisi.
--  Koordinate su priblizne - skripta sama nadje pravi bankomat u krugu od snapRadius metara.
--  Cene su nasumicne, promeni ih kako hoces. Novi bankomat mozes dodati i u igri:
--      /biznis_dodaj [cena]   (stani ispred bankomata)
--  Posle prvog starta biznisi zive u bazi (tabela flamingo_biznisi), pa promena cene
--  ovde vazi samo za bankomate koji jos nemaju vlasnika.
-- ============================================================
Config.ATMs = {
    -- Centar grada
    { coords = vector3(24.59, -946.06, 29.36),    price = 450000 },
    { coords = vector3(5.13, -919.95, 29.56),     price = 450000 },
    { coords = vector3(112.41, -776.16, 31.43),   price = 425000 },
    { coords = vector3(112.93, -818.71, 31.39),   price = 425000 },
    { coords = vector3(119.90, -883.83, 31.19),   price = 400000 },
    { coords = vector3(-203.55, -861.59, 30.21),  price = 400000 },
    { coords = vector3(-256.83, -719.65, 33.44),  price = 380000 },
    { coords = vector3(-254.11, -692.48, 33.62),  price = 380000 },
    { coords = vector3(-302.41, -829.95, 32.42),  price = 375000 },
    { coords = vector3(295.84, -895.64, 29.22),   price = 360000 },
    { coords = vector3(-538.23, -854.42, 29.23),  price = 340000 },
    { coords = vector3(-711.16, -818.96, 23.77),  price = 330000 },
    { coords = vector3(-717.61, -915.88, 19.27),  price = 320000 },
    { coords = vector3(-526.57, -1222.90, 18.43), price = 290000 },
    { coords = vector3(-1305.40, -706.24, 25.35), price = 310000 },

    -- Jug / Grove / Davis
    { coords = vector3(33.23, -1347.85, 29.50),   price = 300000 },
    { coords = vector3(129.22, -1292.35, 29.27),  price = 280000 },
    { coords = vector3(287.65, -1282.65, 29.66),  price = 260000 },
    { coords = vector3(289.01, -1256.55, 29.44),  price = 260000 },
    { coords = vector3(-56.19, -1752.53, 29.45),  price = 240000 },
    { coords = vector3(-261.69, -2012.64, 30.12), price = 250000 },
    { coords = vector3(-273.00, -2025.60, 30.20), price = 250000 },

    -- Vinewood / Mirror Park / Rockford / Del Perro
    { coords = vector3(157.77, 233.55, 106.45),   price = 420000 },
    { coords = vector3(285.20, 143.57, 104.97),   price = 400000 },
    { coords = vector3(381.28, 323.25, 103.27),   price = 360000 },
    { coords = vector3(-164.57, 233.51, 94.92),   price = 390000 },
    { coords = vector3(1153.88, -326.54, 69.25),  price = 300000 },
    { coords = vector3(1168.98, -457.24, 66.64),  price = 300000 },
    { coords = vector3(1139.02, -469.89, 66.79),  price = 290000 },
    { coords = vector3(1077.69, -775.80, 58.22),  price = 280000 },
    { coords = vector3(-846.30, -340.40, 38.69),  price = 410000 },
    { coords = vector3(-1409.39, -99.26, 52.47),  price = 370000 },
    { coords = vector3(-1415.91, -211.83, 46.50), price = 380000 },
    { coords = vector3(-1430.11, -211.01, 46.50), price = 380000 },
    { coords = vector3(-1570.20, -546.65, 34.96), price = 360000 },
    { coords = vector3(-2072.41, -316.96, 13.35), price = 300000 },
    { coords = vector3(-1827.04, 785.52, 138.02), price = 270000 },

    -- Zapadna obala
    { coords = vector3(-2975.72, 379.77, 14.99),  price = 250000 },
    { coords = vector3(-3044.22, 595.24, 7.60),   price = 240000 },
    { coords = vector3(-3144.13, 1127.42, 20.87), price = 220000 },
    { coords = vector3(-3241.10, 996.69, 12.50),  price = 230000 },
    { coords = vector3(-3241.11, 1009.15, 12.88), price = 230000 },

    -- Sandy Shores / Grapeseed / Harmony / Senora
    { coords = vector3(540.04, 2671.01, 42.18),   price = 200000 },
    { coords = vector3(2564.40, 2585.10, 38.02),  price = 190000 },
    { coords = vector3(2558.68, 349.60, 108.05),  price = 210000 },
    { coords = vector3(2558.05, 389.48, 108.66),  price = 210000 },
    { coords = vector3(1967.33, 3744.29, 32.27),  price = 200000 },
    { coords = vector3(1821.92, 3683.48, 34.24),  price = 200000 },
    { coords = vector3(1702.84, 4933.59, 42.05),  price = 180000 },
    { coords = vector3(1686.75, 4815.81, 42.01),  price = 180000 },

    -- Paleto
    { coords = vector3(-386.73, 6045.95, 31.50),  price = 190000 },
    { coords = vector3(-284.04, 6224.39, 31.19),  price = 190000 },
    { coords = vector3(-135.17, 6365.74, 31.10),  price = 200000 },
    { coords = vector3(155.43, 6641.99, 31.78),   price = 180000 },
    { coords = vector3(174.67, 6637.22, 31.78),   price = 180000 },
    { coords = vector3(1703.14, 6426.78, 32.73),  price = 170000 },
    { coords = vector3(1735.11, 6411.04, 35.16),  price = 170000 },
}
