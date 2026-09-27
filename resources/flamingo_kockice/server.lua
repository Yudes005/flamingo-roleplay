local ESX = exports['es_extended']:getSharedObject()

-- ============================================================
--  FLAMINGO KOCKICE - server
--
--  Ponuda i odgovor idu kroz flamingo_odbiprihvati (isti prompt kao
--  "Upoznaj se"), a SVE vezano za novac se resava ovde na serveru:
--  iznos, udaljenost i stanje novca se proveravaju i pri slanju
--  ponude i ponovo u trenutku bacanja kockica.
--
--  Novac se ne skida unapred - posle bacanja gubitnik placa ulog
--  pobedniku, a kod nereseno se nista ne menja. Tako se ne moze
--  desiti da neko ostane bez uloga ako se diskonektuje usred igre.
-- ============================================================

math.randomseed(os.time())

local busy        = {}   -- [serverId] = true dok traje ponuda/igra
local cooldownUntil = {} -- [serverId] = os.time() do kada igrac ne sme ponovo da igra

local DISTANCE_TOLERANCE = 1.5 -- server vidi pozicije sa malim kasnjenjem

local function notify(target, msg, notifyType, duration)
    TriggerClientEvent('flamingo_kockice:client:notify', target, msg, notifyType, duration)
end

local function formatMoney(n)
    local s = tostring(math.floor(n))
    local formatted = s:reverse():gsub('(%d%d%d)', '%1.'):reverse()
    return '$' .. formatted:gsub('^%.', '')
end

local function tagOf(src)
    local ok, uid = pcall(Config.GetUid, src, ESX.GetPlayerFromId(src))
    return '#' .. tostring((ok and uid) or src)
end

local function distanceBetween(a, b)
    local pedA, pedB = GetPlayerPed(a), GetPlayerPed(b)
    if not pedA or pedA == 0 or not pedB or pedB == 0 then return math.huge end

    return #(GetEntityCoords(pedA) - GetEntityCoords(pedB))
end

local function isNear(a, b)
    return distanceBetween(a, b) <= Config.MaxDistance + DISTANCE_TOLERANCE
end

local function getBalance(xPlayer)
    local account = xPlayer.getAccount(Config.Account)
    return account and account.money or 0
end

local function release(a, b)
    if a then busy[a] = nil end
    if b then busy[b] = nil end
end

local function sound(target, name)
    TriggerClientEvent('flamingo_kockice:client:sound', target, name)
end

--- Cooldown se cuva na serveru (on odlucuje), a klijentu se javlja
--- samo da ne bi ni otvarao prozor za unos dok traje.
local function startCooldown(id)
    if not id or not GetPlayerName(id) then return end

    cooldownUntil[id] = os.time() + Config.Cooldown
    TriggerClientEvent('flamingo_kockice:client:cooldown', id, Config.Cooldown)
end

local function cooldownLeft(id)
    local untilTime = cooldownUntil[id]
    if not untilTime then return 0 end

    local left = untilTime - os.time()
    if left <= 0 then
        cooldownUntil[id] = nil
        return 0
    end

    return left
end

--- Kraj partije (odigrane ili otkazane posle prihvatanja) - oba igraca
--- dobijaju cooldown.
local function finishGame(a, b)
    release(a, b)
    startCooldown(a)
    startCooldown(b)
end

--- Rezultat vide i igraci u blizini (Config.AnnounceRadius).
local function announceNearby(src, targetId, msg)
    if not Config.AnnounceRadius or Config.AnnounceRadius <= 0 then return end

    local ped = GetPlayerPed(src)
    if not ped or ped == 0 then return end

    local origin = GetEntityCoords(ped)

    for _, playerId in ipairs(GetPlayers()) do
        local pid = tonumber(playerId)

        if pid and pid ~= src and pid ~= targetId then
            local otherPed = GetPlayerPed(pid)

            if otherPed and otherPed ~= 0 and #(origin - GetEntityCoords(otherPed)) <= Config.AnnounceRadius then
                notify(pid, msg, 'info', Config.ResultDuration)
            end
        end
    end
end

-- ============================================================
--  BACANJE (posle prihvatanja)
-- ============================================================

local function rollDice(src, targetId, amount)
    local xSender = ESX.GetPlayerFromId(src)
    local xTarget = ESX.GetPlayerFromId(targetId)

    if not xSender or not xTarget then
        finishGame(src, targetId)
        if xSender then notify(src, 'Igra je otkazana - protivnik je napustio server.', 'error') end
        if xTarget then notify(targetId, 'Igra je otkazana - protivnik je napustio server.', 'error') end
        return
    end

    if not isNear(src, targetId) then
        finishGame(src, targetId)
        notify(src, 'Igra je otkazana - previše ste udaljeni.', 'error')
        notify(targetId, 'Igra je otkazana - previše ste udaljeni.', 'error')
        return
    end

    -- Ponovna provera novca - moglo je da prodje vreme od ponude.
    if getBalance(xSender) < amount then
        finishGame(src, targetId)
        notify(src, 'Više nemaš dovoljno novca za taj ulog.', 'error')
        notify(targetId, ('Igrač %s više nema dovoljno novca. Igra je otkazana.'):format(tagOf(src)), 'error')
        return
    end

    if getBalance(xTarget) < amount then
        finishGame(src, targetId)
        notify(targetId, 'Nemaš dovoljno novca za taj ulog.', 'error')
        notify(src, ('Igrač %s nema dovoljno novca. Igra je otkazana.'):format(tagOf(targetId)), 'error')
        return
    end

    local rollSender = math.random(1, Config.DiceSides)
    local rollTarget = math.random(1, Config.DiceSides)

    local senderTag = tagOf(src)
    local targetTag = tagOf(targetId)
    local base = ('%s je dobio %d, %s je dobio %d.'):format(senderTag, rollSender, targetTag, rollTarget)

    if rollSender == rollTarget then
        local msg = base .. ' Nerešeno!'

        notify(src, msg, 'info', Config.ResultDuration)
        notify(targetId, msg, 'info', Config.ResultDuration)
        sound(src, 'draw')
        sound(targetId, 'draw')
        announceNearby(src, targetId, msg)

        print(('[flamingo_kockice] %s (%d) vs %s (%d) | ulog %s | %d:%d nereseno'):format(
            senderTag, src, targetTag, targetId, formatMoney(amount), rollSender, rollTarget))
    else
        local winnerId, loserId, xWinner, xLoser, winnerTag, loserTag

        if rollSender > rollTarget then
            winnerId, loserId, xWinner, xLoser, winnerTag, loserTag = src, targetId, xSender, xTarget, senderTag, targetTag
        else
            winnerId, loserId, xWinner, xLoser, winnerTag, loserTag = targetId, src, xTarget, xSender, targetTag, senderTag
        end

        xLoser.removeAccountMoney(Config.Account, amount)
        xWinner.addAccountMoney(Config.Account, amount)

        local msg = ('%s Pobednik je %s!'):format(base, winnerTag)

        notify(winnerId, ('%s Pobedio si i osvojio %s!'):format(base, formatMoney(amount)), 'success', Config.ResultDuration)
        notify(loserId, ('%s Izgubio si %s.'):format(base, formatMoney(amount)), 'error', Config.ResultDuration)
        sound(winnerId, 'win')
        sound(loserId, 'lose')
        announceNearby(src, targetId, msg)

        print(('[flamingo_kockice] %s (%d) vs %s (%d) | ulog %s | %d:%d | pobednik %s, gubitnik %s'):format(
            senderTag, src, targetTag, targetId, formatMoney(amount), rollSender, rollTarget, winnerTag, loserTag))
    end

    finishGame(src, targetId)
end

-- ============================================================
--  PONUDA
-- ============================================================

RegisterNetEvent('flamingo_kockice:server:request', function(amount, targetId)
    local src = source

    amount   = math.floor(tonumber(amount) or 0)
    targetId = tonumber(targetId)

    if amount < Config.MinBet then
        return notify(src, ('Minimalni ulog je %s.'):format(formatMoney(Config.MinBet)), 'error')
    end

    if amount > Config.MaxBet then
        return notify(src, ('Maksimalni ulog je %s.'):format(formatMoney(Config.MaxBet)), 'error')
    end

    if busy[src] then
        return notify(src, 'Već imaš aktivnu partiju kockica.', 'error')
    end

    local left = cooldownLeft(src)
    if left > 0 then
        sound(src, 'error')
        TriggerClientEvent('flamingo_kockice:client:cooldown', src, left)
        return notify(src, ('Sačekaj još %d s pre nove partije kockica.'):format(left), 'error')
    end

    if not targetId or targetId == src or not GetPlayerName(targetId) then
        return notify(src, 'Nema nikoga dovoljno blizu za kockanje.', 'error')
    end

    if not isNear(src, targetId) then
        return notify(src, 'Igrač je predaleko.', 'error')
    end

    if busy[targetId] then
        return notify(src, 'Taj igrač je već u partiji kockica.', 'error')
    end

    local targetLeft = cooldownLeft(targetId)
    if targetLeft > 0 then
        return notify(src, ('Taj igrač je upravo igrao. Sačekaj još %d s.'):format(targetLeft), 'error')
    end

    if GetResourceState('flamingo_odbiprihvati') ~= 'started' then
        return notify(src, 'Sistem ponuda trenutno nije dostupan.', 'error')
    end

    local xSender = ESX.GetPlayerFromId(src)
    local xTarget = ESX.GetPlayerFromId(targetId)
    if not xSender or not xTarget then return end

    if getBalance(xSender) < amount then
        return notify(src, 'Nemaš dovoljno novca za taj ulog.', 'error')
    end

    busy[src], busy[targetId] = true, true
    startCooldown(src)

    local senderTag = tagOf(src)
    local targetTag = tagOf(targetId)

    notify(src, ('Ponuda za kockice (%s) je poslata igraču %s. Čeka se odgovor...'):format(formatMoney(amount), targetTag), 'info')

    exports['flamingo_odbiprihvati']:Send(targetId, {
        title      = 'Kockice',
        text       = ('Igrač %s te poziva na kockice u %s. Ko dobije veći broj, nosi ulog. Prihvataš?'):format(senderTag, formatMoney(amount)),
        senderName = ('Igrač %s'):format(senderTag),
        timeout    = Config.OfferTimeout
    }, function(accepted)
        if not accepted then
            release(src, targetId)
            if GetPlayerName(src) then
                notify(src, ('Igrač %s je odbio kockice (ili nije odgovorio na vreme).'):format(targetTag), 'error')
            end
            return
        end

        if not GetPlayerName(src) then
            finishGame(src, targetId)
            return notify(targetId, 'Igra je otkazana - protivnik je napustio server.', 'error')
        end

        notify(src, ('%s je prihvatio. Kockice su bačene...'):format(targetTag), 'info', Config.RollDelay)
        notify(targetId, 'Kockice su bačene...', 'info', Config.RollDelay)

        TriggerClientEvent('flamingo_kockice:client:rolling', src)
        TriggerClientEvent('flamingo_kockice:client:rolling', targetId)

        SetTimeout(Config.RollDelay, function()
            rollDice(src, targetId, amount)
        end)
    end)
end)

AddEventHandler('playerDropped', function()
    local src = source
    busy[src] = nil
    cooldownUntil[src] = nil
end)
