Config = {}

-- Interakcija
Config.InteractKey      = 38      -- E
Config.InteractDistance = 2.0     -- koliko blizu salteru banke moras da budes
Config.AutoCloseDistance = 4.0    -- ako se udaljis ovoliko dok je banka otvorena, zatvara se

-- esx_notify / esx_keyprompt
Config.NotifyTitle = 'Banka'
Config.NotifyIcon  = nil  -- nil = ikonica po tipu (success/error). Npr. 'fa-solid fa-building-columns' za istu ikonicu uvek
Config.PromptBank  = 'Da otvoriš banku'
Config.PromptATM   = 'Da koristiš bankomat'

-- Server provera (anti-cheat): koliko daleko od konfigurisane banke sme da bude igrac
Config.ServerBankDistance = 8.0
-- Koliko sme da se pomeri od mesta gde je otvorio banku/bankomat dok radi transakciju
Config.ServerSessionDistance = 6.0

-- Pauza izmedju dve transakcije (ms), protiv spama
Config.ActionCooldown = 1000

-- Banke (salteri). Proveri koordinate na svom serveru i po potrebi ih pomeri.
Config.Banks = {
    { name = 'Fleeca Banka',          coords = vector3(149.91, -1040.74, 29.37) },
    { name = 'Fleeca Banka',          coords = vector3(314.19, -278.62, 54.17) },
    { name = 'Fleeca Banka',          coords = vector3(-350.99, -49.99, 49.04) },
    { name = 'Fleeca Banka',          coords = vector3(-1213.30, -330.49, 37.79) },
    { name = 'Fleeca Banka',          coords = vector3(-2962.58, 482.63, 15.70) },
    { name = 'Fleeca Banka',          coords = vector3(1175.07, 2706.64, 38.09) },
    { name = 'Pacific Standard',      coords = vector3(243.20, 224.60, 106.29) },
    { name = 'Blaine County Savings', coords = vector3(-112.20, 6469.29, 31.63) },
}

Config.Blip = {
    enabled = true,
    sprite  = 108,
    color   = 2,
    scale   = 0.7,
    label   = 'Banka'
}

-- Bankomati (prepoznaju se po modelu propa, nema potrebe za koordinatama)
Config.EnableATMs = true
Config.ATMModels = {
    `prop_atm_01`,
    `prop_atm_02`,
    `prop_atm_03`,
    `prop_fleeca_atm`
}
Config.ATMDistance       = 1.3

-- Bankomat: samo podizanje i uplata (bez transfera)
-- Provizija i limit po transakciji zavise od paketa kartice (Config.Cards)
Config.ATM = {
    quick = { 1000, 5000, 10000, 25000, 50000, 100000 } -- brzi iznosi na ekranu
}

-- Transfer: provizija i limit zavise od paketa kartice (Config.Cards)

-- Bankovni racun (novi igraci moraju otvoriti racun na salteru banke pre koriscenja banke/bankomata)
Config.RequireAccount = true                    -- ako je false, svi vec imaju "racun" kao i do sada (bez ovog sistema)
Config.CardItem       = 'bankovna_kartica'       -- naziv ESX inventory itema koji igrac dobija otvaranjem racuna
Config.CardLabel      = 'Bankovna kartica'       -- labela za taj item (upisuje se u "items" tabelu ako ne postoji)
Config.WelcomeBonus   = 0                        -- pocetni bonus na racunu pri otvaranju (0 = iskljuceno), npr. 500

-- ============================================================
--  Kartica + PIN
-- ============================================================
Config.RequireCardItem = true   -- bankomat radi samo ako imas karticu (item) u inventaru
Config.PinLength       = 4      -- broj cifara PIN-a
Config.PinMaxTries     = 3      -- posle ovoliko pogresnih PIN-ova kartica se blokira (odblokira se resetom PIN-a na salteru)
Config.ReissueFee      = 500    -- cena nove kartice (izgubljena / ukradena), skida se sa racuna
Config.PinResetFee     = 250    -- cena reseta zaboravljenog PIN-a na salteru (0 = besplatno)

-- Odrzavanje kartice: skida se sa racuna na svakih `days` dana (realno vreme, naplacuje se dok je igrac u gradu).
-- Ako nema dovoljno novca, kartica se automatski vraca na Config.DefaultCard paket.
Config.Maintenance = {
    enabled = true,
    days    = 7,
    label   = 'nedeljno'   -- tekst na kartici, npr. "1.500$ / nedeljno"
}

Config.DefaultCard = 'standard' -- paket za stare racune (pre ovog sistema) i kad se ne plati odrzavanje

-- Paketi kartica (redosled = redosled u UI-ju)
--   price       -> jednokratna cena pri otvaranju racuna / prelasku na paket
--   maintenance -> cena odrzavanja (vidi Config.Maintenance)
--   atmFee      -> % provizije SAMO na podizanje sa bankomata (uplata i salter banke su bez provizije)
--   atmLimit    -> max iznos po jednoj transakciji na bankomatu
--   transferFee -> % provizije na transfer (banka + telefon)
--   maxTransfer -> max iznos po jednom transferu
--   cashback    -> % povrata kod placanja karticom (export CardPayment, npr. iz prodavnica)
--   theme       -> izgled kartice u UI-ju: 'green' | 'dark' | 'gold'
Config.Cards = {
    {
        id = 'standard', label = 'Standard', theme = 'green',
        price = 0, maintenance = 0,
        atmFee = 15, atmLimit = 50000,
        transferFee = 0, maxTransfer = 500000,
        cashback = 0
    },
    {
        id = 'premium', label = 'Premium', theme = 'dark',
        price = 15000, maintenance = 1500,
        atmFee = 10, atmLimit = 250000,
        transferFee = 0, maxTransfer = 2000000,
        cashback = 1
    },
    {
        id = 'gold', label = 'Gold', theme = 'gold',
        price = 75000, maintenance = 5000,
        atmFee = 5, atmLimit = 1000000,
        transferFee = 0, maxTransfer = 15000000,
        cashback = 3
    },
}

-- Telefon (flamingo_telefon -> aplikacija Banka)
Config.PhoneTransfer    = true   -- dozvoli slanje novca preko telefona
Config.PhoneRecentLimit = 6      -- koliko poslednjih transfera se vidi u aplikaciji

-- Istorija / statistika
Config.HistoryLimit = 150         -- koliko poslednjih transakcija se salje u UI
Config.StatsDays    = 30          -- period za statistiku i grafikon

-- Brza dugmad za iznos u UI
Config.QuickAmounts = { 50, 100, 500, 1000, 5000, 10000 }

-- ============================================================
--  Kazne (flamingo_policija) - kazne se plaćaju ISKLJUČIVO ovde, u banci
-- ============================================================
Config.Fines = {
    enabled  = true,               -- prikazuje karticu "Kazne" u meniju banke
    resource = 'flamingo_policija', -- ime PD resursa (mora imati GetUnpaidFines/PayFine exporte)
    atm      = false,               -- da li se kazne mogu platiti i na bankomatu (false = samo na šalteru banke)
}
