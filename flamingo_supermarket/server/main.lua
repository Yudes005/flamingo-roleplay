local ESX = exports['es_extended']:getSharedObject()

local Shops = Config.Shops
local ShopById = {}
local PriceMapByShop = {}

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
    for k in pairs(ShopById) do ShopById[k] = nil end
    for k in pairs(PriceMapByShop) do PriceMapByShop[k] = nil end

    for i = 1, #Shops do
        local shop = Shops[i]
        if shop and shop.id then
            ShopById[shop.id] = shop

            local list = shop.items or Config.DefaultItems or {}
            local map = {}
            for j = 1, #list do
                local it = list[j]
                if it and it.name and it.price then
                    map[it.name] = safeNumber(it.price)
                end
            end
            PriceMapByShop[shop.id] = map
        end
    end
end

rebuildCaches()

ESX.RegisterServerCallback('flamingo_supermarket:cb:pay', function(source, cb, shopId, basket, payType)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then
        notify(source, 'Igrac nije ucitan.')
        return cb(false)
    end

    local shop = ShopById[shopId]
    if not shop then
        notify(source, 'Nepostojeci market.')
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
        itemsToGive[#itemsToGive + 1] = { name = itemName, count = qty }
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

    cb(true)
end)
