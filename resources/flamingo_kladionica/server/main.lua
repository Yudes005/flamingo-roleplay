local cooldowns = {}

local function notify(src, description, nType)
    TriggerClientEvent('ox_lib:notify', src, { title = 'Kladionica', description = description, type = nType or 'inform' })
end

local function isNearBetshop(src)
    local coords = GetEntityCoords(GetPlayerPed(src))
    for _, loc in ipairs(Config.Locations) do
        if #(coords - loc.coords.xyz) <= (SvConfig.MaxDistance or 10.0) then return true end
    end
    return false
end

local function limits()
    return {
        minStake = SvConfig.MinStake,
        maxStake = SvConfig.MaxStake,
        maxWin = SvConfig.MaxWin,
        maxSelections = SvConfig.MaxSelections,
        maxTotalOdds = SvConfig.MaxTotalOdds,
        quickStakes = SvConfig.QuickStakes,
    }
end

-- Detalji tiketa (sa parovima) za listu kodova
local function ticketDetails(codes)
    if #codes == 0 then return {} end
    local tickets = MySQL.query.await(
        ('SELECT id, code, stake, total_odds, potential_win, win_amount, status, paid, created_at FROM kladionica_tickets WHERE code IN (%s) ORDER BY id DESC')
        :format(Util.placeholders(#codes)), codes) or {}
    if #tickets == 0 then return {} end

    local ids, byId = {}, {}
    for _, t in ipairs(tickets) do
        ids[#ids + 1] = t.id
        byId[t.id] = t
        t.total_odds = tonumber(t.total_odds)
        t.paid = t.paid == 1 or t.paid == true
        t.selections = {}
    end

    local sels = MySQL.query.await(([[
        SELECT s.ticket_id, s.market, s.pick, s.point, s.odds, s.result,
               e.home, e.away, e.league, e.sport, e.commence, e.home_score, e.away_score
        FROM kladionica_selections s
        LEFT JOIN kladionica_events e ON e.id = s.event_id
        WHERE s.ticket_id IN (%s) ORDER BY s.id
    ]]):format(Util.placeholders(#ids)), ids) or {}

    for _, s in ipairs(sels) do
        local t = byId[s.ticket_id]
        t.selections[#t.selections + 1] = {
            market = s.market,
            pick = s.pick,
            point = tonumber(s.point),
            odds = tonumber(s.odds),
            result = s.result,
            home = s.home or '?',
            away = s.away or '?',
            league = s.league or '',
            sport = s.sport or 'soccer',
            time = tonumber(s.commence),
            homeScore = s.home_score,
            awayScore = s.away_score,
        }
    end

    for _, t in ipairs(tickets) do
        t.id = nil
        for _, s in ipairs(t.selections) do
            s.homeLogo = Logos.get(s.home)
            s.awayLogo = Logos.get(s.away)
        end
    end
    return tickets
end

local function inventoryTicketCodes(src)
    local slots = exports.ox_inventory:Search(src, 'slots', Config.TicketItem) or {}
    local codes, seen = {}, {}
    for _, slot in pairs(slots) do
        local code = slot.metadata and slot.metadata.code
        if type(code) == 'string' and not seen[code] then
            seen[code] = true
            codes[#codes + 1] = code
        end
    end
    return codes
end

local function hasTicket(src, code)
    local slots = exports.ox_inventory:Search(src, 'slots', Config.TicketItem, { code = code })
    if type(slots) == 'table' then
        for _, slot in pairs(slots) do return slot end
    end
end

local function generateCode()
    for _ = 1, 10 do
        local code = 'FL-' .. Util.randomCode(8)
        if not MySQL.scalar.await('SELECT 1 FROM kladionica_tickets WHERE code = ?', { code }) then
            return code
        end
    end
end

--------------------------------------------------------------------------------
-- Callbacks
--------------------------------------------------------------------------------

lib.callback.register('kladionica:getOffer', function(src)
    if not isNearBetshop(src) then return nil end
    local offer = Sync.buildOffer()
    offer.limits = limits()
    offer.currency = Config.Currency
    local xPlayer = ESX.GetPlayerFromId(src)
    local account = xPlayer and xPlayer.getAccount(SvConfig.Account)
    offer.balance = account and account.money or 0
    return offer
end)

lib.callback.register('kladionica:placeBet', function(src, data)
    local fail = function(msg, reason) return { ok = false, message = msg, reason = reason } end

    if not isNearBetshop(src) then return fail('Moraš biti u kladionici.') end
    local now = os.time()
    if cooldowns[src] and now - cooldowns[src] < (SvConfig.BetCooldown or 3) then
        return fail('Sačekaj par sekundi prije nove uplate.')
    end
    cooldowns[src] = now

    if type(data) ~= 'table' or type(data.selections) ~= 'table' then return fail('Neispravan tiket.') end
    local stake = math.floor(tonumber(data.stake) or 0)
    if stake < SvConfig.MinStake or stake > SvConfig.MaxStake then
        return fail(('Uplata mora biti između %s%s i %s%s.'):format(
            Config.Currency, Util.formatMoney(SvConfig.MinStake), Config.Currency, Util.formatMoney(SvConfig.MaxStake)))
    end

    local count = #data.selections
    if count == 0 then return fail('Tiket je prazan.') end
    if count > SvConfig.MaxSelections then return fail(('Maksimalno %d parova na tiketu.'):format(SvConfig.MaxSelections)) end

    local close = (SvConfig.CloseMinutesBefore or 1) * 60
    local usedEvents, rows, total, changed = {}, {}, 1.0, false
    for _, sel in ipairs(data.selections) do
        if type(sel) ~= 'table' or type(sel.id) ~= 'string' then return fail('Neispravan tiket.') end
        local ev = Events[sel.id]
        if not ev or ev.status ~= 'open' or ev.commence - close <= now then
            return fail('Jedna od utakmica više nije u ponudi.', 'odds_changed')
        end
        if usedEvents[sel.id] then return fail('Ne možeš igrati istu utakmicu dva puta na jednom tiketu.') end
        usedEvents[sel.id] = true

        local odd, point = Odds.lookup(ev.odds, sel.market, sel.pick)
        if not odd then return fail('Ta opklada više nije u ponudi.', 'odds_changed') end
        if math.abs(odd - (tonumber(sel.odds) or 0)) > 0.001 then changed = true end

        total = total * odd
        rows[#rows + 1] = { event = ev.id, market = sel.market, pick = sel.pick, point = point, odds = odd }
    end
    if changed then return fail('Kvote su se promijenile - provjeri tiket pa uplati ponovo.', 'odds_changed') end

    total = Util.round(total, 2)
    if total > SvConfig.MaxTotalOdds then
        return fail(('Maksimalna ukupna kvota je %s.'):format(SvConfig.MaxTotalOdds))
    end
    local potential = math.min(math.floor(stake * total + 1e-6), SvConfig.MaxWin)

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Greška sa igračem.') end
    local account = xPlayer.getAccount(SvConfig.Account)
    if not account or account.money < stake then return fail('Nemaš dovoljno para kod sebe.') end
    if not exports.ox_inventory:CanCarryItem(src, Config.TicketItem, 1) then
        return fail('Nemaš mjesta u inventaru za tiket.')
    end

    local code = generateCode()
    if not code then return fail('Greška, pokušaj ponovo.') end

    xPlayer.removeAccountMoney(SvConfig.Account, stake, 'Kladionica - uplata tiketa ' .. code)

    local ticketId = MySQL.insert.await([[
        INSERT INTO kladionica_tickets (code, identifier, player_name, stake, total_odds, potential_win, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ]], { code, xPlayer.identifier, xPlayer.getName(), stake, total, potential, now })

    if not ticketId then
        xPlayer.addAccountMoney(SvConfig.Account, stake, 'Kladionica - povrat (greška)')
        return fail('Greška sa bazom, uplata je vraćena.')
    end

    local queries = {}
    for _, r in ipairs(rows) do
        -- bez nil vrijednosti u nizu parametara (1X2 i dupla šansa nemaju liniju)
        if r.point then
            queries[#queries + 1] = {
                query = 'INSERT INTO kladionica_selections (ticket_id, event_id, market, pick, point, odds) VALUES (?, ?, ?, ?, ?, ?)',
                values = { ticketId, r.event, r.market, r.pick, r.point, r.odds },
            }
        else
            queries[#queries + 1] = {
                query = 'INSERT INTO kladionica_selections (ticket_id, event_id, market, pick, odds) VALUES (?, ?, ?, ?, ?)',
                values = { ticketId, r.event, r.market, r.pick, r.odds },
            }
        end
    end
    if not MySQL.transaction.await(queries) then
        MySQL.query.await('DELETE FROM kladionica_tickets WHERE id = ?', { ticketId })
        xPlayer.addAccountMoney(SvConfig.Account, stake, 'Kladionica - povrat (greška)')
        return fail('Greška sa bazom, uplata je vraćena.')
    end

    local metadata = {
        code = code,
        description = ('Kod: **%s**  \nParova: %d · Kvota: %.2f  \nUplata: %s%s  \nMogući dobitak: %s%s'):format(
            code, count, total, Config.Currency, Util.formatMoney(stake), Config.Currency, Util.formatMoney(potential)),
    }
    local added = exports.ox_inventory:AddItem(src, Config.TicketItem, 1, metadata)
    if not added then
        MySQL.query.await('DELETE FROM kladionica_selections WHERE ticket_id = ?', { ticketId })
        MySQL.query.await('DELETE FROM kladionica_tickets WHERE id = ?', { ticketId })
        xPlayer.addAccountMoney(SvConfig.Account, stake, 'Kladionica - povrat (inventar)')
        return fail('Tiket nije mogao biti dodan u inventar, uplata je vraćena.')
    end

    return { ok = true, code = code, total = total, potential = potential }
end)

lib.callback.register('kladionica:getMyTickets', function(src)
    return ticketDetails(inventoryTicketCodes(src))
end)

lib.callback.register('kladionica:getTicket', function(src, code)
    if type(code) ~= 'string' or not hasTicket(src, code) then return nil end
    return ticketDetails({ code })[1]
end)

lib.callback.register('kladionica:payout', function(src, code)
    local fail = function(msg) return { ok = false, message = msg } end
    if type(code) ~= 'string' then return fail('Neispravan tiket.') end
    if not isNearBetshop(src) then return fail('Isplata je moguća samo u kladionici.') end

    local slot = hasTicket(src, code)
    if not slot then return fail('Nemaš taj tiket kod sebe.') end

    local t = MySQL.single.await('SELECT id, status, paid, win_amount FROM kladionica_tickets WHERE code = ?', { code })
    if not t then return fail('Tiket ne postoji.') end
    if t.status == 'pending' then return fail('Tiket još nije završen.') end
    if t.status == 'lost' then return fail('Tiket nije dobitan.') end
    if t.paid == 1 or t.paid == true then return fail('Tiket je već isplaćen.') end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return fail('Greška sa igračem.') end

    -- zaključavanje: samo jedan zahtjev može označiti tiket kao isplaćen
    local affected = MySQL.update.await(
        "UPDATE kladionica_tickets SET paid = 1, paid_at = ?, paid_to = ? WHERE id = ? AND paid = 0 AND status IN ('won', 'void')",
        { os.time(), xPlayer.identifier, t.id })
    if affected ~= 1 then return fail('Tiket je već isplaćen.') end

    exports.ox_inventory:RemoveItem(src, Config.TicketItem, 1, { code = code }, slot.slot)
    xPlayer.addAccountMoney(SvConfig.Account, t.win_amount, 'Kladionica - isplata tiketa ' .. code)

    return { ok = true, amount = t.win_amount }
end)

lib.callback.register('kladionica:discard', function(src, code)
    if type(code) ~= 'string' then return false end
    local slot = hasTicket(src, code)
    if not slot then return false end
    local t = MySQL.single.await('SELECT status, paid FROM kladionica_tickets WHERE code = ?', { code })
    -- baciti se može samo gubitni tiket (ili tiket koji ne postoji u bazi)
    if t and t.status ~= 'lost' then return false end
    return exports.ox_inventory:RemoveItem(src, Config.TicketItem, 1, { code = code }, slot.slot) and true or false
end)

AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)

--------------------------------------------------------------------------------
-- Admin komande
--------------------------------------------------------------------------------

local function reply(src, msg)
    if src == 0 then print(msg) else notify(src, msg) end
end

lib.addCommand('kladionica_status', {
    help = 'Kladionica - stanje API-ja i kredita',
    restricted = SvConfig.AdminGroup,
}, function(src)
    local open = 0
    for _, e in pairs(Events) do if e.status == 'open' then open = open + 1 end end
    reply(src, ('Kladionica: %d liga, %d utakmica u memoriji, osvježavanje svakih %d min, preostalo kredita: %s%s'):format(
        #Sync.leagues, open, math.floor(Sync.interval / 60), tostring(Api.remaining or '?'),
        Api.lastError and (' | zadnja greška: ' .. Api.lastError) or ''))
end)

lib.addCommand('kladionica_sync', {
    help = 'Kladionica - odmah povuci ponudu i rezultate',
    restricted = SvConfig.AdminGroup,
}, function(src)
    reply(src, 'Kladionica: sinhronizacija pokrenuta...')
    CreateThread(function()
        local ok, res = pcall(Sync.tick, true)
        if not ok then
            reply(src, 'Kladionica: greška - ' .. tostring(res))
        elseif res == false then
            reply(src, 'Kladionica: sinhronizacija je već u toku, sačekaj.')
        else
            reply(src, 'Kladionica: sinhronizacija gotova.')
        end
    end)
end)

--------------------------------------------------------------------------------
-- Start
--------------------------------------------------------------------------------

MySQL.ready(function()
    DB.init()
    Logos.load()
    Sync.loadCache()

    if Api.getKey() == '' then
        Util.warn('API ključ NIJE postavljen! Dodaj u server.cfg:  set kladionica_api_key "TVOJ_KLJUC"  (besplatno na https://the-odds-api.com)')
    end

    CreateThread(function()
        while true do
            local ok, err = pcall(Sync.tick)
            if not ok then Util.warn('Greška u sinhronizaciji: %s', tostring(err)) end
            Wait(60000)
        end
    end)
end)
