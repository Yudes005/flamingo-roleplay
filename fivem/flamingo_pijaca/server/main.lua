-- ============================================================
--  flamingo_pijaca - server/main.lua
-- ============================================================

local ESX = exports['es_extended']:getSharedObject()
local ox = exports.ox_inventory

local RESOURCE = GetCurrentResourceName()
local SAVE_FILE = 'data.json'

-- Kljucevi u metadata item-a dok stoji na tezgi
local META_PRICE = 'pijaca_price'
local META_SELLER = 'pijaca_seller'
local META_PREV_LABEL = 'pijaca_prevLabel'
local META_PREV_DESC = 'pijaca_prevDesc'

-- Stalls[id] = {
--     id, label, coords (vector4), stashId,
--     renter (identifier ili nil), renterName, expiresAt (os.time()), warned
-- }
local Stalls = {}
local StallByStash = {}

-- Zarada od prodaje dok prodavac nije bio online: [identifier] = iznos
local Earnings = {}

-- ------------------------------------------------------------
--  Pomocne funkcije
-- ------------------------------------------------------------

local function GetIdentifier(xPlayer)
    if not xPlayer then return nil end
    if xPlayer.identifier then return xPlayer.identifier end
    if xPlayer.getIdentifier then return xPlayer.getIdentifier() end
end

local function Notify(src, msg, notifyType, length)
    TriggerClientEvent('esx:showNotification', src, msg, notifyType, length)
end

local function ReplyCallback(src, reqId, ...)
    TriggerClientEvent('flamingo_pijaca:client:callback', src, reqId, ...)
end

local function ToVec3(v)
    return vector3(v.x, v.y, v.z)
end

local function ToInt(v)
    v = tonumber(v)
    if not v or v ~= v or v == math.huge or v == -math.huge then return nil end
    return math.floor(v)
end

local function FormatMoney(amount)
    local s = tostring(math.floor(amount))
    local formatted = s:reverse():gsub('(%d%d%d)', '%1.'):reverse()
    return (formatted:gsub('^%.', ''))
end

local function IsNear(src, coords, maxDist)
    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return false end
    return #(GetEntityCoords(ped) - ToVec3(coords)) <= maxDist
end

local function GetBalance(xPlayer, account)
    local acc = xPlayer.getAccount(account)
    return acc and acc.money or 0
end

local function CopyTable(t)
    local copy = {}
    if type(t) == 'table' then
        for k, v in pairs(t) do copy[k] = v end
    end
    return copy
end

local function IsListed(meta)
    return type(meta) == 'table' and meta[META_PRICE] ~= nil
end

-- Pravi metadata za item koji se stavlja na tezgu: label na slotu dobija cenu
local function MakeListedMeta(meta, baseLabel, price, seller)
    local m = CopyTable(meta)
    m[META_PREV_LABEL] = m.label
    m[META_PREV_DESC] = m.description
    m[META_PRICE] = price
    m[META_SELLER] = seller
    m.label = ('%s - $%s'):format(baseLabel, FormatMoney(price))
    m.description = ('**Cena:** $%s po komadu'):format(FormatMoney(price))
    if m[META_PREV_DESC] then
        m.description = m.description .. '  \n' .. m[META_PREV_DESC]
    end
    return m
end

-- Vraca originalni metadata (bez cene) kad item skida sa tezge
local function CleanMeta(meta)
    if not IsListed(meta) then return meta end
    local m = CopyTable(meta)
    m.label = m[META_PREV_LABEL]
    m.description = m[META_PREV_DESC]
    m[META_PREV_LABEL] = nil
    m[META_PREV_DESC] = nil
    m[META_PRICE] = nil
    m[META_SELLER] = nil
    return next(m) and m or nil
end

local function GetStallByIdentifier(identifier)
    if not identifier then return nil end
    for _, stall in pairs(Stalls) do
        if stall.renter == identifier then
            return stall
        end
    end
end

-- ------------------------------------------------------------
--  Cuvanje stanja (najmovi + zarada) u data.json - prezivljava restart
-- ------------------------------------------------------------

local function SaveData()
    local rentals = {}
    for id, stall in pairs(Stalls) do
        if stall.renter then
            rentals[tostring(id)] = {
                renter = stall.renter,
                renterName = stall.renterName,
                expiresAt = stall.expiresAt,
            }
        end
    end

    SaveResourceFile(RESOURCE, SAVE_FILE, json.encode({ rentals = rentals, earnings = Earnings }), -1)
end

local function LoadData()
    local raw = LoadResourceFile(RESOURCE, SAVE_FILE)
    if not raw or raw == '' then return {} end
    local ok, data = pcall(json.decode, raw)
    return (ok and type(data) == 'table') and data or {}
end

-- ------------------------------------------------------------
--  Novac prodavcu (online odmah, offline kad se sledeci put uloguje)
-- ------------------------------------------------------------

local function PayoutPending(xPlayer)
    local identifier = GetIdentifier(xPlayer)
    local amount = identifier and Earnings[identifier]
    if not amount or amount <= 0 then return end

    Earnings[identifier] = nil
    SaveData()
    xPlayer.addAccountMoney(Config.Sale.account, amount)
    Notify(xPlayer.source, ('Dok nisi bio tu, sa tezge je prodato robe za $%s. Novac ti je isplacen.'):format(FormatMoney(amount)), 'success', 8000)
end

local function PaySeller(identifier, amount, message)
    local xSeller = ESX.GetPlayerFromIdentifier(identifier)
    if xSeller then
        xSeller.addAccountMoney(Config.Sale.account, amount)
        Notify(xSeller.source, message, 'success', 6000)
    else
        Earnings[identifier] = (Earnings[identifier] or 0) + amount
        SaveData()
    end
end

-- ------------------------------------------------------------
--  "Povrat" magacin: roba koja nije mogla da se vrati vlasniku
-- ------------------------------------------------------------

local function ReturnStashId(identifier)
    return Config.ReturnStashPrefix .. (identifier:gsub('[^%w]', '_'))
end

local function EnsureReturnStash(identifier)
    local id = ReturnStashId(identifier)
    ox:RegisterStash(id, 'Preostala roba sa pijace', Config.ReturnSlots, Config.ReturnMaxWeight, false, nil, ToVec3(Config.Npc.coords))
    return id
end

local function ReturnStashHasItems(identifier)
    local items = ox:GetInventoryItems(EnsureReturnStash(identifier))
    return items ~= nil and next(items) ~= nil
end

-- Skida svu robu sa tezge i vraca je vlasnicima: u inventar ako su online i
-- imaju mesta, inace u njihov "povrat" magacin (preuzima se kod NPC-a).
-- Vraca true ako je nesto zavrsilo u povrat magacinu.
local function ReturnStallItems(stall, fallbackIdentifier)
    local items = ox:GetInventoryItems(stall.stashId)
    if not items then return false end

    local slots = {}
    for _, slotData in pairs(items) do
        slots[#slots + 1] = slotData
    end

    local usedReturnStash = false

    for _, slotData in ipairs(slots) do
        local name, count, meta, slotId = slotData.name, slotData.count, slotData.metadata, slotData.slot
        local owner = (type(meta) == 'table' and meta[META_SELLER]) or fallbackIdentifier
        local clean = CleanMeta(meta)

        if ox:RemoveItem(stall.stashId, name, count, meta, slotId) then
            local delivered = false

            if owner then
                local xOwner = ESX.GetPlayerFromIdentifier(owner)
                if xOwner and ox:CanCarryItem(xOwner.source, name, count, clean) then
                    delivered = ox:AddItem(xOwner.source, name, count, clean) and true or false
                end

                if not delivered then
                    delivered = ox:AddItem(EnsureReturnStash(owner), name, count, clean) and true or false
                    usedReturnStash = usedReturnStash or delivered
                end
            end

            if not delivered then
                -- poslednja opcija: da roba ne nestane, ispada pored tezge
                ox:CustomDrop('Roba - ' .. stall.label, { { name, count, clean } }, ToVec3(stall.coords))
            end
        end
    end

    return usedReturnStash
end

-- ------------------------------------------------------------
--  Sinhronizacija stanja tezgi ka klijentima
-- ------------------------------------------------------------

local function BuildStatesFor(identifier)
    local now = os.time()
    local list = {}
    for id, stall in pairs(Stalls) do
        local mine = identifier ~= nil and stall.renter == identifier
        list[#list + 1] = {
            id = id,
            occupied = stall.renter ~= nil,
            mine = mine,
            remaining = mine and math.max(0, stall.expiresAt - now) or nil,
        }
    end
    return list
end

local function SyncPlayer(src)
    local xPlayer = ESX.GetPlayerFromId(src)
    TriggerClientEvent('flamingo_pijaca:client:syncStalls', src, BuildStatesFor(GetIdentifier(xPlayer)))
end

local function SyncAll()
    for _, src in ipairs(GetPlayers()) do
        SyncPlayer(tonumber(src))
    end
end

-- ------------------------------------------------------------
--  Oslobadjanje tezge
-- ------------------------------------------------------------

-- reason: 'manual' (vlasnik otkazao) ili 'expired' (isteklo vreme)
local function FreeStall(stall, reason)
    local renter = stall.renter
    if not renter then return end

    stall.renter = nil
    stall.renterName = nil
    stall.expiresAt = nil
    stall.warned = nil
    SaveData()

    local usedReturnStash = ReturnStallItems(stall, renter)

    local xOwner = ESX.GetPlayerFromIdentifier(renter)
    if xOwner then
        local msg = reason == 'expired'
            and ('Istekao ti je najam za %s. Roba sa tezge ti je vracena u inventar.'):format(stall.label)
            or ('Otkazao si najam za %s. Roba sa tezge ti je vracena u inventar.'):format(stall.label)
        if usedReturnStash then
            msg = msg .. ' Ono sto nije stalo preuzmi kod zakupca pijace.'
        end
        Notify(xOwner.source, msg, 'info', 8000)
    end

    SyncAll()
end

-- ------------------------------------------------------------
--  NPC dijalog (flamingo_npcdialog "tree")
-- ------------------------------------------------------------

local function BuildRentTree(xPlayer)
    local identifier = GetIdentifier(xPlayer)
    local options = {}
    local message

    local myStall = GetStallByIdentifier(identifier)

    if myStall then
        local remaining = math.max(0, myStall.expiresAt - os.time())
        message = ('Vec iznajmljujete %s.\nPreostalo vreme: %dh %dmin.'):format(
            myStall.label, math.floor(remaining / 3600), math.floor((remaining % 3600) / 60))

        options[#options + 1] = {
            label = 'Zelim da otkazem najam tezge (novac se ne vraca).',
            serverEvent = 'flamingo_pijaca:server:releaseStall',
            close = true,
        }
    else
        local freeStalls = {}
        for _, stall in pairs(Stalls) do
            if not stall.renter then
                freeStalls[#freeStalls + 1] = stall
            end
        end
        table.sort(freeStalls, function(a, b) return a.id < b.id end)

        if #freeStalls == 0 then
            message = 'Trenutno nema slobodnih tezgi. Navratite malo kasnije.'
        else
            message = ('Dobrodosli na pijacu! Najam kosta $%s po satu (od %d do %dh).\nEvo slobodnih tezgi:'):format(
                FormatMoney(Config.Rent.pricePerHour), Config.Rent.minHours, Config.Rent.maxHours)

            for _, stall in ipairs(freeStalls) do
                options[#options + 1] = {
                    label = ('%s je slobodna - iznajmi je.'):format(stall.label),
                    serverEvent = 'flamingo_pijaca:server:chooseStall',
                    args = { stall.id },
                    close = true,
                }
            end
        end
    end

    if ReturnStashHasItems(identifier) then
        options[#options + 1] = {
            label = 'Zelim da preuzmem robu koja mi je ostala.',
            serverEvent = 'flamingo_pijaca:server:openReturnStash',
            close = true,
        }
    end

    options[#options + 1] = { label = 'Dovidjenja.', close = true }

    return { start = { message = message, options = options } }
end

RegisterNetEvent('flamingo_pijaca:server:getRentMenu', function(reqId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    PayoutPending(xPlayer)
    ReplyCallback(src, reqId, BuildRentTree(xPlayer))
end)

-- ------------------------------------------------------------
--  Iznajmljivanje
-- ------------------------------------------------------------

-- Korak 1: igrac izabere tezgu u dijalogu -> otvara se UI za unos sati
RegisterNetEvent('flamingo_pijaca:server:chooseStall', function(stallId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    if GetStallByIdentifier(GetIdentifier(xPlayer)) then
        Notify(src, 'Vec iznajmljujete jednu tezgu. Mozete imati samo jednu.', 'error')
        return
    end

    local stall = Stalls[ToInt(stallId)]
    if not stall then return end

    if stall.renter then
        Notify(src, 'Ta tezga je u medjuvremenu vec iznajmljena.', 'error')
        return
    end

    TriggerClientEvent('flamingo_pijaca:client:openRent', src, {
        stallId = stall.id,
        stallLabel = stall.label,
        pricePerHour = Config.Rent.pricePerHour,
        minHours = Config.Rent.minHours,
        maxHours = Config.Rent.maxHours,
    })
end)

-- Korak 2: igrac upise broj sati i potvrdi
RegisterNetEvent('flamingo_pijaca:server:rentStall', function(stallId, hours)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = GetIdentifier(xPlayer)
    hours = ToInt(hours)

    if not hours or hours < Config.Rent.minHours or hours > Config.Rent.maxHours then
        Notify(src, ('Mozete iznajmiti tezgu od %d do %d sati.'):format(Config.Rent.minHours, Config.Rent.maxHours), 'error')
        return
    end

    if not IsNear(src, Config.Npc.coords, Config.ActionMaxDistance) then
        Notify(src, 'Morate biti kod zakupca pijace.', 'error')
        return
    end

    if GetStallByIdentifier(identifier) then
        Notify(src, 'Vec iznajmljujete jednu tezgu. Mozete imati samo jednu.', 'error')
        return
    end

    local stall = Stalls[ToInt(stallId)]
    if not stall then return end

    if stall.renter then
        Notify(src, 'Ta tezga je u medjuvremenu vec iznajmljena.', 'error')
        return
    end

    local cost = hours * Config.Rent.pricePerHour
    if GetBalance(xPlayer, Config.Rent.account) < cost then
        Notify(src, ('Nemate dovoljno novca. Najam na %dh kosta $%s.'):format(hours, FormatMoney(cost)), 'error')
        return
    end

    xPlayer.removeAccountMoney(Config.Rent.account, cost)

    -- ako je nesto ostalo na tezgi od ranije (npr. pad servera), vrati vlasnicima
    ReturnStallItems(stall, nil)

    stall.renter = identifier
    stall.renterName = xPlayer.getName and xPlayer.getName() or nil
    stall.expiresAt = os.time() + hours * 3600
    stall.warned = nil
    SaveData()

    Notify(src, ('Iznajmili ste %s na %dh za $%s. Idite do tezge i prevucite robu na nju.'):format(
        stall.label, hours, FormatMoney(cost)), 'success', 8000)

    SyncAll()
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

    FreeStall(stall, 'manual')
end)

RegisterNetEvent('flamingo_pijaca:server:openReturnStash', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local id = EnsureReturnStash(GetIdentifier(xPlayer))
    TriggerClientEvent('flamingo_pijaca:client:openStash', src, id)
end)

-- ------------------------------------------------------------
--  Stavljanje robe na tezgu (vlasnik upisao cenu)
-- ------------------------------------------------------------

local function ReopenStall(src, stall)
    TriggerClientEvent('flamingo_pijaca:client:openStash', src, stall.stashId)
end

RegisterNetEvent('flamingo_pijaca:server:listItem', function(stallId, slotId, itemName, count, price)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = GetIdentifier(xPlayer)
    local stall = Stalls[ToInt(stallId)]
    if not stall or stall.renter ~= identifier then
        Notify(src, 'Niste zakupac ove tezge.', 'error')
        return
    end

    if not IsNear(src, stall.coords, Config.ActionMaxDistance) then
        Notify(src, 'Niste dovoljno blizu tezge.', 'error')
        return
    end

    slotId, count, price = ToInt(slotId), ToInt(count), ToInt(price)

    if not price or price < Config.Sale.minPrice or price > Config.Sale.maxPrice then
        Notify(src, ('Cena mora biti izmedju $%s i $%s.'):format(FormatMoney(Config.Sale.minPrice), FormatMoney(Config.Sale.maxPrice)), 'error')
        return ReopenStall(src, stall)
    end

    local slot = slotId and ox:GetSlot(src, slotId)
    if not slot or slot.name ~= itemName or not count or count < 1 or count > slot.count then
        Notify(src, 'Taj item vise nije u vasem inventaru.', 'error')
        return ReopenStall(src, stall)
    end

    if Config.BlacklistedItems[slot.name] or IsListed(slot.metadata) then
        Notify(src, 'Taj item ne moze da se stavi na tezgu.', 'error')
        return ReopenStall(src, stall)
    end

    local originalMeta = slot.metadata
    local baseLabel = (type(originalMeta) == 'table' and originalMeta.label) or slot.label or slot.name
    local listedMeta = MakeListedMeta(originalMeta, baseLabel, price, identifier)

    if not ox:CanCarryItem(stall.stashId, slot.name, count, listedMeta) then
        Notify(src, 'Na tezgi nema vise mesta.', 'error')
        return ReopenStall(src, stall)
    end

    if not ox:RemoveItem(src, slot.name, count, originalMeta, slotId) then
        Notify(src, 'Doslo je do greske, pokusajte ponovo.', 'error')
        return ReopenStall(src, stall)
    end

    if not ox:AddItem(stall.stashId, slot.name, count, listedMeta) then
        ox:AddItem(src, slot.name, count, originalMeta)
        Notify(src, 'Doslo je do greske, item vam je vracen.', 'error')
        return ReopenStall(src, stall)
    end

    Notify(src, ('Stavili ste %dx %s na tezgu po ceni od $%s.'):format(count, baseLabel, FormatMoney(price)), 'success')
    ReopenStall(src, stall)
end)

-- Vlasnik vraca robu sa tezge u svoj inventar (skida se cena)
local function TakeBack(src, stall, slotId, count)
    local slot = ox:GetSlot(stall.stashId, slotId)
    if not slot or not IsListed(slot.metadata) then return end

    count = math.max(1, math.min(ToInt(count) or slot.count, slot.count))
    local clean = CleanMeta(slot.metadata)

    if not ox:CanCarryItem(src, slot.name, count, clean) then
        Notify(src, 'Nemate mesta u inventaru.', 'error')
        return
    end

    if ox:RemoveItem(stall.stashId, slot.name, count, slot.metadata, slotId) then
        ox:AddItem(src, slot.name, count, clean)
    end
end

-- ------------------------------------------------------------
--  Kupovina (kupac potvrdio u UI-u)
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:server:buyItem', function(stallId, slotId, itemName, count, expectedPrice)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local stall = Stalls[ToInt(stallId)]
    if not stall or not stall.renter then
        Notify(src, 'Tezga trenutno nije aktivna.', 'error')
        return
    end

    if stall.renter == GetIdentifier(xPlayer) then
        Notify(src, 'Ne mozete kupovati sa sopstvene tezge.', 'error')
        return
    end

    if not IsNear(src, stall.coords, Config.ActionMaxDistance) then
        Notify(src, 'Niste dovoljno blizu tezge.', 'error')
        return
    end

    slotId, count = ToInt(slotId), ToInt(count)

    local slot = slotId and ox:GetSlot(stall.stashId, slotId)
    if not slot or slot.name ~= itemName or not IsListed(slot.metadata) then
        Notify(src, 'Taj artikal vise nije na tezgi.', 'error')
        return ReopenStall(src, stall)
    end

    local price = slot.metadata[META_PRICE]
    if price ~= ToInt(expectedPrice) then
        Notify(src, 'Cena tog artikla se promenila, pogledajte ponovo.', 'error')
        return ReopenStall(src, stall)
    end

    if not count or count < 1 or count > slot.count then
        Notify(src, 'Nema dovoljno te robe na tezgi.', 'error')
        return ReopenStall(src, stall)
    end

    local total = price * count
    if GetBalance(xPlayer, Config.Sale.account) < total then
        Notify(src, ('Nemate dovoljno novca ($%s).'):format(FormatMoney(total)), 'error')
        return ReopenStall(src, stall)
    end

    local sellerMeta = slot.metadata
    local clean = CleanMeta(sellerMeta)

    if not ox:CanCarryItem(src, slot.name, count, clean) then
        Notify(src, 'Nemate mesta u inventaru za tu kolicinu.', 'error')
        return ReopenStall(src, stall)
    end

    xPlayer.removeAccountMoney(Config.Sale.account, total)

    if not ox:RemoveItem(stall.stashId, slot.name, count, sellerMeta, slotId) then
        xPlayer.addAccountMoney(Config.Sale.account, total)
        Notify(src, 'Doslo je do greske, pokusajte ponovo.', 'error')
        return ReopenStall(src, stall)
    end

    ox:AddItem(src, slot.name, count, clean)

    local itemLabel = sellerMeta[META_PREV_LABEL] or slot.label or slot.name
    PaySeller(stall.renter, total, ('Prodali ste %dx %s za $%s.'):format(count, itemLabel, FormatMoney(total)))
    Notify(src, ('Kupili ste %dx %s za $%s.'):format(count, itemLabel, FormatMoney(total)), 'success')

    ReopenStall(src, stall)
end)

-- ------------------------------------------------------------
--  ox_inventory hookovi - ovde se "hvata" prevlacenje robe
-- ------------------------------------------------------------

local function IsReturnStash(invId)
    return invId:sub(1, #Config.ReturnStashPrefix) == Config.ReturnStashPrefix
end

ox:registerHook('swapItems', function(payload)
    local src = payload.source
    local fromInv, toInv = tostring(payload.fromInventory), tostring(payload.toInventory)
    -- VAZNO: greska u hooku ox_inventory tretira kao "dozvoljeno", zato
    -- sve sto moze da pukne (nil igrac/identifier) odmah odbijamo.
    local xPlayer = ESX.GetPlayerFromId(src)
    local identifier = GetIdentifier(xPlayer)
    if not identifier then return false end

    -- Povrat magacin: samo sopstveni, samo vadjenje u svoj inventar
    if IsReturnStash(toInv) then
        return false
    end
    if IsReturnStash(fromInv) then
        return fromInv == ReturnStashId(identifier) and payload.toType == 'player' and toInv == tostring(src)
    end

    local fromStall, toStall = StallByStash[fromInv], StallByStash[toInv]
    if not fromStall and not toStall then return true end

    local stall = fromStall or toStall
    if not stall.renter then return false end

    local isOwner = stall.renter == identifier

    -- premestanje unutar iste tezge (sredjivanje) - samo vlasnik
    if fromStall and toStall then
        return fromStall == toStall and isOwner
    end

    local slot = payload.fromSlot
    if type(slot) ~= 'table' then return false end

    local count = math.max(1, math.min(ToInt(payload.count) or slot.count, slot.count))

    -- Iz inventara NA tezgu -> otvara se UI za cenu
    if toStall then
        if payload.fromType ~= 'player' or fromInv ~= tostring(src) then return false end

        if not isOwner then
            Notify(src, 'Ne mozete stavljati robu na tudju tezgu.', 'error')
            return false
        end

        if Config.BlacklistedItems[slot.name] or IsListed(slot.metadata) then
            Notify(src, 'Taj item ne moze da se stavi na tezgu.', 'error')
            return false
        end

        TriggerClientEvent('flamingo_pijaca:client:askPrice', src, {
            stallId = stall.id,
            slot = slot.slot,
            name = slot.name,
            label = (type(slot.metadata) == 'table' and slot.metadata.label) or slot.label or slot.name,
            count = count,
            max = slot.count,
            minPrice = Config.Sale.minPrice,
            maxPrice = Config.Sale.maxPrice,
        })
        return false
    end

    -- Sa tezge u inventar
    if payload.toType ~= 'player' or toInv ~= tostring(src) then return false end
    if not IsListed(slot.metadata) then return false end

    if isOwner then
        -- vlasnik vraca robu sebi: radimo rucno da bi se skinula cena sa itema
        local slotId = slot.slot
        SetTimeout(0, function()
            TakeBack(src, stall, slotId, count)
        end)
        return false
    end

    -- kupac -> otvara se UI za potvrdu kupovine
    TriggerClientEvent('flamingo_pijaca:client:askBuy', src, {
        stallId = stall.id,
        slot = slot.slot,
        name = slot.name,
        label = slot.metadata[META_PREV_LABEL] or slot.label or slot.name,
        price = slot.metadata[META_PRICE],
        count = count,
        max = slot.count,
        seller = stall.renterName,
    })
    return false
end, {
    inventoryFilter = { '^flamingo_pijaca_' },
})

-- Tudji povrat magacin i slobodne tezge ne mogu da se otvore
ox:registerHook('openInventory', function(payload)
    local invId = tostring(payload.inventoryId)

    if IsReturnStash(invId) then
        local identifier = GetIdentifier(ESX.GetPlayerFromId(payload.source))
        return identifier ~= nil and invId == ReturnStashId(identifier)
    end

    local stall = StallByStash[invId]
    if stall and not stall.renter then
        return false
    end

    return true
end, {
    inventoryFilter = { '^flamingo_pijaca_' },
})

-- ------------------------------------------------------------
--  Inicijalizacija
-- ------------------------------------------------------------

CreateThread(function()
    local data = LoadData()
    local rentals = type(data.rentals) == 'table' and data.rentals or {}
    Earnings = type(data.earnings) == 'table' and data.earnings or {}

    for _, cfgStall in ipairs(Config.Stalls) do
        local stall = {
            id = cfgStall.id,
            label = cfgStall.label,
            coords = cfgStall.coords,
            stashId = Config.StallStashId(cfgStall.id),
        }

        Stalls[stall.id] = stall
        StallByStash[stall.stashId] = stall

        ox:RegisterStash(stall.stashId, stall.label, Config.StallSlots, Config.StallMaxWeight, false, nil, ToVec3(stall.coords))

        local saved = rentals[tostring(stall.id)]
        if type(saved) == 'table' and saved.renter and tonumber(saved.expiresAt) then
            stall.renter = saved.renter
            stall.renterName = saved.renterName
            stall.expiresAt = tonumber(saved.expiresAt)
        else
            -- tezga nije iznajmljena, a na njoj je ostala roba (npr. pad servera)
            ReturnStallItems(stall, nil)
        end
    end

    SyncAll()
end)

-- Isticanje najma + upozorenje pred istek
CreateThread(function()
    while true do
        Wait(15000)
        local now = os.time()

        for _, stall in pairs(Stalls) do
            if stall.renter and stall.expiresAt then
                if now >= stall.expiresAt then
                    FreeStall(stall, 'expired')
                elseif not stall.warned and stall.expiresAt - now <= Config.ExpireWarningMinutes * 60 then
                    stall.warned = true
                    local xOwner = ESX.GetPlayerFromIdentifier(stall.renter)
                    if xOwner then
                        Notify(xOwner.source, ('Najam za %s istice za %d minuta.'):format(stall.label, math.ceil((stall.expiresAt - now) / 60)), 'info', 8000)
                    end
                end
            end
        end
    end
end)

RegisterNetEvent('flamingo_pijaca:server:ready', function()
    SyncPlayer(source)
end)

AddEventHandler('esx:playerLoaded', function(playerId, xPlayer)
    SyncPlayer(playerId)
    if xPlayer then
        PayoutPending(xPlayer)
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == RESOURCE then
        SaveData()
    end
end)
