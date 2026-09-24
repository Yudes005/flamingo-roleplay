-- ============================================================
--  flamingo_biznisi - client
--  Nema markera ni posebnog menija: sve o biznisu (vlasnik, cena, provizija,
--  kupovina) vidi se u meniju bankomata (flamingo_banke, kategorija "Biznis").
--  Ovde su samo: blip za moj biznis, tacna pozicija bankomata i admin komanda.
-- ============================================================

local businesses = {}   -- [id] = { id, name, x, y, z, owned, calibrated }
local mine       = {}   -- [id] = true
local blips      = {}
local reported   = {}   -- [id] = true (tacna pozicija vec poslata serveru)

local function notify(msg, nType)
    exports['esx_notify']:Notify(msg, nType or 'info', 4500, Config.NotifyTitle, Config.NotifyIcon)
end

RegisterNetEvent('flamingo_biznisi:notify', function(msg, nType)
    notify(msg, nType)
end)

-- ============================================================
--  Blip (samo moj biznis)
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
    businesses = {}
    for _, b in ipairs(list or {}) do businesses[b.id] = b end

    mine = {}
    for _, id in ipairs(myIds or {}) do mine[id] = true end
    refreshBlips()
end)

CreateThread(function()
    while not ESX.IsPlayerLoaded or not ESX.IsPlayerLoaded() do Wait(500) end
    TriggerServerEvent('flamingo_biznisi:server:requestSync')
end)

-- ============================================================
--  Tacna pozicija bankomata
--  Koordinate u configu su priblizne; kad igrac dodje blizu, nadjemo pravi
--  bankomat (prop) i javimo serveru njegovu poziciju, da bi flamingo_banke
--  tacno znao koji bankomat je koji biznis.
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

CreateThread(function()
    while true do
        local pos = GetEntityCoords(PlayerPedId())
        for id, b in pairs(businesses) do
            if not b.calibrated and not reported[id] then
                local c = vector3(b.x, b.y, b.z)
                if #(pos - c) < 60.0 then
                    local obj = closestAtm(c, Config.ATM.snapRadius)
                    if obj ~= 0 then
                        reported[id] = true
                        TriggerServerEvent('flamingo_biznisi:server:calibrate', id, GetEntityCoords(obj))
                    end
                end
            end
        end
        Wait(2000)
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
    for _, blip in pairs(blips) do RemoveBlip(blip) end
end)
