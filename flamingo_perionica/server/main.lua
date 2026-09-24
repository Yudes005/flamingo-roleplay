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
-- igrac stvarno stoji na nekoj od lokacija iz config-a.
local function isAtCarWash(playerId)
    local ped = GetPlayerPed(playerId)
    if not ped or ped == 0 then return false end

    local coords = GetEntityCoords(ped)

    for i = 1, #config.locations do
        if #(coords - config.locations[i].coords) <= (config.washRange + 5.0) then
            return true
        end
    end

    return false
end

-------------------------------------------------
-- Pranje
-------------------------------------------------

lib.callback.register('flamingo_perionica:wash', function(source, packageId)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return false end

    local package = findPackage(packageId)
    if not package then return false end

    if not isAtCarWash(source) then
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

    return true
end)

AddEventHandler('playerDropped', function()
    lastWash[source] = nil
end)
