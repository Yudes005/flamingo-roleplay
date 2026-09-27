-- Povlačenje utakmica, kvota i rezultata sa API-ja + raspored da se ne potroše krediti
Sync = {
    leagues = {},        -- aktivne lige: { key, sport, name, order }
    leagueByKey = {},
    sportsFetched = 0,
    interval = 3600,     -- koliko često se osvježava svaka liga (sekunde)
    pausedUntil = 0,
    lowCreditsWarned = false,
}

local SPORTS_REFRESH = 6 * 3600
local SCORES_REFRESH = 30 * 60
local MAX_ODDS_FETCHES_PER_TICK = 3

local function sportOf(key)
    return key:match('^(%a+)_')
end

local function countList(str)
    local n = 0
    for _ in str:gmatch('[^,%s]+') do n = n + 1 end
    return n
end

local function leagueCost(sport)
    return countList(SvConfig.Sports[sport].markets) * countList(SvConfig.Regions)
end

local function handleApiError(err, status)
    Util.warn('API greška: %s', err)
    if status == 401 then
        Util.warn('API ključ je neispravan ili je potrošen mjesečni limit. Pauza 1h.')
        Sync.pausedUntil = os.time() + 3600
    elseif status == 429 then
        Sync.pausedUntil = os.time() + 300
    end
end

function Sync.computeInterval()
    local cycleCost = 0
    for _, lg in ipairs(Sync.leagues) do cycleCost = cycleCost + leagueCost(lg.sport) end

    local minutes
    if type(SvConfig.RefreshMinutes) == 'number' then
        minutes = SvConfig.RefreshMinutes
    else
        local perDay = (SvConfig.MonthlyCredits / 30) * (1 - SvConfig.ScoresReserve)
        minutes = perDay > 0 and (cycleCost / perDay * 1440) or 1440
    end
    minutes = math.max(minutes, SvConfig.MinRefreshMinutes or 30)
    Sync.interval = math.floor(minutes * 60)

    Util.log('Aktivnih liga: %d | cijena jednog kruga: %d kredita | kvote se osvježavaju svakih %s',
        #Sync.leagues, cycleCost, minutes >= 120 and ('%.1f sati'):format(minutes / 60) or ('%d min'):format(math.floor(minutes)))
    if minutes > 24 * 60 then
        Util.warn('Kvote se osvježavaju rjeđe od jednom dnevno. Smanji broj liga u sv_config.lua ili uzmi veći API paket.')
    end
end

-- Lista sportova je besplatna (ne troši kredite)
function Sync.refreshSports()
    local data, err, status = Api.get('/sports', {})
    Sync.sportsFetched = os.time()
    if not data then return handleApiError(err, status) end

    local listed, order, meta = {}, {}, {}
    for i, lg in ipairs(SvConfig.Leagues) do
        listed[lg.key] = lg.name
        order[lg.key] = i
        meta[lg.key] = lg
    end

    local leagues, found = {}, {}
    for _, s in ipairs(data) do
        local sport = type(s.key) == 'string' and sportOf(s.key)
        if sport and SvConfig.Sports[sport] and s.active and not s.has_outrights then
            local include
            if SvConfig.LeagueMode == 'all' then
                include = not (SvConfig.Blacklist or {})[s.key]
            else
                include = listed[s.key] ~= nil
            end
            if include then
                found[s.key] = true
                leagues[#leagues + 1] = {
                    key = s.key,
                    sport = sport,
                    name = listed[s.key] or s.title or s.key,
                    order = order[s.key] or (1000 + #leagues),
                    flag = meta[s.key] and meta[s.key].flag or nil,
                    top = meta[s.key] and meta[s.key].top or false,
                }
            end
        end
    end

    table.sort(leagues, function(a, b)
        if a.order ~= b.order then return a.order < b.order end
        return a.name < b.name
    end)

    Sync.leagues = leagues
    Sync.leagueByKey = {}
    for _, lg in ipairs(leagues) do Sync.leagueByKey[lg.key] = lg end

    if SvConfig.LeagueMode ~= 'all' then
        local off = {}
        for _, lg in ipairs(SvConfig.Leagues) do
            if not found[lg.key] then off[#off + 1] = lg.key end
        end
        if #off > 0 then
            Util.log('Van sezone (ili pogrešan ključ), preskačem: %s', table.concat(off, ', '))
        end
    end

    Sync.computeInterval()
end

-- Učitava nezavršene utakmice iz baze u memoriju (nakon restarta)
function Sync.loadCache()
    local rows = MySQL.query.await("SELECT * FROM kladionica_events WHERE status IN ('open', 'suspended')") or {}
    for _, r in ipairs(rows) do
        local ok, odds = pcall(json.decode, r.odds or 'null')
        Events[r.id] = {
            id = r.id,
            sport_key = r.sport_key,
            sport = r.sport,
            league = r.league,
            home = r.home,
            away = r.away,
            commence = tonumber(r.commence),
            odds = ok and odds or nil,
            status = r.status,
        }
    end
    for _, e in pairs(Events) do
        Logos.request(e.home, e.sport)
        Logos.request(e.away, e.sport)
    end
    Util.log('Učitano %d utakmica iz baze.', #rows)
end

function Sync.fetchOdds(league)
    local sportCfg = SvConfig.Sports[league.sport]
    local data, err, status = Api.get(('/sports/%s/odds'):format(league.key), {
        regions = SvConfig.Regions,
        markets = sportCfg.markets,
        oddsFormat = 'decimal',
        dateFormat = 'iso',
    })

    local now = os.time()
    if not data then
        -- pokušaj ponovo za 15 minuta
        DB.setState('odds:' .. league.key, now - Sync.interval + 15 * 60)
        return handleApiError(err, status)
    end
    DB.setState('odds:' .. league.key, now)

    local horizon = now + (SvConfig.DaysAhead or 7) * 86400
    local seen, queries, offered = {}, {}, 0
    for _, ev in ipairs(data) do
        local commence = Util.parseIso(ev.commence_time)
        if type(ev.id) == 'string' and commence and commence > now and commence <= horizon then
            local odds = Odds.parse(ev, league.sport)
            if odds then
                Logos.request(ev.home_team, league.sport)
                Logos.request(ev.away_team, league.sport)
                seen[ev.id] = true
                offered = offered + 1
                Events[ev.id] = {
                    id = ev.id,
                    sport_key = league.key,
                    sport = league.sport,
                    league = league.name,
                    home = ev.home_team,
                    away = ev.away_team,
                    commence = commence,
                    odds = odds,
                    status = 'open',
                }
                queries[#queries + 1] = {
                    query = [[INSERT INTO kladionica_events (id, sport_key, sport, league, home, away, commence, odds, odds_updated, status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
                        ON DUPLICATE KEY UPDATE league = VALUES(league), home = VALUES(home), away = VALUES(away),
                        commence = VALUES(commence), odds = VALUES(odds), odds_updated = VALUES(odds_updated),
                        status = IF(status IN ('finished', 'void'), status, 'open')]],
                    values = { ev.id, league.key, league.sport, league.name, ev.home_team, ev.away_team, commence, json.encode(odds), now },
                }
            end
        end
    end

    -- Utakmice koje su nestale iz ponude (odgođene i sl.) se skidaju sa ponude
    for id, e in pairs(Events) do
        if e.sport_key == league.key and e.status == 'open' and e.commence > now and not seen[id] then
            e.status = 'suspended'
            queries[#queries + 1] = {
                query = "UPDATE kladionica_events SET status = 'suspended' WHERE id = ? AND status = 'open'",
                values = { id },
            }
        end
    end

    if #queries > 0 then
        MySQL.transaction.await(queries)
    end
    Util.log('%s: %d utakmica u ponudi (preostalo kredita: %s)', league.name, offered, tostring(Api.remaining or '?'))
end

function Sync.fetchScores(sportKey)
    local data, err, status = Api.get(('/sports/%s/scores'):format(sportKey), { daysFrom = 3, dateFormat = 'iso' })
    local now = os.time()
    if not data then
        DB.setState('scores:' .. sportKey, now - SCORES_REFRESH + 10 * 60)
        return handleApiError(err, status)
    end
    DB.setState('scores:' .. sportKey, now)

    local settled = 0
    for _, ev in ipairs(data) do
        if ev.completed and type(ev.scores) == 'table' and Events[ev.id] then
            local hs, as
            for _, s in ipairs(ev.scores) do
                if s.name == ev.home_team then hs = tonumber(s.score) end
                if s.name == ev.away_team then as = tonumber(s.score) end
            end
            if hs and as then
                Settle.finishEvent(ev.id, math.floor(hs), math.floor(as))
                settled = settled + 1
            end
        end
    end
    if settled > 0 then
        Util.log('%s: obračunato %d završenih utakmica.', sportKey, settled)
    end
end

-- Rezultati se traže samo za lige gdje ima uplaćenih tiketa na utakmice koje su završile
function Sync.runScores(now)
    local rows = MySQL.query.await([[
        SELECT e.sport_key, e.sport, MIN(e.commence) AS first_start
        FROM kladionica_selections s
        JOIN kladionica_events e ON e.id = s.event_id
        WHERE s.result = 'pending' AND e.status IN ('open', 'suspended') AND e.commence < ?
        GROUP BY e.sport_key, e.sport
    ]], { now }) or {}

    for _, row in ipairs(rows) do
        local cfg = SvConfig.Sports[row.sport]
        local delay = ((cfg and cfg.scoresDelayMinutes) or 120) * 60
        if tonumber(row.first_start) + delay <= now and now - DB.getState('scores:' .. row.sport_key) >= SCORES_REFRESH then
            Sync.fetchScores(row.sport_key)
        end
    end
end

function Sync.runOdds(now)
    if Api.remaining and Api.remaining <= SvConfig.StopOddsBelowCredits then
        if not Sync.lowCreditsWarned then
            Util.warn('Ostalo je samo %d kredita - kvote se više ne osvježavaju (rezultati i isplate rade dalje).', Api.remaining)
            Sync.lowCreditsWarned = true
        end
        return
    end
    Sync.lowCreditsWarned = false

    local due = {}
    for _, lg in ipairs(Sync.leagues) do
        local last = DB.getState('odds:' .. lg.key)
        if now - last >= Sync.interval then
            due[#due + 1] = { league = lg, last = last }
        end
    end
    table.sort(due, function(a, b) return a.last < b.last end)

    for i = 1, math.min(#due, MAX_ODDS_FETCHES_PER_TICK) do
        Sync.fetchOdds(due[i].league)
        if Sync.pausedUntil > os.time() then break end
    end
end

function Sync.purge(now)
    if now - DB.getState('purge') < 86400 then return end
    DB.setState('purge', now)
    MySQL.query([[
        DELETE e FROM kladionica_events e
        LEFT JOIN kladionica_selections s ON s.event_id = e.id
        WHERE e.status IN ('finished', 'void') AND e.commence < ? AND s.id IS NULL
    ]], { now - 14 * 86400 })
end

local function tick(force)
    if Api.getKey() == '' then return end
    local now = os.time()
    if not force and Sync.pausedUntil > now then return end

    if force or now - Sync.sportsFetched >= SPORTS_REFRESH or (#Sync.leagues == 0 and now - Sync.sportsFetched >= 600) then
        Sync.refreshSports()
    end

    Sync.runScores(now)
    Settle.voidStale(now)
    Sync.runOdds(now)
    Sync.purge(now)
end

-- Samo jedna sinhronizacija u isto vrijeme
function Sync.tick(force)
    if Sync.running then return false end
    Sync.running = true
    local ok, err = pcall(tick, force)
    Sync.running = false
    if not ok then error(err, 0) end
    return true
end

-- Ponuda koja se šalje igraču (samo utakmice na koje se još može uplatiti)
function Sync.buildOffer()
    local now = os.time()
    local close = (SvConfig.CloseMinutesBefore or 1) * 60
    local events, counts, logos = {}, {}, {}
    for _, e in pairs(Events) do
        if e.status == 'open' and e.odds and e.commence - close > now and Sync.leagueByKey[e.sport_key] then
            events[#events + 1] = {
                id = e.id,
                key = e.sport_key,
                sport = e.sport,
                home = e.home,
                away = e.away,
                time = e.commence,
                odds = e.odds,
            }
            counts[e.sport_key] = (counts[e.sport_key] or 0) + 1
            logos[e.home] = Logos.get(e.home)
            logos[e.away] = Logos.get(e.away)
        end
    end

    local leagues = {}
    for _, lg in ipairs(Sync.leagues) do
        if counts[lg.key] then
            leagues[#leagues + 1] = { key = lg.key, sport = lg.sport, name = lg.name, order = lg.order, flag = lg.flag, top = lg.top }
        end
    end

    local sports = {}
    for key, cfg in pairs(SvConfig.Sports) do
        sports[#sports + 1] = { key = key, label = cfg.label }
    end
    table.sort(sports, function(a, b) return a.key > b.key end) -- soccer pa basketball

    return { sports = sports, leagues = leagues, events = events, logos = logos, serverTime = now }
end
