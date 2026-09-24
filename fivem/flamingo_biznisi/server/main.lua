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
    return #(GetEntityCoords(ped) - b.coords) <= (dist or Config.ServerDistance)
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
local function logTx(bizId, txType, amount, fee, tier, actor)
    MySQL.insert(
        'INSERT INTO flamingo_biznisi_log (biz_id, type, amount, fee, tier, actor) VALUES (?, ?, ?, ?, ?, ?)',
        { bizId, txType, math.floor(amount or 0), math.floor(fee or 0), tier, actor }
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
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                INDEX `idx_biz_time` (`biz_id`, `created_at`)
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

        ready = true
        print(('[flamingo_biznisi] Ucitano biznisa: %d'):format(#rows))
        syncAll()
    end)
end)

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
            WHERE biz_id IN (%s) AND type = 'withdraw' AND created_at >= CURDATE() - INTERVAL 6 DAY
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
            'SELECT type, amount, fee, tier, actor, UNIX_TIMESTAMP(created_at) AS ts FROM flamingo_biznisi_log WHERE biz_id = ? ORDER BY id DESC LIMIT ?',
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
            logs     = logs
        }
    end

    cb({
        ok         = true,
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
