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

-- ============================================================
--  Prodaja biznisa igracu (radial meni G -> "Prodaj biznis")
-- ============================================================
local nuiOpen = nil   -- 'sell' | 'offer' | nil

-- exports['flamingo_biznisi']:HasBusiness() -> radial prikazuje "Prodaj biznis" samo vlasniku
exports('HasBusiness', function()
    return next(mine) ~= nil
end)

local function nearbyPlayers()
    local list = {}
    local myPed = PlayerPedId()
    local myPos = GetEntityCoords(myPed)
    for _, pid in ipairs(GetActivePlayers()) do
        local ped = GetPlayerPed(pid)
        if ped ~= myPed and DoesEntityExist(ped) then
            local d = #(myPos - GetEntityCoords(ped))
            if d <= Config.PlayerSale.distance then
                list[#list + 1] = { id = GetPlayerServerId(pid), dist = math.floor(d * 10 + 0.5) / 10 }
            end
        end
    end
    table.sort(list, function(a, b) return a.dist < b.dist end)
    return list
end

local function closeNui()
    if not nuiOpen then return end
    nuiOpen = nil
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

local function openSellMenu()
    if nuiOpen then return end
    ESX.TriggerServerCallback('flamingo_biznisi:sellInfo', function(info)
        if not info or not info.ok then
            return notify((info and info.msg) or 'Nemaš biznis.', 'error')
        end
        info.players = nearbyPlayers()
        nuiOpen = 'sell'
        SetNuiFocus(true, true)
        SendNUIMessage({ action = 'sell', data = info })
    end)
end
exports('OpenSellMenu', openSellMenu)

RegisterNUICallback('refreshPlayers', function(_, cb)
    cb(nearbyPlayers())
end)

RegisterNUICallback('sellOffer', function(data, cb)
    cb('ok')
    closeNui()
    if type(data) ~= 'table' then return end
    TriggerServerEvent('flamingo_biznisi:server:sellOffer', data.target, data.price)
end)

RegisterNetEvent('flamingo_biznisi:client:offer', function(offer)
    if nuiOpen == 'sell' then closeNui() end
    nuiOpen = 'offer'
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'offer', data = offer })
end)

RegisterNetEvent('flamingo_biznisi:client:offerClosed', function(id)
    SendNUIMessage({ action = 'offerClosed', id = id })
    if nuiOpen == 'offer' then closeNui() end
end)

RegisterNUICallback('offerResponse', function(data, cb)
    cb('ok')
    closeNui()
    if type(data) ~= 'table' then return end
    TriggerServerEvent('flamingo_biznisi:server:offerResponse', data.id, data.accepted == true)
end)

RegisterNUICallback('close', function(_, cb)
    cb('ok')
    closeNui()
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for _, blip in pairs(blips) do RemoveBlip(blip) end
    if nuiOpen then SetNuiFocus(false, false) end
end)
