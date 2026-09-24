local config = require 'config'
local stations = lib.load('data.stations') or {}
local ESX = exports['es_extended']:getSharedObject()

local isMenuOpen = false
local nearestPump = nil

-- Notify preko esx_notify direktno (export je client-only, zato server.lua
-- i dalje ide preko 'esx:showNotification' eventa - to je i dalje ispravan
-- nacin server->klijent, jer esx_notify preuzima ESX.ShowNotification).
local function notify(message, notifyType)
    message = tostring(message or '')
    if message == '' then return end

    exports['esx_notify']:Notify(message, notifyType or 'info')
end

-------------------------------------------------
-- Blipovi pumpi na mapi
-------------------------------------------------
-- NAPOMENA: ovo je sada jedino mesto koje iscrtava blipove za pumpe.
-- ox_fuel/config.lua -> showBlips je namerno ugasen (0) da ne bi bilo
-- duplih blipova na istim koordinatama.

CreateThread(function()
    for station in pairs(stations) do
        local blip = AddBlipForCoord(station.x, station.y, station.z)

        SetBlipSprite(blip, 361)
        SetBlipDisplay(blip, 4)
        SetBlipScale(blip, 0.85)
        SetBlipColour(blip, 2) -- zelena
        SetBlipAsShortRange(blip, true)

        BeginTextCommandSetBlipName('STRING')
        AddTextComponentSubstringPlayerName('Benzinska Pumpa')
        EndTextCommandSetBlipName(blip)
    end
end)

-------------------------------------------------
-- Pomocne funkcije
-------------------------------------------------

-- FIX (flamingo): prikaz stanja u meniju sada cita ESX kes+banku
-- (isto sto se realno naplacuje na serveru - vidi server/main.lua),
-- umesto ox_inventory 'money' itema koji igraci ovde ne koriste.
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

-- Trazi najblize vozilo koje koristi gorivo, u radijusu config.vehicleRange
-- (koristi se kad igrac NIJE u vozilu - npr. stoji peske pored parkiranog auta)
local function getNearbyVehicle()
    local playerCoords = GetEntityCoords(cache.ped)
    local vehicles = GetGamePool('CVehicle')
    local closestVehicle, closestDistance

    for i = 1, #vehicles do
        local vehicle = vehicles[i]

        if DoesVehicleUseFuel(vehicle) then
            local distance = #(playerCoords - GetEntityCoords(vehicle))

            if distance <= config.vehicleRange and (not closestDistance or distance < closestDistance) then
                closestVehicle, closestDistance = vehicle, distance
            end
        end
    end

    return closestVehicle
end

-- Vozilo za sipanje: ako je igrac U vozilu, uzima se to isto vozilo
-- (radi se BEZ izlaska iz auta); u suprotnom trazi se najblize vozilo peske.
local function getTargetVehicle()
    if cache.vehicle and DoesVehicleUseFuel(cache.vehicle) then
        return cache.vehicle
    end

    return getNearbyVehicle()
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

local function openMenu()
    if isMenuOpen or lib.progressActive() then return end

    local vehicle = getTargetVehicle()
    local vehicleData = nil

    if vehicle then
        local fuelPercent = GetVehicleFuelLevel(vehicle)

        vehicleData = {
            netId = NetworkGetNetworkIdFromEntity(vehicle),
            plate = GetVehicleNumberPlateText(vehicle):gsub('^%s*(.-)%s*$', '%1'),
            fuelPercent = fuelPercent,
            currentLiters = math.floor((fuelPercent / 100) * config.tankLiters),
            maxLiters = config.tankLiters,
        }
    end

    local canisterData = lib.callback.await('flamingo_pumpa:getCanisterData', false) or { hasCanister = false, ammo = 0 }

    -- vlasnik stanice + gorivo u rezervoaru (flamingo_biznisi); bez njega meni radi kao ranije
    local bizInfo = lib.callback.await('flamingo_pumpa:info', false)

    isMenuOpen = true
    exports['esx_keyprompt']:HideKeyPrompt()
    SetNuiFocus(true, true)

    SendNUIMessage({
        action = 'open',
        vehicle = vehicleData,
        canister = canisterData,
        canisterConfig = config.canister,
        pricePerLiter = config.pricePerLiter,
        money = getMoney(),
        repairKitConfig = config.repairKit,
        repairKitAvailable = config.repairKit.enabled and GetResourceState('flamingo_repair') == 'started',
        biz = bizInfo,
    })
end

RegisterNUICallback('close', function(_, cb)
    closeMenu()
    cb('ok')
end)

RegisterNUICallback('refuel', function(data, cb)
    cb('ok')

    if isMenuOpen then closeMenu() end

    local liters = tonumber(data and data.liters)
    local netId = data and data.netId

    if not liters or liters <= 0 or not netId then return end

    local vehicle = NetworkGetEntityFromNetworkId(netId)
    if not DoesEntityExist(vehicle) then return end

    local price = math.ceil(liters * config.pricePerLiter)
    local money = getMoney()

    if price > money then
        return notify(('Nemate dovoljno novca! Fali vam $%s'):format(price - money), 'error')
    end

    -- Traka napretka je opciona (config.refuelProgress.enabled). Ako je
    -- ugasena, sipanje je trenutno kao i do sada.
    local progressCfg = config.refuelProgress

    if progressCfg and progressCfg.enabled and GetResourceState('flamingo_progressbar') == 'started' then
        local duration = math.floor(liters * (progressCfg.perLiter or 120))
        duration = math.max(progressCfg.min or 2000, math.min(progressCfg.max or 12000, duration))

        local ok = exports['flamingo_progressbar']:Progress({
            label = ('Sipanje %d L...'):format(liters),
            duration = duration,
            icon = 'fa-solid fa-gas-pump',
            canCancel = true,
            disable = { move = false, combat = true },
        })

        if not ok then
            return notify('Sipanje je prekinuto.', 'error')
        end

        if not DoesEntityExist(vehicle) then return end
    end

    -- stanica koja je biznis mora imati dovoljno goriva u rezervoaru
    if not lib.callback.await('flamingo_pumpa:reserve', false, liters) then return end

    local currentFuel = GetVehicleFuelLevel(vehicle)
    local newFuel = math.min(100, currentFuel + (liters / config.tankLiters) * 100)

    TriggerServerEvent('ox_fuel:pay', price, newFuel, netId)
    notify(('Sipali ste %d litara goriva za $%s.'):format(liters, price), 'success')
end)

-- Biznis (TEST kupovina pumpe iz menija, kasnije aukcija) - ide na flamingo_biznisi
RegisterNUICallback('bizBuy', function(data, cb)
    if GetResourceState('flamingo_biznisi') ~= 'started' then
        notify('Biznisi trenutno nisu dostupni.', 'error')
        return cb(false)
    end
    ESX.TriggerServerCallback('flamingo_biznisi:buy', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then notify(res.msg, res.ok and 'success' or 'error') end
        if not res.ok then return cb(false) end
        lib.callback('flamingo_pumpa:info', false, function(info)
            cb(info or false)
        end)
    end, type(data) == 'table' and data.id or nil)
end)

RegisterNUICallback('buyCanister', function(data, cb)
    cb('ok')
    if isMenuOpen then closeMenu() end

    local mode = data and data.mode -- 'buy' | 'refill'
    if mode ~= 'buy' and mode ~= 'refill' then return end

    if mode == 'refill' then
        -- Refill se odnosi na kanister koji igrac VEC drzi u ruci - kolicina
        -- ovde nema smisla (uvek tacno 1 kanister se puni).
        TriggerServerEvent('ox_fuel:fuelCan', true, config.canister.refillPrice)
        notify('Kanister je napunjen.', 'success')
        return
    end

    local qty = math.floor(tonumber(data and data.qty) or 1)
    qty = math.max(1, math.min(qty, config.canister.maxBuyQty or 5))

    -- Svaki kanister je zaseban 'WEAPON_PETROLCAN' item (nije stackable),
    -- pa se za kolicinu > 1 ox_fuel-ov POSTOJECI event jednostavno pozove
    -- vise puta - svaki poziv sam naplacuje i proverava mesto u inventaru.
    for _ = 1, qty do
        TriggerServerEvent('ox_fuel:fuelCan', false, config.canister.buyPrice)
    end

    notify(('Kupili ste %dx kanister goriva.'):format(qty), 'success')
end)

-- Kupovina repair kita OVDE NA PUMPI - flamingo_pumpa ne zna nista o ceni
-- niti o ox_inventory itemu, samo prosledi na flamingo_repair-ov POSTOJECI
-- server event ('flamingo_repair:buyKit') koji sam radi naplatu (ESX nalog)
-- i dodaje item(e). Vidi flamingo_repair/server/main.lua.
RegisterNUICallback('buyRepairKit', function(data, cb)
    cb('ok')
    if isMenuOpen then closeMenu() end

    if not config.repairKit.enabled then return end
    if GetResourceState('flamingo_repair') ~= 'started' then return end

    local qty = math.floor(tonumber(data and data.qty) or 1)
    qty = math.max(1, math.min(qty, config.repairKit.maxBuyQty or 10))

    TriggerServerEvent('flamingo_repair:buyKit', qty)
end)

-------------------------------------------------
-- Detekcija blizine pumpe (E prompt)
-------------------------------------------------

local function nearbyStation(point)
    if point.currentDistance > 25 then return end

    local pumps = point.pumps

    for i = 1, #pumps do
        local pump = pumps[i]
        local range = cache.vehicle and config.pumpRangeVehicle or config.pumpRange
        local pumpDistance = #(GetEntityCoords(cache.ped) - pump)

        if pumpDistance <= range then
            nearestPump = pump

            repeat
                if not isMenuOpen then
                    local vehicle = getTargetVehicle()

                    if vehicle then
                        exports['esx_keyprompt']:ShowKeyPrompt('Otvori meni pumpe', 'E')
                    elseif config.canister.enabled then
                        exports['esx_keyprompt']:ShowKeyPrompt('Kupi ili napuni kanister', 'E')
                    else
                        exports['esx_keyprompt']:HideKeyPrompt()
                    end
                end

                Wait(200)
                range = cache.vehicle and config.pumpRangeVehicle or config.pumpRange
                pumpDistance = #(GetEntityCoords(cache.ped) - pump)
            until pumpDistance > range or isMenuOpen

            if not isMenuOpen then
                exports['esx_keyprompt']:HideKeyPrompt()
            end

            nearestPump = nil
            return
        end
    end
end

for station, pumps in pairs(stations) do
    lib.points.new({
        coords = station,
        distance = 40,
        nearby = nearbyStation,
        pumps = pumps,
    })
end

-------------------------------------------------
-- [E] otvara meni pumpe (radi i peske i iz vozila)
-------------------------------------------------

RegisterCommand('flamingo_pumpa_open', function()
    if not nearestPump then return end
    openMenu()
end, false)

RegisterKeyMapping('flamingo_pumpa_open', 'Otvori meni pumpe', 'keyboard', 'e')
TriggerEvent('chat:removeSuggestion', '/flamingo_pumpa_open')

AddEventHandler('onResourceStop', function(resource)
    if resource == cache.resource then
        closeMenu()
    end
end)

-------------------------------------------------
-- Export za flamingo_hud (i bilo koji drugi resurs)
-------------------------------------------------
-- Vraca "virtuelni" kapacitet rezervoara u litrima (config.tankLiters), da
-- HUD prikazuje ISTI broj litara koji koristi meni pumpe, umesto svog
-- odvojenog hardkodovanog broja.
exports('getTankLiters', function()
    return config.tankLiters
end)

-- Export za flamingo_radialmenuauta (i bilo koji drugi resurs) - da li
-- igrac trenutno stoji u dometu fizicke pumpe (isto stanje koje koristi
-- ovaj resurs sam za svoj E prompt).
exports('isNearPump', function()
    return nearestPump ~= nil
end)
