local config = require 'config'
local ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false
local isWashing = false
local nearestLocation = nil
local lastWash = 0
local waxUntil = 0
local waxVehicle = nil

local function notify(message, notifyType)
    message = tostring(message or '')
    if message == '' then return end

    exports['esx_notify']:Notify(message, notifyType or 'info')
end

-------------------------------------------------
-- Blipovi
-------------------------------------------------

CreateThread(function()
    if not config.blip.enabled then return end

    for i = 1, #config.locations do
        local location = config.locations[i]
        local blip = AddBlipForCoord(location.coords.x, location.coords.y, location.coords.z)

        SetBlipSprite(blip, config.blip.sprite)
        SetBlipDisplay(blip, 4)
        SetBlipScale(blip, config.blip.scale)
        SetBlipColour(blip, config.blip.color)
        SetBlipAsShortRange(blip, true)

        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName(config.blip.label)
        EndTextCommandSetBlipName(blip)
    end
end)

-------------------------------------------------
-- Pomocne funkcije
-------------------------------------------------

local function getMoney()
    local playerData = ESX.GetPlayerData()
    local cash = playerData.money or 0
    local bank = 0

    if playerData.accounts then
        for i = 1, #playerData.accounts do
            if playerData.accounts[i].name == 'bank' then
                bank = playerData.accounts[i].money
                break
            end
        end
    end

    return cash + bank
end

-- Vozilo koje se pere: igrac mora da bude u vozilu (po defaultu za volanom).
local function getTargetVehicle()
    local vehicle = cache.vehicle
    if not vehicle then return nil end

    if config.driverOnly and cache.seat ~= -1 then return nil end

    return vehicle
end

local function findPackage(id)
    for i = 1, #config.packages do
        if config.packages[i].id == id then
            return config.packages[i]
        end
    end
end

-- GTA prljavstinu vodi kao 0.0 - 15.0; meni je prikazuje u procentima.
local function dirtPercent(vehicle)
    return math.floor((GetVehicleDirtLevel(vehicle) / 15.0) * 100 + 0.5)
end

-------------------------------------------------
-- Zastita posle detailinga ("vosak")
-------------------------------------------------
-- Dok traje, prljavstina se vraca na nulu cim vozilo pocne da se prlja.

CreateThread(function()
    while true do
        local wait = 1000

        if waxVehicle and GetGameTimer() < waxUntil then
            if DoesEntityExist(waxVehicle) then
                if GetVehicleDirtLevel(waxVehicle) > 0.0 then
                    SetVehicleDirtLevel(waxVehicle, 0.0)
                end

                wait = 2000
            else
                waxVehicle, waxUntil = nil, 0
            end
        elseif waxVehicle then
            waxVehicle, waxUntil = nil, 0
        end

        Wait(wait)
    end
end)

-------------------------------------------------
-- Samo pranje
-------------------------------------------------

local function applyPackage(vehicle, package)
    local features = package.features or {}

    if features.decals then
        WashDecalsFromVehicle(vehicle, 1.0)
    end

    if features.windows then
        for window = 0, 7 do
            FixVehicleWindow(vehicle, window)
        end
    end

    if features.tyres then
        for tyre = 0, 7 do
            SetVehicleTyreFixed(vehicle, tyre)
        end
    end

    if features.dirt then
        SetVehicleDirtLevel(vehicle, 0.0)
    end

    if features.wax then
        waxVehicle = vehicle
        waxUntil = GetGameTimer() + (config.waxMinutes * 60000)
    end
end

local function runWash(vehicle, package)
    isWashing = true

    if config.freezeVehicle then
        FreezeEntityPosition(vehicle, true)
    end

    -- Prljavstina se skida postepeno dok traje progres, da se vidi da se
    -- vozilo zaista pere, a ne da samo "pukne" cisto.
    local startDirt = GetVehicleDirtLevel(vehicle)
    local steps = 20
    local stepWait = math.floor(package.duration / steps)

    CreateThread(function()
        for step = 1, steps do
            if not DoesEntityExist(vehicle) then return end

            SetVehicleDirtLevel(vehicle, startDirt * (1 - (step / steps)))
            Wait(stepWait)
        end
    end)

    -- Traka napretka ide preko deljenog resursa flamingo_progressbar; ako on
    -- iz nekog razloga nije pokrenut, pada nazad na ox_lib traku.
    if GetResourceState('flamingo_progressbar') == 'started' then
        exports['flamingo_progressbar']:Progress({
            label = ('%s u toku...'):format(package.label),
            duration = package.duration,
            icon = 'fa-solid fa-spray-can-sparkles',
            canCancel = false,
            disable = { move = false, combat = true },
        })
    else
        lib.progressBar({
            duration = package.duration,
            label = ('%s u toku...'):format(package.label),
            useWhileDead = false,
            canCancel = false,
            disable = { move = true, car = true, combat = true },
        })
    end

    if config.freezeVehicle then
        FreezeEntityPosition(vehicle, false)
    end

    if DoesEntityExist(vehicle) then
        applyPackage(vehicle, package)
    end

    isWashing = false
    lastWash = GetGameTimer()

    notify(('Vozilo je oprano — %s.'):format(package.label), 'success')

    if package.features and package.features.wax then
        notify(('Zaštita drži narednih %d minuta.'):format(config.waxMinutes), 'info')
    end
end

-------------------------------------------------
-- Meni
-------------------------------------------------

local function closeMenu()
    if not isMenuOpen then return end

    isMenuOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

local function progressActive()
    if lib.progressActive() then return true end

    if GetResourceState('flamingo_progressbar') == 'started' then
        return exports['flamingo_progressbar']:IsActive()
    end

    return false
end

local function openMenu()
    if isMenuOpen or isWashing or progressActive() then return end

    local vehicle = getTargetVehicle()

    if not vehicle then
        return notify(config.driverOnly and 'Moraš biti za volanom.' or 'Moraš biti u vozilu.', 'error')
    end

    local remaining = math.ceil(((lastWash + (config.cooldown * 1000)) - GetGameTimer()) / 1000)

    if remaining > 0 then
        return notify(('Sačekaj još %d s pre sledećeg pranja.'):format(remaining), 'error')
    end

    isMenuOpen = true
    exports['esx_keyprompt']:HideKeyPrompt()

    -- vlasnik perionice (flamingo_biznisi); bez njega meni radi kao ranije
    lib.callback('flamingo_perionica:info', false, function(bizInfo)
        if not isMenuOpen then return end
        SetNuiFocus(true, true)

        SendNUIMessage({
            action = 'open',
            location = nearestLocation and nearestLocation.label or 'Auto perionica',
            money = getMoney(),
            packages = config.packages,
            biz = bizInfo,
            vehicle = {
                plate = GetVehicleNumberPlateText(vehicle):gsub('^%s*(.-)%s*$', '%1'),
                model = GetLabelText(GetDisplayNameFromVehicleModel(GetEntityModel(vehicle))),
                dirt = dirtPercent(vehicle),
            },
        })
    end)
end

RegisterNUICallback('close', function(_, cb)
    closeMenu()
    cb('ok')
end)

-- Biznis (TEST kupovina perionice iz menija, kasnije aukcija) - ide na flamingo_biznisi
RegisterNUICallback('bizBuy', function(data, cb)
    if GetResourceState('flamingo_biznisi') ~= 'started' then
        notify('Biznisi trenutno nisu dostupni.', 'error')
        return cb(false)
    end
    ESX.TriggerServerCallback('flamingo_biznisi:buy', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then notify(res.msg, res.ok and 'success' or 'error') end
        if not res.ok then return cb(false) end
        lib.callback('flamingo_perionica:info', false, function(info)
            cb(info or false)
        end)
    end, type(data) == 'table' and data.id or nil)
end)

RegisterNUICallback('wash', function(data, cb)
    cb('ok')
    closeMenu()

    local package = findPackage(data and data.id)
    if not package then return end

    local vehicle = getTargetVehicle()
    if not vehicle then return end

    if getMoney() < package.price then
        return notify('Nemaš dovoljno novca za taj paket.', 'error')
    end

    -- Naplata ide preko servera (klijentu se ne veruje za pare), pranje
    -- krece tek kad server potvrdi da je placeno.
    local paid = lib.callback.await('flamingo_perionica:wash', false, package.id)
    if not paid then return end

    runWash(vehicle, package)
end)

-------------------------------------------------
-- [E] prompt na lokaciji perionice
-------------------------------------------------

local function nearbyLocation(point)
    if point.currentDistance > config.washRange then return end

    nearestLocation = point.location

    repeat
        if not isMenuOpen and not isWashing then
            if getTargetVehicle() then
                exports['esx_keyprompt']:ShowKeyPrompt('Operi vozilo', 'E')
            else
                exports['esx_keyprompt']:HideKeyPrompt()
            end
        end

        Wait(250)
    until #(GetEntityCoords(cache.ped) - point.coords) > config.washRange or isMenuOpen

    if not isMenuOpen then
        exports['esx_keyprompt']:HideKeyPrompt()
    end

    nearestLocation = nil
end

for i = 1, #config.locations do
    local location = config.locations[i]

    lib.points.new({
        coords = location.coords,
        distance = config.washRange + 10.0,
        nearby = nearbyLocation,
        location = location,
    })
end

RegisterCommand('flamingo_perionica_open', function()
    if not nearestLocation then return end
    openMenu()
end, false)

RegisterKeyMapping('flamingo_perionica_open', 'Otvori meni perionice', 'keyboard', 'e')
TriggerEvent('chat:removeSuggestion', '/flamingo_perionica_open')

AddEventHandler('onResourceStop', function(resource)
    if resource == cache.resource then
        closeMenu()

        if waxVehicle and DoesEntityExist(waxVehicle) then
            FreezeEntityPosition(waxVehicle, false)
        end
    end
end)

-------------------------------------------------
-- Export za druge resurse (npr. radial meni)
-------------------------------------------------

exports('isNearCarWash', function()
    return nearestLocation ~= nil
end)
