-- ============================================================
--  flamingo_pijaca - client/main.lua
-- ============================================================

local KEY_INTERACT = 38 -- 'E'

local npcPed = nil
local stallStates = {} -- [stallId] = { occupied, mine, expiresAt (GetGameTimer) }
local uiOpen = false
local reopenStashId = nil -- stash koji se ponovo otvara kad se UI zatvori bez potvrde

-- ------------------------------------------------------------
--  Generican RPC sistem ka serveru
-- ------------------------------------------------------------

local callbackId = 0
local pendingCallbacks = {}

local function TriggerCallback(eventName, cb, ...)
    callbackId = callbackId + 1
    pendingCallbacks[callbackId] = cb
    TriggerServerEvent(eventName, callbackId, ...)
end

RegisterNetEvent('flamingo_pijaca:client:callback', function(id, ...)
    local cb = pendingCallbacks[id]
    if cb then
        pendingCallbacks[id] = nil
        cb(...)
    end
end)

-- ------------------------------------------------------------
--  ox_inventory / NUI
-- ------------------------------------------------------------

local function OpenStash(stashId)
    exports.ox_inventory:openInventory('stash', stashId)
end

local function OpenUi(payload, stashToReopen)
    -- sacekaj da ox_inventory zavrsi odgovor na (otkazano) prevlacenje, pa ga zatvori
    Wait(100)
    exports.ox_inventory:closeInventory()

    uiOpen = true
    reopenStashId = stashToReopen
    SetNuiFocus(true, true)
    SendNUIMessage(payload)
end

local function CloseUi(reopen)
    uiOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })

    local stashId = reopenStashId
    reopenStashId = nil

    if reopen and stashId then
        Wait(50)
        OpenStash(stashId)
    end
end

RegisterNetEvent('flamingo_pijaca:client:openRent', function(data)
    Wait(250) -- da se flamingo_npcdialog zatvori i pusti fokus
    data.action = 'open'
    data.mode = 'rent'
    OpenUi(data, nil)
end)

RegisterNetEvent('flamingo_pijaca:client:askPrice', function(data)
    data.action = 'open'
    data.mode = 'price'
    OpenUi(data, Config.StallStashId(data.stallId))
end)

RegisterNetEvent('flamingo_pijaca:client:askBuy', function(data)
    data.action = 'open'
    data.mode = 'buy'
    OpenUi(data, Config.StallStashId(data.stallId))
end)

RegisterNetEvent('flamingo_pijaca:client:openStash', function(stashId)
    if uiOpen then CloseUi(false) end
    Wait(50)
    OpenStash(stashId)
end)

RegisterNUICallback('close', function(_, cb)
    cb('ok')
    CloseUi(true)
end)

RegisterNUICallback('confirmRent', function(data, cb)
    cb('ok')
    CloseUi(false)
    TriggerServerEvent('flamingo_pijaca:server:rentStall', data.stallId, data.hours)
end)

RegisterNUICallback('confirmPrice', function(data, cb)
    cb('ok')
    reopenStashId = nil -- server ponovo otvara tezgu kad zavrsi
    CloseUi(false)
    TriggerServerEvent('flamingo_pijaca:server:listItem', data.stallId, data.slot, data.name, data.count, data.price)
end)

RegisterNUICallback('confirmBuy', function(data, cb)
    cb('ok')
    reopenStashId = nil
    CloseUi(false)
    TriggerServerEvent('flamingo_pijaca:server:buyItem', data.stallId, data.slot, data.name, data.count, data.price)
end)

-- ------------------------------------------------------------
--  Sinhronizacija stanja tezgi sa serverom
-- ------------------------------------------------------------

RegisterNetEvent('flamingo_pijaca:client:syncStalls', function(states)
    local now = GetGameTimer()
    stallStates = {}
    for _, s in ipairs(states) do
        stallStates[s.id] = {
            occupied = s.occupied,
            mine = s.mine,
            expiresAt = s.remaining and (now + s.remaining * 1000) or nil,
        }
    end
end)

CreateThread(function()
    Wait(2000)
    TriggerServerEvent('flamingo_pijaca:server:ready')
end)

local function FormatRemaining(expiresAt)
    local seconds = math.max(0, math.floor((expiresAt - GetGameTimer()) / 1000))
    return ('%dh %dmin'):format(math.floor(seconds / 3600), math.floor((seconds % 3600) / 60))
end

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
    if uiOpen then
        SetNuiFocus(false, false)
    end
end)

-- ------------------------------------------------------------
--  Interakcija sa NPC-em (iznajmljivanje)
-- ------------------------------------------------------------

local function CanInteract()
    return not uiOpen and not LocalPlayer.state.invOpen
end

CreateThread(function()
    local npcCoords = vector3(Config.Npc.coords.x, Config.Npc.coords.y, Config.Npc.coords.z)

    while true do
        local sleep = 800
        local dist = #(GetEntityCoords(PlayerPedId()) - npcCoords)

        if dist < Config.Npc.interactDistance and CanInteract() then
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
--  Interakcija sa tezgama - E otvara ox_inventory tezge
-- ------------------------------------------------------------

CreateThread(function()
    while true do
        local sleep = 800
        local pcoords = GetEntityCoords(PlayerPedId())

        for _, stall in ipairs(Config.Stalls) do
            local sc = vector3(stall.coords.x, stall.coords.y, stall.coords.z)

            if #(pcoords - sc) < Config.StallInteractDistance and CanInteract() then
                sleep = 0
                local state = stallStates[stall.id]

                if state and state.mine then
                    local left = state.expiresAt and (' (%s)'):format(FormatRemaining(state.expiresAt)) or ''
                    TriggerEvent('esx:showHelpNotification', ('Pritisni ~INPUT_CONTEXT~ da otvoris svoju tezgu%s'):format(left), true)

                    if IsControlJustReleased(0, KEY_INTERACT) then
                        OpenStash(Config.StallStashId(stall.id))
                    end
                elseif state and state.occupied then
                    TriggerEvent('esx:showHelpNotification', ('Pritisni ~INPUT_CONTEXT~ da pogledas ponudu (%s)'):format(stall.label), true)

                    if IsControlJustReleased(0, KEY_INTERACT) then
                        OpenStash(Config.StallStashId(stall.id))
                    end
                else
                    TriggerEvent('esx:showHelpNotification', ('%s je slobodna - iznajmi je kod zakupca pijace.'):format(stall.label), true)
                end
            end
        end

        Wait(sleep)
    end
end)
