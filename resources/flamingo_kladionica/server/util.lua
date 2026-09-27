Util = {}

function Util.log(msg, ...)
    print(('^5[kladionica]^7 ' .. msg):format(...))
end

function Util.warn(msg, ...)
    print(('^3[kladionica] UPOZORENJE:^7 ' .. msg):format(...))
end

function Util.round(n, decimals)
    local m = 10 ^ (decimals or 2)
    return math.floor(n * m + 0.5) / m
end

-- Broj dana od 1970-01-01 (radi u UTC, ne zavisi od vremenske zone servera)
local function daysFromCivil(y, m, d)
    if m <= 2 then y = y - 1 end
    local era = (y >= 0 and y or y - 399) // 400
    local yoe = y - era * 400
    local mp = (m + 9) % 12
    local doy = (153 * mp + 2) // 5 + d - 1
    local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    return era * 146097 + doe - 719468
end

-- '2026-09-27T18:45:00Z' -> unix timestamp
function Util.parseIso(str)
    if type(str) ~= 'string' then return nil end
    local y, mo, d, h, mi, s = str:match('^(%d+)%-(%d+)%-(%d+)T(%d+):(%d+):(%d+)')
    if not y then return nil end
    return daysFromCivil(tonumber(y), tonumber(mo), tonumber(d)) * 86400
        + tonumber(h) * 3600 + tonumber(mi) * 60 + tonumber(s)
end

function Util.formatMoney(n)
    local s = tostring(math.floor(n))
    local out = s:reverse():gsub('(%d%d%d)', '%1.'):reverse()
    return (out:gsub('^%.', ''))
end

local CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function Util.randomCode(len)
    local t = {}
    for i = 1, len do
        local r = math.random(1, #CODE_CHARS)
        t[i] = CODE_CHARS:sub(r, r)
    end
    return table.concat(t)
end

function Util.placeholders(n)
    return ('?,'):rep(n):sub(1, -2)
end
