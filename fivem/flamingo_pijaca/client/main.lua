-- ============================================================
--  flamingo_pijaca - client/main.lua
-- ============================================================

local KEY_INTERACT = 38 -- 'E' (isto dugme koje koristi esx_keyprompt/flamingo_npcdialog)

local npcPed = nil
local myStallId = nil        -- id tezge koju TRENUTNI igrac iznajmljuje, ili nil
local stallOccupied = {}     -- [stallId] = true/false, sinhronizovano sa servera

-- ------------------------------------------------------------
--  Generican RPC sistem ka serveru (radi na svakoj verziji ESX-a)
-- ------------------------------------------------------------

local callbackId = 0
local pendingCallbacks = {}

local function TriggerCallback(eventName, cb, ...)
    callbackId = callbackId + 1
    local id = callbackId
    pendingCallbacks[id] = cb
    TriggerServerEvent(eventName, id, ...)
end

RegisterNetEvent('flamingo_pijaca:client:callback', function(id, ...)
    local cb = pendingCallbacks[id]
    if cb then
        pendingCallbacks[id] = nil
        cb(...)
    end
end)

-- ------------------------------------------------------------
--  Otvaranje NUI panela
-- ------------------------------------------------------------

local function OpenManagePanel(stallId)
    TriggerCallback('flamingo_pijaca:server:requestManage', function(data)
        if not data or data.error then
            if data and data.error then
                TriggerEvent('esx:showNotification', data.error, 'error')
            end
            return
        end

        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'open',
            mode = 'manage',
            stallId = data.stallId,
            stallLabel = data.stallLabel,
            remaining = data.remaining,
            items = data.items,
        })
    end, stallId)
end

local function OpenShopPanel(stallId)
    TriggerCallback('flamingo_pijaca:server:requestShop', function(data)
        if not data or data.error then
            if data and data.error then
                TriggerEvent('esx:showNotification', data.error, 'error')
            end
            return
        end

        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'open',
            mode = 'shop',
            stallId = data.stallId,
            stallLabel = data.stallLabel,
            items = data.items,
        })
    end, stallId)
end

-- ------------------------------------------------------------
--  Sinhronizacija stanja tezgi sa serverom
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:client:syncStalls', function(states)
    for _, s in ipairs(states) do
        stallOccupied[s.id] = s.occupied
    end
end)

RegisterNetEvent('flamingo_pijaca:client:stallRented', function(stallId)
    myStallId = stallId
    stallOccupied[stallId] = true
end)

RegisterNetEvent('flamingo_pijaca:client:stallReleased', function()
    myStallId = nil
end)

RegisterNetEvent('flamingo_pijaca:client:openStash', function(stashId)
    SetNuiFocus(false, false)
    exports.ox_inventory:openInventory('stash', stashId)
end)

CreateThread(function()
    Wait(2000)
    TriggerServerEvent('flamingo_pijaca:server:ready')
end)

-- ------------------------------------------------------------
--  NUI callback-ovi
-- ------------------------------------------------------------

RegisterNUICallback('close', function(_, cb)
    SetNuiFocus(false, false)
    cb('ok')
end)

RegisterNUICallback('savePrices', function(data, cb)
    TriggerServerEvent('flamingo_pijaca:server:setPrices', data.stallId, data.prices)
    cb('ok')
end)

RegisterNUICallback('openStash', function(data, cb)
    SetNuiFocus(false, false)
    TriggerServerEvent('flamingo_pijaca:server:openStashInventory', data.stallId)
    cb('ok')
end)

RegisterNUICallback('releaseStall', function(_, cb)
    SetNuiFocus(false, false)
    TriggerServerEvent('flamingo_pijaca:server:releaseStall')
    cb('ok')
end)

RegisterNUICallback('buyItem', function(data, cb)
    TriggerServerEvent('flamingo_pijaca:server:buyItem', data.stallId, data.item, data.count)
    cb('ok')
end)

-- ------------------------------------------------------------
--  Spawn NPC-a
-- ------------------------------------------------------------

CreateThread(function()
    local model = Config.Npc.model
    RequestModel(model)

    local tries = 0
    while not HasModelLoaded(model) and tries < 200 do
        Wait(10)
        tries = tries + 1
    end

    if not HasModelLoaded(model) then return end

    local c = Config.Npc.coords
    npcPed = CreatePed(4, model, c.x, c.y, c.z - 1.0, c.w, false, true)

    FreezeEntityPosition(npcPed, true)
    SetEntityInvincible(npcPed, true)
    SetBlockingOfNonTemporaryEvents(npcPed, true)
    SetPedDiesWhenInjured(npcPed, false)
    SetPedCanRagdollFromPlayerImpact(npcPed, false)

    if Config.Npc.scenario then
        TaskStartScenarioInPlace(npcPed, Config.Npc.scenario, 0, true)
    end

    SetModelAsNoLongerNeeded(model)
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    if npcPed and DoesEntityExist(npcPed) then
        DeleteEntity(npcPed)
    end
end)

-- ------------------------------------------------------------
--  Interakcija sa NPC-em (iznajmljivanje)
-- ------------------------------------------------------------

CreateThread(function()
    local npcCoords = vector3(Config.Npc.coords.x, Config.Npc.coords.y, Config.Npc.coords.z)

    while true do
        local sleep = 800
        local pcoords = GetEntityCoords(PlayerPedId())
        local dist = #(pcoords - npcCoords)

        if dist < Config.Npc.interactDistance then
            sleep = 0
            TriggerEvent('esx:showHelpNotification', 'Pritisni ~INPUT_CONTEXT~ da razgovaras', true)

            if IsControlJustReleased(0, KEY_INTERACT) then
                TriggerCallback('flamingo_pijaca:server:getRentMenu', function(tree)
                    if tree then
                        exports['flamingo_npcdialog']:OpenDialog({
                            ped = npcPed,
                            name = Config.Npc.name,
                            title = 'Pijaca\nIznajmljivanje tezgi',
                            tree = tree,
                        })
                    end
                end)
            end
        end

        Wait(sleep)
    end
end)

-- ------------------------------------------------------------
--  Interakcija sa tezgama (vlasnik / kupac)
-- ------------------------------------------------------------

CreateThread(function()
    while true do
        local sleep = 800
        local pcoords = GetEntityCoords(PlayerPedId())

        for _, stall in ipairs(Config.Stalls) do
            local sc = vector3(stall.coords.x, stall.coords.y, stall.coords.z)
            local dist = #(pcoords - sc)

            if dist < Config.StallInteractDistance then
                sleep = 0

                if myStallId == stall.id then
                    TriggerEvent('esx:showHelpNotification', ('Pritisni ~INPUT_CONTEXT~ da upravljas sa %s'):format(stall.label), true)

                    if IsControlJustReleased(0, KEY_INTERACT) then
                        OpenManagePanel(stall.id)
                    end
                elseif stallOccupied[stall.id] then
                    TriggerEvent('esx:showHelpNotification', ('Pritisni ~INPUT_CONTEXT~ da pogledas ponudu (%s)'):format(stall.label), true)

                    if IsControlJustReleased(0, KEY_INTERACT) then
                        OpenShopPanel(stall.id)
                    end
                else
                    TriggerEvent('esx:showHelpNotification', ('%s je slobodna - iznajmi je kod prodavca na pijaci.'):format(stall.label), true)
                end
            end
        end

        Wait(sleep)
    end
end)
