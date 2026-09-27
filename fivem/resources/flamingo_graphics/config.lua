Config = {}

-- Sta svaki igrac dobija cim udje na server (dok ne promeni u M meni -> Podesavanja -> Grafika).
-- Iste vrednosti su podrazumevane i u flamingo_mmenu (client/client.lua -> DefaultSettings).
Config.Defaults = {
    preset = 'prirodno',   -- vidi Config.Presets
    strength = 80,         -- jacina efekta 0-100
    dayNight = true,       -- poseban izgled nocu (lepsa svetla grada)
    lod = 100,             -- daljina detalja u % (100 = vanilla, max Config.MaxLod)
    softShadows = false,   -- meke senke
    vehicleLights = false, -- jaca svetla vozila
}

Config.MaxLod = 150

-- Koliko sekundi traje glatki prelaz izmedju preseta / dana i noci
Config.TransitionTime = 4.0

-- Od kog do kog sata (vreme u igri) se koristi nocni modifier
Config.NightStart = 20
Config.NightEnd = 6

-- Tip senki za "Meke senke"
Config.SoftShadowType = 'CSM_ST_SOFT16'

-- Koliko jace svetle farovi kad je ukljuceno "Jaca svetla vozila" (1.0 = vanilla)
Config.VehicleLightMultiplier = 1.6

-- day/night = imena modifiera iz data/timecycle_mods_flamingo.xml
-- ID-evi moraju da se poklapaju sa GRAPHICS_PRESETS u flamingo_mmenu/html/js/script.js
Config.Presets = {
    off      = {},
    prirodno = { day = 'flamingo_prirodno_dan', night = 'flamingo_prirodno_noc' },
    zivo     = { day = 'flamingo_zivo_dan',     night = 'flamingo_zivo_noc' },
    film     = { day = 'flamingo_film_dan',     night = 'flamingo_film_noc' },
    toplo    = { day = 'flamingo_toplo_dan',    night = 'flamingo_toplo_noc' },
    hladno   = { day = 'flamingo_hladno_dan',   night = 'flamingo_hladno_noc' },
    crnobelo = { day = 'flamingo_crnobelo' },
}
