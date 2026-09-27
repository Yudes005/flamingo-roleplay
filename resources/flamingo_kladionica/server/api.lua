-- Komunikacija sa The Odds API (https://the-odds-api.com/liveapi/guides/v4/)
Api = {
    remaining = nil,   -- preostali krediti (iz x-requests-remaining headera)
    used = nil,
    lastError = nil,
}

local BASE_URL = 'https://api.the-odds-api.com/v4'

function Api.getKey()
    local key = GetConvar('kladionica_api_key', '')
    if key == '' then key = SvConfig.ApiKey or '' end
    return key
end

local function header(headers, name)
    if type(headers) ~= 'table' then return nil end
    for k, v in pairs(headers) do
        if type(k) == 'string' and k:lower() == name then return v end
    end
end

-- Vraća: data, errorMessage, httpStatus
function Api.get(path, params)
    local key = Api.getKey()
    if key == '' then return nil, 'API ključ nije postavljen', 0 end

    local query = { 'apiKey=' .. key }
    for k, v in pairs(params or {}) do
        query[#query + 1] = ('%s=%s'):format(k, v)
    end
    local url = ('%s%s?%s'):format(BASE_URL, path, table.concat(query, '&'))

    local p = promise.new()
    PerformHttpRequest(url, function(status, body, headers, errorData)
        p:resolve({ status = status, body = body, headers = headers, err = errorData })
    end, 'GET', '', { ['Accept'] = 'application/json' })
    local res = Citizen.Await(p)

    local remaining = tonumber(header(res.headers, 'x-requests-remaining'))
    if remaining then
        Api.remaining = math.floor(remaining)
        Api.used = tonumber(header(res.headers, 'x-requests-used'))
    end

    if res.status ~= 200 then
        local msg = ('HTTP %s %s'):format(tostring(res.status), tostring(res.body or res.err or ''):sub(1, 200))
        Api.lastError = msg
        return nil, msg, res.status
    end

    local ok, data = pcall(json.decode, res.body)
    if not ok or type(data) ~= 'table' then
        Api.lastError = 'neispravan odgovor (JSON)'
        return nil, Api.lastError, res.status
    end

    Api.lastError = nil
    return data, nil, res.status
end
