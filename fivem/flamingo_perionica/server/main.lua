local config = require 'config'
local ESX = exports['es_extended']:getSharedObject()

local lastWash = {}

-------------------------------------------------
-- Naplata (ista logika kao u flamingo_pumpa)
-------------------------------------------------

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

local function payMoney(xPlayer, price)
    local primary = config.payment.primaryAccount
    local fallback = config.payment.useBothAccounts and config.payment.fallbackAccount or nil

    local primaryMoney = getAccountMoney(xPlayer, primary)
    local fallbackMoney = fallback and getAccountMoney(xPlayer, fallback) or 0

    if primaryMoney + fallbackMoney < price then
        return false, price - (primaryMoney + fallbackMoney)
    end

    if primaryMoney >= price then
        removeAccountMoney(xPlayer, primary, price)
    else
        if primaryMoney > 0 then
            removeAccountMoney(xPlayer, primary, primaryMoney)
        end

        removeAccountMoney(xPlayer, fallback, price - primaryMoney)
    end

    return true
end

-------------------------------------------------
-- Provere
-------------------------------------------------

local function findPackage(id)
    for i = 1, #config.packages do
        if config.packages[i].id == id then
            return config.packages[i]
        end
    end
end

-- Klijent moze da posalje bilo sta, zato se ovde jos jednom proverava da
-- igrac stvarno stoji na nekoj od lokacija iz config-a. Vraca tu lokaciju.
local function isAtCarWash(playerId)
    local ped = GetPlayerPed(playerId)
    if not ped or ped == 0 then return nil end

    local coords = GetEntityCoords(ped)

    for i = 1, #config.locations do
        if #(coords - config.locations[i].coords) <= (config.washRange + 5.0) then
            return config.locations[i]
        end
    end

    return nil
end

-------------------------------------------------
-- flamingo_biznisi: svaka perionica je poseban biznis.
-- Vlasnik dobija udeo od svakog pranja (Config.Carwash.share u flamingo_biznisi).
-- Bez flamingo_biznisi perionica radi kao i ranije.
-------------------------------------------------

local function biz(fn, ...)
    if GetResourceState('flamingo_biznisi') ~= 'started' then return nil end
    local args = { ... }
    local ok, a, b = pcall(function() return exports['flamingo_biznisi'][fn](nil, table.unpack(args)) end)
    if not ok then
        print(('[flamingo_perionica] flamingo_biznisi:%s greska: %s'):format(fn, tostring(a)))
        return nil
    end
    return a, b
end

local function registerBusiness()
    if GetResourceState('flamingo_biznisi') ~= 'started' then return end
    local packages = {}
    for i = 1, #config.packages do
        local p = config.packages[i]
        packages[#packages + 1] = { id = p.id, label = p.label, price = p.price }
    end
    local list = {}
    for i = 1, #config.locations do
        local l = config.locations[i]
        list[#list + 1] = { coords = l.coords, label = l.label, price = l.bizPrice, packages = packages }
    end
    biz('RegisterCarwashes', list)
end

AddEventHandler('onResourceStart', function(res)
    if res == GetCurrentResourceName() or res == 'flamingo_biznisi' then
        SetTimeout(1000, registerBusiness)
    end
end)
AddEventHandler('flamingo_biznisi:ready', registerBusiness)

-- Vlasnik perionice + cena biznisa (za meni)
lib.callback.register('flamingo_perionica:info', function(source)
    local location = isAtCarWash(source)
    if not location then return nil end
    return biz('GetCarwashInfo', location.coords, source)
end)

-------------------------------------------------
-- Pranje
-------------------------------------------------

lib.callback.register('flamingo_perionica:wash', function(source, packageId)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return false end

    local package = findPackage(packageId)
    if not package then return false end

    local location = isAtCarWash(source)
    if not location then
        TriggerClientEvent('esx:showNotification', source, 'Nisi na perionici.', 'error')
        return false
    end

    local now = os.time()

    if lastWash[source] and (now - lastWash[source]) < config.cooldown then
        return false
    end

    local paid, missing = payMoney(xPlayer, package.price)

    if not paid then
        TriggerClientEvent('esx:showNotification', source, ('Nemaš dovoljno novca! Fali ti $%s'):format(missing), 'error')
        return false
    end

    lastWash[source] = now

    -- udeo od pranja ide u kasu vlasnika perionice
    biz('CarwashSale', location.coords, package.price, package.label, xPlayer.getName())

    return true
end)

AddEventHandler('playerDropped', function()
    lastWash[source] = nil
end)
