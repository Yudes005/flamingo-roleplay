local ESX = exports['es_extended']:getSharedObject()

-- ============================================================
--  FLAMINGO KOCKICE - klijent
--
--  Tok:
--  1) G (radial) -> Osnovne akcije -> Kockice
--  2) Otvara se flamingo_input prozor "Suma uloga"
--  3) Server salje ponudu najblizem igracu (flamingo_odbiprihvati)
--  4) Ako prihvati - bacaju se kockice, rezultat stize u esx_notify
--
--  Iz drugih resursa: exports['flamingo_kockice']:OpenDice()
-- ============================================================

local function notify(msg, notifyType, duration)
    if GetResourceState('esx_notify') == 'started' then
        exports['esx_notify']:Notify(msg, notifyType or 'info', duration or 5000, 'Kockice', 'fa-solid fa-dice')
    else
        ESX.ShowNotification(msg, notifyType, duration)
    end
end

RegisterNetEvent('flamingo_kockice:client:notify', notify)

-- ============================================================
--  ZVUKOVI
-- ============================================================

local function playSound(name)
    local sounds = Config.Sounds
    if not sounds or not sounds.enabled then return end

    if name == 'roll' then
        if (sounds.rollVolume or 0) <= 0 then return end

        SendNUIMessage({
            action   = 'roll',
            volume   = sounds.rollVolume,
            duration = (Config.RollDelay or 2000) / 1000
        })
        return
    end

    local s = sounds[name]
    if s then
        PlaySoundFrontend(-1, s.name, s.set, true)
    end
end

RegisterNetEvent('flamingo_kockice:client:sound', playSound)

-- ============================================================
--  COOLDOWN
--  Server je taj koji odlucuje - ovde se samo pamti da se prozor
--  za unos uopste ne otvara dok cooldown traje.
-- ============================================================

local cooldownEnd = 0

RegisterNetEvent('flamingo_kockice:client:cooldown', function(seconds)
    cooldownEnd = GetGameTimer() + (tonumber(seconds) or 0) * 1000
end)

local function cooldownLeft()
    local left = cooldownEnd - GetGameTimer()
    if left <= 0 then return 0 end

    return math.ceil(left / 1000)
end

local function getClosestPlayer()
    local myPed    = PlayerPedId()
    local myCoords = GetEntityCoords(myPed)
    local myId     = PlayerId()

    local closestId, closestDist = nil, Config.MaxDistance

    for _, player in ipairs(GetActivePlayers()) do
        if player ~= myId then
            local ped = GetPlayerPed(player)

            if ped ~= 0 and DoesEntityExist(ped) then
                local dist = #(myCoords - GetEntityCoords(ped))

                if dist < closestDist then
                    closestDist = dist
                    closestId   = GetPlayerServerId(player)
                end
            end
        end
    end

    return closestId
end

local opening = false

local function openDice()
    if opening then return end

    local left = cooldownLeft()
    if left > 0 then
        playSound('error')
        return notify(('Sačekaj još %d s pre nove partije kockica.'):format(left), 'error')
    end

    if GetResourceState('flamingo_input') ~= 'started' then
        return notify('Sistem za unos trenutno nije dostupan.', 'error')
    end

    local ped = PlayerPedId()
    if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) then
        return notify('Sada ne možeš da se kockaš.', 'error')
    end

    local target = getClosestPlayer()
    if not target then
        return notify('Nema nikoga dovoljno blizu za kockanje.', 'error')
    end

    opening = true

    CreateThread(function()
        -- Kratka pauza da radial prvo zatvori i pusti NUI fokus.
        Wait(150)

        local amount = exports['flamingo_input']:Input({
            title       = 'Suma uloga',
            description = 'Unesite sumu u dolarima',
            type        = 'number',
            placeholder = ('npr. %d'):format(math.max(Config.MinBet, 1000)),
            min         = Config.MinBet,
            max         = Config.MaxBet,
            prefix      = '$',
            quick       = Config.QuickAmounts,
            icon        = 'fa-solid fa-dice',
            confirm     = 'Ok',
            cancel      = 'Otkaži'
        })

        opening = false

        amount = math.floor(tonumber(amount) or 0)
        if amount < 1 then return end -- otkazano

        TriggerServerEvent('flamingo_kockice:server:request', amount, target)
    end)
end

exports('OpenDice', openDice)
AddEventHandler('flamingo_kockice:client:open', openDice)
RegisterCommand('kockice', openDice, false)

-- ============================================================
--  ANIMACIJA BACANJA
-- ============================================================

RegisterNetEvent('flamingo_kockice:client:rolling', function()
    playSound('roll')

    local anim = Config.RollAnim
    if not anim then return end

    local ped = PlayerPedId()
    if IsEntityDead(ped) or IsPedInAnyVehicle(ped, false) then return end

    RequestAnimDict(anim.dict)

    local deadline = GetGameTimer() + 2000
    while not HasAnimDictLoaded(anim.dict) do
        if GetGameTimer() > deadline then return end
        Wait(10)
    end

    TaskPlayAnim(ped, anim.dict, anim.name, 8.0, -8.0, anim.duration or 1500, 48, 0, false, false, false)
    RemoveAnimDict(anim.dict)
end)
