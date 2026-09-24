local ESX = exports['es_extended']:getSharedObject()

local Shops = Config.Shops
local PriceMapByShop = {}   -- [index marketa] = { [item] = cena }

-- Koliko daleko od prodavca sme da bude igrac kad placa (anti-cheat)
local MAX_SHOP_DISTANCE = 6.0

local function notify(src, msg, notifyType)
    -- Salje kroz nas custom event, koje client hvata i prosledjuje u
    -- exports['esx_notify']:Notify(...) - stari 'esx:showNotification' je
    -- uvek prikazivao goli/nestilizovani tekst bez tipa (uvek "info").
    TriggerClientEvent('flamingo_supermarket:notify', src, msg, notifyType or 'error')
end

local function safeNumber(n)
    n = tonumber(n)
    if not n then return 0 end
    if n < 0 then return 0 end
    return math.floor(n)
end

local function rebuildCaches()
    for k in pairs(PriceMapByShop) do PriceMapByShop[k] = nil end

    for i = 1, #Shops do
        local shop = Shops[i]
        if shop then
            local list = shop.items or Config.DefaultItems or {}
            local map = {}
            for j = 1, #list do
                local it = list[j]
                if it and it.name and it.price then
                    map[it.name] = safeNumber(it.price)
                end
            end
            PriceMapByShop[i] = map
        end
    end
end

rebuildCaches()

-- ============================================================
--  flamingo_biznisi: svaki market je poseban biznis (zalihe, kasa, vlasnik).
--  Market se prepoznaje po poziciji prodavca (ped.coords), pa isti id u
--  configu nije problem. Ako flamingo_biznisi nije pokrenut, market radi
--  kao i ranije (bez zaliha).
-- ============================================================
local function shopCoords(shop)
    local c = shop and shop.ped and shop.ped.coords
    if not c then return nil end
    return vector3(c.x + 0.0, c.y + 0.0, c.z + 0.0)
end

local function biz(fn, ...)
    if GetResourceState('flamingo_biznisi') ~= 'started' then return nil end
    local args = { ... }
    local ok, a, b = pcall(function() return exports['flamingo_biznisi'][fn](nil, table.unpack(args)) end)
    if not ok then
        print(('[flamingo_supermarket] flamingo_biznisi:%s greska: %s'):format(fn, tostring(a)))
        return nil
    end
    return a, b
end

local function registerBusiness()
    if GetResourceState('flamingo_biznisi') ~= 'started' then return end
    local list = {}
    for i = 1, #Shops do
        local shop = Shops[i]
        local c = shopCoords(shop)
        if c then
            local items = {}
            for _, it in ipairs(shop.items or Config.DefaultItems or {}) do
                items[#items + 1] = { name = it.name, label = it.label, price = it.price }
            end
            list[#list + 1] = { coords = c, label = shop.label, price = shop.bizPrice, items = items }
        end
    end
    biz('RegisterMarkets', list)
end

AddEventHandler('onResourceStart', function(res)
    if res == GetCurrentResourceName() or res == 'flamingo_biznisi' then
        SetTimeout(1000, registerBusiness)
    end
end)
AddEventHandler('flamingo_biznisi:ready', registerBusiness)

local function nearShop(src, shop)
    local c = shopCoords(shop)
    local ped = GetPlayerPed(src)
    if not c or ped == 0 then return false end
    return #(GetEntityCoords(ped) - c) <= MAX_SHOP_DISTANCE
end

-- Podaci za meni: vlasnik marketa, cena biznisa, zalihe
ESX.RegisterServerCallback('flamingo_supermarket:cb:info', function(source, cb, shopIndex)
    local shop = Shops[tonumber(shopIndex) or -1]
    if not shop or not nearShop(source, shop) then return cb(nil) end
    cb(biz('GetMarketInfo', shopCoords(shop), source))
end)

ESX.RegisterServerCallback('flamingo_supermarket:cb:pay', function(source, cb, shopId, basket, payType)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then
        notify(source, 'Igrac nije ucitan.')
        return cb(false)
    end

    shopId = tonumber(shopId)
    local shop = shopId and Shops[shopId]
    if not shop then
        notify(source, 'Nepostojeci market.')
        return cb(false)
    end
    if not nearShop(source, shop) then
        notify(source, 'Previše si daleko od prodavca.')
        return cb(false)
    end

    if type(basket) ~= 'table' or #basket == 0 then
        notify(source, 'Korpa je prazna.')
        return cb(false)
    end

    local account = Config.PayAccounts[payType]
    if not account then
        notify(source, 'Pogresna vrsta placanja.')
        return cb(false)
    end

    local priceMap = PriceMapByShop[shopId]
    if not priceMap then
        rebuildCaches()
        priceMap = PriceMapByShop[shopId]
        if not priceMap then
            notify(source, 'Nepostojeci market.')
            return cb(false)
        end
    end

    local itemsToGive = {}
    local total = 0

    for i = 1, #basket do
        local itemName = basket[i].id
        local qty = safeNumber(basket[i].kolicina)

        if type(itemName) ~= 'string' or itemName == '' then
            notify(source, 'Pogresan item u korpi.')
            return cb(false)
        end

        local unitPrice = priceMap[itemName]
        if not unitPrice or unitPrice <= 0 then
            notify(source, ('Item nije dozvoljen: %s'):format(itemName))
            return cb(false)
        end

        if qty <= 0 or qty > 100 then
            notify(source, 'Pogresna kolicina u korpi.')
            return cb(false)
        end

        total = total + (unitPrice * qty)
        itemsToGive[#itemsToGive + 1] = { name = itemName, count = qty, price = unitPrice }
    end

    -- market sa vlasnikom: mora biti dovoljno robe na stanju
    local inStock, stockMsg = biz('MarketCheck', shopCoords(shop), itemsToGive)
    if inStock == false then
        notify(source, stockMsg or 'Nema dovoljno robe na stanju.')
        return cb(false)
    end

    if total <= 0 then
        notify(source, 'Pogresan iznos.')
        return cb(false)
    end

    local hasMoney = false
    if account == 'money' then
        hasMoney = xPlayer.getMoney() >= total
    else
        local acc = xPlayer.getAccount(account)
        hasMoney = acc and acc.money and acc.money >= total
    end

    if not hasMoney then
        notify(source, 'Nemate dovoljno novca.')
        return cb(false)
    end

    for i = 1, #itemsToGive do
        local it = itemsToGive[i]
        if not exports.ox_inventory:CanCarryItem(source, it.name, it.count) then
            notify(source, 'Nemate mjesta u inventory ili taj item ne postoji.')
            return cb(false)
        end
    end

    if account == 'money' then
        xPlayer.removeMoney(total)
    else
        xPlayer.removeAccountMoney(account, total)
    end

    for i = 1, #itemsToGive do
        local it = itemsToGive[i]
        exports.ox_inventory:AddItem(source, it.name, it.count)

        -- Javi flamingo_misije (ako je pokrenut i ako je igrac trenutno na
        -- "Kupi SIM karticu" misiji) da je SIM kartica stvarno kupljena, da
        -- moze da zavrsi tu misiju. TriggerClientEvent je globalan po imenu,
        -- pa radi izmedju resursa bez zavisnosti - ako flamingo_misije nije
        -- pokrenut ili igrac nije na toj misiji, ovo jednostavno nema efekta.
        if it.name == 'simcard' then
            TriggerClientEvent('flamingo_misije:client:simCardBought', source)
        end
    end

    -- roba izlazi iz magacina, novac ide u kasu vlasnika marketa
    biz('MarketSale', shopCoords(shop), itemsToGive, total, xPlayer.getName())

    cb(true)
end)
