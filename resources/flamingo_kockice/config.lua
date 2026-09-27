Config = {}

-- Najmanji i najveci ulog (u dolarima).
Config.MinBet = 100
Config.MaxBet = 5000000

-- Sa kog naloga ide novac: 'money' (keš) ili 'bank'.
Config.Account = 'money'

-- Koliko blizu (u metrima) drugi igrac mora da bude.
Config.MaxDistance = 3.0

-- Koliko dugo (ms) protivnik ima da prihvati/odbije ponudu.
Config.OfferTimeout = 15000

-- Cooldown (sekunde): posle poslate ponude i posle svake odigrane
-- partije (za oba igraca) mora da prodje ovoliko pre nove partije.
Config.Cooldown = 10

-- Broj strana kockice.
Config.DiceSides = 6

-- Koliko traje "bacanje" (ms) pre nego sto se pokaze rezultat.
Config.RollDelay = 2000

-- Animacija dok se bacaju kockice (nil = bez animacije).
Config.RollAnim = { dict = 'mp_common', name = 'givetake1_a', duration = 1500 }

-- ============================================================
--  ZVUKOVI
--  roll  = zvuk kockica koje se tresu i padaju na sto (pravi se u
--          NUI-u, nije potreban nikakav fajl). Volume 0.0 - 1.0.
--  win / lose / draw / error = GTA zvukovi (PlaySoundFrontend).
--  Stavi nil na bilo koji da ga iskljucis.
-- ============================================================
Config.Sounds = {
    enabled    = true,
    rollVolume = 0.6,
    win   = { name = 'LOCAL_PLYR_CASH_COUNTER_COMPLETE', set = 'DLC_HEISTS_GENERAL_FRONTEND_SOUNDS' },
    lose  = { name = 'LOSER',                            set = 'HUD_AWARDS' },
    draw  = { name = 'CHECKPOINT_NORMAL',                set = 'HUD_MINI_GAME_SOUNDSET' },
    error = { name = 'ERROR',                            set = 'HUD_FRONTEND_DEFAULT_SOUNDSET' }
}

-- Igraci u ovom krugu (metri) oko kockara takodje vide rezultat.
-- 0 = rezultat vide samo ta dvojica.
Config.AnnounceRadius = 10.0

-- Brzi iznosi (dugmici ispod polja za unos).
Config.QuickAmounts = { 1000, 10000, 100000, 1000000 }

-- Koliko dugo (ms) stoji notifikacija sa rezultatom.
Config.ResultDuration = 7000

-- ============================================================
--  UUID IGRACA (prikazuje se kao #12345 u notifikacijama)
--  Prilagodi ovo svom serveru - redom se proverava:
--  state bag, pa ESX xPlayer.get(...), pa metadata.
--  Ako nista ne postoji, prikazuje se server ID igraca.
--  (Poziva se samo na serveru.)
-- ============================================================
Config.GetUid = function(source, xPlayer)
    local state = Player(source).state
    local uid = state and (state.uuid or state.uid or state.pid)

    if not uid and xPlayer then
        if xPlayer.get then
            uid = xPlayer.get('uuid') or xPlayer.get('uid')
        end

        if not uid and xPlayer.getMeta then
            local ok, meta = pcall(xPlayer.getMeta, 'uuid')
            if ok then uid = meta end
        end
    end

    return uid or source
end
