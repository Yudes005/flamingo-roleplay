-- ============================================================
--  flamingo_biznisi - server
--  Za sada samo bankomati: vlasnik zaradjuje proviziju od podizanja
--  novca na svom bankomatu (Standard 15% / Premium 10% / Gold 5%,
--  procenti se citaju iz flamingo_banke), provizija ide u kasu biznisa.
--  Svaki bankomat ima svoju gotovinu (max Config.ATM.maxCash).
-- ============================================================

local BIZ        = {}     -- [id] = biznis (izvor istine je memorija, baza se azurira delta upitima)
local ready      = false
local lastAction = {}

-- ============================================================
--  Pomocne funkcije
-- ============================================================
local function fmt(n)
    local s = tostring(math.floor(n or 0))
    local out = s:reverse():gsub('(%d%d%d)', '%1.'):reverse():gsub('^%.', '')
    return out .. '$'
end

local function toAmount(v)
    v = tonumber(v)
    if not v or v ~= v or v == math.huge then return nil end
    v = math.floor(v)
    if v < 1 or v > 2147483647 then return nil end
    return v
end

local function sanitize(str, max)
    if type(str) ~= 'string' then return nil end
    str = str:gsub('[<>\r\n\t"\']', ''):gsub('^%s+', ''):gsub('%s+$', ''):gsub('%s+', ' ')
    if str == '' then return nil end
    return str:sub(1, max)
end

local function passCooldown(src, ms)
    local now = GetGameTimer()
    if lastAction[src] and now - lastAction[src] < (ms or 800) then return false end
    lastAction[src] = now
    return true
end

local function notify(src, msg, nType)
    TriggerClientEvent('flamingo_biznisi:notify', src, msg, nType or 'info')
end

local function bizName(b)
    if b.label and b.label ~= '' then return b.label end
    if b.type == 'market' then return ('%s #%d'):format(b.shopLabel or Config.Market.label, b.id) end
    if b.type == 'carwash' then return ('%s #%d'):format(b.shopLabel or Config.Carwash.label, b.id) end
    if b.type == 'fuel' then return ('%s #%d'):format(b.shopLabel or Config.Fuel.label, b.id) end
    return ('%s #%d'):format(Config.ATM.label, b.id)
end

local function seedKey(c)
    return ('%d_%d_%d'):format(math.floor(c.x + 0.5), math.floor(c.y + 0.5), math.floor(c.z + 0.5))
end

local function isAdmin(xPlayer)
    local group = xPlayer.getGroup and xPlayer.getGroup() or nil
    for _, g in ipairs(Config.AdminGroups) do
        if g == group then return true end
    end
    return false
end

local function nearBiz(src, b, dist)
    local ped = GetPlayerPed(src)
    if ped == 0 then return false end
    local max = dist or (b.type == 'carwash' and Config.Carwash.distance) or (b.type == 'fuel' and Config.Fuel.distance) or Config.ServerDistance
    return #(GetEntityCoords(ped) - b.coords) <= max
end

local function ownedCount(identifier)
    local n = 0
    for _, b in pairs(BIZ) do
        if b.owner == identifier and not b.disabled then n = n + 1 end
    end
    return n
end

-- Paketi kartica (procenti provizije) - citaju se iz flamingo_banke da bi uvek bili isti
local function cardTiers()
    if GetResourceState('flamingo_banke') == 'started' then
        local ok, tiers = pcall(function() return exports['flamingo_banke']:GetCardTiers() end)
        if ok and type(tiers) == 'table' and #tiers > 0 then return tiers end
    end
    return Config.CardFallback
end

-- ============================================================
--  Baza
-- ============================================================
local function logTx(bizId, txType, amount, fee, tier, actor, note)
    MySQL.insert(
        'INSERT INTO flamingo_biznisi_log (biz_id, type, amount, fee, tier, actor, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        { bizId, txType, math.floor(amount or 0), math.floor(fee or 0), tier, actor, note }
    )
end

-- Novac se u bazi menja relativno (col = col + delta) da redosled async upita ne bi mogao da pregazi stanje
local function addMoney(b, fields)
    local sets, params = {}, {}
    for col, delta in pairs(fields) do
        sets[#sets + 1] = ('`%s` = `%s` + ?'):format(col, col)
        params[#params + 1] = delta
    end
    params[#params + 1] = b.id
    MySQL.update(('UPDATE flamingo_biznisi SET %s WHERE id = ?'):format(table.concat(sets, ', ')), params)
end

local function rowToBiz(r)
    return {
        id        = r.id,
        type      = r.type,
        seedKey   = r.seed_key,
        label     = r.label,
        coords    = vector3(r.x + 0.0, r.y + 0.0, r.z + 0.0),
        price     = r.price,
        owner     = r.owner,
        ownerName = r.owner_name,
        balance   = tonumber(r.balance) or 0,
        atmCash   = tonumber(r.atm_cash) or 0,
        earned    = tonumber(r.earned) or 0,
        boughtAt  = r.bought_ts,
        disabled  = r.disabled == 1 or r.disabled == true,
        stock     = {},   -- marketi: [item] = komada
        pending   = {},   -- marketi: [item] = komada u dolasku
        items     = nil,  -- marketi: lista artikala iz flamingo_supermarket
        calibrated = r.calibrated == 1 or r.calibrated == true
    }
end

-- ============================================================
--  Sinhronizacija sa klijentima
-- ============================================================
local function publicList()
    local list = {}
    for _, b in pairs(BIZ) do
        if not b.disabled then
            list[#list + 1] = {
                id = b.id, type = b.type, name = bizName(b),
                x = b.coords.x, y = b.coords.y, z = b.coords.z,
                owned = b.owner ~= nil,
                calibrated = b.calibrated
            }
        end
    end
    return list
end

local function mineOf(identifier)
    local ids = {}
    for _, b in pairs(BIZ) do
        if b.owner == identifier and not b.disabled then ids[#ids + 1] = b.id end
    end
    return ids
end

local function syncPlayer(src)
    if not ready then return end
    local xPlayer = ESX.GetPlayerFromId(src)
    TriggerClientEvent('flamingo_biznisi:client:sync', src, publicList(), xPlayer and mineOf(xPlayer.identifier) or {})
end

local function syncAll()
    if not ready then return end
    local list = publicList()
    for _, xPlayer in pairs(ESX.GetExtendedPlayers()) do
        TriggerClientEvent('flamingo_biznisi:client:sync', xPlayer.source, list, mineOf(xPlayer.identifier))
    end
end

RegisterNetEvent('flamingo_biznisi:server:requestSync', function()
    syncPlayer(source)
end)

-- Koordinate iz configa su priblizne. Prvi igrac koji priđe bankomatu javi tacnu poziciju
-- pravog bankomata (propa), da bi flamingo_banke tacno prepoznao koji je bankomat biznis.
-- Prihvata se samo jednom po biznisu i samo ako je u krugu od snapRadius metara.
RegisterNetEvent('flamingo_biznisi:server:calibrate', function(id, atm)
    local src = source
    local b = BIZ[tonumber(id) or -1]
    if not b or b.calibrated or type(atm) ~= 'vector3' then return end
    if #(atm - b.coords) > Config.ATM.snapRadius + 0.5 then return end
    local ped = GetPlayerPed(src)
    if ped == 0 or #(GetEntityCoords(ped) - atm) > 60.0 then return end

    b.coords = atm
    b.calibrated = true
    MySQL.update('UPDATE flamingo_biznisi SET x = ?, y = ?, z = ?, calibrated = 1 WHERE id = ?', { atm.x, atm.y, atm.z, b.id })
    syncAll()
end)

AddEventHandler('esx:playerLoaded', function(src)
    syncPlayer(src)
end)

AddEventHandler('playerDropped', function()
    lastAction[source] = nil
end)

-- ============================================================
--  Start: tabele + bankomati iz configa
-- ============================================================
MySQL.ready(function()
    CreateThread(function()
        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `flamingo_biznisi` (
                `id`         INT NOT NULL AUTO_INCREMENT,
                `type`       VARCHAR(20) NOT NULL DEFAULT 'atm',
                `label`      VARCHAR(40) NULL,
                `seed_key`   VARCHAR(40) NULL,
                `x`          FLOAT NOT NULL,
                `y`          FLOAT NOT NULL,
                `z`          FLOAT NOT NULL,
                `price`      INT NOT NULL DEFAULT 0,
                `owner`      VARCHAR(64) NULL,
                `owner_name` VARCHAR(64) NULL,
                `balance`    BIGINT NOT NULL DEFAULT 0,
                `atm_cash`   BIGINT NOT NULL DEFAULT 0,
                `earned`     BIGINT NOT NULL DEFAULT 0,
                `bought_at`  TIMESTAMP NULL DEFAULT NULL,
                `disabled`   TINYINT NOT NULL DEFAULT 0,
                `calibrated` TINYINT NOT NULL DEFAULT 0,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                UNIQUE KEY `uq_seed` (`seed_key`),
                INDEX `idx_owner` (`owner`)
            )
        ]])

        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `flamingo_biznisi_log` (
                `id`         BIGINT NOT NULL AUTO_INCREMENT,
                `biz_id`     INT NOT NULL,
                `type`       VARCHAR(20) NOT NULL,
                `amount`     BIGINT NOT NULL DEFAULT 0,
                `fee`        INT NOT NULL DEFAULT 0,
                `tier`       VARCHAR(20) NULL,
                `actor`      VARCHAR(64) NULL,
                `note`       VARCHAR(120) NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                INDEX `idx_biz_time` (`biz_id`, `created_at`)
            )
        ]])

        -- kolona "note" za bazu napravljenu pre marketa
        local hasNote = MySQL.scalar.await(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flamingo_biznisi_log' AND COLUMN_NAME = 'note'"
        )
        if not hasNote or tonumber(hasNote) == 0 then
            MySQL.query.await('ALTER TABLE `flamingo_biznisi_log` ADD COLUMN `note` VARCHAR(120) NULL AFTER `actor`')
        end

        -- Marketi: zalihe po artiklu i narudzbine robe
        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `flamingo_biznisi_stock` (
                `biz_id` INT NOT NULL,
                `item`   VARCHAR(64) NOT NULL,
                `stock`  INT NOT NULL DEFAULT 0,
                PRIMARY KEY (`biz_id`, `item`)
            )
        ]])
        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `flamingo_biznisi_orders` (
                `id`           INT NOT NULL AUTO_INCREMENT,
                `biz_id`       INT NOT NULL,
                `item`         VARCHAR(64) NOT NULL,
                `amount`       INT NOT NULL,
                `cost`         INT NOT NULL,
                `status`       VARCHAR(16) NOT NULL DEFAULT 'pending',
                `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                `delivered_at` TIMESTAMP NULL DEFAULT NULL,
                PRIMARY KEY (`id`),
                INDEX `idx_biz_status` (`biz_id`, `status`)
            )
        ]])

        -- Bankomati iz configa: novi se ubacuju, a onima bez vlasnika se osvezava cena
        for _, a in ipairs(Config.ATMs) do
            local price = a.price or Config.ATM.defaultPrice
            MySQL.query.await([[
                INSERT INTO flamingo_biznisi (type, seed_key, x, y, z, price, atm_cash)
                VALUES ('atm', ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE price = IF(owner IS NULL, VALUES(price), price)
            ]], { seedKey(a.coords), a.coords.x, a.coords.y, a.coords.z, price, Config.ATM.startCash })
        end

        local rows = MySQL.query.await('SELECT *, UNIX_TIMESTAMP(bought_at) AS bought_ts FROM flamingo_biznisi') or {}
        for _, r in ipairs(rows) do
            BIZ[r.id] = rowToBiz(r)
        end

        for _, r in ipairs(MySQL.query.await('SELECT biz_id, item, stock FROM flamingo_biznisi_stock') or {}) do
            local b = BIZ[r.biz_id]
            if b then b.stock[r.item] = r.stock end
        end
        for _, r in ipairs(MySQL.query.await("SELECT biz_id, item, SUM(amount) AS n FROM flamingo_biznisi_orders WHERE status = 'pending' GROUP BY biz_id, item") or {}) do
            local b = BIZ[r.biz_id]
            if b then b.pending[r.item] = tonumber(r.n) or 0 end
        end

        ready = true
        print(('[flamingo_biznisi] Ucitano biznisa: %d'):format(#rows))
        syncAll()
        TriggerEvent('flamingo_biznisi:ready')
    end)
end)

-- ============================================================
--  Kasa pri prodaji: sve sto je ostalo u kasi isplacuje se prodavcu na racun
-- ============================================================
local function payoutKasa(b, xPlayer)
    local amount = math.floor(b.balance)
    if amount < 1 then return 0 end
    b.balance = 0
    addMoney(b, { balance = -amount })
    xPlayer.addAccountMoney('bank', amount, 'Isplata iz kase biznisa')
    logTx(b.id, 'take', amount, 0, 'bank', xPlayer.getName())
    return amount
end

local function bankLog(src, txType, title, amount, memo, party)
    if GetResourceState('flamingo_banke') ~= 'started' then return end
    pcall(function()
        exports['flamingo_banke']:AddTransaction(src, txType, title, amount, memo, party)
    end)
end

local function ownedBy(identifier)
    for _, b in pairs(BIZ) do
        if b.owner == identifier and not b.disabled then return b end
    end
end

-- ============================================================
--  Marketi: zalihe
-- ============================================================
local function marketItem(b, name)
    for _, it in ipairs(b.items or {}) do
        if it.name == name then return it end
    end
end

-- Magacin po tipu: market (komadi) ili pumpa (litri goriva)
local function stockCfg(b)
    if b and b.type == 'fuel' then
        return { max = Config.Fuel.maxLiters, low = Config.Fuel.lowLiters, ratio = Config.Fuel.orderRatio, unit = 'L' }
    end
    return { max = Config.Market.maxStock, low = Config.Market.lowStock, ratio = Config.Market.orderRatio, unit = 'kom.' }
end

local function orderPrice(it, b)
    return math.max(1, math.floor(it.price * stockCfg(b).ratio + 0.5))
end

local function stockNote(b, amount, it)
    if b.type == 'fuel' then return ('%d L goriva'):format(amount) end
    return ('%dx %s'):format(amount, it.label)
end

local function addStock(b, item, delta)
    local new = math.max(0, (b.stock[item] or 0) + delta)
    b.stock[item] = new
    MySQL.update(
        'INSERT INTO flamingo_biznisi_stock (biz_id, item, stock) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE stock = GREATEST(0, stock + ?)',
        { b.id, item, new, delta }
    )
    return new
end

local function carwashPackages(b)
    local list = {}
    for _, pk in ipairs(b.packages or {}) do
        list[#list + 1] = { label = pk.label, price = pk.price, earn = math.floor(pk.price * (Config.Carwash.share or 0) / 100) }
    end
    return list
end

local function marketProducts(b)
    local list = {}
    for _, it in ipairs(b.items or {}) do
        local sc = stockCfg(b)
        list[#list + 1] = {
            name = it.name, label = it.label, price = it.price, orderPrice = orderPrice(it, b),
            stock = b.stock[it.name] or 0, pending = b.pending[it.name] or 0,
            max = sc.max, low = (b.stock[it.name] or 0) < sc.low, unit = sc.unit
        }
    end
    return list
end

-- ============================================================
--  Promena vlasnika (kupovina / aukcija / admin)
--  Kasa se pri promeni vlasnika prazni - stari vlasnik treba da je podigne pre prodaje.
-- ============================================================
local function setOwner(b, identifier, name, reason)
    local oldBalance = b.balance
    b.owner     = identifier
    b.ownerName = identifier and name or nil
    b.boughtAt  = identifier and os.time() or nil
    b.label     = nil
    b.balance   = 0

    MySQL.update(
        'UPDATE flamingo_biznisi SET owner = ?, owner_name = ?, bought_at = IF(? IS NULL, NULL, NOW()), label = NULL, balance = balance - ? WHERE id = ?',
        { identifier, b.ownerName, identifier, oldBalance, b.id }
    )
    logTx(b.id, identifier and 'owner' or 'state', 0, 0, nil, identifier and name or (reason or 'Država'))
    syncAll()
end

-- ============================================================
--  Meni bankomata (flamingo_banke): kategorija "Biznis" + kupovina
-- ============================================================
local function publicInfo(b, xPlayer)
    local mine = b.owner ~= nil and b.owner == xPlayer.identifier
    return {
        id        = b.id,
        type      = b.type,
        name      = bizName(b),
        price     = b.price,
        owned     = b.owner ~= nil,
        mine      = mine,
        ownerName = b.ownerName,
        cards     = cardTiers(),
        stateCut  = Config.StateCut,
        canBuy    = Config.AllowDirectBuy and b.owner == nil,
        directBuy = Config.AllowDirectBuy,
        myCount   = ownedCount(xPlayer.identifier),
        maxCount  = Config.MaxPerPlayer,
        cash      = xPlayer.getAccount('money').money,
        bank      = xPlayer.getAccount('bank').money,
        buyFrom   = Config.BuyFrom
    }
end

-- flamingo_banke: podaci za kategoriju "Biznis" i "Vlasnik" u meniju bankomata
exports('GetAtmInfo', function(id, src)
    local xPlayer = ESX.GetPlayerFromId(src)
    local b = BIZ[tonumber(id) or -1]
    if not xPlayer or not b or b.disabled then return nil end
    return publicInfo(b, xPlayer)
end)

ESX.RegisterServerCallback('flamingo_biznisi:buy', function(src, cb, id)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    if not Config.AllowDirectBuy then return fail('Biznisi se kupuju isključivo na aukciji.') end
    if not passCooldown(src, 1500) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    local b = BIZ[tonumber(id) or -1]
    if not xPlayer or not b or b.disabled then return fail('Biznis nije pronađen.') end
    if not nearBiz(src, b) then return fail('Previše si daleko od biznisa.') end
    if b.owner then return fail('Ovaj biznis već ima vlasnika.') end

    if Config.MaxPerPlayer > 0 and ownedCount(xPlayer.identifier) >= Config.MaxPerPlayer then
        return fail(Config.MaxPerPlayer == 1 and 'Već imaš biznis. Možeš imati samo jedan.' or ('Možeš imati najviše %d biznisa.'):format(Config.MaxPerPlayer))
    end

    local price = b.price
    local paidFrom
    if Config.BuyFrom ~= 'money' and xPlayer.getAccount('bank').money >= price then
        paidFrom = 'bank'
    elseif Config.BuyFrom ~= 'bank' and xPlayer.getAccount('money').money >= price then
        paidFrom = 'money'
    end
    if not paidFrom then
        local where = Config.BuyFrom == 'bank' and 'na računu' or (Config.BuyFrom == 'money' and 'u gotovini' or 'na računu ili u gotovini')
        return fail(('Za ovaj biznis ti treba %s %s.'):format(fmt(price), where))
    end

    xPlayer.removeAccountMoney(paidFrom, price, 'Kupovina biznisa')
    if paidFrom == 'bank' and GetResourceState('flamingo_banke') == 'started' then
        pcall(function()
            exports['flamingo_banke']:AddTransaction(src, 'expense', 'Kupovina biznisa', price, bizName(b), 'Država')
        end)
    end

    local name = xPlayer.getName()
    setOwner(b, xPlayer.identifier, name)
    logTx(b.id, 'buy', price, 0, nil, name)

    local info = publicInfo(b, xPlayer)
    info.ok  = true
    info.msg = ('Kupio si %s za %s! Upravljaj njime na tabletu, aplikacija "Moj biznis".'):format(bizName(b), fmt(price))
    cb(info)
end)

-- ============================================================
--  Tablet: aplikacija "Moj biznis"
-- ============================================================
local function placeholders(n)
    local t = {}
    for i = 1, n do t[i] = '?' end
    return table.concat(t, ',')
end

ESX.RegisterServerCallback('flamingo_biznisi:tablet:list', function(src, cb)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return cb({ ok = false, error = 'Igrač nije pronađen.' }) end
    if not ready then return cb({ ok = false, error = 'Biznisi se još učitavaju, pokušaj za par sekundi.' }) end

    local owned, ids = {}, {}
    for _, b in pairs(BIZ) do
        if b.owner == xPlayer.identifier and not b.disabled then
            owned[#owned + 1] = b
            ids[#ids + 1] = b.id
        end
    end
    table.sort(owned, function(a, c) return a.id < c.id end)

    local days, tiers = {}, {}
    if #ids > 0 then
        local ph = placeholders(#ids)

        local dayRows = MySQL.query.await(([[
            SELECT biz_id, DATEDIFF(CURDATE(), DATE(created_at)) AS ago, COALESCE(SUM(fee), 0) AS f, COUNT(*) AS c
            FROM flamingo_biznisi_log
            WHERE biz_id IN (%s) AND type IN ('withdraw', 'sale', 'wash', 'fuel') AND created_at >= CURDATE() - INTERVAL 6 DAY
            GROUP BY biz_id, ago
        ]]):format(ph), ids) or {}
        for _, r in ipairs(dayRows) do
            days[r.biz_id] = days[r.biz_id] or {}
            days[r.biz_id][tonumber(r.ago)] = { fee = tonumber(r.f) or 0, count = tonumber(r.c) or 0 }
        end

        local tierRows = MySQL.query.await(([[
            SELECT biz_id, tier, COALESCE(SUM(fee), 0) AS f, COUNT(*) AS c
            FROM flamingo_biznisi_log
            WHERE biz_id IN (%s) AND type = 'withdraw' AND created_at >= NOW() - INTERVAL 7 DAY
            GROUP BY biz_id, tier
        ]]):format(ph), ids) or {}
        for _, r in ipairs(tierRows) do
            tiers[r.biz_id] = tiers[r.biz_id] or {}
            tiers[r.biz_id][r.tier or 'standard'] = { fee = tonumber(r.f) or 0, count = tonumber(r.c) or 0 }
        end
    end

    local out = {}
    for _, b in ipairs(owned) do
        local logs = MySQL.query.await(
            'SELECT type, amount, fee, tier, actor, note, UNIX_TIMESTAMP(created_at) AS ts FROM flamingo_biznisi_log WHERE biz_id = ? ORDER BY id DESC LIMIT ?',
            { b.id, Config.LogLimit }
        ) or {}

        local chart, week, count7 = {}, 0, 0
        for ago = 6, 0, -1 do
            local d = (days[b.id] and days[b.id][ago]) or { fee = 0, count = 0 }
            chart[#chart + 1] = { ago = ago, fee = d.fee, count = d.count }
            week = week + d.fee
            count7 = count7 + d.count
        end

        out[#out + 1] = {
            id       = b.id,
            type     = b.type,
            name     = bizName(b),
            custom   = b.label ~= nil and b.label ~= '',
            coords   = { x = b.coords.x, y = b.coords.y, z = b.coords.z },
            price    = b.price,
            sellPrice = math.floor(b.price * Config.SellToStateRatio),
            balance  = b.balance,
            atmCash  = b.atmCash,
            atmMax   = Config.ATM.maxCash,
            lowCash  = b.atmCash < Config.ATM.lowCash,
            earned   = b.earned,
            boughtAt = b.boughtAt,
            today    = chart[7].fee,
            week     = week,
            count7   = count7,
            chart    = chart,
            tiers    = tiers[b.id] or {},
            logs     = logs,
            products = (b.type == 'market' or b.type == 'fuel') and marketProducts(b) or nil,
            packages = b.type == 'carwash' and carwashPackages(b) or nil,
            share    = b.type == 'carwash' and Config.Carwash.share or nil
        }
    end

    cb({
        ok         = true,
        orderRatio = Config.Market.orderRatio,
        supply     = Config.Supply.resource ~= nil and GetResourceState(Config.Supply.resource) == 'started',
        businesses = out,
        cards      = cardTiers(),
        stateCut   = Config.StateCut,
        refill     = Config.Refill.resource ~= nil and GetResourceState(Config.Refill.resource) == 'started',
        maxCount   = Config.MaxPerPlayer,
        cash       = xPlayer.getAccount('money').money,
        bank       = xPlayer.getAccount('bank').money,
        now        = os.time()
    })
end)

ESX.RegisterServerCallback('flamingo_biznisi:tablet:action', function(src, cb, payload)
    local function fail(msg) cb({ ok = false, error = msg }) end

    if type(payload) ~= 'table' then return fail('Neispravan zahtev.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    local b = BIZ[tonumber(payload.id) or -1]
    if not xPlayer or not b or b.disabled then return fail('Biznis nije pronađen.') end
    if b.owner ~= xPlayer.identifier then return fail('Nisi vlasnik ovog biznisa.') end

    local name   = xPlayer.getName()
    local action = payload.action
    local account = payload.account == 'bank' and 'bank' or 'money'
    local accLabel = account == 'bank' and 'na račun' or 'u gotovini'

    if action == 'take' or action == 'takeAll' then
        local amount = action == 'takeAll' and math.floor(b.balance) or toAmount(payload.amount)
        if not amount or amount < 1 then
            return fail(action == 'takeAll' and 'Kasa je prazna.' or 'Unesi ispravan iznos.')
        end
        if amount > b.balance then return fail(('U kasi ima samo %s.'):format(fmt(b.balance))) end

        b.balance = b.balance - amount
        addMoney(b, { balance = -amount })
        xPlayer.addAccountMoney(account, amount, 'Isplata iz kase biznisa')
        logTx(b.id, 'take', amount, 0, account, name)
        if account == 'bank' and GetResourceState('flamingo_banke') == 'started' then
            pcall(function()
                exports['flamingo_banke']:AddTransaction(src, 'income', 'Isplata iz kase', amount, bizName(b), bizName(b))
            end)
        end
        return cb({ ok = true, message = ('Podigao si %s iz kase %s.'):format(fmt(amount), accLabel) })

    elseif action == 'put' then
        local amount = toAmount(payload.amount)
        if not amount then return fail('Unesi ispravan iznos.') end
        if xPlayer.getAccount(account).money < amount then
            return fail(account == 'bank' and 'Nemaš toliko novca na računu.' or 'Nemaš toliko gotovine kod sebe.')
        end

        xPlayer.removeAccountMoney(account, amount, 'Uplata u kasu biznisa')
        b.balance = b.balance + amount
        addMoney(b, { balance = amount })
        logTx(b.id, 'put', amount, 0, account, name)
        if account == 'bank' and GetResourceState('flamingo_banke') == 'started' then
            pcall(function()
                exports['flamingo_banke']:AddTransaction(src, 'expense', 'Uplata u kasu', amount, bizName(b), bizName(b))
            end)
        end
        return cb({ ok = true, message = ('Uložio si %s u kasu.'):format(fmt(amount)) })

    elseif action == 'rename' then
        local label = sanitize(payload.name, 24)
        if label and #label < 3 then return fail('Naziv mora imati bar 3 slova.') end
        b.label = label
        MySQL.update('UPDATE flamingo_biznisi SET label = ? WHERE id = ?', { label, b.id })
        syncAll()
        return cb({ ok = true, message = label and ('Biznis se sada zove "%s".'):format(label) or 'Vraćen je podrazumevani naziv.' })

    elseif action == 'order' or action == 'orderFill' then
        if b.type ~= 'market' and b.type ~= 'fuel' then return fail('Ovaj biznis nema robu.') end
        local it = marketItem(b, payload.item)
        if not it then return fail('Nepoznat artikal.') end

        local sc = stockCfg(b)
        local room = sc.max - (b.stock[it.name] or 0) - (b.pending[it.name] or 0)
        local amount = action == 'orderFill' and room or toAmount(payload.amount)
        if not amount or amount < 1 then
            if room <= 0 then return fail(b.type == 'fuel' and 'Rezervoar pumpe je pun.' or 'Magacin za ovaj artikal je pun.') end
            return fail(b.type == 'fuel' and 'Unesi koliko litara naručuješ.' or 'Unesi koliko komada naručuješ.')
        end
        if amount > room then
            return fail(('Može još najviše %d %s (%s %d %s).'):format(math.max(0, room), sc.unit,
                b.type == 'fuel' and 'rezervoar' or 'magacin', sc.max, sc.unit))
        end

        local unit = orderPrice(it, b)
        local cost = unit * amount
        if cost > b.balance then
            return fail(('Narudžbina košta %s, a u kasi ima %s. Uloži novac u kasu.'):format(fmt(cost), fmt(b.balance)))
        end

        b.balance = b.balance - cost
        addMoney(b, { balance = -cost })
        local note = stockNote(b, amount, it)
        logTx(b.id, 'order', cost, 0, nil, name, note)

        local supply = Config.Supply.resource
        if supply and GetResourceState(supply) == 'started' then
            local orderId = MySQL.insert.await(
                "INSERT INTO flamingo_biznisi_orders (biz_id, item, amount, cost, status) VALUES (?, ?, ?, ?, 'pending')",
                { b.id, it.name, amount, cost }
            )
            b.pending[it.name] = (b.pending[it.name] or 0) + amount
            TriggerEvent('flamingo_biznisi:orderCreated', src, orderId, b.id, it.name, amount)
            return cb({ ok = true, message = ('Naručeno %s za %s. Roba stiže transportom.'):format(note, fmt(cost)) })
        end

        -- nema transporta: roba stize odmah
        MySQL.insert(
            "INSERT INTO flamingo_biznisi_orders (biz_id, item, amount, cost, status, delivered_at) VALUES (?, ?, ?, ?, 'delivered', NOW())",
            { b.id, it.name, amount, cost }
        )
        addStock(b, it.name, amount)
        return cb({ ok = true, message = ('Naručeno i stiglo %s za %s.'):format(note, fmt(cost)) })

    elseif action == 'sellState' then
        local value = math.floor(b.price * Config.SellToStateRatio)
        local kasa = payoutKasa(b, xPlayer)
        if value > 0 then
            xPlayer.addAccountMoney('bank', value, 'Prodaja biznisa drzavi')
            bankLog(src, 'income', 'Prodaja biznisa', value, bizName(b), 'Država')
        end
        logTx(b.id, 'sell_state', value, 0, nil, name)
        local label = bizName(b)
        setOwner(b, nil, nil, 'Prodato državi')
        return cb({ ok = true, message = ('Prodao si %s državi za %s.%s'):format(label, fmt(value),
            kasa > 0 and (' Iz kase ti je isplaćeno još %s.'):format(fmt(kasa)) or '') })

    elseif action == 'refill' then
        local missing = math.max(0, Config.ATM.maxCash - b.atmCash)
        if missing <= 0 then return fail('Bankomat je već pun.') end
        local res = Config.Refill.resource
        if not res or GetResourceState(res) ~= 'started' then
            return fail('Transport novca još nije dostupan. Uskoro!')
        end
        TriggerEvent('flamingo_biznisi:refillRequested', src, b.id, missing)
        return cb({ ok = true, message = ('Zahtev za transport je poslat (%s do punog bankomata).'):format(fmt(missing)) })
    end

    fail('Nepoznata akcija.')
end)

-- ============================================================
--  Exports za flamingo_banke (bankomat)
-- ============================================================

-- Biznis-bankomat na kom igrac stoji (coords = pozicija igraca kad je otvorio bankomat)
exports('GetAtmAt', function(coords)
    if not ready or not coords then return nil end
    local best, bestDist
    for _, b in pairs(BIZ) do
        if not b.disabled and b.type == 'atm' then
            local d = #(coords - b.coords)
            if d <= Config.ATM.linkRadius and (not bestDist or d < bestDist) then
                best, bestDist = b, d
            end
        end
    end
    if not best then return nil end
    return { id = best.id, name = bizName(best), atmCash = best.atmCash, atmMax = Config.ATM.maxCash, owned = best.owner ~= nil }
end)

-- Da li bankomat ima dovoljno gotovine za isplatu
exports('AtmCanWithdraw', function(id, amount)
    local b = BIZ[id]
    if not b or b.disabled then return true end -- nije biznis, radi normalno
    if b.atmCash <= 0 then
        return false, 'Bankomat je prazan. Probaj neki drugi bankomat.'
    end
    if amount > b.atmCash then
        return false, ('U bankomatu ima samo %s gotovine.'):format(fmt(b.atmCash))
    end
    return true
end)

-- Isplata je prosla: gotovina izlazi iz bankomata, provizija ide u kasu
exports('AtmWithdraw', function(id, amount, fee, tierId, actor)
    local b = BIZ[id]
    if not b or b.disabled then return false end
    amount = math.floor(tonumber(amount) or 0)
    fee    = math.floor(tonumber(fee) or 0)

    local ownerFee = math.floor(fee * (100 - (Config.StateCut or 0)) / 100)
    if not b.owner then ownerFee = 0 end -- bankomat bez vlasnika: provizija ide drzavi

    b.atmCash = math.max(0, b.atmCash - amount)
    b.balance = b.balance + ownerFee
    b.earned  = b.earned + ownerFee
    addMoney(b, { atm_cash = -amount, balance = ownerFee, earned = ownerFee })
    logTx(b.id, 'withdraw', amount, ownerFee, tierId, actor)

    if b.owner and b.atmCash < Config.ATM.lowCash and b.atmCash + amount >= Config.ATM.lowCash then
        local xOwner = ESX.GetPlayerFromIdentifier(b.owner)
        if xOwner then
            notify(xOwner.source, ('%s: ostalo je samo %s gotovine. Dopuni bankomat preko tableta.'):format(bizName(b), fmt(b.atmCash)), 'error')
        end
    end
    return true, ownerFee
end)

-- Uplata na bankomatu puni bankomat gotovinom
exports('AtmDeposit', function(id, amount, actor)
    local b = BIZ[id]
    if not b or b.disabled then return false end
    amount = math.floor(tonumber(amount) or 0)
    local added = 0
    if Config.ATM.depositFillsAtm then
        added = math.max(0, math.min(amount, Config.ATM.maxCash - b.atmCash))
        if added > 0 then
            b.atmCash = b.atmCash + added
            addMoney(b, { atm_cash = added })
        end
    end
    logTx(b.id, 'deposit', amount, 0, nil, actor)
    return true, added
end)

-- ============================================================
--  Exports za druge skripte (aukcija, transport...)
-- ============================================================

-- exports['flamingo_biznisi']:GetBusiness(id)
exports('GetBusiness', function(id)
    local b = BIZ[tonumber(id) or -1]
    if not b then return nil end
    return {
        id = b.id, type = b.type, name = bizName(b), coords = b.coords, price = b.price,
        owner = b.owner, ownerName = b.ownerName, balance = b.balance,
        atmCash = b.atmCash, atmMax = Config.ATM.maxCash, earned = b.earned, disabled = b.disabled
    }
end)

-- exports['flamingo_biznisi']:GetBusinesses(identifier) -> lista id-jeva (nil = svi biznisi)
exports('GetBusinesses', function(identifier)
    local out = {}
    for _, b in pairs(BIZ) do
        if not b.disabled and (identifier == nil or b.owner == identifier) then out[#out + 1] = b.id end
    end
    table.sort(out)
    return out
end)

-- Aukcija: exports['flamingo_biznisi']:SetOwner(id, identifier, 'Ime Prezime')
-- identifier = nil -> biznis se vraca drzavi
exports('SetOwner', function(id, identifier, name)
    local b = BIZ[tonumber(id) or -1]
    if not b or b.disabled then return false end
    setOwner(b, identifier, name or 'Nepoznat')
    return true
end)

-- Transport: exports['flamingo_biznisi']:RefillAtm(id, iznos) -> koliko je stvarno ubaceno
exports('RefillAtm', function(id, amount, actor)
    local b = BIZ[tonumber(id) or -1]
    amount = toAmount(amount)
    if not b or b.disabled or not amount then return 0 end
    local added = math.max(0, math.min(amount, Config.ATM.maxCash - b.atmCash))
    if added <= 0 then return 0 end
    b.atmCash = b.atmCash + added
    addMoney(b, { atm_cash = added })
    logTx(b.id, 'refill', added, 0, nil, actor or 'Transport')
    return added
end)

-- Koliko fali do punog bankomata
exports('GetAtmMissing', function(id)
    local b = BIZ[tonumber(id) or -1]
    if not b then return 0 end
    return math.max(0, Config.ATM.maxCash - b.atmCash)
end)

-- ============================================================
--  Admin komande
-- ============================================================
ESX.RegisterCommand('biznis_dodaj', Config.AdminGroups, function(xPlayer, args)
    TriggerClientEvent('flamingo_biznisi:client:pickAtm', xPlayer.source, toAmount(args.cena) or Config.ATM.defaultPrice)
end, false, { help = 'Napravi biznis od bankomata ispred kog stojiš', arguments = {
    { name = 'cena', help = 'Cena biznisa (prazno = podrazumevana)', type = 'any' }
} })

RegisterNetEvent('flamingo_biznisi:server:addAtm', function(coords, price)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer or not isAdmin(xPlayer) or not ready then return end
    if type(coords) ~= 'vector3' and type(coords) ~= 'table' then return end
    coords = vector3(tonumber(coords.x) or 0.0, tonumber(coords.y) or 0.0, tonumber(coords.z) or 0.0)
    price = toAmount(price) or Config.ATM.defaultPrice

    if #(GetEntityCoords(GetPlayerPed(src)) - coords) > 5.0 then
        return notify(src, 'Previše si daleko od bankomata.', 'error')
    end
    for _, b in pairs(BIZ) do
        if not b.disabled and #(b.coords - coords) < 1.5 then
            return notify(src, ('Ovaj bankomat je već biznis (#%d).'):format(b.id), 'error')
        end
    end

    local key = seedKey(coords)
    MySQL.query.await('DELETE FROM flamingo_biznisi WHERE seed_key = ? AND disabled = 1', { key })
    local id = MySQL.insert.await(
        "INSERT INTO flamingo_biznisi (type, seed_key, x, y, z, price, atm_cash, calibrated) VALUES ('atm', ?, ?, ?, ?, ?, ?, 1)",
        { key, coords.x, coords.y, coords.z, price, Config.ATM.startCash }
    )
    if not id then return notify(src, 'Greška pri upisu u bazu.', 'error') end

    local row = MySQL.single.await('SELECT *, UNIX_TIMESTAMP(bought_at) AS bought_ts FROM flamingo_biznisi WHERE id = ?', { id })
    BIZ[id] = rowToBiz(row)
    notify(src, ('Napravljen biznis %s, cena %s.'):format(bizName(BIZ[id]), fmt(price)), 'success')
    syncAll()
end)

ESX.RegisterCommand('biznis_obrisi', Config.AdminGroups, function(xPlayer, args, showError)
    local b = BIZ[args.id or -1]
    if not b or b.disabled then return showError('Biznis ne postoji.') end
    b.disabled = true
    MySQL.update('UPDATE flamingo_biznisi SET disabled = 1 WHERE id = ?', { b.id })
    notify(xPlayer.source, ('Biznis #%d je uklonjen.'):format(b.id), 'success')
    syncAll()
end, false, { help = 'Ukloni biznis', arguments = {
    { name = 'id', help = 'ID biznisa', type = 'number' }
} })

ESX.RegisterCommand('biznis_vlasnik', Config.AdminGroups, function(xPlayer, args, showError)
    local b = BIZ[args.id or -1]
    if not b or b.disabled then return showError('Biznis ne postoji.') end
    local target = args.igrac
    setOwner(b, target.identifier, target.getName())
    notify(xPlayer.source, ('%s je sada vlasnik biznisa #%d.'):format(target.getName(), b.id), 'success')
    notify(target.source, ('Dobio si biznis %s. Otvori tablet, aplikacija "Moj biznis".'):format(bizName(b)), 'success')
end, false, { help = 'Postavi vlasnika biznisa', arguments = {
    { name = 'id', help = 'ID biznisa', type = 'number' },
    { name = 'igrac', help = 'ID igrača', type = 'player' }
} })

ESX.RegisterCommand('biznis_oduzmi', Config.AdminGroups, function(xPlayer, args, showError)
    local b = BIZ[args.id or -1]
    if not b or b.disabled then return showError('Biznis ne postoji.') end
    setOwner(b, nil, nil, 'Admin')
    notify(xPlayer.source, ('Biznis #%d je vraćen državi.'):format(b.id), 'success')
end, false, { help = 'Vrati biznis državi', arguments = {
    { name = 'id', help = 'ID biznisa', type = 'number' }
} })

ESX.RegisterCommand('biznis_dopuni', Config.AdminGroups, function(xPlayer, args, showError)
    local b = BIZ[args.id or -1]
    if not b or b.disabled then return showError('Biznis ne postoji.') end
    local amount = toAmount(args.iznos) or (Config.ATM.maxCash - b.atmCash)
    local added = exports[GetCurrentResourceName()]:RefillAtm(b.id, amount, 'Admin')
    notify(xPlayer.source, ('Bankomat #%d dopunjen sa %s (sada %s).'):format(b.id, fmt(added), fmt(b.atmCash)), 'success')
end, false, { help = 'Dopuni bankomat gotovinom (test)', arguments = {
    { name = 'id', help = 'ID biznisa', type = 'number' },
    { name = 'iznos', help = 'Iznos (prazno = do punog)', type = 'any' }
} })

-- ============================================================
--  Prodaja biznisa igracu (radial meni G -> "Prodaj biznis")
--  Prodavac bira igraca u blizini i cenu, kupac dobija ponudu
--  i ima Config.PlayerSale.timeout sekundi da prihvati.
-- ============================================================
local offers = {}       -- [kupacSrc] = { id, seller, bizId, price, expires }
local offerSeq = 0

local function playersNear(a, b, dist)
    local pa, pb = GetPlayerPed(a), GetPlayerPed(b)
    if pa == 0 or pb == 0 then return false end
    return #(GetEntityCoords(pa) - GetEntityCoords(pb)) <= dist
end

-- Podaci za prozor prodaje (sta prodajem i koliko vredi)
ESX.RegisterServerCallback('flamingo_biznisi:sellInfo', function(src, cb)
    local xPlayer = ESX.GetPlayerFromId(src)
    local b = xPlayer and ownedBy(xPlayer.identifier)
    if not b then return cb({ ok = false, msg = 'Nemaš biznis.' }) end
    cb({
        ok = true, id = b.id, name = bizName(b), price = b.price,
        stateValue = math.floor(b.price * Config.SellToStateRatio),
        balance = b.balance,
        minPrice = Config.PlayerSale.minPrice, maxPrice = Config.PlayerSale.maxPrice,
        distance = Config.PlayerSale.distance
    })
end)

RegisterNetEvent('flamingo_biznisi:server:sellOffer', function(target, price)
    local src = source
    if not passCooldown(src, 2000) then return notify(src, 'Sačekaj trenutak pa pokušaj ponovo.', 'error') end

    local xSeller = ESX.GetPlayerFromId(src)
    local b = xSeller and ownedBy(xSeller.identifier)
    if not b then return notify(src, 'Nemaš biznis koji možeš da prodaš.', 'error') end

    target = tonumber(target)
    price = toAmount(price)
    local xBuyer = target and ESX.GetPlayerFromId(target)
    if not xBuyer or target == src then return notify(src, 'Izaberi igrača u blizini.', 'error') end
    if not price or price < Config.PlayerSale.minPrice or price > Config.PlayerSale.maxPrice then
        return notify(src, 'Unesi ispravnu cenu.', 'error')
    end
    if not playersNear(src, target, Config.PlayerSale.distance + 1.0) then
        return notify(src, 'Kupac mora biti pored tebe.', 'error')
    end
    if Config.MaxPerPlayer > 0 and ownedCount(xBuyer.identifier) >= Config.MaxPerPlayer then
        return notify(src, 'Taj igrač već ima biznis.', 'error')
    end
    if offers[target] and offers[target].expires > os.time() then
        return notify(src, 'Taj igrač već razmatra drugu ponudu.', 'error')
    end

    offerSeq = offerSeq + 1
    local offer = { id = offerSeq, seller = src, bizId = b.id, price = price, expires = os.time() + Config.PlayerSale.timeout }
    offers[target] = offer

    TriggerClientEvent('flamingo_biznisi:client:offer', target, {
        id = offer.id, seller = xSeller.getName(), name = bizName(b), type = b.type,
        price = price, stateValue = math.floor(b.price * Config.SellToStateRatio),
        bank = xBuyer.getAccount('bank').money, timeout = Config.PlayerSale.timeout
    })
    notify(src, ('Ponuda je poslata: %s za %s. Čeka se odgovor kupca.'):format(bizName(b), fmt(price)), 'info')

    SetTimeout(Config.PlayerSale.timeout * 1000 + 1000, function()
        if offers[target] == offer then
            offers[target] = nil
            notify(src, 'Kupac nije odgovorio na ponudu na vreme.', 'error')
            TriggerClientEvent('flamingo_biznisi:client:offerClosed', target, offer.id)
        end
    end)
end)

RegisterNetEvent('flamingo_biznisi:server:offerResponse', function(id, accepted)
    local src = source
    local offer = offers[src]
    if not offer or offer.id ~= tonumber(id) then return end
    offers[src] = nil

    local seller = offer.seller
    local xBuyer, xSeller = ESX.GetPlayerFromId(src), ESX.GetPlayerFromId(seller)
    if not xBuyer then return end
    if not xSeller then return notify(src, 'Prodavac više nije u gradu.', 'error') end

    if not accepted then
        notify(seller, ('%s je odbio ponudu za biznis.'):format(xBuyer.getName()), 'error')
        return notify(src, 'Odbio si ponudu.', 'info')
    end

    local function fail(msg)
        notify(src, msg, 'error')
        notify(seller, 'Prodaja nije uspela: ' .. msg, 'error')
    end

    local b = BIZ[offer.bizId]
    if offer.expires < os.time() then return fail('Ponuda je istekla.') end
    if not b or b.disabled or b.owner ~= xSeller.identifier then return fail('Biznis više nije na prodaju.') end
    if not playersNear(src, seller, Config.PlayerSale.distance + 1.0) then return fail('Kupac i prodavac moraju biti jedan pored drugog.') end
    if Config.MaxPerPlayer > 0 and ownedCount(xBuyer.identifier) >= Config.MaxPerPlayer then return fail('Kupac već ima biznis.') end
    if xBuyer.getAccount('bank').money < offer.price then return fail('Kupac nema dovoljno novca na računu.') end

    local label = bizName(b)
    xBuyer.removeAccountMoney('bank', offer.price, 'Kupovina biznisa')
    xSeller.addAccountMoney('bank', offer.price, 'Prodaja biznisa')
    local kasa = payoutKasa(b, xSeller)

    bankLog(src, 'expense', 'Kupovina biznisa', offer.price, label, xSeller.getName())
    bankLog(seller, 'income', 'Prodaja biznisa', offer.price, label, xBuyer.getName())
    logTx(b.id, 'sold', offer.price, 0, nil, ('%s -> %s'):format(xSeller.getName(), xBuyer.getName()))
    setOwner(b, xBuyer.identifier, xBuyer.getName())

    notify(src, ('Kupio si %s za %s. Upravljaj njime na tabletu, aplikacija "Moj biznis".'):format(label, fmt(offer.price)), 'success')
    notify(seller, ('Prodao si %s igraču %s za %s.%s'):format(label, xBuyer.getName(), fmt(offer.price),
        kasa > 0 and (' Iz kase ti je isplaćeno još %s.'):format(fmt(kasa)) or ''), 'success')
end)

AddEventHandler('playerDropped', function()
    local src = source
    offers[src] = nil
    for buyer, o in pairs(offers) do
        if o.seller == src then
            offers[buyer] = nil
            TriggerClientEvent('flamingo_biznisi:client:offerClosed', buyer, o.id)
        end
    end
end)


-- ============================================================
--  Supermarketi (flamingo_supermarket)
--  flamingo_supermarket na startu posalje listu marketa (pozicija prodavca,
--  naziv, artikli). Svaki market postaje poseban biznis (type = 'market').
--  Market bez vlasnika radi kao i ranije (bez ogranicenja zaliha).
-- ============================================================
local marketQueue = {}

-- Marketi i perionice se registruju isto: svaki je poseban biznis, prepoznaje se po poziciji.
local KINDS = {
    market  = { prefix = 'm_', price = function() return Config.Market.defaultPrice end },
    carwash = { prefix = 'c_', price = function() return Config.Carwash.defaultPrice end },
    fuel    = { prefix = 'f_', price = function() return Config.Fuel.defaultPrice end },
}

local function typedKey(kind, coords)
    return KINDS[kind].prefix .. seedKey(coords)
end

local function findTyped(kind, coords)
    if not coords then return nil end
    local key = typedKey(kind, vector3(coords.x + 0.0, coords.y + 0.0, coords.z + 0.0))
    for _, b in pairs(BIZ) do
        if b.type == kind and b.seedKey == key and not b.disabled then return b end
    end
end

local function findMarket(coords) return findTyped('market', coords) end

local function registerTyped(kind, list)
    for _, m in ipairs(list) do
        local c = vector3(m.coords.x + 0.0, m.coords.y + 0.0, m.coords.z + 0.0)
        local key = typedKey(kind, c)
        local price = toAmount(m.price) or KINDS[kind].price()

        MySQL.query.await([[
            INSERT INTO flamingo_biznisi (type, seed_key, x, y, z, price, atm_cash, calibrated)
            VALUES (?, ?, ?, ?, ?, ?, 0, 1)
            ON DUPLICATE KEY UPDATE price = IF(owner IS NULL, VALUES(price), price)
        ]], { kind, key, c.x, c.y, c.z, price })

        local row = MySQL.single.await('SELECT *, UNIX_TIMESTAMP(bought_at) AS bought_ts FROM flamingo_biznisi WHERE seed_key = ?', { key })
        if row then
            local b = BIZ[row.id]
            if not b then
                b = rowToBiz(row)
                BIZ[row.id] = b
            elseif not b.owner then
                b.price = row.price
            end
            b.seedKey   = key
            b.shopLabel = m.label

            if kind == 'market' then
                -- artikli iz configa; svaki novi artikal dobija pocetnu zalihu
                b.items = {}
                for _, it in ipairs(m.items or {}) do
                    local p = toAmount(it.price)
                    if type(it.name) == 'string' and p then
                        b.items[#b.items + 1] = { name = it.name, label = it.label or it.name, price = p }
                        if b.stock[it.name] == nil then
                            b.stock[it.name] = Config.Market.startStock
                            MySQL.insert.await('INSERT IGNORE INTO flamingo_biznisi_stock (biz_id, item, stock) VALUES (?, ?, ?)',
                                { b.id, it.name, Config.Market.startStock })
                        end
                    end
                end
            elseif kind == 'fuel' then
                -- pumpa: jedan "artikal" = gorivo u litrima, rezervoar Config.Fuel.maxLiters
                b.items = { { name = 'fuel', label = 'Gorivo', price = toAmount(m.pricePerLiter) or 20 } }
                if b.stock.fuel == nil then
                    b.stock.fuel = Config.Fuel.startLiters
                    MySQL.insert.await('INSERT IGNORE INTO flamingo_biznisi_stock (biz_id, item, stock) VALUES (?, ?, ?)',
                        { b.id, 'fuel', Config.Fuel.startLiters })
                end
            else
                -- perionica: paketi pranja (samo za prikaz zarade na tabletu)
                b.packages = {}
                for _, pk in ipairs(m.packages or {}) do
                    local p = toAmount(pk.price)
                    if p then b.packages[#b.packages + 1] = { id = pk.id, label = pk.label or pk.id, price = p } end
                end
            end
        end
    end
    print(('[flamingo_biznisi] Registrovano (%s): %d'):format(kind, #list))
    syncAll()
end

local function registerMarkets(list) registerTyped('market', list) end

local function queueRegister(kind, list)
    if type(list) ~= 'table' then return false end
    marketQueue[#marketQueue + 1] = { kind = kind, list = list }
    CreateThread(function()
        while not ready do Wait(250) end
        local q = marketQueue
        marketQueue = {}
        for _, e in ipairs(q) do registerTyped(e.kind, e.list) end
    end)
    return true
end

-- exports['flamingo_biznisi']:RegisterMarkets({ { coords = vector3, label = 'Flamingo Market', price = 750000, items = { {name, label, price} } } })
exports('RegisterMarkets', function(list)
    return queueRegister('market', list)
end)

-- Podaci za meni marketa: vlasnik, cena, zalihe (samo ako market ima vlasnika)
exports('GetMarketInfo', function(coords, src)
    local b = findMarket(coords)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not b or not xPlayer then return nil end
    local info = publicInfo(b, xPlayer)
    info.stock = b.owner and b.stock or nil
    info.maxStock = Config.Market.maxStock
    return info
end)

-- Da li market ima dovoljno robe. basket = { { name, count } }
exports('MarketCheck', function(coords, basket)
    local b = findMarket(coords)
    if not b or not b.owner then return true end
    for _, it in ipairs(basket or {}) do
        local have = b.stock[it.name] or 0
        if have < (it.count or 0) then
            local item = marketItem(b, it.name)
            local label = item and item.label or it.name
            if have <= 0 then return false, ('%s trenutno nema na stanju.'):format(label) end
            return false, ('Na stanju je samo %d kom. artikla %s.'):format(have, label)
        end
    end
    return true
end)

-- Prodaja je prosla: roba izlazi iz magacina, novac ide u kasu. basket = { { name, count, price } }
exports('MarketSale', function(coords, basket, total, actor)
    local b = findMarket(coords)
    if not b or not b.owner then return false end

    local parts, low = {}, {}
    for _, it in ipairs(basket or {}) do
        local item = marketItem(b, it.name)
        local left = addStock(b, it.name, -(it.count or 0))
        parts[#parts + 1] = ('%dx %s'):format(it.count or 0, item and item.label or it.name)
        if left < Config.Market.lowStock and left + (it.count or 0) >= Config.Market.lowStock then
            low[#low + 1] = ('%s (%d kom.)'):format(item and item.label or it.name, left)
        end
    end

    total = math.floor(tonumber(total) or 0)
    local revenue = math.floor(total * (100 - (Config.Market.stateCut or 0)) / 100)
    b.balance = b.balance + revenue
    b.earned  = b.earned + revenue
    addMoney(b, { balance = revenue, earned = revenue })
    logTx(b.id, 'sale', total, revenue, nil, actor, table.concat(parts, ', '):sub(1, 120))

    if #low > 0 then
        local xOwner = ESX.GetPlayerFromIdentifier(b.owner)
        if xOwner then
            notify(xOwner.source, ('%s: ponestaje robe - %s. Naruči na tabletu.'):format(bizName(b), table.concat(low, ', ')), 'error')
        end
    end
    return true, revenue
end)

-- Transport: roba je dovezena. exports['flamingo_biznisi']:DeliverOrder(orderId, 'Ime vozaca')
exports('DeliverOrder', function(orderId, actor)
    local row = MySQL.single.await("SELECT * FROM flamingo_biznisi_orders WHERE id = ? AND status = 'pending'", { tonumber(orderId) or -1 })
    if not row then return false end
    local b = BIZ[row.biz_id]
    MySQL.update.await("UPDATE flamingo_biznisi_orders SET status = 'delivered', delivered_at = NOW() WHERE id = ?", { row.id })
    if not b then return false end
    b.pending[row.item] = math.max(0, (b.pending[row.item] or 0) - row.amount)
    addStock(b, row.item, row.amount)
    local item = marketItem(b, row.item)
    logTx(b.id, 'delivery', row.amount, 0, nil, actor or 'Transport', stockNote(b, row.amount, item or { label = row.item }))
    return true
end)

-- Transport: narudzbine koje cekaju dostavu (bizId = nil -> sve)
exports('GetPendingOrders', function(bizId)
    if bizId then
        return MySQL.query.await("SELECT * FROM flamingo_biznisi_orders WHERE status = 'pending' AND biz_id = ? ORDER BY id", { bizId }) or {}
    end
    return MySQL.query.await("SELECT * FROM flamingo_biznisi_orders WHERE status = 'pending' ORDER BY id") or {}
end)


-- ============================================================
--  Perionice (flamingo_perionica)
--  Vlasnik dobija Config.Carwash.share % od cene svakog pranja u kasu.
--  Nema robe ni narudzbina.
-- ============================================================

-- exports['flamingo_biznisi']:RegisterCarwashes({ { coords = vector3, label = 'Hands On Car Wash', price = 500000, packages = { {id, label, price} } } })
exports('RegisterCarwashes', function(list)
    return queueRegister('carwash', list)
end)

-- Podaci za meni perionice: vlasnik, cena, udeo
exports('GetCarwashInfo', function(coords, src)
    local b = findTyped('carwash', coords)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not b or not xPlayer then return nil end
    local info = publicInfo(b, xPlayer)
    info.share = Config.Carwash.share
    return info
end)

-- Pranje je placeno: udeo ide u kasu vlasnika
exports('CarwashSale', function(coords, price, packageLabel, actor)
    local b = findTyped('carwash', coords)
    if not b or not b.owner then return false end
    price = math.floor(tonumber(price) or 0)
    local revenue = math.floor(price * (Config.Carwash.share or 0) / 100)
    b.balance = b.balance + revenue
    b.earned  = b.earned + revenue
    addMoney(b, { balance = revenue, earned = revenue })
    logTx(b.id, 'wash', price, revenue, nil, actor, packageLabel)
    return true, revenue
end)


-- ============================================================
--  Benzinske pumpe (flamingo_pumpa)
--  Svaka stanica ima rezervoar (Config.Fuel.maxLiters). Kad igrac sipa,
--  litri izlaze iz rezervoara, a cela cena ide u kasu vlasnika.
--  Vlasnik narucuje gorivo na tabletu za Config.Fuel.orderRatio cene po litru.
--  Pumpa bez vlasnika (drzava) radi kao i ranije, bez ogranicenja.
-- ============================================================

-- exports['flamingo_biznisi']:RegisterFuelStations({ { coords = vector3, label = 'Pumpa', price = 800000, pricePerLiter = 20 } })
exports('RegisterFuelStations', function(list)
    return queueRegister('fuel', list)
end)

-- Podaci za meni pumpe: vlasnik, cena, gorivo u rezervoaru stanice
exports('GetFuelInfo', function(coords, src)
    local b = findTyped('fuel', coords)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not b or not xPlayer then return nil end
    local info = publicInfo(b, xPlayer)
    info.liters    = b.owner and (b.stock.fuel or 0) or nil   -- nil = drzavna pumpa, bez ogranicenja
    info.maxLiters = Config.Fuel.maxLiters
    info.orderRatio = Config.Fuel.orderRatio
    return info
end)

-- Da li stanica ima dovoljno goriva. Vraca ok, poruka, koliko ima
exports('FuelCheck', function(coords, liters)
    local b = findTyped('fuel', coords)
    if not b or not b.owner then return true end
    local have = b.stock.fuel or 0
    liters = math.floor(tonumber(liters) or 0)
    if have <= 0 then return false, 'Pumpa je ostala bez goriva. Vlasnik mora da naruči gorivo.', 0 end
    if liters > have then return false, ('Na pumpi je ostalo samo %d L goriva.'):format(have), have end
    return true, nil, have
end)

-- Sipanje je placeno: litri izlaze iz rezervoara, cela cena ide u kasu
exports('FuelSale', function(coords, liters, price, actor)
    local b = findTyped('fuel', coords)
    if not b or not b.owner then return false end
    liters = math.floor(tonumber(liters) or 0)
    price  = math.floor(tonumber(price) or 0)

    local before = b.stock.fuel or 0
    local left = addStock(b, 'fuel', -liters)
    local revenue = math.floor(price * (100 - (Config.Fuel.stateCut or 0)) / 100)
    b.balance = b.balance + revenue
    b.earned  = b.earned + revenue
    addMoney(b, { balance = revenue, earned = revenue })
    logTx(b.id, 'fuel', price, revenue, nil, actor, ('%d L goriva'):format(liters))

    if left < Config.Fuel.lowLiters and before >= Config.Fuel.lowLiters then
        local xOwner = ESX.GetPlayerFromIdentifier(b.owner)
        if xOwner then
            notify(xOwner.source, ('%s: u rezervoaru je ostalo %d L. Naruči gorivo na tabletu.'):format(bizName(b), left), 'error')
        end
    end
    return true, revenue
end)
