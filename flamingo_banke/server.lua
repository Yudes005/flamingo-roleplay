local sessions   = {}  -- [src] = { kind = 'bank'|'atm', coords = vector3, place = string }
local lastAction = {}
local accCache   = {}  -- [identifier] = true/false (da li ima otvoren racun), keš da ne pitamo bazu svaki put

-- ============================================================
--  Baza
-- ============================================================
MySQL.ready(function()
    MySQL.query([[
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

    MySQL.query([[
        CREATE TABLE IF NOT EXISTS `flamingo_bank_accounts` (
            `identifier`  VARCHAR(64) NOT NULL,
            `card_number` VARCHAR(24) NOT NULL,
            `opened_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`identifier`)
        )
    ]])

    -- Registruje item za bankovnu karticu ako vec ne postoji (ESX legacy 'items' tabela).
    -- Ako tvoj esx_inventory/ox_inventory koristi drugaciju tabelu/format, dodaj item rucno tamo.
    MySQL.query('INSERT IGNORE INTO items (name, label) VALUES (?, ?)', { Config.CardItem, Config.CardLabel })
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

local function fmt(n)
    local s = tostring(math.floor(n))
    local out = s:reverse():gsub('(%d%d%d)', '%1,'):reverse()
    return '$' .. out:gsub('^,', '')
end

-- ============================================================
--  Bankovni racun (otvaranje / provera)
-- ============================================================
local function generateCardNumber()
    local digits = {}
    for i = 1, 16 do digits[i] = math.random(0, 9) end
    local raw = table.concat(digits)
    return raw:sub(1, 4) .. ' ' .. raw:sub(5, 8) .. ' ' .. raw:sub(9, 12) .. ' ' .. raw:sub(13, 16)
end

-- Async provera da li igrac ima otvoren racun (kesirano po identifier-u)
local function hasAccount(identifier, cb)
    if not Config.RequireAccount then return cb(true) end
    if accCache[identifier] ~= nil then return cb(accCache[identifier]) end

    MySQL.scalar('SELECT 1 FROM flamingo_bank_accounts WHERE identifier = ?', { identifier }, function(result)
        local has = result ~= nil
        accCache[identifier] = has
        cb(has)
    end)
end

local function buildData(xPlayer, cb)
    MySQL.query(
        'SELECT id, type, title, memo, party, amount, UNIX_TIMESTAMP(created_at) AS ts FROM flamingo_bank_transactions WHERE identifier = ? ORDER BY id DESC LIMIT ?',
        { xPlayer.identifier, Config.HistoryLimit },
        function(rows)
            cb({
                name         = xPlayer.getName(),
                bank         = xPlayer.getAccount('bank').money,
                cash         = xPlayer.getAccount('money').money,
                transactions = rows or {},
                now          = os.time()
            })
        end
    )
end

-- ============================================================
--  Transfer (zajednicko za banku, bankomat i telefon)
-- ============================================================
local function doTransfer(src, xPlayer, target, amount, memo, place)
    if amount > Config.MaxTransfer then
        return false, ('Najveći transfer je %s.'):format(fmt(Config.MaxTransfer))
    end

    local targetId = tonumber(target)
    if not targetId then return false, 'Unesi ID igrača.' end
    targetId = math.floor(targetId)
    if targetId == src then return false, 'Ne možeš poslati novac sebi.' end

    local xTarget = ESX.GetPlayerFromId(targetId)
    if not xTarget then return false, 'Igrač sa tim ID-jem nije u gradu.' end

    local fee   = math.floor(amount * (Config.TransferFee or 0) / 100)
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

    hasAccount(xPlayer.identifier, function(hasAcc)
        -- bankomat trazi karticu/racun - bez toga se ne moze ni uci u meni
        if kind == 'atm' and not hasAcc then
            return cb({ noAccount = true, kind = 'atm' })
        end

        sessions[src] = { kind = kind, coords = coords, place = place }

        -- na salteru banke bez otvorenog racuna - prikazi ekran za otvaranje racuna
        if not hasAcc then
            return cb({ noAccount = true, kind = 'bank', place = place, name = xPlayer.getName() })
        end

        buildData(xPlayer, function(data)
            data.kind       = kind
            data.place      = place
            data.hasAccount = true
            cb(data)
        end)
    end)
end)

-- Otvaranje bankovnog racuna (samo na salteru banke)
ESX.RegisterServerCallback('flamingo_banke:openAccount', function(src, cb)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    local s = sessions[src]
    if not s or s.kind ~= 'bank' then return fail('Moraš biti na šalteru banke.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    hasAccount(xPlayer.identifier, function(hasAcc)
        if hasAcc then return fail('Već imaš otvoren bankovni račun.') end

        local identifier = xPlayer.identifier
        local cardNumber = generateCardNumber()

        MySQL.insert('INSERT INTO flamingo_bank_accounts (identifier, card_number) VALUES (?, ?)',
            { identifier, cardNumber }, function(insertId)
                if not insertId then return fail('Greška prilikom otvaranja računa, pokušaj ponovo.') end

                accCache[identifier] = true
                xPlayer.addInventoryItem(Config.CardItem, 1)

                if Config.WelcomeBonus and Config.WelcomeBonus > 0 then
                    xPlayer.addAccountMoney('bank', Config.WelcomeBonus)
                    logTx(identifier, 'income', 'Dobrodošlica', 'Bonus za otvaranje računa', s.place, Config.WelcomeBonus)
                end

                buildData(xPlayer, function(data)
                    data.ok         = true
                    data.msg        = ('Račun uspešno otvoren! Dobio si bankovnu karticu (%s).'):format(cardNumber)
                    data.kind       = 'bank'
                    data.place      = s.place
                    data.hasAccount = true
                    data.cardNumber = cardNumber
                    cb(data)
                end)
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

-- Ocisti kes kad se igrac odjavi (identifier moze biti ponovo iskoriscen kroz sesiju servera retko, ali cistoce radi)
AddEventHandler('esx:playerDropped', function(playerId, reason, xPlayer)
    if xPlayer and xPlayer.identifier then
        accCache[xPlayer.identifier] = nil
    end
end)

-- ============================================================
--  Akcije: uplata / podizanje / transfer
-- ============================================================
ESX.RegisterServerCallback('flamingo_banke:action', function(src, cb, payload)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    if type(payload) ~= 'table' then return fail('Neispravan zahtev.') end

    local s = validSession(src)
    if not s then return fail('Previše si daleko od banke.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    hasAccount(xPlayer.identifier, function(hasAcc)
        if not hasAcc then return fail('Prvo moraš otvoriti bankovni račun na šalteru banke.') end
        doAction(src, s, xPlayer, payload, cb)
    end)
end)

function doAction(src, s, xPlayer, payload, cb)
    local function fail(msg) cb({ ok = false, msg = msg }) end

    local amount = toAmount(payload.amount)
    if not amount then return fail('Unesi ispravan iznos.') end

    local memo   = sanitize(payload.memo, 64)
    local action = payload.action
    local msg

    local isAtm = s.kind == 'atm'

    if action == 'deposit' then
        if isAtm and amount > Config.ATM.maxDeposit then
            return fail(('Na bankomatu možeš uplatiti najviše %s odjednom.'):format(fmt(Config.ATM.maxDeposit)))
        end
        if xPlayer.getAccount('money').money < amount then
            return fail('Nemaš toliko gotovine kod sebe.')
        end

        local fee      = isAtm and math.floor(amount * Config.ATM.depositFee / 100) or 0
        local credited = amount - fee
        if credited < 1 then return fail('Iznos je premali.') end

        xPlayer.removeAccountMoney('money', amount, 'Bank deposit')
        xPlayer.addAccountMoney('bank', credited, 'Bank deposit')
        logTx(xPlayer.identifier, 'deposit', 'Uplata na račun', memo or 'Gotovina na račun', s.place, amount)
        if fee > 0 then
            logTx(xPlayer.identifier, 'fee', 'Provizija bankomata', ('Uplata, %d%%'):format(Config.ATM.depositFee), s.place, fee)
            msg = ('Uplaćeno %s na račun (provizija %s).'):format(fmt(credited), fmt(fee))
        else
            msg = ('Uplaćeno %s na račun.'):format(fmt(amount))
        end

    elseif action == 'withdraw' then
        if isAtm and amount > Config.ATM.maxWithdraw then
            return fail(('Bankomat isplaćuje najviše %s odjednom.'):format(fmt(Config.ATM.maxWithdraw)))
        end

        local fee   = isAtm and math.floor(amount * Config.ATM.withdrawFee / 100) or 0
        local total = amount + fee
        if xPlayer.getAccount('bank').money < total then
            return fail(fee > 0 and ('Nemaš dovoljno na računu (%s sa provizijom).'):format(fmt(total)) or 'Nemaš toliko novca na računu.')
        end

        xPlayer.removeAccountMoney('bank', total, 'Bank withdraw')
        xPlayer.addAccountMoney('money', amount, 'Bank withdraw')
        logTx(xPlayer.identifier, 'withdraw', 'Podizanje novca', memo or 'Račun u gotovinu', s.place, amount)
        if fee > 0 then
            logTx(xPlayer.identifier, 'fee', 'Provizija bankomata', ('Podizanje, %d%%'):format(Config.ATM.withdrawFee), s.place, fee)
            msg = ('Podignuto %s (provizija %s).'):format(fmt(amount), fmt(fee))
        else
            msg = ('Podignuto %s u gotovini.'):format(fmt(amount))
        end

    elseif action == 'transfer' then
        if isAtm then
            return fail('Transfer nije moguć na bankomatu. Koristi banku ili telefon.')
        end
        local ok, res = doTransfer(src, xPlayer, payload.target, amount, memo, s.place)
        if not ok then return fail(res) end
        msg = res
    else
        return fail('Nepoznata akcija.')
    end

    buildData(xPlayer, function(data)
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

-- ============================================================
--  Telefon (flamingo_telefon -> aplikacija Banka, samo transfer)
-- ============================================================
local function phoneInfo(xPlayer, cb)
    MySQL.query(
        "SELECT type, title, memo, party, amount, UNIX_TIMESTAMP(created_at) AS ts FROM flamingo_bank_transactions WHERE identifier = ? AND type IN ('transfer_in', 'transfer_out') ORDER BY id DESC LIMIT ?",
        { xPlayer.identifier, Config.PhoneRecentLimit or 6 },
        function(rows)
            cb({
                name        = xPlayer.getName(),
                bank        = xPlayer.getAccount('bank').money,
                recent      = rows or {},
                now         = os.time(),
                fee         = Config.TransferFee or 0,
                maxTransfer = Config.MaxTransfer
            })
        end
    )
end

ESX.RegisterServerCallback('flamingo_banke:phoneInfo', function(src, cb)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer or not Config.PhoneTransfer then return cb(false) end
    phoneInfo(xPlayer, cb)
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

    hasAccount(xPlayer.identifier, function(hasAcc)
        if not hasAcc then return fail('Prvo moraš otvoriti bankovni račun u banci.') end

        local ok, msg, targetName = doTransfer(src, xPlayer, payload.target, amount, sanitize(payload.memo, 64), 'Telefon')
        if not ok then return fail(msg) end

        phoneInfo(xPlayer, function(info)
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
    if not Config.Fines.atm and s.kind == 'atm' then return fail('Kazne se plaćaju isključivo na šalteru banke.') end
    if not passCooldown(src) then return fail('Sačekaj trenutak pa pokušaj ponovo.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Igrač nije pronađen.') end

    hasAccount(xPlayer.identifier, function(hasAcc)
        if not hasAcc then return fail('Prvo moraš otvoriti bankovni račun na šalteru banke.') end

        local ok, res, err = pcall(function() return exports[Config.Fines.resource]:PayFine(src, ticketId) end)
        if not ok then return fail('Greška pri plaćanju kazne.') end
        if not res then return fail(err or 'Kazna nije mogla da se plati.') end

        buildData(xPlayer, function(data)
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
