-- Grbovi klubova sa TheSportsDB (besplatno). Traže se u pozadini, polako, i pamte u bazi.
Logos = {
    map = {},       -- ime kluba -> { logo = url ili '', checked = timestamp }
    queue = {},
    queued = {},
    running = false,
}

local RETRY_MISS = 7 * 86400     -- klub koji nije pronađen se ponovo traži nakon 7 dana
local RETRY_ERROR = 3600         -- greška u mreži -> ponovo za 1h
local DELAY = 2500               -- pauza između zahtjeva (limit besplatnog ključa)
local SPORT_NAMES = { soccer = 'Soccer', basketball = 'Basketball' }

local function urlencode(str)
    return (str:gsub('[^%w%-_%.~]', function(c) return ('%%%02X'):format(c:byte()) end))
end

local function norm(str)
    return (tostring(str or ''):lower():gsub('[^%w]', ''))
end

local function save(name, logo, checked)
    Logos.map[name] = { logo = logo, checked = checked }
    MySQL.query('INSERT INTO kladionica_teams (name, logo, checked) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE logo = VALUES(logo), checked = VALUES(checked)',
        { name, logo, checked })
end

function Logos.load()
    local rows = MySQL.query.await('SELECT name, logo, checked FROM kladionica_teams') or {}
    for _, r in ipairs(rows) do
        Logos.map[r.name] = { logo = r.logo or '', checked = tonumber(r.checked) or 0 }
    end
end

function Logos.get(name)
    if type(name) ~= 'string' then return nil end
    local override = SvConfig.TeamLogoOverrides and SvConfig.TeamLogoOverrides[name]
    if override then return override end
    local entry = Logos.map[name]
    if entry and entry.logo ~= '' then return entry.logo end
    return nil
end

function Logos.fetch(name, sport)
    local query = (SvConfig.TeamSearchAliases or {})[name] or name
    local url = ('https://www.thesportsdb.com/api/v1/json/%s/searchteams.php?t=%s'):format(
        SvConfig.TeamLogoApiKey or '3', urlencode(query))

    local p = promise.new()
    PerformHttpRequest(url, function(status, body) p:resolve({ status = status, body = body }) end, 'GET')
    local res = Citizen.Await(p)

    local now = os.time()
    if res.status ~= 200 then
        save(name, '', now - RETRY_MISS + RETRY_ERROR)
        if res.status == 429 then Wait(60000) end
        return
    end

    local ok, data = pcall(json.decode, res.body or '')
    local best
    if ok and type(data) == 'table' and type(data.teams) == 'table' then
        local want, nq, nn = SPORT_NAMES[sport], norm(query), norm(name)
        for _, t in ipairs(data.teams) do
            if not want or t.strSport == want then
                local badge = t.strBadge or t.strTeamBadge
                if type(badge) == 'string' and badge ~= '' then
                    local tn = norm(t.strTeam)
                    if tn == nq or tn == nn then
                        best = badge
                        break
                    end
                    best = best or badge
                end
            end
        end
    end
    save(name, best or '', now)
end

local function startWorker()
    if Logos.running then return end
    Logos.running = true
    CreateThread(function()
        while #Logos.queue > 0 do
            local item = table.remove(Logos.queue, 1)
            Logos.queued[item.name] = nil
            local ok, err = pcall(Logos.fetch, item.name, item.sport)
            if not ok then Util.warn('Greška pri traženju grba za %s: %s', item.name, tostring(err)) end
            Wait(DELAY)
        end
        Logos.running = false
    end)
end

function Logos.request(name, sport)
    if not SvConfig.TeamLogos or type(name) ~= 'string' or name == '' then return end
    if SvConfig.TeamLogoOverrides and SvConfig.TeamLogoOverrides[name] then return end
    local entry = Logos.map[name]
    if entry and (entry.logo ~= '' or os.time() - entry.checked < RETRY_MISS) then return end
    if Logos.queued[name] then return end
    Logos.queued[name] = true
    Logos.queue[#Logos.queue + 1] = { name = name, sport = sport }
    startWorker()
end
