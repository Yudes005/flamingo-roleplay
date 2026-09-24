local isOpen   = false
local openPos  = nil
local nearby   = nil   -- 'bank' | 'atm' | nil
local busy     = false
local shownPrompt = nil -- koji prompt je trenutno prikazan ('bank' | 'atm' | nil)

-- ============================================================
--  esx_notify + esx_keyprompt
-- ============================================================
local function notify(msg, nType, icon)
    exports['esx_notify']:Notify(msg, nType or 'info', 4000, Config.NotifyTitle, icon or Config.NotifyIcon)
end

RegisterNetEvent('flamingo_banke:notify', function(msg, nType, icon)
    notify(msg, nType, icon)
end)

local function setPrompt(kind)
    if kind == shownPrompt then return end
    shownPrompt = kind
    if kind then
        exports['esx_keyprompt']:ShowKeyPrompt(kind == 'bank' and Config.PromptBank or Config.PromptATM, 'E')
    else
        exports['esx_keyprompt']:HideKeyPrompt()
    end
end

-- ============================================================
--  Blipovi
-- ============================================================
CreateThread(function()
    if not Config.Blip.enabled then return end
    for _, b in ipairs(Config.Banks) do
        local blip = AddBlipForCoord(b.coords.x, b.coords.y, b.coords.z)
        SetBlipSprite(blip, Config.Blip.sprite)
        SetBlipColour(blip, Config.Blip.color)
        SetBlipScale(blip, Config.Blip.scale)
        SetBlipAsShortRange(blip, true)
        BeginTextCommandSetBlipName('STRING')
        AddTextComponentString(Config.Blip.label)
        EndTextCommandSetBlipName(blip)
    end
end)

-- ============================================================
--  Otvaranje / zatvaranje
-- ============================================================
local function closeBank()
    if not isOpen then return end
    isOpen  = false
    openPos = nil
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
    TriggerServerEvent('flamingo_banke:close')
end

local function openBank(kind)
    if isOpen or busy then return end
    busy = true
    setPrompt(nil)

    ESX.TriggerServerCallback('flamingo_banke:open', function(data)
        busy = false
        if not data then
            notify('Banka trenutno nije dostupna.', 'error')
            return
        end

        if data.noAccount and data.kind == 'atm' then
            notify('Nemaš bankovnu karticu. Prvo otvori račun na šalteru banke.', 'error')
            return
        end

        -- flamingo_misije (misija 6): igrac sa vec otvorenim racunom na salteru
        if data.kind == 'bank' and data.hasAccount then
            TriggerEvent('flamingo_misije:client:bankAccountReady')
        end

        isOpen  = true
        openPos = GetEntityCoords(PlayerPedId())
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = 'open',
            data   = data,
            config = {
                quick       = Config.QuickAmounts,
                atm         = Config.ATM,
                fee         = Config.TransferFee,
                maxTransfer = Config.MaxTransfer,
                statsDays   = Config.StatsDays,
                fines       = Config.Fines
            }
        })
    end, kind)
end

-- ============================================================
--  NUI callbacks
-- ============================================================
RegisterNUICallback('close', function(_, cb)
    closeBank()
    cb('ok')
end)

RegisterNUICallback('openAccount', function(_, cb)
    ESX.TriggerServerCallback('flamingo_banke:openAccount', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then
            notify(res.msg, res.ok and 'success' or 'error')
        end

        -- flamingo_misije (misija 6): racun uspesno otvoren
        if res.ok then
            TriggerEvent('flamingo_misije:client:bankAccountReady')
        end

        cb(res)
    end)
end)

RegisterNUICallback('action', function(payload, cb)
    ESX.TriggerServerCallback('flamingo_banke:action', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then
            notify(res.msg, res.ok and 'success' or 'error')
        end

        -- flamingo_misije (misija 6): uplata na salteru (iznos potvrdio server)
        if res.ok and res.depositedAmount then
            TriggerEvent('flamingo_misije:client:bankDeposit', res.depositedAmount)
        end

        cb(res)
    end, payload)
end)

RegisterNUICallback('getFines', function(_, cb)
    ESX.TriggerServerCallback('flamingo_banke:getFines', function(list)
        cb(list or {})
    end)
end)

RegisterNUICallback('payFine', function(data, cb)
    local id = type(data) == 'table' and data.id or data
    ESX.TriggerServerCallback('flamingo_banke:payFine', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then notify(res.msg, res.ok and 'success' or 'error') end
        cb(res)
    end, id)
end)

-- ============================================================
--  Detekcija banke / bankomata (sporiji thread)
-- ============================================================
CreateThread(function()
    while true do
        local found = nil

        if not isOpen then
            local ped = PlayerPedId()
            local pos = GetEntityCoords(ped)

            if not IsPedInAnyVehicle(ped, false) and not IsEntityDead(ped) then
                for _, b in ipairs(Config.Banks) do
                    if #(pos - b.coords) <= Config.InteractDistance then
                        found = 'bank'
                        break
                    end
                end

                if not found and Config.EnableATMs then
                    for _, model in ipairs(Config.ATMModels) do
                        if GetClosestObjectOfType(pos.x, pos.y, pos.z, Config.ATMDistance, model, false, false, false) ~= 0 then
                            found = 'atm'
                            break
                        end
                    end
                end
            end
        end

        nearby = found
        Wait(400)
    end
end)

-- ============================================================
--  Prompt (esx_keyprompt) + taster E
-- ============================================================
CreateThread(function()
    while true do
        if nearby and not isOpen and not busy then
            setPrompt(nearby)
            if IsControlJustReleased(0, Config.InteractKey) then
                openBank(nearby)
            end
            Wait(0)
        else
            setPrompt(nil)
            Wait(250)
        end
    end
end)

-- ============================================================
--  Auto zatvaranje (udaljio se / umro)
-- ============================================================
CreateThread(function()
    while true do
        if isOpen then
            local ped = PlayerPedId()
            if IsEntityDead(ped) or (openPos and #(GetEntityCoords(ped) - openPos) > Config.AutoCloseDistance) then
                closeBank()
            end
            Wait(500)
        else
            Wait(1000)
        end
    end
end)

AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    if isOpen then SetNuiFocus(false, false) end
    if shownPrompt then exports['esx_keyprompt']:HideKeyPrompt() end
end)
