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
