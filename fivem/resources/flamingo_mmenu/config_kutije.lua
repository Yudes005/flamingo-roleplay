-- ============================================================
--  KUTIJE I MOJI PAKETI
--  Sve što igrač kupi (kutija, vozilo, predmet, novac) prvo ide
--  u "Moji paketi". Tamo se kutija otvara, a nagrada aktivira
--  ili prodaje za Flamingo Coine.
-- ============================================================
-- Ovaj fajl se učitava POSLE config.lua i samo dopunjava postojeći Config.
Config = Config or {}
Config.Crates = Config.Crates or {}
Config.MoneyPackages = Config.MoneyPackages or {}
Config.ReferralMilestones = Config.ReferralMilestones or {}
Config.DailyRewards = Config.DailyRewards or {}
Config.PlaytimeMilestones = Config.PlaytimeMilestones or {}
Config.DailyTasks = Config.DailyTasks or {}
Config.SocialLinks = Config.SocialLinks or {}

-- retkosti (boja i naziv se koriste u UI-u: traka na vrhu nagrade, sjaj, rulet)
-- highlight = true -> kartica na ruletu ima okvir u boji retkosti
Config.Retkosti = {
    obicno      = { label = 'Obično',      color = '#8a96a3' },
    retko       = { label = 'Retko',       color = '#3ea6ff' },
    epsko       = { label = 'Epsko',       color = '#a855f7' },
    legendarno  = { label = 'Legendarno',  color = '#ffc94a', highlight = true },
    ekskluzivno = { label = 'Ekskluzivno', color = '#1fd3a0', highlight = true },
}

-- koliko Coina se dobija kad se paket proda (procenat od coinValue nagrade)
Config.PaketProdajaProcenat = 0.55

-- najviše kutija u jednoj kupovini (klizač u UI-u ide do ovog broja)
Config.KutijeMaxKupovina = 50

-- "Dropovi" traka u detalju kutije: koliko poslednjih dobitaka se pamti
-- (čuva se u memoriji servera, briše se na restart resursa)
Config.KutijeDropovi = true
Config.KutijeDropoviBroj = 20

-- Oznaka "Ostalo: X dana":
--  * najbolje je svakoj kutiji dati `ends = 'GGGG-MM-DD'` (ili 'GGGG-MM-DD HH:MM');
--    posle tog datuma kutija nestaje iz prodavnice, a kupljene i dalje mogu da se otvore
--  * ako kutija nema `ends`, prikazuje se ovaj broj (nil = bez oznake)
Config.KutijeTrajanje = nil

-- Na koji račun ide keš iz kutija: 'money' (keš u ruci) ili 'bank'
Config.KutijeNovacRacun = 'money'

-- ============================================================
--  KUTIJE
--  image  : slika kutije u html/img/kutije/ (npr. 'premium.png'), ili pun
--           link (https://... / nui://...). Bez slike se crta kofer u boji retkosti.
--  ends   : datum do kog se kutija prodaje (opciono)
--
--  NAGRADE
--  kind      : 'vozilo' | 'predmet' | 'novac'
--  ref       : model vozila / naziv ox_inventory predmeta / 'money'
--  chance    : šansa u procentima (zbir po kutiji bi trebalo da bude 100)
--  coinValue : koliko paket vredi pri prodaji (pre procenta iznad)
--  image     : (opciono) slika nagrade. Predmeti automatski uzimaju sliku iz
--              ox_inventory (web/images/<ref>.png), novac uzima money_bag.png.
--              Za vozila stavi sliku u html/img/kutije/ i upiši ime ovde.
-- ============================================================
Config.Kutije = {
    {
        id = 'premium_auta',
        name = 'Premium automobili',
        desc = 'Transportna kutija. Iz nje ispadaju vozila različitih klasa, sve do najskupljih i najređih.',
        price = 600,
        icon = 'fa-car-side',
        rarity = 'ekskluzivno',
        image = nil,            -- npr. 'premium_auta.png'
        ends = nil,             -- npr. '2026-10-05'
        rewards = {
            { label = 'Pfister Comet S2',     kind = 'vozilo',  ref = 'comet6',    rarity = 'ekskluzivno', chance = 2,  coinValue = 5000 },
            { label = 'Ocelot Pariah',        kind = 'vozilo',  ref = 'pariah',    rarity = 'legendarno',  chance = 5,  coinValue = 3000 },
            { label = 'Karin Sultan RS',      kind = 'vozilo',  ref = 'sultanrs',  rarity = 'epsko',       chance = 10, coinValue = 1800 },
            { label = 'Annis Elegy RH8',      kind = 'vozilo',  ref = 'elegy2',    rarity = 'epsko',       chance = 13, coinValue = 1500 },
            { label = 'Vapid Dominator',      kind = 'vozilo',  ref = 'dominator', rarity = 'retko',       chance = 20, coinValue = 900 },
            { label = 'Declasse Vigero',      kind = 'vozilo',  ref = 'vigero',    rarity = 'obicno',      chance = 25, coinValue = 500 },
            { label = '15.000$ - 40.000$',    kind = 'novac',   ref = 'money',     rarity = 'obicno',      chance = 25, coinValue = 250, min = 15000, max = 40000 },
        }
    },
    {
        id = 'oruzje',
        name = 'Arsenal kutija',
        desc = 'U ovoj kutiji su oružja i municija, od pištolja do teških komada.',
        price = 400,
        icon = 'fa-gun',
        rarity = 'legendarno',
        rewards = {
            { label = 'Carbine Rifle',   kind = 'predmet', ref = 'WEAPON_CARBINERIFLE', rarity = 'ekskluzivno', chance = 3,  coinValue = 2500 },
            { label = 'SMG',             kind = 'predmet', ref = 'WEAPON_SMG',          rarity = 'legendarno',  chance = 7,  coinValue = 1500 },
            { label = 'Pump Shotgun',    kind = 'predmet', ref = 'WEAPON_PUMPSHOTGUN',  rarity = 'epsko',       chance = 12, coinValue = 900 },
            { label = 'Pistol',          kind = 'predmet', ref = 'WEAPON_PISTOL',       rarity = 'retko',       chance = 23, coinValue = 400 },
            { label = '50x municija',    kind = 'predmet', ref = 'ammo-9',              rarity = 'obicno',      chance = 30, coinValue = 150, amount = 50 },
            { label = '5.000$ - 15.000$', kind = 'novac',  ref = 'money',               rarity = 'obicno',      chance = 25, coinValue = 100, min = 5000, max = 15000 },
        }
    },
    {
        id = 'nedeljna',
        name = 'Nedeljna kutija',
        desc = 'Mešana kutija sa predmetima, kešom i povremeno vozilom.',
        price = 250,
        icon = 'fa-box-open',
        rarity = 'epsko',
        rewards = {
            { label = 'Vapid Dominator',   kind = 'vozilo',  ref = 'dominator', rarity = 'legendarno', chance = 3,  coinValue = 900 },
            { label = 'Pancir',            kind = 'predmet', ref = 'armour',    rarity = 'epsko',      chance = 12, coinValue = 400 },
            { label = 'Kalauz x2',         kind = 'predmet', ref = 'lockpick',  rarity = 'retko',      chance = 20, coinValue = 250, amount = 2 },
            { label = 'Zavoji x5',         kind = 'predmet', ref = 'bandage',   rarity = 'obicno',     chance = 30, coinValue = 100, amount = 5 },
            { label = 'Keš nagrada',       kind = 'novac',   ref = 'money',     rarity = 'obicno',     chance = 35, coinValue = 120, min = 3000, max = 12000 },
        }
    },
}
