ESX = exports['es_extended']:getSharedObject()

math.randomseed(os.time())

local MAX_DISTANCE = 3.0   -- metara, koliko blizu mora biti drugi igrac
local SHOW_COOLDOWN = 3    -- sekundi izmedju dva pokazivanja dokumenta

local lastShow = {}

local function GetClosestPlayer(source)
    local senderPed = GetPlayerPed(source)
    if not senderPed or senderPed == 0 then return nil end

    local senderCoords = GetEntityCoords(senderPed)

    local closestId, closestDist = nil, MAX_DISTANCE

    for _, playerId in ipairs(GetPlayers()) do
        local pid = tonumber(playerId)

        if pid and pid ~= source then
            local ped = GetPlayerPed(playerId)

            if ped and ped ~= 0 then
                local dist = #(senderCoords - GetEntityCoords(ped))

                if dist < closestDist then
                    closestDist = dist
                    closestId = pid
                end
            end
        end
    end

    return closestId
end

-- ============================================================
--  POKAZIVANJE DOKUMENTA
--  Klijent salje SAMO koji dokument hoce da pokaze. Sadrzaj se
--  ponovo cita iz flamingo_documents na serveru, da igrac ne bi
--  mogao da izmeni podatke u NUI-u i pokaze lazni dokument.
-- ============================================================

local VALID_VIEWS = { idcard = true, medcert = true, licenses = true }

RegisterNetEvent('flamingo_radialmenu:server:showDocument', function(view)
    local src = source

    if not VALID_VIEWS[view] then return end

    local now = os.time()
    if lastShow[src] and now - lastShow[src] < SHOW_COOLDOWN then return end
    lastShow[src] = now

    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local closestId = GetClosestPlayer(src)

    if not closestId then
        return TriggerClientEvent('esx:showNotification', src, 'Nema nikoga dovoljno blizu da mu pokažeš dokument.')
    end

    if GetResourceState('flamingo_documents') ~= 'started' then
        return TriggerClientEvent('esx:showNotification', src, 'Sistem dokumenata nije dostupan.')
    end

    exports['flamingo_documents']:GetDocuments(xPlayer.identifier, function(payload)
        if not payload then return end

        -- Posalji samo ono sto se stvarno pokazuje
        local trimmed = {
            holder   = payload.holder,
            country  = payload.country,
            hospital = payload.hospital,
            idcard   = (view == 'idcard' or view == 'licenses') and payload.idcard or nil,
            medcert  = view == 'medcert' and payload.medcert or nil,
            licenses = view == 'licenses' and payload.licenses or nil
        }

        TriggerClientEvent('flamingo_radialmenu:client:receiveDocument', closestId, view, trimmed, src)

        local labels = { idcard = 'ličnu kartu', medcert = 'lekarsko uverenje', licenses = 'dozvole' }
        TriggerClientEvent('esx:showNotification', src, ('Pokazao/la si %s igraču u blizini.'):format(labels[view]))
    end)
end)

AddEventHandler('playerDropped', function()
    lastShow[source] = nil
end)

-- ============================================================
--  UPOZNAJ SE
-- ============================================================

RegisterNetEvent('flamingo_radialmenu:server:introduceRequest', function()
    local src = source
    local target = GetClosestPlayer(src)

    if not target then
        return TriggerClientEvent('esx:showNotification', src, 'Nema nikoga dovoljno blizu da se upoznaš.')
    end

    if GetResourceState('flamingo_odbiprihvati') ~= 'started' then
        return TriggerClientEvent('esx:showNotification', src, 'Sistem ponuda trenutno nije dostupan.')
    end

    local xRequester = ESX.GetPlayerFromId(src)
    if not xRequester then return end

    local requesterName = (xRequester.getName and xRequester.getName()) or GetPlayerName(src)

    -- Ponuda i odgovor idu kroz flamingo_odbiprihvati; rezultat stize
    -- ovde kroz callback, isto kao za bilo koju drugu "prihvati/odbij" akciju.
    exports['flamingo_odbiprihvati']:Send(target, {
        title      = 'Upoznavanje',
        text       = ('%s (ID %d) želi da se upozna sa tobom. Prihvataš?'):format(requesterName, src),
        senderName = requesterName
    }, function(accepted, targetId)
        local xTarget = ESX.GetPlayerFromId(targetId)
        if not xTarget then return end

        local targetName = (xTarget.getName and xTarget.getName()) or GetPlayerName(targetId)

        if accepted then
            exports.oxmysql:insert(
                'INSERT IGNORE INTO flamingo_known_players (viewer_identifier, target_identifier, target_name) VALUES (?, ?, ?)',
                { xRequester.identifier, xTarget.identifier, targetName }
            )

            TriggerClientEvent('flamingo_id:client:knownNameResult', src, targetId, targetName)
        end

        TriggerClientEvent('flamingo_radialmenu:client:introduceResult', src, accepted, targetName)
    end)
end)

-- ============================================================
--  KOCKICE - premesteno u poseban resurs flamingo_kockice
--  (custom UI za unos uloga, ponuda, bacanje i isplata).
-- ============================================================
