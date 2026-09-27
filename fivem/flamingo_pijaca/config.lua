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
--  Podesavanja iznajmljivanja
-- ============================================================
Config.MaxRentSeconds = 5 * 60 * 60 -- 5 sati, posle isteka tezga se automatski oslobadja
Config.StallInteractDistance = 2.5   -- na kojoj udaljenosti od tezge radi keyprompt (vlasnik/kupci)
Config.BuyMaxDistance = 5.0          -- server-side provera da igrac stvarno stoji blizu tezge kad kupuje

-- ============================================================
--  ox_inventory stash (magacin robe na tezgi)
-- ============================================================
Config.StallSlots = 30
Config.StallMaxWeight = 200000 -- u gramima (200kg)

-- ============================================================
--  Novac
-- ============================================================
-- 'money' = kes, 'bank' = racun u banci (ESX account)
Config.Currency = 'money'

-- ============================================================
--  Ostalo
-- ============================================================
Config.Locale = 'sr' -- samo informativno, svi tekstovi su vec na srpskom u kodu
