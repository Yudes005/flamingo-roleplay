local sessions   = {}  -- [src] = { kind = 'bank'|'atm', coords = vector3, place = string, pinOk = bool }
local lastAction = {}
local accCache   = {}  -- [identifier] = red iz flamingo_bank_accounts ili false (nema racun)

-- ============================================================
--  Paketi kartica
-- ============================================================
local CARDS = {}
for _, c in ipairs(Config.Cards) do CARDS[c.id] = c end

local function defaultTier()
    return CARDS[Config.DefaultCard] or Config.Cards[1]
end

local function tierOf(acc)
    return (acc and CARDS[acc.tier]) or defaultTier()
end

local function maintenanceInterval()
    return math.floor((Config.Maintenance and Config.Maintenance.days or 7) * 86400)
end

local function nextFeeDue(tier)
    if not (Config.Maintenance and Config.Maintenance.enabled) or (tier.maintenance or 0) <= 0 then return nil end
    return os.time() + maintenanceInterval()
end

-- ============================================================
--  Baza
-- ============================================================
local function ensureColumn(col, def)
    local exists = MySQL.scalar.await(
        "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flamingo_bank_accounts' AND COLUMN_NAME = ?",
        { col }
    )
    if not exists or tonumber(exists) == 0 then
        MySQL.query.await(('ALTER TABLE `flamingo_bank_accounts` ADD COLUMN `%s` %s'):format(col, def))
    end
end

MySQL.ready(function()
    CreateThread(function()
        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `flamingo_bank_transactions` (
                `id`         INT NOT NULL AUTO_INCREMENT,
                `identifier` VARCHAR(64) NOT NULL,
                `type`       VARCHAR(20) NOT NULL,
                `title`      VARCHAR(64) NOT NULL,
                `memo`       VARCHAR(128) NULL,
                `party`      VARCHAR(64) NULL,
                `amount`     INT NOT NULL,
                `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`id`),
                INDEX `idx_ident_time` (`identifier`, `created_at`)
            )
        ]])

        MySQL.query.await([[
            CREATE TABLE IF NOT EXISTS `flamingo_bank_accounts` (
                `identifier`  VARCHAR(64) NOT NULL,
                `card_number` VARCHAR(24) NOT NULL,
                `opened_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (`identifier`)
            )
        ]])

        -- nove kolone (kartica, PIN, odrzavanje) - dodaju se i na vec postojecu tabelu
        ensureColumn('tier',      "VARCHAR(20) NOT NULL DEFAULT 'standard'")
        ensureColumn('pin',       'VARCHAR(32) NULL')
        ensureColumn('pin_tries', 'TINYINT NOT NULL DEFAULT 0')
        ensureColumn('fee_due',   'INT NULL')

        -- Registruje item za bankovnu karticu ako vec ne postoji (ESX legacy 'items' tabela).
        -- Ako tvoj esx_inventory/ox_inventory koristi drugaciju tabelu/format, dodaj item rucno tamo.
        MySQL.query('INSERT IGNORE INTO items (name, label) VALUES (?, ?)', { Config.CardItem, Config.CardLabel })
    end)
end)

-- ============================================================
--  Pomocne funkcije
-- ============================================================
local VALID_TYPES = {
    deposit = true, withdraw = true, transfer_in = true, transfer_out = true,
    income = true, expense = true, fee = true
}

local function sanitize(str, max)
    if type(str) ~= 'string' then return nil end
    str = str:gsub('[<>\r\n\t]', ''):gsub('^%s+', ''):gsub('%s+$', '')
    if str == '' then return nil end
    return str:sub(1, max)
end

local function toAmount(v)
    v = tonumber(v)
    if not v or v ~= v or v == math.huge then return nil end
    v = math.floor(v)
    if v < 1 or v > 2147483647 then return nil end
    return v
end

local function logTx(identifier, txType, title, memo, party, amount)
    MySQL.insert(
        'INSERT INTO flamingo_bank_transactions (identifier, type, title, memo, party, amount) VALUES (?, ?, ?, ?, ?, ?)',
        { identifier, txType, title, memo, party, amount }
    )
end

local function nearestBank(coords)
    for _, b in ipairs(Config.Banks) do
        if #(coords - b.coords) <= Config.ServerBankDistance then
            return b
        end
    end
end

local function validSession(src)
    local s = sessions[src]
    if not s then return nil end
    local ped = GetPlayerPed(src)
    if ped == 0 then return nil end
    if #(GetEntityCoords(ped) - s.coords) > Config.ServerSessionDistance then return nil end
    return s
end

local function passCooldown(src)
    local now = GetGameTimer()
    if lastAction[src] and now - lastAction[src] < Config.ActionCooldown then return false end
    lastAction[src] = now
    return true
end

-- ============================================================
--  flamingo_biznisi: bankomati koji su biznisi (gotovina u bankomatu + provizija vlasniku)
-- ============================================================
local function bizReady()
    return GetResourceState('flamingo_biznisi') == 'started'
end

local function bizCall(fn, ...)
    if not bizReady() then return nil end
    local args = { ... }
    local ok, a, b = pcall(function() return exports['flamingo_biznisi'][fn](nil, table.unpack(args)) end)
    if not ok then
        print(('[flamingo_banke] flamingo_biznisi:%s greska: %s'):format(fn, tostring(a)))
        return nil
    end
    return a, b
end

-- 240000 -> "240.000$" (isto kao u UI-ju)
local function fmt(n)
    local s = tostring(math.floor(n))
    local out = s:reverse():gsub('(%d%d%d)', '%1.'):reverse():gsub('^%.', '')
    return out .. '$'
end

-- ============================================================
--  Kartica / PIN
-- ============================================================
local function generateCardNumber()
    local digits = {}
    for i = 1, 16 do digits[i] = math.random(0, 9) end
    digits[1] = 4 -- da izgleda kao prava kartica
    local raw = table.concat(digits)
    return raw:sub(1, 4) .. ' ' .. raw:sub(5, 8) .. ' ' .. raw:sub(9, 12) .. ' ' .. raw:sub(13, 16)
end

local function validPin(pin)
    if type(pin) == 'number' then pin = tostring(math.floor(pin)) end
    if type(pin) ~= 'string' or #pin ~= Config.PinLength or not pin:match('^%d+$') then return nil end
    return pin
end

-- PIN se ne cuva u cistom obliku u bazi
local function hashPin(identifier, pin)
    return tostring(GetHashKey(('flamingo_banke:%s:%s'):format(identifier, pin)))
end

local function isBlocked(acc)
    return acc and not acc.virtual and (acc.pin_tries or 0) >= Config.PinMaxTries
end

local function hasCardItem(xPlayer)
    if not Config.RequireCardItem then return true end
    local ok, item = pcall(xPlayer.getInventoryItem, Config.CardItem)
    return ok and type(item) == 'table' and (item.count or item.amount or 0) > 0
end

-- Async ucitavanje racuna (kesirano po identifier-u). cb(acc | false)
local function getAccount(identifier, cb)
    if not Config.RequireAccount then
        return cb({ virtual = true, tier = Config.DefaultCard, identifier = identifier })
    end
    if accCache[identifier] ~= nil then return cb(accCache[identifier]) end

    MySQL.single('SELECT identifier, card_number, tier, pin, pin_tries, fee_due FROM flamingo_bank_accounts WHERE identifier = ?', { identifier }, function(row)
        if row and not CARDS[row.tier] then row.tier = defaultTier().id end
        accCache[identifier] = row or false
        cb(accCache[identifier])
    end)
end

local NULL = {} -- saveAccount(acc, { fee_due = NULL }) -> upisuje NULL u bazu

local function saveAccount(acc, fields)
    local sets, params = {}, {}
    for k, v in pairs(fields) do
        if v == NULL then
            acc[k] = nil
            sets[#sets + 1] = ('`%s` = NULL'):format(k)
        else
            acc[k] = v
            sets[#sets + 1] = ('`%s` = ?'):format(k)
            params[#params + 1] = v
        end
    end
    params[#params + 1] = acc.identifier
    MySQL.update(('UPDATE flamingo_bank_accounts SET %s WHERE identifier = ?'):format(table.concat(sets, ', ')), params)
end

-- Sta UI sme da zna o kartici (bez PIN-a)
local function cardInfo(acc, xPlayer)
    if not acc or acc.virtual then return nil end
    return {
        number    = acc.card_number,
        tier      = tierOf(acc).id,
        hasPin    = acc.pin ~= nil,
        blocked   = isBlocked(acc),
        triesLeft = math.max(0, Config.PinMaxTries - (acc.pin_tries or 0)),
        hasItem   = hasCardItem(xPlayer),
        feeDue    = acc.fee_due
    }
end

local function buildData(xPlayer, acc, cb)
    MySQL.query(
        'SELECT id, type, title, memo, party, amount, UNIX_TIMESTAMP(created_at) AS ts FROM flamingo_bank_transactions WHERE identifier = ? ORDER BY id DESC LIMIT ?',
        { xPlayer.identifier, Config.HistoryLimit },
        function(rows)
            cb({
                name         = xPlayer.getName(),
                bank         = xPlayer.getAccount('bank').money,
                cash         = xPlayer.getAccount('money').money,
                transactions = rows or {},
                now          = os.time(),
                card         = cardInfo(acc, xPlayer)
            })
        end
    )
end

-- Naplata sa racuna, a ako nema dovoljno - iz gotovine. Vraca 'bank' | 'money' | nil
local function chargeAny(xPlayer, amount, reason)
    if amount <= 0 then return 'bank' end
    if xPlayer.getAccount('bank').money >= amount then
        xPlayer.removeAccountMoney('bank', amount, reason)
        return 'bank'
    end
    if xPlayer.getAccount('money').money >= amount then
        xPlayer.removeAccountMoney('money', amount, reason)
        return 'money'
    end
end

-- ============================================================
--  Transfer (zajednicko za banku i telefon)
-- ============================================================
local function doTransfer(src, xPlayer, acc, target, amount, memo, place)
    local tier = tierOf(acc)
    if amount > tier.maxTransfer then
        return false, ('Tvoja %s kartica dozvoljava najviše %s po transferu.'):format(tier.label, fmt(tier.maxTransfer))
    end

    local targetId = tonumber(target)
    if not targetId then return false, 'Unesi ID igrača.' end
    targetId = math.floor(targetId)
    if targetId == src then return false, 'Ne možeš poslati novac sebi.' end

    local xTarget = ESX.GetPlayerFromId(targetId)
    if not xTarget then return false, 'Igrač sa tim ID-jem nije u gradu.' end

    local fee   = math.floor(amount * (tier.transferFee or 0) / 100)
    local total = amount + fee
    if xPlayer.getAccount('bank').money < total then
        return false, 'Nemaš dovoljno novca na računu.'
    end

    local senderName, targetName = xPlayer.getName(), xTarget.getName()

    xPlayer.removeAccountMoney('bank', total, 'Bank transfer')
    xTarget.addAccountMoney('bank', amount, 'Bank transfer')

    logTx(xPlayer.identifier, 'transfer_out', 'Poslat novac', memo or 'Transfer na račun', targetName, amount)
    if fee > 0 then
        logTx(xPlayer.identifier, 'fee', 'Provizija', 'Provizija za transfer', place, fee)
    end
    logTx(xTarget.identifier, 'transfer_in', 'Primljen novac', memo or 'Transfer sa računa', senderName, amount)

    TriggerClientEvent('flamingo_banke:notify', targetId, ('Primio si %s na račun od %s.'):format(fmt(amount), senderName), 'success')
    return true, ('Poslato %s igraču %s.'):format(fmt(amount), targetName), targetName
end

-- ============================================================
--  Otvaranje / zatvaranje
-- ============================================================
ESX.RegisterServerCallback('flamingo_banke:open', function(src, cb, kind)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return cb(false) end

    local coords = GetEntityCoords(GetPlayerPed(src))
    local place

    if kind == 'bank' then
        local bank = nearestBank(coords)
        if not bank then return cb(false) end
        place = bank.name
    else
        if not Config.EnableATMs then return cb(false) end
        kind  = 'atm'
        place = 'Bankomat'
    end

    -- bankomat koji je biznis (flamingo_biznisi)
    local atmBiz = kind == 'atm' and bizCall('GetAtmAt', coords) or nil
    if atmBiz then place = atmBiz.name end

    getAccount(xPlayer.identifier, function(acc)
        if kind == 'atm' then
            -- bankomat trazi racun, karticu u inventaru i PIN
            if not acc then
                return cb({ denied = true, msg = 'Nemaš bankovni račun. Prvo ga otvori na šalteru banke.' })
            end
            if not acc.virtual then
                if not hasCardItem(xPlayer) then
                    return cb({ denied = true, msg = 'Nemaš bankovnu karticu kod sebe. Zatraži novu na šalteru banke.' })
                end
                if not acc.pin then
                    return cb({ denied = true, msg = 'Kartica nema PIN. Postavi ga na šalteru banke.' })
                end
                if isBlocked(acc) then
                    return cb({ denied = true, msg = 'Kartica je blokirana zbog pogrešnog PIN-a. Odblokiraj je na šalteru banke.' })
                end
            end

            sessions[src] = { kind = 'atm', coords = coords, place = place, pinOk = acc.virtual == true, biz = atmBiz and atmBiz.id or nil }

            if not acc.virtual then
                local num = acc.card_number or ''
                return cb({
                    needPin = true,
                    kind    = 'atm',
                    place   = place,
                    name    = xPlayer.getName(),
                    card    = { tier = tierOf(acc).id, last4 = num:sub(-4), triesLeft = math.max(0, Config.PinMaxTries - (acc.pin_tries or 0)) }
                })
            end
        else
            sessions[src] = { kind = 'bank', coords = coords, place = place, pinOk = true }

            -- na salteru banke bez otvorenog racuna - prikazi ekran za otvaranje racuna
            if not acc then
                return cb({
                    noAccount = true, kind = 'bank', place = place,
                    name = xPlayer.getName(),
                    cash = xPlayer.getAccount('money').money,
                    bank = xPlayer.getAccount('bank').money
                })
            end
        end

        buildData(xPlayer, acc, function(data)
            data.kind       = kind
            data.place      = place
            data.hasAccount = true
            cb(data)
        end)
    end)
end)

-- Provera PIN-a na bankomatu
ESX.RegisterServerCallback('flamingo_banke:verifyPin', function(src, cb, pin)
    local function fail(msg, extra)
        local r = extra or {}
        r.ok, r.msg = false, msg
        cb(r)
    end

    local s = validSession(src)
    if not s or s.kind ~= 'atm' then return fail('Previše si daleko od bankomata.') end
    if s.pinOk then return fail('PIN je već potvrđen.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    pin = validPin(pin)
    if not pin then return fail(('PIN mora imati %d cifre.'):format(Config.PinLength)) end

    getAccount(xPlayer.identifier, function(acc)
        if not acc or acc.virtual or not acc.pin then return fail('Kartica nije aktivna.') end
        if not hasCardItem(xPlayer) then return fail('Nemaš karticu kod sebe.', { blocked = true }) end
        if isBlocked(acc) then return fail('Kartica je blokirana. Odblokiraj je na šalteru banke.', { blocked = true }) end

        if hashPin(acc.identifier, pin) ~= acc.pin then
            local tries = (acc.pin_tries or 0) + 1
            saveAccount(acc, { pin_tries = tries })
            local left = math.max(0, Config.PinMaxTries - tries)
            if left == 0 then
                sessions[src] = nil
                return fail('Pogrešan PIN. Kartica je blokirana - odblokiraj je na šalteru banke.', { blocked = true, triesLeft = 0 })
            end
            return fail(('Pogrešan PIN. Preostalo pokušaja: %d.'):format(left), { triesLeft = left })
        end

        if (acc.pin_tries or 0) > 0 then saveAccount(acc, { pin_tries = 0 }) end
        s.pinOk = true

        buildData(xPlayer, acc, function(data)
            data.ok         = true
            data.kind       = 'atm'
            data.place      = s.place
            data.hasAccount = true
            cb(data)
        end)
    end)
end)

-- Otvaranje bankovnog racuna (samo na salteru banke): paket + PIN
ESX.RegisterServerCallback('flamingo_banke:openAccount', function(src, cb, payload)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    local s = validSession(src)
    if not s or s.kind ~= 'bank' then return fail('Moraš biti na šalteru banke.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end
    if not Config.RequireAccount then return fail('Račun ti nije potreban.') end

    payload = type(payload) == 'table' and payload or {}
    local tier = CARDS[payload.tier]
    if not tier then return fail('Izaberi paket kartice.') end
    local pin = validPin(payload.pin)
    if not pin then return fail(('PIN mora imati tačno %d cifre.'):format(Config.PinLength)) end

    getAccount(xPlayer.identifier, function(acc)
        if acc then return fail('Već imaš otvoren bankovni račun.') end

        local identifier = xPlayer.identifier
        local price = tier.price or 0
        local paidFrom = chargeAny(xPlayer, price, 'Bank card')
        if not paidFrom then
            return fail(('Za %s karticu ti treba %s (na računu ili u gotovini).'):format(tier.label, fmt(price)))
        end

        local cardNumber = generateCardNumber()
        local feeDue = nextFeeDue(tier)

        MySQL.insert('INSERT INTO flamingo_bank_accounts (identifier, card_number, tier, pin, pin_tries, fee_due) VALUES (?, ?, ?, ?, 0, ?)',
            { identifier, cardNumber, tier.id, hashPin(identifier, pin), feeDue }, function(insertId)
                if not insertId then
                    if price > 0 then xPlayer.addAccountMoney(paidFrom, price, 'Bank card refund') end
                    return fail('Greška prilikom otvaranja računa, pokušaj ponovo.')
                end

                local newAcc = { identifier = identifier, card_number = cardNumber, tier = tier.id, pin = hashPin(identifier, pin), pin_tries = 0, fee_due = feeDue }
                accCache[identifier] = newAcc
                xPlayer.addInventoryItem(Config.CardItem, 1)

                if price > 0 and paidFrom == 'bank' then
                    logTx(identifier, 'fee', 'Izdavanje kartice', ('%s paket'):format(tier.label), s.place, price)
                end

                if Config.WelcomeBonus and Config.WelcomeBonus > 0 then
                    xPlayer.addAccountMoney('bank', Config.WelcomeBonus)
                    logTx(identifier, 'income', 'Dobrodošlica', 'Bonus za otvaranje računa', s.place, Config.WelcomeBonus)
                end

                buildData(xPlayer, newAcc, function(data)
                    data.ok         = true
                    data.msg        = ('Račun je otvoren! Dobio si %s karticu (•••• %s).'):format(tier.label, cardNumber:sub(-4))
                    data.kind       = 'bank'
                    data.place      = s.place
                    data.hasAccount = true
                    cb(data)
                end)
            end)
    end)
end)

-- Upravljanje karticom na salteru: nova kartica, PIN, promena paketa
ESX.RegisterServerCallback('flamingo_banke:card', function(src, cb, payload)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    if type(payload) ~= 'table' then return fail('Neispravan zahtev.') end

    local s = validSession(src)
    if not s or s.kind ~= 'bank' then return fail('Karticom se upravlja samo na šalteru banke.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    getAccount(xPlayer.identifier, function(acc)
        if not acc or acc.virtual then return fail('Nemaš bankovni račun.') end

        local op, msg = payload.op, nil

        if op == 'reissue' then
            if hasCardItem(xPlayer) then return fail('Već imaš karticu kod sebe.') end
            local fee = Config.ReissueFee or 0
            if fee > 0 then
                if xPlayer.getAccount('bank').money < fee then
                    return fail(('Nova kartica košta %s, nemaš dovoljno na računu.'):format(fmt(fee)))
                end
                xPlayer.removeAccountMoney('bank', fee, 'Bank card reissue')
                logTx(acc.identifier, 'fee', 'Nova kartica', 'Izgubljena / ukradena kartica', s.place, fee)
            end
            local number = generateCardNumber()
            saveAccount(acc, { card_number = number })
            xPlayer.addInventoryItem(Config.CardItem, 1)
            msg = ('Izdata je nova kartica (•••• %s). Stara kartica više ne važi.'):format(number:sub(-4))

        elseif op == 'changePin' then
            local new = validPin(payload.new)
            if not new then return fail(('Novi PIN mora imati tačno %d cifre.'):format(Config.PinLength)) end
            if acc.pin then
                local old = validPin(payload.old)
                if not old or hashPin(acc.identifier, old) ~= acc.pin then
                    return fail('Stari PIN nije tačan. Ako si ga zaboravio, koristi "Zaboravio sam PIN".')
                end
            end
            saveAccount(acc, { pin = hashPin(acc.identifier, new), pin_tries = 0 })
            msg = 'PIN je uspešno promenjen.'

        elseif op == 'resetPin' then
            local new = validPin(payload.new)
            if not new then return fail(('Novi PIN mora imati tačno %d cifre.'):format(Config.PinLength)) end
            local fee = acc.pin and (Config.PinResetFee or 0) or 0 -- prvo postavljanje PIN-a je besplatno
            if fee > 0 then
                if xPlayer.getAccount('bank').money < fee then
                    return fail(('Reset PIN-a košta %s, nemaš dovoljno na računu.'):format(fmt(fee)))
                end
                xPlayer.removeAccountMoney('bank', fee, 'Bank PIN reset')
                logTx(acc.identifier, 'fee', 'Reset PIN-a', 'Zaboravljen PIN', s.place, fee)
            end
            local wasBlocked = isBlocked(acc)
            saveAccount(acc, { pin = hashPin(acc.identifier, new), pin_tries = 0 })
            msg = wasBlocked and 'Novi PIN je postavljen i kartica je odblokirana.' or 'Novi PIN je postavljen.'

        elseif op == 'tier' then
            local tier, cur = CARDS[payload.tier], tierOf(acc)
            if not tier then return fail('Nepoznat paket.') end
            if tier.id == cur.id then return fail(('Već koristiš %s paket.'):format(tier.label)) end

            local price = tier.price or 0
            local upgrade = price > (cur.price or 0)
            if upgrade and price > 0 then
                if xPlayer.getAccount('bank').money < price then
                    return fail(('%s paket košta %s, nemaš dovoljno na računu.'):format(tier.label, fmt(price)))
                end
                xPlayer.removeAccountMoney('bank', price, 'Bank card upgrade')
                logTx(acc.identifier, 'fee', 'Promena paketa', ('%s -> %s'):format(cur.label, tier.label), s.place, price)
            end
            saveAccount(acc, { tier = tier.id, fee_due = nextFeeDue(tier) or NULL })
            msg = ('Prešao si na %s paket.'):format(tier.label)
        else
            return fail('Nepoznata akcija.')
        end

        buildData(xPlayer, acc, function(data)
            data.ok    = true
            data.msg   = msg
            data.kind  = 'bank'
            data.place = s.place
            cb(data)
        end)
    end)
end)

RegisterNetEvent('flamingo_banke:close', function()
    sessions[source] = nil
end)

AddEventHandler('playerDropped', function()
    sessions[source]   = nil
    lastAction[source] = nil
end)

-- Ocisti kes kad se igrac odjavi
AddEventHandler('esx:playerDropped', function(playerId, reason, xPlayer)
    if xPlayer and xPlayer.identifier then
        accCache[xPlayer.identifier] = nil
    end
end)

-- ============================================================
--  Akcije: uplata / podizanje / transfer
-- ============================================================
local function doAction(src, s, xPlayer, acc, payload, cb)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    local amount = toAmount(payload.amount)
    if not amount then return fail('Unesi ispravan iznos.') end

    local memo   = sanitize(payload.memo, 64)
    local action = payload.action
    local tier   = tierOf(acc)
    local msg

    local isAtm = s.kind == 'atm'

    if action == 'deposit' then
        if isAtm and amount > tier.atmLimit then
            return fail(('Sa %s karticom možeš uplatiti najviše %s odjednom.'):format(tier.label, fmt(tier.atmLimit)))
        end
        if xPlayer.getAccount('money').money < amount then
            return fail('Nemaš toliko gotovine kod sebe.')
        end

        -- uplata je uvek bez provizije (i na bankomatu)
        xPlayer.removeAccountMoney('money', amount, 'Bank deposit')
        xPlayer.addAccountMoney('bank', amount, 'Bank deposit')
        if isAtm and s.biz then
            bizCall('AtmDeposit', s.biz, amount, xPlayer.getName())
        end
        logTx(xPlayer.identifier, 'deposit', 'Uplata na račun', memo or 'Gotovina na račun', s.place, amount)
        msg = ('Uplaćeno %s na račun.'):format(fmt(amount))

    elseif action == 'withdraw' then
        if isAtm and amount > tier.atmLimit then
            return fail(('Sa %s karticom bankomat isplaćuje najviše %s odjednom.'):format(tier.label, fmt(tier.atmLimit)))
        end

        local fee   = isAtm and math.floor(amount * tier.atmFee / 100) or 0
        local total = amount + fee
        if xPlayer.getAccount('bank').money < total then
            return fail(fee > 0 and ('Nemaš dovoljno na računu (%s sa provizijom).'):format(fmt(total)) or 'Nemaš toliko novca na računu.')
        end

        -- bankomat-biznis: mora imati dovoljno gotovine u sebi
        if isAtm and s.biz then
            local can, why = bizCall('AtmCanWithdraw', s.biz, amount)
            if can == false then return fail(why or 'Bankomat nema dovoljno gotovine.') end
        end

        xPlayer.removeAccountMoney('bank', total, 'Bank withdraw')
        xPlayer.addAccountMoney('money', amount, 'Bank withdraw')

        -- provizija ide u kasu biznisa, gotovina izlazi iz bankomata
        if isAtm and s.biz then
            bizCall('AtmWithdraw', s.biz, amount, fee, tier.id, xPlayer.getName())
        end
        logTx(xPlayer.identifier, 'withdraw', 'Podizanje novca', memo or 'Račun u gotovinu', s.place, amount)
        if fee > 0 then
            logTx(xPlayer.identifier, 'fee', 'Provizija bankomata', ('Podizanje, %d%%'):format(tier.atmFee), s.place, fee)
            msg = ('Podignuto %s (provizija %s).'):format(fmt(amount), fmt(fee))
        else
            msg = ('Podignuto %s u gotovini.'):format(fmt(amount))
        end

    elseif action == 'transfer' then
        if isAtm then
            return fail('Transfer nije moguć na bankomatu. Koristi banku ili telefon.')
        end
        local ok, res = doTransfer(src, xPlayer, acc, payload.target, amount, memo, s.place)
        if not ok then return fail(res) end
        msg = res
    else
        return fail('Nepoznata akcija.')
    end

    buildData(xPlayer, acc, function(data)
        data.ok    = true
        data.msg   = msg
        data.kind  = s.kind
        data.place = s.place

        -- flamingo_misije (misija 6): javi tacan iznos uplate na SALTERU banke
        -- (bez provizije). Bankomat namerno ne salje ovo polje.
        if action == 'deposit' and not isAtm then
            data.depositedAmount = amount
        end

        cb(data)
    end)
end

ESX.RegisterServerCallback('flamingo_banke:action', function(src, cb, payload)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    if type(payload) ~= 'table' then return fail('Neispravan zahtev.') end

    local s = validSession(src)
    if not s then return fail('Previše si daleko od banke.') end
    if not s.pinOk then return fail('Prvo unesi PIN.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    getAccount(xPlayer.identifier, function(acc)
        if not acc then return fail('Prvo moraš otvoriti bankovni račun na šalteru banke.') end
        if s.kind == 'atm' and not acc.virtual and not hasCardItem(xPlayer) then
            return fail('Nemaš karticu kod sebe.')
        end
        doAction(src, s, xPlayer, acc, payload, cb)
    end)
end)

-- ============================================================
--  Odrzavanje kartice (naplata za igrace koji su u gradu)
-- ============================================================
local function chargeMaintenance(xPlayer, acc)
    if not acc or acc.virtual or not acc.fee_due or os.time() < acc.fee_due then return end
    local tier = tierOf(acc)
    local cost = tier.maintenance or 0
    if cost <= 0 then return saveAccount(acc, { fee_due = NULL }) end

    if xPlayer.getAccount('bank').money >= cost then
        xPlayer.removeAccountMoney('bank', cost, 'Bank card maintenance')
        logTx(acc.identifier, 'fee', 'Održavanje kartice', ('%s paket'):format(tier.label), 'Banka', cost)
        saveAccount(acc, { fee_due = os.time() + maintenanceInterval() })
        TriggerClientEvent('flamingo_banke:notify', xPlayer.source, ('Naplaćeno održavanje %s kartice: %s.'):format(tier.label, fmt(cost)), 'info')
    else
        local def = defaultTier()
        saveAccount(acc, { tier = def.id, fee_due = nextFeeDue(def) or NULL })
        TriggerClientEvent('flamingo_banke:notify', xPlayer.source,
            ('Nisi imao %s za održavanje, kartica je vraćena na %s paket.'):format(fmt(cost), def.label), 'error')
    end
end

CreateThread(function()
    if not (Config.Maintenance and Config.Maintenance.enabled) then return end
    while true do
        Wait(5 * 60 * 1000)
        local players = ESX.GetExtendedPlayers and ESX.GetExtendedPlayers() or {}
        for _, xPlayer in pairs(players) do
            getAccount(xPlayer.identifier, function(acc) chargeMaintenance(xPlayer, acc) end)
            Wait(50)
        end
    end
end)

-- ============================================================
--  Telefon (flamingo_telefon -> aplikacija Banka, samo transfer)
-- ============================================================
local function phoneInfo(xPlayer, acc, cb)
    local tier = tierOf(acc)
    MySQL.query(
        "SELECT type, title, memo, party, amount, UNIX_TIMESTAMP(created_at) AS ts FROM flamingo_bank_transactions WHERE identifier = ? AND type IN ('transfer_in', 'transfer_out') ORDER BY id DESC LIMIT ?",
        { xPlayer.identifier, Config.PhoneRecentLimit or 6 },
        function(rows)
            cb({
                name        = xPlayer.getName(),
                bank        = xPlayer.getAccount('bank').money,
                recent      = rows or {},
                now         = os.time(),
                fee         = tier.transferFee or 0,
                maxTransfer = tier.maxTransfer,
                tier        = tier.id,
                tierLabel   = tier.label,
                theme       = tier.theme
            })
        end
    )
end

ESX.RegisterServerCallback('flamingo_banke:phoneInfo', function(src, cb)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer or not Config.PhoneTransfer then return cb(false) end
    getAccount(xPlayer.identifier, function(acc) phoneInfo(xPlayer, acc, cb) end)
end)

ESX.RegisterServerCallback('flamingo_banke:phoneTransfer', function(src, cb, payload)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    if not Config.PhoneTransfer then return fail('Transfer preko telefona je isključen.') end
    if type(payload) ~= 'table' then return fail('Neispravan zahtev.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    local amount = toAmount(payload.amount)
    if not amount then return fail('Unesi ispravan iznos.') end

    getAccount(xPlayer.identifier, function(acc)
        if not acc then return fail('Prvo moraš otvoriti bankovni račun u banci.') end

        local ok, msg, targetName = doTransfer(src, xPlayer, acc, payload.target, amount, sanitize(payload.memo, 64), 'Telefon')
        if not ok then return fail(msg) end

        phoneInfo(xPlayer, acc, function(info)
            cb({ ok = true, msg = msg, amount = amount, targetName = targetName, info = info })
        end)
    end)
end)

-- ============================================================
--  Kazne (flamingo_policija) - kazne se plaćaju ISKLJUČIVO u banci
-- ============================================================
local function finesReady()
    return Config.Fines and Config.Fines.enabled and GetResourceState(Config.Fines.resource) == 'started'
end

ESX.RegisterServerCallback('flamingo_banke:getFines', function(src, cb)
    if not finesReady() then return cb({}) end
    local ok, list = pcall(function() return exports[Config.Fines.resource]:GetUnpaidFines(src) end)
    cb((ok and type(list) == 'table') and list or {})
end)

ESX.RegisterServerCallback('flamingo_banke:payFine', function(src, cb, ticketId)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    if not finesReady() then return fail('Plaćanje kazni trenutno nije dostupno.') end

    local s = validSession(src)
    if not s then return fail('Previše si daleko od banke.') end
    if not s.pinOk then return fail('Prvo unesi PIN.') end
    if not Config.Fines.atm and s.kind == 'atm' then return fail('Kazne se plaćaju isključivo na šalteru banke.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    getAccount(xPlayer.identifier, function(acc)
        if not acc then return fail('Prvo moraš otvoriti bankovni račun na šalteru banke.') end

        local ok, res, err = pcall(function() return exports[Config.Fines.resource]:PayFine(src, ticketId) end)
        if not ok then return fail('Greška pri plaćanju kazne.') end
        if not res then return fail(err or 'Kazna nije mogla da se plati.') end

        buildData(xPlayer, acc, function(data)
            data.ok  = true
            data.msg = 'Kazna je plaćena.'
            cb(data)
        end)
    end)
end)

-- ============================================================
--  Export za druge resurse (payday, kazne, poslovi...)
--  exports['flamingo_banke']:AddTransaction(src ili identifier, 'income', 'Plata', 2500, 'Payday', 'Država')
--  Tipovi: income, expense, fee, deposit, withdraw, transfer_in, transfer_out
--  NAPOMENA: ovo samo upisuje u istoriju, novac dodaj/oduzmi kao i do sada.
-- ============================================================
exports('AddTransaction', function(target, txType, title, amount, memo, party)
    local identifier = target
    if type(target) == 'number' then
        local x = ESX.GetPlayerFromId(target)
        if not x then return false end
        identifier = x.identifier
    end
    if type(identifier) ~= 'string' or not VALID_TYPES[txType] then return false end

    amount = toAmount(amount)
    if not amount then return false end

    logTx(identifier, txType, sanitize(title, 64) or 'Transakcija', sanitize(memo, 128), sanitize(party, 64), amount)
    return true
end)

-- ============================================================
--  Placanje karticom (za prodavnice i sl.) + cashback po paketu
--  local ok, msg, cashback = exports['flamingo_banke']:CardPayment(src, 1200, 'Kupovina', '24/7 Market')
--  Skida novac sa racuna (igrac mora imati karticu kod sebe) i vraca cashback % po paketu.
-- ============================================================
exports('CardPayment', function(src, amount, title, party)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return false, 'Igrač nije pronađen.' end
    amount = toAmount(amount)
    if not amount then return false, 'Neispravan iznos.' end

    local acc = accCache[xPlayer.identifier]
    if acc == nil and Config.RequireAccount then
        acc = MySQL.single.await('SELECT identifier, card_number, tier, pin, pin_tries, fee_due FROM flamingo_bank_accounts WHERE identifier = ?', { xPlayer.identifier }) or false
        accCache[xPlayer.identifier] = acc
    elseif not Config.RequireAccount then
        acc = { virtual = true, tier = Config.DefaultCard, identifier = xPlayer.identifier }
    end
    if not acc then return false, 'Nemaš bankovni račun.' end
    if not acc.virtual and not hasCardItem(xPlayer) then return false, 'Nemaš karticu kod sebe.' end
    if xPlayer.getAccount('bank').money < amount then return false, 'Nemaš dovoljno novca na računu.' end

    local tier = tierOf(acc)
    xPlayer.removeAccountMoney('bank', amount, 'Card payment')
    logTx(xPlayer.identifier, 'expense', sanitize(title, 64) or 'Plaćanje karticom', ('%s kartica'):format(tier.label), sanitize(party, 64), amount)

    local back = math.floor(amount * (tier.cashback or 0) / 100)
    if back > 0 then
        xPlayer.addAccountMoney('bank', back, 'Card cashback')
        logTx(xPlayer.identifier, 'income', 'Cashback', ('%d%% povrata, %s kartica'):format(tier.cashback, tier.label), sanitize(party, 64), back)
    end
    return true, 'Plaćeno karticom.', back
end)

-- ============================================================
--  Paketi kartica za druge resurse (flamingo_biznisi prikazuje proviziju po kartici)
--  exports['flamingo_banke']:GetCardTiers()
-- ============================================================
exports('GetCardTiers', function()
    local out = {}
    for _, c in ipairs(Config.Cards) do
        out[#out + 1] = { id = c.id, label = c.label, atmFee = c.atmFee or 0, theme = c.theme }
    end
    return out
end)
