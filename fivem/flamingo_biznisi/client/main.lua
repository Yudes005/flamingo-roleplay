-- ============================================================
--  flamingo_biznisi - client
--  Marker "Biznis" ispred svakog bankomata koji je biznis + meni sa detaljima.
-- ============================================================

local businesses = {}   -- [id] = { id, name, x, y, z, owned, type }
local mine       = {}   -- [id] = true
local points     = {}   -- [id] = { marker = vector3, atm = vector3|nil, tries = n }
local blips      = {}

local isOpen      = false
local openPos     = nil
local busy        = false
local nearbyId    = nil
local shownPrompt = false

-- ============================================================
--  esx_notify / esx_keyprompt
-- ============================================================
local function notify(msg, nType)
    exports['esx_notify']:Notify(msg, nType or 'info', 4500, Config.NotifyTitle, Config.NotifyIcon)
end

RegisterNetEvent('flamingo_biznisi:notify', function(msg, nType)
    notify(msg, nType)
end)

local function setPrompt(show)
    if show == shownPrompt then return end
    shownPrompt = show
    if show then
        exports['esx_keyprompt']:ShowKeyPrompt('Da pogledaš biznis', 'E')
    else
        exports['esx_keyprompt']:HideKeyPrompt()
    end
end

-- ============================================================
--  Blipovi (samo moji biznisi)
-- ============================================================
local function refreshBlips()
    for _, blip in pairs(blips) do RemoveBlip(blip) end
    blips = {}
    if not Config.Blip.enabled then return end

    for id in pairs(mine) do
        local b = businesses[id]
        if b then
            local blip = AddBlipForCoord(b.x, b.y, b.z)
            SetBlipSprite(blip, Config.Blip.sprite)
            SetBlipColour(blip, Config.Blip.color)
            SetBlipScale(blip, Config.Blip.scale)
            SetBlipAsShortRange(blip, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentString(('%s: %s'):format(Config.Blip.label, b.name))
            EndTextCommandSetBlipName(blip)
            blips[id] = blip
        end
    end
end

RegisterNetEvent('flamingo_biznisi:client:sync', function(list, myIds)
    local fresh = {}
    for _, b in ipairs(list or {}) do
        fresh[b.id] = b
        local old = businesses[b.id]
        if old and (old.x ~= b.x or old.y ~= b.y or old.z ~= b.z) then points[b.id] = nil end
    end
    for id in pairs(points) do
        if not fresh[id] then points[id] = nil end
    end
    businesses = fresh

    mine = {}
    for _, id in ipairs(myIds or {}) do mine[id] = true end
    refreshBlips()
end)

CreateThread(function()
    while not ESX.IsPlayerLoaded or not ESX.IsPlayerLoaded() do Wait(500) end
    TriggerServerEvent('flamingo_biznisi:server:requestSync')
end)

-- ============================================================
--  Pozicija markera: nadji pravi bankomat i stavi marker ispred njega
-- ============================================================
local function closestAtm(pos, radius)
    local best, bestDist = 0, nil
    for _, model in ipairs(Config.ATM.models) do
        local obj = GetClosestObjectOfType(pos.x, pos.y, pos.z, radius, model, false, false, false)
        if obj ~= 0 then
            local d = #(GetEntityCoords(obj) - pos)
            if not bestDist or d < bestDist then best, bestDist = obj, d end
        end
    end
    return best
end

local function resolvePoint(b)
    local p = points[b.id]
    if p and (p.atm or p.tries >= 240) then return p end

    local c = vector3(b.x, b.y, b.z)
    local obj = closestAtm(c, Config.ATM.snapRadius)
    p = p or { marker = c, tries = 0 }

    if obj ~= 0 then
        local off = Config.ATM.offset
        local m = GetOffsetFromEntityInWorldCoords(obj, off.x, off.y, off.z)
        local atmPos = GetEntityCoords(obj)
        local found, groundZ = GetGroundZFor_3dCoord(m.x, m.y, atmPos.z + 1.0, false)
        p.marker = vector3(m.x, m.y, found and groundZ or atmPos.z)
        p.atm = atmPos
        if not b.calibrated then
            TriggerServerEvent('flamingo_biznisi:server:calibrate', b.id, atmPos)
        end
    else
        p.tries = p.tries + 1 -- objekat se mozda jos nije ucitao (stream), probamo ponovo
    end

    points[b.id] = p
    return p
end

-- ============================================================
--  Crtanje
-- ============================================================
local function text3d(x, y, z, text, scale, r, g, b, a)
    SetDrawOrigin(x, y, z, 0)
    SetTextScale(0.0, scale)
    SetTextFont(4)
    SetTextProportional(true)
    SetTextColour(r, g, b, a)
    SetTextCentre(true)
    SetTextOutline()
    BeginTextCommandDisplayText('STRING')
    AddTextComponentSubstringPlayerName(text)
    EndTextCommandDisplayText(0.0, 0.0)
    ClearDrawOrigin()
end

local COLORS = {
    sale  = { 48, 209, 88 },    -- na prodaju (zeleno)
    mine  = { 255, 77, 148 },   -- moj (flamingo roze)
    owned = { 100, 170, 255 },  -- tudji (plavo)
}

-- Razdaljina po zemlji (bez visine): pozicija igraca je ~1m iznad zemlje, a marker je na zemlji
local function flatDist(a, b)
    local dx, dy = a.x - b.x, a.y - b.y
    return math.sqrt(dx * dx + dy * dy), math.abs(a.z - b.z)
end

local function drawPoint(b, p, dist)
    local col = mine[b.id] and COLORS.mine or (b.owned and COLORS.owned or COLORS.sale)
    local m = p.marker
    local alpha = math.floor(math.max(60, 200 - dist * 10))

    DrawMarker(25, m.x, m.y, m.z + 0.03, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.85, 0.85, 0.85,
        col[1], col[2], col[3], alpha, false, false, 2, false, nil, nil, false)
    DrawMarker(29, m.x, m.y, m.z + 0.95, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.42, 0.42, 0.42,
        col[1], col[2], col[3], alpha, true, true, 2, true, nil, nil, false)

    if dist < 7.0 then
        local status = mine[b.id] and 'Tvoj biznis' or (b.owned and 'Ima vlasnika' or 'Na prodaju')
        text3d(m.x, m.y, m.z + 1.45, 'BIZNIS', 0.42, col[1], col[2], col[3], 255)
        text3d(m.x, m.y, m.z + 1.30, ('%s  ·  %s'):format(b.name, status), 0.30, 255, 255, 255, 225)
    end
end

-- ============================================================
--  Meni (NUI)
-- ============================================================
local function streetOf(x, y, z)
    local s1, s2 = GetStreetNameAtCoord(x, y, z)
    local street = GetStreetNameFromHashKey(s1)
    local cross  = s2 ~= 0 and GetStreetNameFromHashKey(s2) or nil
    local zone   = GetLabelText(GetNameOfZone(x, y, z))
    if zone == 'NULL' then zone = nil end
    return street .. ((cross and cross ~= '') and (' / ' .. cross) or ''), zone
end

local function closeMenu()
    if not isOpen then return end
    isOpen, openPos = false, nil
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

local function openMenu(id)
    if isOpen or busy then return end
    busy = true
    setPrompt(false)

    ESX.TriggerServerCallback('flamingo_biznisi:info', function(info)
        busy = false
        if not info or not info.ok then
            return notify((info and info.msg) or 'Biznis trenutno nije dostupan.', 'error')
        end

        local b = businesses[id]
        local street, zone = streetOf(b.x, b.y, b.z)
        info.street, info.zone = street, zone

        isOpen  = true
        openPos = GetEntityCoords(PlayerPedId())
        SetNuiFocus(true, true)
        SendNUIMessage({ action = 'open', data = info })
    end, id)
end

RegisterNUICallback('close', function(_, cb)
    closeMenu()
    cb('ok')
end)

RegisterNUICallback('buy', function(data, cb)
    ESX.TriggerServerCallback('flamingo_biznisi:buy', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then notify(res.msg, res.ok and 'success' or 'error') end
        if res.ok then
            local b = businesses[res.id]
            if b then
                local street, zone = streetOf(b.x, b.y, b.z)
                res.street, res.zone = street, zone
            end
        end
        cb(res)
    end, type(data) == 'table' and data.id or nil)
end)

-- ============================================================
--  Glavna petlja: blizina, marker, prompt, taster E
-- ============================================================
local near = {} -- lista { b, p } u blizini (osvezava se na 500ms)

CreateThread(function()
    while true do
        local pos = GetEntityCoords(PlayerPedId())
        local list = {}
        for _, b in pairs(businesses) do
            local d = #(pos - vector3(b.x, b.y, b.z))
            if d < 60.0 then
                local p = resolvePoint(b)
                if #(pos - p.marker) <= Config.DrawDistance then
                    list[#list + 1] = { b = b, p = p }
                end
            end
        end
        near = list
        Wait(500)
    end
end)

CreateThread(function()
    while true do
        if #near == 0 or isOpen then
            nearbyId = nil
            setPrompt(false)
            Wait(400)
        else
            local ped = PlayerPedId()
            local pos = GetEntityCoords(ped)
            local canUse = not IsPedInAnyVehicle(ped, false) and not IsEntityDead(ped)
            local found

            for _, e in ipairs(near) do
                local dist, height = flatDist(pos, e.p.marker)
                drawPoint(e.b, e.p, dist)
                if canUse and not found and dist <= Config.InteractDistance and height < 2.5 then
                    -- ne smetaj banci: ako stojis na samom bankomatu, E je za bankomat
                    if not e.p.atm or flatDist(pos, e.p.atm) > Config.ATM.blockNearAtm then
                        found = e.b.id
                    end
                end
            end

            nearbyId = found
            setPrompt(found ~= nil and not busy)
            if found and not busy and IsControlJustReleased(0, Config.InteractKey) then
                openMenu(found)
            end
            Wait(0)
        end
    end
end)

-- Auto zatvaranje menija (udaljio se / umro)
CreateThread(function()
    while true do
        if isOpen then
            local ped = PlayerPedId()
            if IsEntityDead(ped) or (openPos and #(GetEntityCoords(ped) - openPos) > 4.0) then
                closeMenu()
            end
            Wait(500)
        else
            Wait(1000)
        end
    end
end)

-- ============================================================
--  Admin: /biznis_dodaj -> uzmi pravi bankomat ispred igraca
-- ============================================================
RegisterNetEvent('flamingo_biznisi:client:pickAtm', function(price)
    local pos = GetEntityCoords(PlayerPedId())
    local obj = closestAtm(pos, 3.0)
    if obj == 0 then
        return notify('Nema bankomata u blizini. Stani ispred bankomata.', 'error')
    end
    TriggerServerEvent('flamingo_biznisi:server:addAtm', GetEntityCoords(obj), price)
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if isOpen then SetNuiFocus(false, false) end
    if shownPrompt then exports['esx_keyprompt']:HideKeyPrompt() end
    for _, blip in pairs(blips) do RemoveBlip(blip) end
end)
