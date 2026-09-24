return {
    -- Cena po litru goriva
    pricePerLiter = 20,

    -- "Virtuelni" kapacitet rezervoara u litrima, samo za lep prikaz/racunanje cene.
    -- ox_fuel interno i dalje radi sa procentima (0-100), ovo se koristi da se
    -- ti procenti pretvore u litre za meni.
    tankLiters = 80,

    -- Na kojoj udaljenosti (u metrima) od pumpe igrac dobija [E] prompt kad je PESKE
    pumpRange = 3.0,

    -- Isto to, ali kad je igrac U VOZILU (vece jer se autom ne moze prici
    -- fizickom crevu pumpe kao peske) - ovo omogucava sipanje BEZ izlaska iz auta
    pumpRangeVehicle = 5.5,

    -- Na kojoj udaljenosti (u metrima) od igraca se trazi vozilo da bi meni
    -- za sipanje goriva bio dostupan (ako nema vozila u blizini, prikazuje se
    -- samo opcija za kanister)
    vehicleRange = 5.0,

    -- Traka napretka dok se sipa gorivo (koristi flamingo_progressbar).
    -- enabled = false -> sipanje je trenutno, tacno kao do sada.
    -- Trajanje se racuna kao litri * perLiter, ograniceno na min/max.
    refuelProgress = {
        enabled = false,
        perLiter = 120, -- ms po litru
        min = 2000,
        max = 12000,
    },

    -- Kanister - cene MORAJU da odgovaraju ox_fuel/config.lua -> petrolCan,
    -- jer se placanje i dalje radi preko ox_fuel-ovog servera (ox_fuel:fuelCan)
    canister = {
        enabled = true,
        buyPrice = 1000,
        refillPrice = 800,
        maxBuyQty = 5, -- max koliko kanistera odjednom moze da se kupi (refill je uvek x1)
    },

    -- Kupovina repair kita OVDE NA PUMPI (pored kupovine kanistera).
    -- Cena MORA da odgovara flamingo_repair/config.lua -> repairKitPrice,
    -- jer se kupovina i dalje radi preko flamingo_repair-ovog servera
    -- ('flamingo_repair:buyKit' event) - flamingo_pumpa samo prosledi taj
    -- event, ne zna nista o inventaru/ceni sama. Ako flamingo_repair nije
    -- pokrenut, ova kolona se automatski sakriva u meniju.
    repairKit = {
        enabled = true,
        price = 1500,
        maxBuyQty = 10,
    },

    -- FIX (flamingo): server NE koristi ox_inventory 'money' item za placanje
    -- (nema money itema u inventaru) - koristi se standardni ESX sistem
    -- novca (kes/banka). Ovde se podesava sa kog naloga se naplacuje gorivo.
    --   primaryAccount   = nalog koji se naplacuje prvi (obicno 'money' = kes)
    --   fallbackAccount  = ako na primarnom nema dovoljno, uzima se ostatak
    --                      odavde (obicno 'bank' = banka)
    --   useBothAccounts  = false ako zelis da se naplacuje SAMO sa primarnog
    --                      naloga (npr. samo kes, nikad banka)
    payment = {
        primaryAccount = 'money',
        fallbackAccount = 'bank',
        useBothAccounts = true,
    },
}
