-- Obračun tiketa (dobitni / gubitni / stornirani)
Settle = {}

-- Events = keš utakmica koje još nisu završene (id -> event)
Events = Events or {}

local STATUS_LABEL = {
    won = 'DOBITAN',
    lost = 'GUBITAN',
    void = 'STORNIRAN (povrat uplate)',
}

local function notifyOwner(ticket, status, amount)
    local xPlayer = ESX.GetPlayerFromIdentifier(ticket.identifier)
    if not xPlayer then return end
    local desc = ('Tiket %s je %s.'):format(ticket.code, STATUS_LABEL[status] or status)
    if status ~= 'lost' then
        desc = desc .. (' Isplata: %s%s - podigni je u kladionici.'):format(Config.Currency, Util.formatMoney(amount))
    end
    TriggerClientEvent('ox_lib:notify', xPlayer.source, {
        title = 'Kladionica',
        description = desc,
        type = status == 'lost' and 'error' or 'success',
        duration = 8000,
    })
end

function Settle.ticket(ticketId)
    local t = MySQL.single.await('SELECT id, code, identifier, stake, status FROM kladionica_tickets WHERE id = ?', { ticketId })
    if not t or t.status ~= 'pending' then return end

    local sels = MySQL.query.await('SELECT result, odds FROM kladionica_selections WHERE ticket_id = ?', { ticketId }) or {}
    local anyLost, anyPending, allVoid, odds = false, false, true, 1.0
    for _, s in ipairs(sels) do
        if s.result == 'lost' then
            anyLost = true
        elseif s.result == 'pending' then
            anyPending = true
        elseif s.result == 'won' then
            allVoid = false
            odds = odds * tonumber(s.odds)
        end
    end

    local status, win
    if anyLost then
        status, win = 'lost', 0
    elseif anyPending then
        return
    elseif allVoid then
        status, win = 'void', t.stake
    else
        status = 'won'
        win = math.min(math.floor(t.stake * Util.round(odds, 2) + 1e-6), SvConfig.MaxWin)
    end

    local affected = MySQL.update.await(
        'UPDATE kladionica_tickets SET status = ?, win_amount = ?, settled_at = ? WHERE id = ? AND status = ?',
        { status, win, os.time(), ticketId, 'pending' })
    if affected == 1 then
        notifyOwner(t, status, win)
    end
end

local function settleSelections(eventId, resolver)
    local sels = MySQL.query.await(
        'SELECT id, ticket_id, market, pick, point FROM kladionica_selections WHERE event_id = ? AND result = ?',
        { eventId, 'pending' }) or {}
    if #sels == 0 then return end

    local tickets = {}
    for _, s in ipairs(sels) do
        MySQL.update.await('UPDATE kladionica_selections SET result = ? WHERE id = ?', { resolver(s), s.id })
        tickets[s.ticket_id] = true
    end
    for ticketId in pairs(tickets) do
        Settle.ticket(ticketId)
    end
end

-- Utakmica završena -> obračun svih parova na toj utakmici
function Settle.finishEvent(eventId, homeScore, awayScore)
    if not Events[eventId] then return end
    Events[eventId] = nil
    MySQL.update.await('UPDATE kladionica_events SET status = ?, home_score = ?, away_score = ? WHERE id = ?',
        { 'finished', homeScore, awayScore, eventId })

    settleSelections(eventId, function(s)
        return Odds.evaluate(s.market, s.pick, s.point, homeScore, awayScore)
    end)
end

-- Rezultat nije stigao (otkazano / odgođeno) -> par se stornira (kvota 1.00)
function Settle.voidEvent(eventId)
    Events[eventId] = nil
    MySQL.update.await('UPDATE kladionica_events SET status = ? WHERE id = ?', { 'void', eventId })
    settleSelections(eventId, function() return 'void' end)
end

function Settle.voidStale(now)
    local limit = (SvConfig.VoidAfterHours or 72) * 3600
    local stale = {}
    for id, ev in pairs(Events) do
        if now > ev.commence + limit then stale[#stale + 1] = id end
    end
    for _, id in ipairs(stale) do
        Settle.voidEvent(id)
    end
end
