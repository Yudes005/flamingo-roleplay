local ESX = exports['es_extended']:getSharedObject()

-- Ugasi ugrađeni FiveM "chat" resurs (onaj dosadni na dnu ekrana) ako je pokrenut,
-- da se ne preklapa sa flamingo_chat. Za trajno rešenje, obriši "ensure chat" (ili
-- dodaj "stop chat") u server.cfg, ovo je samo dodatna sigurnosna mreža.
CreateThread(function()
    Wait(2000)
    if GetResourceState('chat') == 'started' then
        StopResource('chat')
    end
end)

-- Boja imena igrača u chatu (flamingo brend, ista kao na logu "FLAMINGOROLEPLAY")
local NAME_COLOR = '#e21e6b'

local function GetSenderInfo(src)
    local xPlayer = ESX.GetPlayerFromId(src)
    local name = GetPlayerName(src) or ('Igrač ' .. src)

    if xPlayer and xPlayer.getName then
        local esxName = xPlayer.getName()
        if esxName and esxName ~= '' then
            name = esxName
        end
    end

    return {
        id = src,
        name = name,
        color = NAME_COLOR,
        job = xPlayer and xPlayer.job and xPlayer.job.name or nil
    }
end

-- Prepoznaje /me, /try, /do, /todo na početku poruke
local function ParseCommandMessage(text)
    local cmd, rest = text:match('^/(%a+)%s+(.*)$')

    if not cmd then
        return nil, text
    end

    cmd = cmd:lower()

    if cmd == 'me' or cmd == 'try' or cmd == 'do' or cmd == 'todo' then
        return cmd, rest
    end

    return nil, text
end

-- proverava flamingo_staff mute status; ne ruši se ako flamingo_staff nije pokrenut
local function IsSenderMuted(src)
    if GetResourceState('flamingo_staff') ~= 'started' then return false end
    local ok, muted = pcall(function()
        return exports['flamingo_staff']:IsPlayerMuted(src)
    end)
    return ok and muted == true
end

RegisterNetEvent('flamingo_chat:send')
AddEventHandler('flamingo_chat:send', function(rawText, channel)
    local src = source

    if type(rawText) ~= 'string' or rawText:gsub('%s', '') == '' then return end
    if type(channel) ~= 'string' or (channel ~= 'rp' and channel ~= 'nonrp') then
        channel = 'rp'
    end

    if IsSenderMuted(src) then
        TriggerClientEvent('flamingo_chat:receiveSystem', src, {
            text = 'Ućutkan si i ne možeš da pišeš u chat.',
            color = '#ff4d6d'
        })
        return
    end

    -- Osnovna zaštita od preteranog spama/dužine
    if #rawText > 150 then
        rawText = rawText:sub(1, 150)
    end

    local sender = GetSenderInfo(src)
    local cmd, body = ParseCommandMessage(rawText)

    local payload = {
        channel = channel,
        author = sender.name,
        authorId = sender.id,
        authorColor = sender.color,
        kind = 'message',
        text = body
    }

    if cmd == 'me' then
        payload.kind = 'me'
    elseif cmd == 'try' then
        payload.kind = 'try'
        payload.success = math.random(1, 100) <= 50
    elseif cmd == 'do' then
        payload.kind = 'do'
    elseif cmd == 'todo' then
        payload.kind = 'todo'
    end

    -- NON-RP: globalno, svi igrači
    if channel == 'nonrp' then
        TriggerClientEvent('flamingo_chat:receive', -1, payload)
        return
    end

    --[[ FAMILY kanal - trenutno isključen (nije prioritet za sada), samo otkomentariši
    kad zatreba i vrati "FAMILY" tab u html/index.html
    if channel == 'family' then
        if not sender.job then return end

        for _, playerId in ipairs(GetPlayers()) do
            playerId = tonumber(playerId)
            local targetPlayer = ESX.GetPlayerFromId(playerId)

            if targetPlayer and targetPlayer.job and targetPlayer.job.name == sender.job then
                TriggerClientEvent('flamingo_chat:receive', playerId, payload)
            end
        end
        return
    end
    ]]

    -- RP: samo igrači u fizičkoj blizini (in-character lokalni chat)
    local senderPed = GetPlayerPed(src)
    if not senderPed or senderPed == 0 then return end
    local senderCoords = GetEntityCoords(senderPed)

    for _, playerId in ipairs(GetPlayers()) do
        playerId = tonumber(playerId)
        local targetPed = GetPlayerPed(playerId)

        if targetPed and targetPed ~= 0 then
            local targetCoords = GetEntityCoords(targetPed)
            local distance = #(senderCoords - targetCoords)

            if distance <= 20.0 then
                TriggerClientEvent('flamingo_chat:receive', playerId, payload)
            end
        end
    end
end)

-- Export za druge resurse (npr. telefon/biznis oglasi) da ubace lepo dizajniranu
-- "reklamnu" poruku u chat (ikonica u boji kategorije, tekst oglasa, i po zelji
-- kontakt broj i ime pošiljaoca). "title" se i dalje prosledjuje (zbog
-- kompatibilnosti), ali se vise ne ispisuje kao tekst pored ikonice - kartica
-- sad prikazuje samo ikonicu kategorije, odmah ispred teksta oglasa.
-- "contact" je opcioni 7. parametar (broj telefona) - ako se ne prosledi,
-- red sa kontaktom se jednostavno ne prikazuje.
-- Primer upotrebe iz drugog resursa:
-- exports['flamingo_chat']:SendChatAd('heart', 'Tražim porodicu', '#ff4d6d', 'Javite se u pm.', 'Aleksa Alcappone', '#ff4d6d', '515-1515')
exports('SendChatAd', function(icon, title, titleColor, subtitle, senderName, borderColor, contact)
    TriggerClientEvent('flamingo_chat:receiveAd', -1, {
        icon = icon,
        title = title,
        titleColor = titleColor,
        subtitle = subtitle,
        sender = senderName,
        borderColor = borderColor,
        contact = contact
    })
end)

-- Export za sistemske poruke (npr. "Stranac (73920) uzima nešto iz prtljažnika")
-- exports['flamingo_chat']:SendSystemMessage('Stranac (73920) uzima nešto iz prtljažnika')
exports('SendSystemMessage', function(text, color)
    TriggerClientEvent('flamingo_chat:receiveSystem', -1, { text = text, color = color })
end)
