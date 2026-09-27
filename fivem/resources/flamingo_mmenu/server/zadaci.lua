-- ============================================================
--  ZADACI (dnevni / nedeljni) - server
--  Config: config_zadaci.lua   |   SQL: sql/flamingo_tasks.sql
--
--  Napredak se broji PO TIPU (npr. 'drive' = metri, 'mining' = komadi)
--  posebno za današnji dan i za ovu nedelju. Zadatak je završen kad
--  brojač njegovog tipa dostigne target. Nagrada je samo novac.
--
--  Drugi resursi javljaju napredak (server strana):
--      exports['flamingo_mmenu']:AddTaskProgress(source, 'mining', 1)
--  ili
--      TriggerEvent('flamingo_mmenu:addTaskProgress', source, 'mining', 1)
-- ============================================================

local ESX = nil
CreateThread(function()
    while ESX == nil do
        local ok, obj = pcall(function() return exports['es_extended']:getSharedObject() end)
        if ok and obj then ESX = obj end
        Wait(0)
    end
end)

local function TaskNotify(src, msg, notifyType, icon)
    if GetResourceState('esx_notify') == 'started' then
        TriggerClientEvent('esx_notify:notify', src, msg, notifyType or 'info', 5000, 'Zadaci', icon or 'fa-solid fa-list-check')
    else
        TriggerClientEvent('esx:showNotification', src, msg, notifyType)
    end
end

local function FormatMoney(v)
    return (ESX and ESX.Math and ESX.Math.GroupDigits(v)) or tostring(v)
end

-- ------------------------------------------------------------
-- Periodi (dan / nedelja od ponedeljka), vreme servera
-- ------------------------------------------------------------
local function DateParts(t)
    local d = os.date('*t', t)
    return d.year, d.month, d.day
end

local function DayKey(offsetDays)
    local y, m, d = DateParts(os.time())
    return os.date('%Y-%m-%d', os.time({ year = y, month = m, day = d + (offsetDays or 0), hour = 12 }))
end

local function MondayTime(offsetWeeks)
    local now = os.time()
    local y, m, d = DateParts(now)
    local wday = tonumber(os.date('%w', now)) -- 0 = nedelja
    local back = (wday + 6) % 7               -- koliko dana nazad je ponedeljak
    return os.time({ year = y, month = m, day = d - back + 7 * (offsetWeeks or 0), hour = 12 })
end

local function WeekKey(offsetWeeks)
    return 'W' .. os.date('%Y-%m-%d', MondayTime(offsetWeeks))
end

local function PeriodKey(period, offset)
    if period == 'weekly' then return WeekKey(offset) end
    return DayKey(offset)
end

local function SecondsUntilReset(period)
    local now = os.time()
    local target
    if period == 'weekly' then
        local y, m, d = DateParts(MondayTime(1))
        target = os.time({ year = y, month = m, day = d, hour = 0, min = 0, sec = 0 })
    else
        local y, m, d = DateParts(now)
        target = os.time({ year = y, month = m, day = d + 1, hour = 0, min = 0, sec = 0 })
    end
    return math.max(0, target - now)
end

-- ------------------------------------------------------------
-- Nasumičan (ali stalan za isti dan/igrača) izbor zadataka
-- ------------------------------------------------------------
local function HashString(s)
    local h = 2166136261
    for i = 1, #s do
        h = ((h ~ s:byte(i)) * 16777619) & 0xFFFFFFFF
    end
    return h
end

local function MakeRng(seed)
    local state = seed & 0x7FFFFFFF
    return function(n)
        state = (state * 1103515245 + 12345) & 0x7FFFFFFF
        return (state % n) + 1
    end
end

local TaskById = { daily = {}, weekly = {} }
local function IndexPool()
    for period, list in pairs(Config.TaskPool or {}) do
        TaskById[period] = {}
        for _, t in ipairs(list) do TaskById[period][t.id] = t end
    end
end
IndexPool()

local function TypeEnabled(taskType)
    local cfg = Config.TaskTypes and Config.TaskTypes[taskType]
    return cfg ~= nil and cfg.enabled == true
end

local function PeriodCfg(period)
    return period == 'weekly' and Config.Tasks.Weekly or Config.Tasks.Daily
end

-- redni broj dana / nedelje (za rotaciju)
local function PeriodIndex(period)
    if period == 'weekly' then
        return MondayTime(0) // (7 * 86400)
    end
    local y, m, d = DateParts(os.time())
    return os.time({ year = y, month = m, day = d, hour = 12 }) // 86400
end

-- Rotacija kao "špil karata": lista se promeša jednom po ciklusu, pa svaki
-- dan/nedelja uzima sledeći deo špila -> zadaci se menjaju iz dana u dan i
-- svi dođu na red, a stalni (fixed) su uvek tu.
local function PickTasks(identifier, period, index)
    local cfg = PeriodCfg(period)
    local who = Config.Tasks.PerPlayer and identifier or 'global'
    local count = cfg.randomCount or 0
    local maxPerType = Config.Tasks.MaxPerType or 2

    local picked, used, usedTypes = {}, {}, {}

    for _, id in ipairs(cfg.fixed or {}) do
        local t = TaskById[period][id]
        if t and TypeEnabled(t.type) and not used[id] then
            picked[#picked + 1] = id
            used[id] = true
            usedTypes[t.type] = (usedTypes[t.type] or 0) + 1
        end
    end

    local deck = {}
    for _, t in ipairs(Config.TaskPool[period] or {}) do
        if not used[t.id] and TypeEnabled(t.type) then deck[#deck + 1] = t end
    end
    if #deck == 0 or count <= 0 then return picked end

    local perCycle = Config.Tasks.AvoidRepeat and math.max(1, #deck // math.max(1, count)) or 1
    local cycle = index // perCycle
    local slot = index % perCycle

    local rng = MakeRng(HashString(('%s|%s|%s|%s'):format(who, period, cycle, Config.Tasks.Seed or '')))
    for i = #deck, 2, -1 do
        local j = rng(i)
        deck[i], deck[j] = deck[j], deck[i]
    end

    -- kreni od svog dela špila; prvo različiti tipovi, pa dopuna do MaxPerType
    local start = slot * count
    local added = 0
    for pass = 1, 2 do
        for k = 0, #deck - 1 do
            if added >= count then break end
            local t = deck[((start + k) % #deck) + 1]
            local n = usedTypes[t.type] or 0
            if not used[t.id] and ((pass == 1 and n == 0) or (pass == 2 and n < maxPerType)) then
                picked[#picked + 1] = t.id
                used[t.id] = true
                usedTypes[t.type] = n + 1
                added = added + 1
            end
        end
    end

    return picked
end

local SelectionCache = {} -- [identifier] = { daily = { key, ids }, weekly = { key, ids } }

local function GetSelection(identifier, period)
    local key = PeriodKey(period, 0)
    SelectionCache[identifier] = SelectionCache[identifier] or {}
    local c = SelectionCache[identifier][period]
    if c and c.key == key then return c.ids, key end

    local ids = PickTasks(identifier, period, PeriodIndex(period))
    SelectionCache[identifier][period] = { key = key, ids = ids }
    return ids, key
end

-- ------------------------------------------------------------
-- Brojači i pokupljeni zadaci (memorija + baza)
-- ------------------------------------------------------------
local State = {} -- [identifier] = { loaded, loading, counters = {[key]={[type]=v}}, dirty = {[key]={[type]=true}}, claims = {[key]={[id]=true}} }

local function GetState(identifier)
    local s = State[identifier]
    if not s then
        s = { loaded = false, loading = false, counters = {}, dirty = {}, claims = {} }
        State[identifier] = s
    end
    return s
end

local function LoadState(identifier, cb)
    local s = GetState(identifier)
    if s.loaded then if cb then cb(s) end return end

    s.waiting = s.waiting or {}
    if cb then s.waiting[#s.waiting + 1] = cb end
    if s.loading then return end
    s.loading = true

    local keys = { DayKey(0), WeekKey(0) }

    MySQL.query('SELECT period_key, task_type, value FROM flamingo_task_counters WHERE identifier = ? AND period_key IN (?, ?)',
        { identifier, keys[1], keys[2] }, function(rows)
        for _, r in ipairs(rows or {}) do
            s.counters[r.period_key] = s.counters[r.period_key] or {}
            -- ono što je već dodato pre nego što je baza odgovorila ostaje (+)
            s.counters[r.period_key][r.task_type] = (s.counters[r.period_key][r.task_type] or 0) + (tonumber(r.value) or 0)
        end

        MySQL.query('SELECT period_key, task_id FROM flamingo_task_claims WHERE identifier = ? AND period_key IN (?, ?)',
            { identifier, keys[1], keys[2] }, function(crows)
            for _, r in ipairs(crows or {}) do
                s.claims[r.period_key] = s.claims[r.period_key] or {}
                s.claims[r.period_key][r.task_id] = true
            end

            s.loaded, s.loading = true, false
            local waiting = s.waiting or {}
            s.waiting = {}
            for _, fn in ipairs(waiting) do pcall(fn, s) end
        end)
    end)
end

local function SaveState(identifier)
    local s = State[identifier]
    if not s or not s.loaded then return end

    for key, types in pairs(s.dirty) do
        for taskType in pairs(types) do
            local value = (s.counters[key] and s.counters[key][taskType]) or 0
            MySQL.insert('INSERT INTO flamingo_task_counters (identifier, period_key, task_type, value) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
                { identifier, key, taskType, math.floor(value) })
        end
    end
    s.dirty = {}
end

local function GetCounter(s, key, taskType)
    return (s.counters[key] and s.counters[key][taskType]) or 0
end

-- ------------------------------------------------------------
-- Podaci za NUI
-- ------------------------------------------------------------
local function BuildPeriodData(identifier, s, period)
    local ids, key = GetSelection(identifier, period)
    local tasks = {}
    for _, id in ipairs(ids) do
        local t = TaskById[period][id]
        if t then
            local typeCfg = Config.TaskTypes[t.type] or {}
            tasks[#tasks + 1] = {
                id = t.id,
                label = t.label,
                description = t.description,
                icon = t.icon,
                type = t.type,
                unit = typeCfg.unit,
                target = t.target,
                money = t.money or 0,
                progress = math.floor(GetCounter(s, key, t.type)),
                claimed = (s.claims[key] and s.claims[key][t.id]) == true,
            }
        end
    end
    return { key = key, resetIn = SecondsUntilReset(period), tasks = tasks }
end

local function SendTaskData(src, identifier)
    LoadState(identifier, function(s)
        TriggerClientEvent('flamingo_mmenu:receiveTaskData', src, {
            daily = BuildPeriodData(identifier, s, 'daily'),
            weekly = BuildPeriodData(identifier, s, 'weekly'),
            account = Config.Tasks.MoneyAccount,
        })
    end)
end

-- ------------------------------------------------------------
-- Dodavanje napretka
-- ------------------------------------------------------------
local function CheckCompleted(src, identifier, s, taskType, oldValues)
    if not Config.Tasks.NotifyOnComplete then return end
    for _, period in ipairs({ 'daily', 'weekly' }) do
        local ids, key = GetSelection(identifier, period)
        local before = oldValues[key] or 0
        local now = GetCounter(s, key, taskType)
        for _, id in ipairs(ids) do
            local t = TaskById[period][id]
            if t and t.type == taskType and before < t.target and now >= t.target
                and not (s.claims[key] and s.claims[key][id]) then
                TaskNotify(src, ('Zadatak završen: %s! Pokupi $%s u M meniju (Zadaci).'):format(t.label, FormatMoney(t.money)),
                    'success', 'fa-solid fa-circle-check')
                TriggerClientEvent('flamingo_mmenu:taskCompleted', src)
            end
        end
    end
end

local function AddProgressIdentifier(src, identifier, taskType, amount)
    amount = tonumber(amount) or 0
    if amount <= 0 or not identifier then return end
    if not Config.TaskTypes[taskType] then return end

    local s = GetState(identifier)
    local keys = { DayKey(0), WeekKey(0) }
    local oldValues = {}

    for _, key in ipairs(keys) do
        s.counters[key] = s.counters[key] or {}
        oldValues[key] = s.counters[key][taskType] or 0
        s.counters[key][taskType] = oldValues[key] + amount
        s.dirty[key] = s.dirty[key] or {}
        s.dirty[key][taskType] = true
    end

    if s.loaded then
        if src then CheckCompleted(src, identifier, s, taskType, oldValues) end
    else
        LoadState(identifier) -- učita bazu u pozadini; ovaj napredak se samo dodaje na to
    end
end

function FlTasks_Add(src, taskType, amount)
    src = tonumber(src)
    if not src or not ESX then return end
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end
    AddProgressIdentifier(src, xPlayer.identifier, taskType, amount)
end

exports('AddTaskProgress', FlTasks_Add)

-- samo server -> server (klijent ovo NE može da pozove)
AddEventHandler('flamingo_mmenu:addTaskProgress', function(src, taskType, amount)
    FlTasks_Add(src, taskType, amount)
end)

-- ------------------------------------------------------------
-- Klijent javlja pređene metre (vožnja/peške/plivanje/bicikl)
-- ------------------------------------------------------------
local DISTANCE_CAP = { drive = 3000, walk = 300, swim = 120, cycle = 700 } -- max metara po izveštaju (30s)
local lastDistanceReport = {}

RegisterNetEvent('flamingo_mmenu:taskDistance', function(data)
    local src = source
    if type(data) ~= 'table' then return end

    local now = os.time()
    if lastDistanceReport[src] and now - lastDistanceReport[src] < 20 then return end
    lastDistanceReport[src] = now

    for taskType, cap in pairs(DISTANCE_CAP) do
        local meters = tonumber(data[taskType]) or 0
        if meters > 0 then
            FlTasks_Add(src, taskType, math.min(meters, cap))
        end
    end
end)

-- ------------------------------------------------------------
-- NUI zahtevi
-- ------------------------------------------------------------
RegisterNetEvent('flamingo_mmenu:requestTaskData', function()
    local src = source
    local xPlayer = ESX and ESX.GetPlayerFromId(src)
    if not xPlayer then return end
    SendTaskData(src, xPlayer.identifier)
end)

local claimBusy = {}

local function AwaitState(identifier)
    local p = promise.new()
    LoadState(identifier, function(s) p:resolve(s) end)
    return Citizen.Await(p)
end

-- pokupi jedan zadatak (poziva se unutar event-a, pa .await radi)
-- vraća: ok, poruka, iznos
local function ClaimOne(src, identifier, s, period, taskId)
    local ids, key = GetSelection(identifier, period)
    local active = false
    for _, id in ipairs(ids) do if id == taskId then active = true break end end

    local t = TaskById[period][taskId]
    if not active or not t then return false, 'Ovaj zadatak više nije aktivan.' end
    if s.claims[key] and s.claims[key][taskId] then return false, 'Već si pokupio ovu nagradu.' end
    if GetCounter(s, key, t.type) < t.target then return false, 'Zadatak još nije završen.' end

    s.claims[key] = s.claims[key] or {}
    s.claims[key][taskId] = true -- odmah, da dupli klik ne prođe

    -- INSERT IGNORE vraća 0 kad red već postoji -> nema duple isplate
    local affected = MySQL.update.await('INSERT IGNORE INTO flamingo_task_claims (identifier, period_key, task_id) VALUES (?, ?, ?)',
        { identifier, key, taskId })
    if not affected or affected < 1 then return false, 'Već si pokupio ovu nagradu.' end

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return false, 'Igrač nije pronađen.' end

    local money = math.floor(tonumber(t.money) or 0)
    if money > 0 then
        xPlayer.addAccountMoney(Config.Tasks.MoneyAccount or 'money', money, 'Flamingo zadatak')
    end
    return true, t.label, money
end

RegisterNetEvent('flamingo_mmenu:claimTask', function(period, taskId)
    local src = source
    local xPlayer = ESX and ESX.GetPlayerFromId(src)
    if not xPlayer then return end
    if period ~= 'daily' and period ~= 'weekly' then return end
    if type(taskId) ~= 'string' and taskId ~= '*' then return end
    if claimBusy[src] then return end
    claimBusy[src] = true

    local identifier = xPlayer.identifier
    local ok, err = pcall(function()
        local s = AwaitState(identifier)

        -- '*' = pokupi sve završene u ovom periodu
        local list = {}
        if taskId == '*' then
            local ids, key = GetSelection(identifier, period)
            for _, id in ipairs(ids) do
                local t = TaskById[period][id]
                if t and not (s.claims[key] and s.claims[key][id]) and GetCounter(s, key, t.type) >= t.target then
                    list[#list + 1] = id
                end
            end
        else
            list[1] = taskId
        end

        local total, count, lastMsg = 0, 0, 'Nema završenih zadataka.'
        for _, id in ipairs(list) do
            local success, msg, money = ClaimOne(src, identifier, s, period, id)
            if success then
                total = total + (money or 0)
                count = count + 1
                lastMsg = msg
            else
                lastMsg = msg
            end
        end

        if count > 0 then
            if count == 1 then
                TaskNotify(src, ('Pokupio si nagradu za zadatak "%s": $%s'):format(lastMsg, FormatMoney(total)), 'success', 'fa-solid fa-sack-dollar')
            else
                TaskNotify(src, ('Pokupio si %d nagrade za zadatke: $%s'):format(count, FormatMoney(total)), 'success', 'fa-solid fa-sack-dollar')
            end
            TriggerClientEvent('flamingo_mmenu:taskClaimed', src, { success = true, count = count, money = total })
        else
            TriggerClientEvent('flamingo_mmenu:taskClaimed', src, { success = false, message = lastMsg })
        end
    end)

    if not ok then print('[flamingo_mmenu] greška pri preuzimanju zadatka: ' .. tostring(err)) end
    claimBusy[src] = nil
    SendTaskData(src, identifier)
end)

-- ------------------------------------------------------------
-- Učitavanje / čuvanje / čišćenje
-- ------------------------------------------------------------
AddEventHandler('esx:playerLoaded', function(playerId, xPlayer)
    if xPlayer and xPlayer.identifier then LoadState(xPlayer.identifier) end
end)

AddEventHandler('playerDropped', function()
    local src = source
    lastDistanceReport[src] = nil
    claimBusy[src] = nil
    local xPlayer = ESX and ESX.GetPlayerFromId(src)
    if not xPlayer then return end
    SaveState(xPlayer.identifier)
    State[xPlayer.identifier] = nil
    SelectionCache[xPlayer.identifier] = nil
end)

-- čuvanje na svakih 60s + novi dan/nedelja -> izbaci stare ključeve iz memorije
CreateThread(function()
    while true do
        Wait(60000)
        local keep = { [DayKey(0)] = true, [WeekKey(0)] = true }
        for identifier, s in pairs(State) do
            SaveState(identifier)
            for key in pairs(s.counters) do if not keep[key] then s.counters[key] = nil end end
            for key in pairs(s.claims) do if not keep[key] then s.claims[key] = nil end end
        end
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for identifier in pairs(State) do SaveState(identifier) end
end)

CreateThread(function()
    Wait(5000)
    local days = tonumber(Config.Tasks.CleanupDays) or 21
    MySQL.update('DELETE FROM flamingo_task_counters WHERE updated_at < (NOW() - INTERVAL ? DAY)', { days })
    MySQL.update('DELETE FROM flamingo_task_claims WHERE claimed_at < (NOW() - INTERVAL ? DAY)', { days })

    -- restart resursa dok su igrači online
    while ESX == nil do Wait(200) end
    for _, playerId in ipairs(ESX.GetPlayers()) do
        local xPlayer = ESX.GetPlayerFromId(playerId)
        if xPlayer then LoadState(xPlayer.identifier) end
    end
end)

-- /zadatakdodaj [id] [tip] [iznos] - samo za test (konzola ili admin grupa)
RegisterCommand('zadatakdodaj', function(src, args)
    if src ~= 0 then
        local xPlayer = ESX and ESX.GetPlayerFromId(src)
        if not xPlayer or (xPlayer.getGroup() ~= 'admin' and xPlayer.getGroup() ~= 'superadmin') then return end
    end
    local target, taskType, amount = tonumber(args[1]), args[2], tonumber(args[3]) or 1
    if not target or not taskType then
        print('Upotreba: /zadatakdodaj [id igrača] [tip] [iznos]  npr. /zadatakdodaj 1 drive 5000')
        return
    end
    FlTasks_Add(target, taskType, amount)
    print(('[flamingo_mmenu] +%s %s igraču %s'):format(amount, taskType, target))
end, false)
