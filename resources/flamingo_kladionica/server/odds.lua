-- Pretvaranje API podataka u kvote, provjera opklada i obračun parova.
Odds = {}

local function price(p)
    p = tonumber(p)
    if not p or p <= 1.0 then return nil end
    local factor = SvConfig.OddsFactor or 1.0
    return math.max(1.01, Util.round(1 + (p - 1) * factor, 2))
end

-- Linija mora biti cijela ili .5 (bez azijskih .25/.75 linija)
local function validLine(point)
    point = tonumber(point)
    return point ~= nil and (point * 2) % 1 == 0
end

local parsers = {}

function parsers.h2h(market, ev, sport)
    local r = {}
    for _, o in ipairs(market.outcomes or {}) do
        if o.name == ev.home_team then
            r.home = price(o.price)
        elseif o.name == ev.away_team then
            r.away = price(o.price)
        elseif o.name == 'Draw' then
            r.draw = price(o.price)
        end
    end
    if not r.home or not r.away then return nil end
    if sport == 'soccer' and not r.draw then return nil end
    -- košarka: samo tržište bez neriješenog (produžeci se računaju)
    if sport ~= 'soccer' and r.draw then return nil end
    return r
end

function parsers.totals(market)
    local over, under
    for _, o in ipairs(market.outcomes or {}) do
        if o.name == 'Over' then over = o elseif o.name == 'Under' then under = o end
    end
    if not over or not under or over.point ~= under.point or not validLine(over.point) then return nil end
    local po, pu = price(over.price), price(under.price)
    if not po or not pu then return nil end
    return { point = tonumber(over.point), over = po, under = pu }
end

function parsers.spreads(market, ev)
    local home, away
    for _, o in ipairs(market.outcomes or {}) do
        if o.name == ev.home_team then home = o elseif o.name == ev.away_team then away = o end
    end
    if not home or not away or not validLine(home.point) then return nil end
    if tonumber(home.point) ~= -tonumber(away.point) then return nil end
    local ph, pa = price(home.price), price(away.price)
    if not ph or not pa then return nil end
    return { point = tonumber(home.point), home = ph, away = pa }
end

-- Uzima kvotu po redoslijedu kladionica iz SvConfig.Bookmakers
local function pickMarket(ev, marketKey, sport)
    local byBook, order = {}, {}
    for _, b in ipairs(ev.bookmakers or {}) do
        for _, m in ipairs(b.markets or {}) do
            if m.key == marketKey then
                byBook[b.key] = m
                order[#order + 1] = b.key
                break
            end
        end
    end

    local tried = {}
    for _, bk in ipairs(SvConfig.Bookmakers or {}) do
        if byBook[bk] then
            tried[bk] = true
            local r = parsers[marketKey](byBook[bk], ev, sport)
            if r then return r end
        end
    end
    if SvConfig.AnyBookmakerFallback then
        for _, bk in ipairs(order) do
            if not tried[bk] then
                local r = parsers[marketKey](byBook[bk], ev, sport)
                if r then return r end
            end
        end
    end
end

local function doubleChance(a, b)
    return math.max(1.01, Util.round(1 / (1 / a + 1 / b), 2))
end

-- API event -> { h2h = {...}, dc = {...}, totals = {...}, spreads = {...} } ili nil
function Odds.parse(ev, sport)
    local sportCfg = SvConfig.Sports[sport]
    if not sportCfg then return nil end

    local odds, any = {}, false
    for marketKey in sportCfg.markets:gmatch('[^,%s]+') do
        if parsers[marketKey] then
            local m = pickMarket(ev, marketKey, sport)
            if m then
                odds[marketKey] = m
                any = true
            end
        end
    end
    if not any then return nil end

    local h = odds.h2h
    if sportCfg.doubleChance and h and h.draw then
        odds.dc = {
            ['1X'] = doubleChance(h.home, h.draw),
            ['12'] = doubleChance(h.home, h.away),
            ['X2'] = doubleChance(h.draw, h.away),
        }
    end
    return odds
end

local DC_PICKS = { ['1X'] = true, ['12'] = true, ['X2'] = true }

-- Vraća trenutnu kvotu i liniju za odabranu opkladu (ili nil ako ne postoji)
function Odds.lookup(eventOdds, market, pick)
    if type(eventOdds) ~= 'table' or type(market) ~= 'string' or type(pick) ~= 'string' then return nil end

    if market == 'h2h' then
        local m = eventOdds.h2h
        if m and (pick == 'home' or pick == 'away' or pick == 'draw') and m[pick] then
            return m[pick], nil
        end
    elseif market == 'dc' then
        local m = eventOdds.dc
        if m and DC_PICKS[pick] and m[pick] then
            return m[pick], nil
        end
    elseif market == 'totals' then
        local m = eventOdds.totals
        if m and (pick == 'over' or pick == 'under') then
            return m[pick], m.point
        end
    elseif market == 'spreads' then
        local m = eventOdds.spreads
        if m and (pick == 'home' or pick == 'away') then
            return m[pick], pick == 'home' and m.point or -m.point
        end
    end
    return nil
end

local function cmp(value)
    if value > 0 then return 'won' elseif value < 0 then return 'lost' end
    return 'void'
end

-- Obračun jednog para: 'won' / 'lost' / 'void'
function Odds.evaluate(market, pick, point, home, away)
    point = tonumber(point)
    if market == 'h2h' then
        local result = home > away and 'home' or (home < away and 'away' or 'draw')
        return result == pick and 'won' or 'lost'
    elseif market == 'dc' then
        if pick == '1X' then return home >= away and 'won' or 'lost' end
        if pick == '12' then return home ~= away and 'won' or 'lost' end
        if pick == 'X2' then return home <= away and 'won' or 'lost' end
    elseif market == 'totals' and point then
        local diff = (home + away) - point
        return cmp(pick == 'over' and diff or -diff)
    elseif market == 'spreads' and point then
        if pick == 'home' then return cmp(home + point - away) end
        return cmp(away + point - home)
    end
    return 'void'
end
