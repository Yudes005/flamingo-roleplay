Config = {}

-- Lokacije kladionice (NPC). coords = mjesto gdje NPC stoji (x, y, z, heading).
-- Koordinate uzmi npr. sa /coords ili vMenu -> "Show coordinates" i samo ih upiši ovdje.
-- Možeš dodati koliko hoćeš lokacija.
Config.Locations = {
    { coords = vec4(195.17, -933.77, 30.69, 144.5), ped = 'a_m_y_business_03', blip = true },
    -- { coords = vec4(-1285.0, -1117.0, 6.99, 90.0), ped = 'a_f_y_business_02', blip = true },
}

Config.Blip = {
    sprite = 108,
    color = 48,
    scale = 0.8,
    label = 'Kladionica',
}

-- 'auto'   = koristi ox_target ako je pokrenut, inače [E] tekst
-- 'target' = samo ox_target
-- 'textui' = samo [E] tekst (ox_lib TextUI)
Config.Interaction = 'auto'
Config.InteractDistance = 2.0
Config.PedScenario = 'WORLD_HUMAN_CLIPBOARD'

-- Ime itema (papirni tiket) u ox_inventory/data/items.lua
Config.TicketItem = 'kladionica_tiket'

Config.Currency = '$'
