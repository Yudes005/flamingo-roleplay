local chatOpen = false
local chatManuallyEnabled = true

local function OpenChat()
    chatOpen = true
    SetNuiFocus(true, true)
    -- staff:onDuty je statebag koji postavlja flamingo_staff; ako taj resurs nije
    -- pokrenut ili igrač nije staff, ovo je jednostavno nil/false i tab ostaje sakriven
    local canSeeStaffTab = LocalPlayer.state['staff:onDuty'] == true
    SendNUIMessage({ action = 'open', canSeeStaffTab = canSeeStaffTab })
end

local function CloseChat()
    chatOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

RegisterNetEvent('flamingo_chat:setEnabled', function(enabled)
    chatManuallyEnabled = enabled
    SendNUIMessage({ action = 'setChatEnabled', enabled = enabled })

    if not enabled and chatOpen then
        CloseChat()
    end
end)

-- Podrazumevani taster je T, korisnik može da ga promeni u
-- Settings > Key Bindings > FiveM > Otvori chat
RegisterKeyMapping('flamingo_chat_open', 'Otvori chat', 'keyboard', 'T')

RegisterCommand('flamingo_chat_open', function()
    if not chatOpen and chatManuallyEnabled then
        OpenChat()
    end
end, false)

RegisterNUICallback('closeChat', function(data, cb)
    CloseChat()
    cb('ok')
end)

RegisterNUICallback('sendMessage', function(data, cb)
    if data and data.text and data.text ~= '' then
        if data.channel == 'staff' then
            -- staff kanal ide direktno kroz flamingo_staff (on tamo proverava
            -- da li si staff/on-duty/imaš staff.chat permisiju pre slanja)
            TriggerServerEvent('flamingo_staff:server:sendStaffChatFromChat', data.text)
        else
            TriggerServerEvent('flamingo_chat:send', data.text, data.channel)
        end
    end
    cb('ok')
end)

RegisterNetEvent('flamingo_chat:receive')
AddEventHandler('flamingo_chat:receive', function(payload)
    SendNUIMessage({ action = 'message', data = payload })
end)

RegisterNetEvent('flamingo_chat:receiveAd')
AddEventHandler('flamingo_chat:receiveAd', function(payload)
    SendNUIMessage({ action = 'ad', data = payload })
end)

RegisterNetEvent('flamingo_chat:receiveSystem')
AddEventHandler('flamingo_chat:receiveSystem', function(payload)
    SendNUIMessage({ action = 'system', data = payload })
end)

-- flamingo_staff okida ovaj event direktno (samo ka klijentima koji su trenutno
-- on-duty staff) kad neko piše u STAFF kanal - vidi server/staffchat.lua tamo
RegisterNetEvent('flamingo_chat:addStaffMessage')
AddEventHandler('flamingo_chat:addStaffMessage', function(payload)
    SendNUIMessage({ action = 'staffMessage', data = payload })
end)

-- Sakrij ceo chat kad je otvoren ESC meni, market, telefon ili bilo koji drugi NUI
CreateThread(function()
    local hidden = false

    while true do
        Wait(150)

        local pauseActive = IsPauseMenuActive()
        local nuiFocused = IsNuiFocused()

        -- Ako je NUI fokus tu zbog toga što MI kucamo poruku (chatOpen), to se ne računa
        -- kao "tuđi" meni. Inače (ESC meni, market, telefon, itd.) chat se sakriva.
        local shouldHide = pauseActive or (nuiFocused and not chatOpen)

        if shouldHide ~= hidden then
            hidden = shouldHide
            SendNUIMessage({ action = 'setSuppressed', hidden = hidden })
        end

        -- Ako se u međuvremenu otvorio drugi meni dok smo pisali poruku, zatvori chat input
        if shouldHide and chatOpen then
            CloseChat()
        end
    end
end)
