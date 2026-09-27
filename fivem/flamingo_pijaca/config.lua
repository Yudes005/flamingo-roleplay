Config = {}

-- ============================================================
--  NPC koji izdaje tezge
-- ============================================================
Config.Npc = {
    model = `a_m_m_business_01`,
    coords = vector4(-1322.4492, -1348.7338, 4.5153, 286.5812),
    scenario = 'WORLD_HUMAN_CLIPBOARD', -- animacija dok stoji
    name = 'Zakupac pijace',
    interactDistance = 2.5, -- na kojoj udaljenosti se pojavljuje keyprompt
}

-- ============================================================
--  Tezge (stalls) - dodaj nove po istom obrascu, id mora biti unikatan
-- ============================================================
Config.Stalls = {
    {
        id = 1,
        label = 'Tezga #1',
        coords = vector4(-1331.6011, -1314.7418, 4.8325, 117.0532),
    },
    -- { id = 2, label = 'Tezga #2', coords = vector4(0.0, 0.0, 0.0, 0.0) },
}

-- ============================================================
--  Iznajmljivanje
-- ============================================================
Config.Rent = {
    pricePerHour = 1500, -- cena za 1 sat najma
    minHours = 1,        -- najmanje sati koje igrac moze da upise
    maxHours = 5,        -- najvise sati koje igrac moze da upise
    account = 'money',   -- odakle se placa najam: 'money' (kes) ili 'bank'
}

Config.StallInteractDistance = 2.5 -- na kojoj udaljenosti od tezge radi keyprompt (vlasnik/kupci)
Config.ActionMaxDistance = 6.0     -- server-side provera da igrac stvarno stoji blizu tezge / NPC-a
Config.ExpireWarningMinutes = 10   -- koliko minuta pre isteka najma vlasnik dobija upozorenje

-- ============================================================
--  Prodaja
-- ============================================================
Config.Sale = {
    account = 'money', -- kupac placa i prodavac dobija na: 'money' (kes) ili 'bank'
    minPrice = 1,      -- najmanja cena po komadu
    maxPrice = 1000000 -- najveca cena po komadu
}

-- Itemi koji ne mogu da se stave na tezgu
Config.BlacklistedItems = {
    money = true,
    black_money = true,
}

-- ============================================================
--  ox_inventory stash-evi
-- ============================================================
Config.StallSlots = 30
Config.StallMaxWeight = 200000 -- u gramima (200kg)

-- Kad najam istekne a vlasnik nije online (ili nema mesta u inventaru),
-- roba ide u njegov licni "povrat" magacin koji preuzima kod NPC-a.
Config.ReturnSlots = 50
Config.ReturnMaxWeight = 1000000

-- Prefiksi za ox_inventory stash id-jeve (ne menjaj dok server radi)
Config.StallStashPrefix = 'flamingo_pijaca_tezga_'
Config.ReturnStashPrefix = 'flamingo_pijaca_povrat_'

function Config.StallStashId(stallId)
    return Config.StallStashPrefix .. tostring(stallId)
end
