-- ============================================================
--  flamingo_pijaca - server/main.lua
-- ============================================================

local ESX = nil

CreateThread(function()
    while ESX == nil do
        TriggerEvent('esx:getSharedObject', function(obj) ESX = obj end)
        Wait(0)
    end
end)

-- Kompatibilnost: esx_legacy koristi xPlayer.identifier (property), starije
-- verzije ESX-a koriste xPlayer.getIdentifier() (funkcija). Ova funkcija radi sa obe.
local function GetIdentifier(xPlayer)
    if xPlayer.identifier then
        return xPlayer.identifier
    end
    if xPlayer.getIdentifier then
        return xPlayer.getIdentifier()
    end
end

-- ox_inventory:RegisterStash trazi vector3 za coords, a nase tezge cuvaju
-- vector4 (zbog heading-a za spawn/interakciju), pa uvek konvertujemo ovako.
local function ToVec3(v)
    return vector3(v.x, v.y, v.z)
end

-- Stalls[id] = {
--     id, label, coords (vector4),
--     stashId,
--     renter (identifier ili nil),
--     renterSource (source ili nil),
--     expiresAt (os.time() timestamp ili nil),
--     prices = { [itemName] = price },
-- }
local Stalls = {}

-- ------------------------------------------------------------
--  Sitne pomocne funkcije (moraju biti definisane PRE nego sto
--  se koriste u zatvaranjima nizim/event handlerima)
-- ------------------------------------------------------------

local function Notify(src, msg, notifyType, length)
    TriggerClientEvent('esx:showNotification', src, msg, notifyType, length)
end

local function ReplyCallback(src, reqId, ...)
    TriggerClientEvent('flamingo_pijaca:client:callback', src, reqId, ...)
end

local function GetStallByIdentifier(identifier)
    for _, stall in pairs(Stalls) do
        if stall.renter == identifier then
            return stall
        end
    end
    return nil
end

local function BuildPublicStallStates()
    local data = {}
    for _, stall in pairs(Stalls) do
        data[#data + 1] = { id = stall.id, occupied = stall.renter ~= nil }
    end
    return data
end

local function BroadcastStallStates()
    TriggerClientEvent('flamingo_pijaca:client:syncStalls', -1, BuildPublicStallStates())
end

-- Vraca listu { name, label, count } spojenu po imenu iteme, u redosledu pojavljivanja
local function GetMergedStock(stashId)
    local items = exports.ox_inventory:GetInventoryItems(stashId) or {}
    local merged = {}
    local order = {}

    for _, slotData in pairs(items) do
        local existing = merged[slotData.name]
        if not existing then
            existing = { name = slotData.name, label = slotData.label, count = 0 }
            merged[slotData.name] = existing
            order[#order + 1] = slotData.name
        end
        existing.count = existing.count + slotData.count
    end

    local list = {}
    for _, name in ipairs(order) do
        list[#list + 1] = merged[name]
    end

    return list
end

-- Oslobadja tezgu. reason: 'manual' (igrac sam otkazao dok je online),
-- 'expired' (isteklo vreme) ili 'disconnect' (igrac napustio server).
local function FreeStall(stallId, reason)
    local stall = Stalls[stallId]
    if not stall or not stall.renter then return end

    local ownerSrc = stall.renterSource
    local stock = exports.ox_inventory:GetInventoryItems(stall.stashId) or {}
    local leftovers = {}

    for _, slotData in pairs(stock) do
        local givenBack = false

        if reason == 'manual' and ownerSrc then
            if exports.ox_inventory:CanCarryItem(ownerSrc, slotData.name, slotData.count, slotData.metadata) then
                exports.ox_inventory:AddItem(ownerSrc, slotData.name, slotData.count, slotData.metadata)
                givenBack = true
            end
        end

        if not givenBack then
            leftovers[#leftovers + 1] = { slotData.name, slotData.count, slotData.metadata }
        end
    end

    exports.ox_inventory:ClearInventory(stall.stashId)

    if #leftovers > 0 then
        exports.ox_inventory:CustomDrop(
            'Roba - ' .. stall.label,
            leftovers,
            vector3(stall.coords.x, stall.coords.y, stall.coords.z)
        )
    end

    if ownerSrc then
        if reason == 'expired' then
            Notify(ownerSrc, ('Vas najam za %s je istekao. Preostala roba je ispala pored tezge.'):format(stall.label), 'info', 6000)
        elseif reason == 'disconnect' then
            -- igrac vise nije konektovan, nema smisla slati notify
        end
        TriggerClientEvent('flamingo_pijaca:client:stallReleased', ownerSrc)
    end

    stall.renter = nil
    stall.renterSource = nil
    stall.expiresAt = nil
    stall.prices = {}

    exports.ox_inventory:RegisterStash(stall.stashId, stall.label, Config.StallSlots, Config.StallMaxWeight, false, nil, ToVec3(stall.coords))

    BroadcastStallStates()
end

-- Gradi flamingo_npcdialog "tree" za razgovor sa NPC-em
local function BuildRentTree(xPlayer)
    local myStall = GetStallByIdentifier(GetIdentifier(xPlayer))

    if myStall then
        local remaining = math.max(0, (myStall.expiresAt or 0) - os.time())
        local h = math.floor(remaining / 3600)
        local m = math.floor((remaining % 3600) / 60)

        return {
            start = {
                message = ('Vec iznajmljujete %s.\nPreostalo vreme: %dh %dmin.'):format(myStall.label, h, m),
                options = {
                    { label = 'Zelim da otkazem najam tezge.', serverEvent = 'flamingo_pijaca:server:releaseStall', close = true },
                    { label = 'Dovidjenja.', close = true },
                }
            }
        }
    end

    local freeStalls = {}
    for _, stall in pairs(Stalls) do
        if not stall.renter then
            freeStalls[#freeStalls + 1] = stall
        end
    end

    table.sort(freeStalls, function(a, b) return a.id < b.id end)

    if #freeStalls == 0 then
        return {
            start = {
                message = 'Trenutno nema slobodnih tezgi. Navratite malo kasnije.',
                options = {
                    { label = 'Dovidjenja.', close = true },
                }
            }
        }
    end

    local options = {}
    for _, stall in ipairs(freeStalls) do
        options[#options + 1] = {
            label = ('%s je slobodna - iznajmi je.'):format(stall.label),
            serverEvent = 'flamingo_pijaca:server:rentStall',
            args = { stall.id },
            close = true,
        }
    end
    options[#options + 1] = { label = 'Dovidjenja.', close = true }

    return {
        start = {
            message = 'Dobrodosli na pijacu! Evo trenutno slobodnih tezgi:',
            options = options
        }
    }
end

-- ------------------------------------------------------------
--  Inicijalizacija tezgi
-- ------------------------------------------------------------

CreateThread(function()
    for _, cfgStall in ipairs(Config.Stalls) do
        Stalls[cfgStall.id] = {
            id = cfgStall.id,
            label = cfgStall.label,
            coords = cfgStall.coords,
            stashId = ('flamingo_pijaca_tezga_%d'):format(cfgStall.id),
            renter = nil,
            renterSource = nil,
            expiresAt = nil,
            prices = {},
        }

        exports.ox_inventory:RegisterStash(
            Stalls[cfgStall.id].stashId,
            cfgStall.label,
            Config.StallSlots,
            Config.StallMaxWeight,
            false,
            nil,
            ToVec3(cfgStall.coords)
        )
    end
end)

-- ------------------------------------------------------------
--  NPC dijalog - iznajmljivanje
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:server:getRentMenu', function(reqId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    ReplyCallback(src, reqId, BuildRentTree(xPlayer))
end)

RegisterNetEvent('flamingo_pijaca:server:rentStall', function(stallId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    if GetStallByIdentifier(GetIdentifier(xPlayer)) then
        Notify(src, 'Vec iznajmljujete jednu tezgu. Mozete imati samo jednu.', 'error')
        return
    end

    local stall = Stalls[stallId]
    if not stall then return end

    if stall.renter then
        Notify(src, 'Ta tezga je u medjuvremenu vec iznajmljena.', 'error')
        return
    end

    stall.renter = GetIdentifier(xPlayer)
    stall.renterSource = src
    stall.expiresAt = os.time() + Config.MaxRentSeconds
    stall.prices = {}

    exports.ox_inventory:RegisterStash(stall.stashId, stall.label, Config.StallSlots, Config.StallMaxWeight, GetIdentifier(xPlayer), nil, ToVec3(stall.coords))

    Notify(src, ('Uspesno ste iznajmili %s na %d sati. Idite do tezge da postavite robu i cene.'):format(stall.label, Config.MaxRentSeconds / 3600), 'success', 6000)
    TriggerClientEvent('flamingo_pijaca:client:stallRented', src, stall.id, stall.expiresAt)

    BroadcastStallStates()
end)

RegisterNetEvent('flamingo_pijaca:server:releaseStall', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local stall = GetStallByIdentifier(GetIdentifier(xPlayer))
    if not stall then
        Notify(src, 'Ne iznajmljujete nijednu tezgu.', 'error')
        return
    end

    FreeStall(stall.id, 'manual')
    Notify(src, 'Otkazali ste najam tezge. Roba koja nije stala u inventar je ispala pored tezge.', 'info')
end)

-- ------------------------------------------------------------
--  Upravljanje tezgom (vlasnik)
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:server:requestManage', function(reqId, stallId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local stall = Stalls[stallId]
    if not stall or stall.renter ~= GetIdentifier(xPlayer) then
        ReplyCallback(src, reqId, { error = 'Niste zakupac ove tezge.' })
        return
    end

    local remaining = math.max(0, (stall.expiresAt or 0) - os.time())
    local list = GetMergedStock(stall.stashId)

    for _, item in ipairs(list) do
        item.price = stall.prices[item.name] or 0
    end

    ReplyCallback(src, reqId, {
        stallId = stall.id,
        stallLabel = stall.label,
        remaining = remaining,
        items = list,
    })
end)

RegisterNetEvent('flamingo_pijaca:server:setPrices', function(stallId, prices)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local stall = Stalls[stallId]
    if not stall or stall.renter ~= GetIdentifier(xPlayer) then return end
    if type(prices) ~= 'table' then return end

    local clean = {}
    for itemName, price in pairs(prices) do
        price = tonumber(price)
        if type(itemName) == 'string' and price and price >= 0 then
            clean[itemName] = math.floor(price)
        end
    end

    stall.prices = clean
    Notify(src, 'Cene su sacuvane.', 'success')
end)

RegisterNetEvent('flamingo_pijaca:server:openStashInventory', function(stallId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local stall = Stalls[stallId]
    if not stall or stall.renter ~= GetIdentifier(xPlayer) then
        Notify(src, 'Niste zakupac ove tezge.', 'error')
        return
    end

    TriggerClientEvent('flamingo_pijaca:client:openStash', src, stall.stashId, stall.label)
end)

-- ------------------------------------------------------------
--  Kupovina (drugi igraci)
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:server:requestShop', function(reqId, stallId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local stall = Stalls[stallId]
    if not stall or not stall.renter then
        ReplyCallback(src, reqId, { error = 'Ova tezga trenutno nije iznajmljena.' })
        return
    end

    if stall.renter == GetIdentifier(xPlayer) then
        ReplyCallback(src, reqId, { error = 'Ovo je vasa tezga - upravljajte njome preko svoje opcije.' })
        return
    end

    local list = GetMergedStock(stall.stashId)
    local forSale = {}

    for _, item in ipairs(list) do
        local price = stall.prices[item.name]
        if price and price > 0 then
            item.price = price
            forSale[#forSale + 1] = item
        end
    end

    ReplyCallback(src, reqId, {
        stallId = stall.id,
        stallLabel = stall.label,
        items = forSale,
    })
end)

RegisterNetEvent('flamingo_pijaca:server:buyItem', function(stallId, itemName, count)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    count = tonumber(count)
    if not count or count <= 0 or count ~= math.floor(count) then return end

    local stall = Stalls[stallId]
    if not stall or not stall.renter then
        Notify(src, 'Tezga trenutno nije aktivna.', 'error')
        return
    end

    if stall.renter == GetIdentifier(xPlayer) then
        Notify(src, 'Ne mozete kupovati sa sopstvene tezge.', 'error')
        return
    end

    local price = stall.prices[itemName]
    if not price or price <= 0 then
        Notify(src, 'Taj artikal se trenutno ne prodaje ovde.', 'error')
        return
    end

    local ped = GetPlayerPed(src)
    local coords = GetEntityCoords(ped)
    local dist = #(coords - vector3(stall.coords.x, stall.coords.y, stall.coords.z))
    if dist > Config.BuyMaxDistance then
        Notify(src, 'Niste dovoljno blizu tezge.', 'error')
        return
    end

    local stock = exports.ox_inventory:GetItemCount(stall.stashId, itemName)
    if not stock or stock < count then
        Notify(src, 'Nema dovoljno te robe na tezgi.', 'error')
        return
    end

    local total = price * count
    local playerMoney = Config.Currency == 'bank' and xPlayer.getAccount('bank').money or xPlayer.getMoney()

    if playerMoney < total then
        Notify(src, 'Nemate dovoljno novca.', 'error')
        return
    end

    if not exports.ox_inventory:CanCarryItem(src, itemName, count) then
        Notify(src, 'Nemate mesta u inventaru za tu kolicinu.', 'error')
        return
    end

    local removed = exports.ox_inventory:RemoveItem(stall.stashId, itemName, count)
    if not removed then
        Notify(src, 'Doslo je do greske, pokusajte ponovo.', 'error')
        return
    end

    exports.ox_inventory:AddItem(src, itemName, count)

    if Config.Currency == 'bank' then
        xPlayer.removeAccountMoney('bank', total)
    else
        xPlayer.removeMoney(total)
    end

    local xSeller = stall.renterSource and ESX.GetPlayerFromId(stall.renterSource)
    if xSeller then
        if Config.Currency == 'bank' then
            xSeller.addAccountMoney('bank', total)
        else
            xSeller.addMoney(total)
        end
        Notify(stall.renterSource, ('Prodali ste %dx robu za $%d.'):format(count, total), 'success')
    end

    Notify(src, ('Kupili ste %dx za $%d.'):format(count, total), 'success')
end)

-- ------------------------------------------------------------
--  Sinhronizacija stanja tezgi ka klijentima
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:server:ready', function()
    local src = source
    TriggerClientEvent('flamingo_pijaca:client:syncStalls', src, BuildPublicStallStates())
end)

CreateThread(function()
    while true do
        Wait(30000)
        BroadcastStallStates()
    end
end)

-- ------------------------------------------------------------
--  Automatsko isticanje najma i oslobadjanje pri odjavi
-- ------------------------------------------------------------

CreateThread(function()
    while true do
        Wait(30000)
        local now = os.time()
        for id, stall in pairs(Stalls) do
            if stall.renter and stall.expiresAt and now >= stall.expiresAt then
                FreeStall(id, 'expired')
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    for id, stall in pairs(Stalls) do
        if stall.renterSource == src then
            FreeStall(id, 'disconnect')
            break
        end
    end
end)
