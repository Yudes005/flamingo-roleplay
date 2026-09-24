return {
    ----------------------------------------------------------------
    -- LOKACIJE PERIONICA
    ----------------------------------------------------------------
    -- coords = tacka gde se pojavljuje [E] prompt (ulaz u perionicu)
    -- label  = ime koje se vidi na blipu i u meniju
    --
    -- BIZNIS (flamingo_biznisi): svaka lokacija je poseban biznis, prepoznaje se po coords
    -- (ne pomeraj ih posle kupovine). Vlasnik dobija 35% od svakog pranja
    -- (Config.Carwash.share u flamingo_biznisi). Cena perionice: dodaj bizPrice = 600000
    -- u lokaciju, inace vazi Config.Carwash.defaultPrice.
    --
    -- NAPOMENA: koordinate su standardne GTA perionice. Ako neka kod tebe
    -- na mapi nije tacno na mestu (custom MLO, promenjena mapa...), samo
    -- stani na zeljeno mesto i iskucaj koordinate pa ih zameni ovde.
    locations = {
        { label = 'Hands On Car Wash',  coords = vec3(26.47, -1392.17, 29.32) },
        { label = 'Little Seoul',       coords = vec3(-699.53, -932.31, 19.01) },
        { label = 'Mirror Park',        coords = vec3(1366.29, 3591.76, 34.94) },
        { label = 'Paleto Bay',         coords = vec3(-74.29, 6420.36, 31.49) },
        { label = 'Popular Street',     coords = vec3(174.66, -1736.24, 29.29) },
    },

    ----------------------------------------------------------------
    -- PAKETI PRANJA
    ----------------------------------------------------------------
    -- id       = mora biti jedinstven (koristi ga i server za naplatu)
    -- price    = cena u dolarima
    -- duration = koliko traje pranje (u milisekundama)
    -- features = sta paket radi:
    --      dirt    -> skida prljavstinu sa karoserije
    --      decals  -> skida tragove blata, metaka i ogrebotina od farbe
    --      windows -> vraca polomljena stakla
    --      tyres   -> krpi izduvane gume
    --      wax     -> vozilo ostaje cisto narednih 'waxMinutes' minuta
    --
    -- Perionica NAMERNO ne popravlja motor i karoseriju - to ostaje posao
    -- repair kita / mehanicara.
    packages = {
        {
            id = 'brzo',
            label = 'Brzo pranje',
            desc = 'Voda i cetke, gotovo za minut',
            price = 250,
            duration = 8000,
            features = { dirt = true },
        },
        {
            id = 'standard',
            label = 'Pranje i stakla',
            desc = 'Karoserija, stakla i tragovi sa puta',
            price = 600,
            duration = 14000,
            features = { dirt = true, decals = true, windows = true },
        },
        {
            id = 'detailing',
            label = 'Detailing',
            desc = 'Kompletno sredjivanje sa poliranjem',
            price = 1400,
            duration = 20000,
            features = { dirt = true, decals = true, windows = true, tyres = true, wax = true },
        },
    },

    -- Koliko minuta posle 'wax' paketa vozilo ostaje cisto (prljavstina se
    -- automatski vraca na nulu dok traje zastita).
    waxMinutes = 25,

    ----------------------------------------------------------------
    -- INTERAKCIJA
    ----------------------------------------------------------------
    -- Na kojoj udaljenosti (u metrima) od tacke perionice igrac dobija [E]
    washRange = 6.0,

    -- Da li igrac mora da bude za volanom (true) ili moze i kao putnik/peske
    -- pored vozila (false)
    driverOnly = true,

    -- Vozilo se zamrzne dok traje pranje (da ne moze da se izvuce iz kabine)
    freezeVehicle = true,

    -- Koliko sekundi igrac mora da saceka izmedju dva pranja (anti-spam)
    cooldown = 20,

    ----------------------------------------------------------------
    -- BLIP
    ----------------------------------------------------------------
    blip = {
        enabled = true,
        sprite = 100,       -- ako ti se ikonica ne svidja, probaj 524 ili 446
        color = 3,          -- 3 = svetlo plava
        scale = 0.75,
        label = 'Auto perionica',
    },

    ----------------------------------------------------------------
    -- NAPLATA (isto kao u flamingo_pumpa)
    ----------------------------------------------------------------
    --   primaryAccount  = nalog koji se naplacuje prvi ('money' = kes)
    --   fallbackAccount = ostatak se skida odavde ('bank' = banka)
    --   useBothAccounts = false ako zelis naplatu SAMO sa primarnog naloga
    payment = {
        primaryAccount = 'money',
        fallbackAccount = 'bank',
        useBothAccounts = true,
    },
}
