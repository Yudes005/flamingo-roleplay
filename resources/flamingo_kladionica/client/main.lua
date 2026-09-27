local isOpen = false
local peds = {}
local blips = {}

local function useTarget()
    if Config.Interaction == 'target' then return true end
    if Config.Interaction == 'textui' then return false end
    return GetResourceState('ox_target') == 'started'
end

local function notify(description, nType)
    lib.notify({ title = 'Kladionica', description = description, type = nType or 'inform' })
end

local function setFocus(state)
    isOpen = state
    SetNuiFocus(state, state)
end

local function openBetshop(tab)
    if isOpen then return end
    local offer = lib.callback.await('kladionica:getOffer', false)
    if not offer then
        return notify('Kladionica trenutno nije dostupna.', 'error')
    end
    setFocus(true)
    SendNUIMessage({ action = 'open', offer = offer, tab = tab or 'offer' })
end

-- Korištenje papirnog tiketa iz inventara (ox_inventory: client.export = 'flamingo_kladionica.useTicket')
exports('useTicket', function(data, slot)
    local metadata = (slot and slot.metadata) or (data and data.metadata) or {}
    if not metadata.code then
        return notify('Ovaj tiket je nečitljiv.', 'error')
    end
    local ticket = lib.callback.await('kladionica:getTicket', false, metadata.code)
    if not ticket then
        return notify('Tiket nije pronađen u sistemu.', 'error')
    end
    setFocus(true)
    SendNUIMessage({ action = 'ticket', ticket = ticket, currency = Config.Currency })
end)

--------------------------------------------------------------------------------
-- NUI
--------------------------------------------------------------------------------

RegisterNUICallback('close', function(_, cb)
    setFocus(false)
    cb('ok')
end)

RegisterNUICallback('refresh', function(_, cb)
    cb(lib.callback.await('kladionica:getOffer', false) or false)
end)

RegisterNUICallback('placeBet', function(data, cb)
    local res = lib.callback.await('kladionica:placeBet', false, data) or { ok = false, message = 'Greška.' }
    if res.ok then
        notify(('Tiket %s uplaćen. Tiket je u tvom inventaru.'):format(res.code), 'success')
    end
    cb(res)
end)

RegisterNUICallback('getTickets', function(_, cb)
    cb(lib.callback.await('kladionica:getMyTickets', false) or {})
end)

RegisterNUICallback('payout', function(data, cb)
    local res = lib.callback.await('kladionica:payout', false, data.code) or { ok = false, message = 'Greška.' }
    if res.ok then
        notify(('Isplaćeno %s%s. Čestitamo!'):format(Config.Currency, res.amount), 'success')
    end
    cb(res)
end)

RegisterNUICallback('discard', function(data, cb)
    cb(lib.callback.await('kladionica:discard', false, data.code) or false)
end)

--------------------------------------------------------------------------------
-- NPC i blip
--------------------------------------------------------------------------------

local function spawnPed(index, loc)
    if peds[index] and DoesEntityExist(peds[index]) then return end
    local model = joaat(loc.ped or 'a_m_y_business_03')
    lib.requestModel(model, 10000)

    local c = loc.coords
    local found, groundZ = GetGroundZFor_3dCoord(c.x, c.y, c.z + 1.0, false)
    local ped = CreatePed(4, model, c.x, c.y, found and groundZ or (c.z - 1.0), c.w, false, true)
    SetModelAsNoLongerNeeded(model)

    FreezeEntityPosition(ped, true)
    SetEntityInvincible(ped, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetPedCanRagdoll(ped, false)
    if Config.PedScenario then
        TaskStartScenarioInPlace(ped, Config.PedScenario, 0, true)
    end

    if useTarget() then
        exports.ox_target:addLocalEntity(ped, {
            {
                name = 'kladionica_open',
                icon = 'fa-solid fa-futbol',
                label = 'Kladionica - ponuda',
                distance = 2.5,
                onSelect = function() openBetshop('offer') end,
            },
            {
                name = 'kladionica_tickets',
                icon = 'fa-solid fa-ticket',
                label = 'Moji tiketi / isplata',
                distance = 2.5,
                onSelect = function() openBetshop('tickets') end,
            },
        })
    end

    peds[index] = ped
end

local function deletePed(index)
    local ped = peds[index]
    if ped and DoesEntityExist(ped) then
        if useTarget() then
            exports.ox_target:removeLocalEntity(ped, { 'kladionica_open', 'kladionica_tickets' })
        end
        DeleteEntity(ped)
    end
    peds[index] = nil
end

CreateThread(function()
    for index, loc in ipairs(Config.Locations) do
        local c = loc.coords

        if loc.blip ~= false then
            local blip = AddBlipForCoord(c.x, c.y, c.z)
            SetBlipSprite(blip, Config.Blip.sprite)
            SetBlipColour(blip, Config.Blip.color)
            SetBlipScale(blip, Config.Blip.scale)
            SetBlipAsShortRange(blip, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentSubstringPlayerName(Config.Blip.label)
            EndTextCommandSetBlipName(blip)
            blips[#blips + 1] = blip
        end

        local spawnPoint = lib.points.new({ coords = c.xyz, distance = 50.0 })
        function spawnPoint:onEnter() spawnPed(index, loc) end
        function spawnPoint:onExit() deletePed(index) end

        if not useTarget() then
            local interactPoint = lib.points.new({ coords = c.xyz, distance = Config.InteractDistance })
            function interactPoint:onEnter()
                lib.showTextUI('[E] Kladionica', { icon = 'futbol' })
            end
            function interactPoint:onExit()
                lib.hideTextUI()
            end
            function interactPoint:nearby()
                if not isOpen and IsControlJustReleased(0, 38) then
                    openBetshop('offer')
                end
            end
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    for index in pairs(peds) do deletePed(index) end
    for _, blip in ipairs(blips) do RemoveBlip(blip) end
    if isOpen then SetNuiFocus(false, false) end
    lib.hideTextUI()
end)
