Config = {}

-- Preset koji svaki igrac dobija automatski kad prvi put udje na server.
-- Igrac posle moze sam da promeni preko /grafika (izbor se pamti kod njega).
Config.DefaultPreset = 'prirodno'

-- Jacina efekta od 0.0 do 1.0 (igrac menja preko /grafikajacina 0-100)
Config.DefaultStrength = 0.8

-- Koliko sekundi traje prelaz izmedju dnevnog i nocnog izgleda
Config.TransitionTime = 6.0

-- Od kog do kog sata (vreme u igri) se koristi nocni modifier
Config.NightStart = 20
Config.NightEnd = 6

-- Redosled prikaza u komandi /grafika
Config.PresetOrder = { 'off', 'prirodno', 'film', 'ultra' }

-- day/night = imena modifiera iz data/timecycle_mods_flamingo.xml
-- lodScale  = koliko dalje se renderuju detalji (1.0 = vanilla). Trosi FPS!
Config.Presets = {
    off = {
        label = 'Iskljuceno (vanilla GTA)',
    },
    prirodno = {
        label = 'Prirodno - blago jace boje, lepsa svetla nocu',
        day = 'flamingo_prirodno_dan',
        night = 'flamingo_prirodno_noc',
    },
    film = {
        label = 'Filmski - jace boje, vise bloom-a i vinjete',
        day = 'flamingo_film_dan',
        night = 'flamingo_film_noc',
    },
    ultra = {
        label = 'Ultra - filmski + dalji LOD (samo za jace PC-jeve)',
        day = 'flamingo_film_dan',
        night = 'flamingo_film_noc',
        lodScale = 1.35,
    },
}
