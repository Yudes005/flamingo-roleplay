local ox_inventory = exports.ox_inventory
local ESX = exports['es_extended']:getSharedObject()
local config = require 'config'
local stations = lib.load('data.stations') or {}

-------------------------------------------------
-- flamingo_biznisi: svaka stanica je poseban biznis sa rezervoarom
-- (Config.Fuel u flamingo_biznisi). Kad igrac sipa, litri izlaze iz
-- rezervoara stanice, a cela cena ide u kasu vlasnika. Bez flamingo_biznisi
-- pumpa radi kao i ranije.
-------------------------------------------------

local function biz(fn, ...)
    if GetResourceState('flamingo_biznisi') ~= 'started' then return nil end
    local args = { ... }
    local ok, a, b, c = pcall(function() return exports['flamingo_biznisi'][fn](nil, table.unpack(args)) end)
    if not ok then
        print(('[flamingo_pumpa] flamingo_biznisi:%s greska: %s'):format(fn, tostring(a)))
        return nil
    end
    return a, b, c
end

-- Stanica na kojoj je igrac (centar stanice iz data/stations.lua)
local STATION_RANGE = 40.0

local function stationOf(playerId)
    local ped = GetPlayerPed(playerId)
    if not ped or ped == 0 then return nil end
    local coords = GetEntityCoords(ped)
    local best, bestDist
    for center, pumps in pairs(stations) do
        local d = #(coords - center)
        for i = 1, #pumps do
            d = math.min(d, #(coords - pumps[i]))
        end
        if d <= STATION_RANGE and (not bestDist or d < bestDist) then
            best, bestDist = center, d
        end
    end
    return best
end

local function registerBusiness()
    if GetResourceState('flamingo_biznisi') ~= 'started' then return end
    local list = {}
    for center in pairs(stations) do
        list[#list + 1] = { coords = center, label = 'Pumpa', pricePerLiter = config.pricePerLiter }
    end
    biz('RegisterFuelStations', list)
end

AddEventHandler('onResourceStart', function(res)
    if res == GetCurrentResourceName() or res == 'flamingo_biznisi' then
        SetTimeout(1000, registerBusiness)
    end
end)
AddEventHandler('flamingo_biznisi:ready', registerBusiness)

-- Vlasnik stanice + gorivo u rezervoaru (za meni)
lib.callback.register('flamingo_pumpa:info', function(source)
    local station = stationOf(source)
    if not station then return nil end
    return biz('GetFuelInfo', station, source)
end)

-- Pre placanja: da li stanica ima dovoljno goriva. Zapamti sipanje, pa kad
-- ox_fuel naplati tacno tu cenu (payMoney ispod), litri se skidaju sa stanice.
local pendingFuel = {}

lib.callback.register('flamingo_pumpa:reserve', function(source, liters)
    liters = math.floor(tonumber(liters) or 0)
    if liters <= 0 then return false end

    local station = stationOf(source)
    if not station then return true end -- van stanice: ox_fuel sam odlucuje, biznis se ne dira

    local ok, msg = biz('FuelCheck', station, liters)
    if ok == false then
        TriggerClientEvent('esx:showNotification', source, msg or 'Pumpa nema dovoljno goriva.', 'error')
        return false
    end

    pendingFuel[source] = {
        station = station,
        liters = liters,
        price = math.ceil(liters * config.pricePerLiter),
        at = os.time(),
    }
    return true
end)

AddEventHandler('playerDropped', function()
    pendingFuel[source] = nil
end)

-- Vraca da li igrac trenutno drzi kanister goriva u ruci i koliko je pun.
-- (isto ogranicenje kao u ox_fuel-u: kanister mora biti opremljen kao oruzje
-- da bi se prepoznao - to je nacin na koji ox_fuel/ox_inventory prati kanister)
lib.callback.register('flamingo_pumpa:getCanisterData', function(source)
    local item = ox_inventory:GetCurrentWeapon(source)

    if item and item.name == 'WEAPON_PETROLCAN' then
        return {
            hasCanister = true,
            ammo = (item.metadata and item.metadata.ammo) or 0,
        }
    end

    return { hasCanister = false, ammo = 0 }
end)

--[[
    FIX (flamingo): ox_fuel po defaultu naplacuje gorivo skidanjem
    ox_inventory 'money' ITEMA iz inventara (ox_inventory:RemoveItem(src,
    'money', price)). Ako server koristi standardni ESX sistem novca
    (kes/banka na xPlayer nalogu), igraci fizicki NEMAJU taj 'money' item
    u inventaru pa je naplata UVEK padala sa "nemate dovoljno novca", bez
    obzira koliko su realno imali para. Zbog toga ni sipanje goriva ni
    kupovina/punjenje kanistera nikad nisu prolazili.

    Ovde se ox_fuel-ov nacin naplate menja preko njegovog 'setPaymentMethod'
    exporta (server.lua u ox_fuel-u) tako da se novac skida direktno sa
    ESX naloga umesto sa ox_inventory itema. Racuni koji se koriste
    podesavaju se u config.lua -> payment.
]]

local function getAccountMoney(xPlayer, account)
    if account == 'money' then
        return xPlayer.getMoney()
    end

    local acc = xPlayer.getAccount(account)
    return acc and acc.money or 0
end

local function removeAccountMoney(xPlayer, account, amount)
    if account == 'money' then
        xPlayer.removeMoney(amount)
    else
        xPlayer.removeAccountMoney(account, amount)
    end
end

local function payMoney(playerId, price)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    local primary = config.payment.primaryAccount
    local fallback = config.payment.useBothAccounts and config.payment.fallbackAccount or nil

    local primaryMoney = getAccountMoney(xPlayer, primary)
    local fallbackMoney = fallback and getAccountMoney(xPlayer, fallback) or 0

    if primaryMoney + fallbackMoney < price then
        TriggerClientEvent('esx:showNotification', playerId, ('Nemate dovoljno novca! Fali vam $%s'):format(price - (primaryMoney + fallbackMoney)), 'error')
        return false
    end

    if primaryMoney >= price then
        removeAccountMoney(xPlayer, primary, price)
    else
        if primaryMoney > 0 then
            removeAccountMoney(xPlayer, primary, primaryMoney)
        end

        removeAccountMoney(xPlayer, fallback, price - primaryMoney)
    end

    -- sipanje na stanici koja je biznis: gorivo izlazi iz rezervoara, novac ide u kasu vlasnika
    local p = pendingFuel[playerId]
    if p and p.price == price and os.time() - p.at <= 120 then
        pendingFuel[playerId] = nil
        biz('FuelSale', p.station, p.liters, price, xPlayer.getName())
    end

    return true
end

-- ox_fuel je deklarisan kao 'dependency' u fxmanifest.lua, pa se garantovano
-- pokrece PRE flamingo_pumpa-e - export 'setPaymentMethod' ovde sigurno vec
-- postoji.
exports.ox_fuel:setPaymentMethod(payMoney)
