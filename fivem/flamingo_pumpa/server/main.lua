local ox_inventory = exports.ox_inventory
local ESX = exports['es_extended']:getSharedObject()
local config = require 'config'

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

    return true
end

-- ox_fuel je deklarisan kao 'dependency' u fxmanifest.lua, pa se garantovano
-- pokrece PRE flamingo_pumpa-e - export 'setPaymentMethod' ovde sigurno vec
-- postoji.
exports.ox_fuel:setPaymentMethod(payMoney)
