-- Flamingo Telefon - SIM kartica, kontakti, pozivi i poruke sistem
-- Pretpostavke: es_extended (legacy ESX object) + oxmysql
-- Ako koristis mysql-async ili drugu inventory osnovu, pogledaj komentare dole.

ESX = exports['es_extended']:getSharedObject()

-- ================== CONFIG ==================
local PhoneNumberDigits = 7 -- ukupno cifara u broju (bez crtice), format XXX-XXXX

-- ================== BAZA PODATAKA ==================
CreateThread(function()
    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS phone_numbers (
            identifier VARCHAR(60) NOT NULL PRIMARY KEY,
            phone_number VARCHAR(20) NOT NULL UNIQUE
        )
    ]])

    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS phone_contacts (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            owner_identifier VARCHAR(60) NOT NULL,
            contact_name VARCHAR(24) NOT NULL,
            contact_number VARCHAR(20) NOT NULL,
            favorite TINYINT(1) NOT NULL DEFAULT 0,
            INDEX idx_owner (owner_identifier)
        )
    ]])

    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS phone_calls (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            owner_identifier VARCHAR(60) NOT NULL,
            other_number VARCHAR(20) NOT NULL,
            direction VARCHAR(10) NOT NULL,
            status VARCHAR(12) NOT NULL,
            duration INT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_owner_time (owner_identifier, created_at)
        )
    ]])

    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS phone_messages (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            from_number VARCHAR(20) NOT NULL,
            to_number VARCHAR(20) NOT NULL,
            body VARCHAR(160) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_from (from_number),
            INDEX idx_to (to_number)
        )
    ]])
end)

-- generise nasumican broj u formatu XXX-XXXX (jos uvek ne proverava dostupnost)
local function generateRandomNumber()
    local digits = ''
    for i = 1, PhoneNumberDigits do
        digits = digits .. tostring(math.random(0, 9))
    end
    return string.sub(digits, 1, 3) .. '-' .. string.sub(digits, 4)
end

-- ================== SIM KARTICA - USABLE ITEM (ox_inventory) ==================
-- Item mora biti definisan u ox_inventory/data/items.lua (vidi install.sql / napomenu na dnu fajla).
-- Klijent (client/client.lua) poziva exports.ox_inventory:useItem(...) sto server-side
-- validira i trosi sim karticu, pa tek onda triggeruje ovaj event.

-- callback koji klijent zove PRE nego sto potrosi sim karticu, da proveri da li igrac
-- vec ima broj (da ne izgubi karticu ako je vec ima)
ESX.RegisterServerCallback('esx_phone:canUseSim', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then cb(false) return end

    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(existing)
        if existing then
            cb(false, existing)
        else
            cb(true)
        end
    end)
end)

-- klijent salje ovo TEK POSLE sto je ox_inventory:useItem potvrdio da je kartica potrosena
RegisterServerEvent('esx_phone:useSimCard')
AddEventHandler('esx_phone:useSimCard', function()
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    -- dvostruka provera (moguc race ako igrac spam-uje karticu iz vise izvora)
    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(existing)
        if existing then
            TriggerClientEvent('esx_phone:notify', source, ('Već imaš aktivan broj: %s'):format(existing))
            return
        end

        -- otvara ekran za biranje broja na telefonu
        TriggerClientEvent('esx_phone:openSimSetup', source)
    end)
end)

-- igrac trazi predlog nasumicnog (slobodnog) broja
RegisterServerEvent('esx_phone:requestRandomNumber')
AddEventHandler('esx_phone:requestRandomNumber', function()
    local source = source

    local function tryGenerate(attempts)
        if attempts > 20 then
            TriggerClientEvent('esx_phone:randomNumberResult', source, nil)
            return
        end

        local candidate = generateRandomNumber()

        exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE phone_number = ?', { candidate }, function(taken)
            if taken then
                tryGenerate(attempts + 1)
            else
                TriggerClientEvent('esx_phone:randomNumberResult', source, candidate)
            end
        end)
    end

    tryGenerate(1)
end)

-- igrac potvrdjuje (rucno unet ili generisan) broj
RegisterServerEvent('esx_phone:submitNumber')
AddEventHandler('esx_phone:submitNumber', function(number)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    if type(number) ~= 'string' or not string.match(number, '^%d%d%d%-%d%d%d%d$') then
        TriggerClientEvent('esx_phone:simResult', source, false, 'Nevalidan format broja.')
        return
    end

    local identifier = xPlayer.identifier

    -- ako igrac vec ima broj (npr. duplo poslao zahtev), ne dozvoli ponovnu registraciju
    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { identifier }, function(already)
        if already then
            TriggerClientEvent('esx_phone:simResult', source, false, 'Već imaš aktivan broj: ' .. already)
            return
        end

        exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE phone_number = ?', { number }, function(taken)
            if taken then
                TriggerClientEvent('esx_phone:simResult', source, false, 'Taj broj je već zauzet, izaberi drugi.')
                return
            end

            -- INSERT sa UNIQUE na phone_number je poslednja linija odbrane
            -- ako dva igraca kliknu istovremeno na isti broj, ovo ce baciti gresku za jednog od njih
            exports.oxmysql:insert('INSERT INTO phone_numbers (identifier, phone_number) VALUES (?, ?)', { identifier, number }, function(insertId)
                if insertId then
                    TriggerClientEvent('esx_phone:simResult', source, true, number)

                    -- Javi flamingo_misije (ako je pokrenut i ako je igrac trenutno
                    -- na misiji koja ceka aktivaciju SIM kartice) da je broj stvarno
                    -- aktiviran. TriggerClientEvent je globalan po imenu, pa radi
                    -- izmedju resursa bez zavisnosti - ako flamingo_misije nije
                    -- pokrenut, ovo jednostavno nema efekta.
                    TriggerClientEvent('flamingo_misije:client:simCardActivated', source)
                else
                    TriggerClientEvent('esx_phone:simResult', source, false, 'Taj broj je već zauzet, izaberi drugi.')
                end
            end)
        end)
    end)
end)

-- callback koji klijent zove kad otvara telefon da dobije svoj broj
ESX.RegisterServerCallback('esx_phone:getNumber', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then cb(nil) return end

    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(number)
        cb(number)
    end)
end)

-- ================== KONTAKTI ==================
-- Svaki igrac ima svoj imenik (owner_identifier = xPlayer.identifier), potpuno odvojen
-- od phone_numbers tabele (koja cuva SAMO sopstveni broj igraca). Kontakti su samo
-- lokalni zapisi "ime <-> broj" koje igrac sam unosi, ne moraju da postoje kao pravi igraci.

-- klijent trazi ceo imenik (kad se otvori telefon app / Kontakti tab)
ESX.RegisterServerCallback('esx_phone:getContacts', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then cb({}) return end

    exports.oxmysql:query('SELECT id, contact_name AS name, contact_number AS number, favorite FROM phone_contacts WHERE owner_identifier = ?', { xPlayer.identifier }, function(rows)
        cb(rows or {})
    end)
end)

-- dodavanje novog kontakta (ime + broj), validacija i na klijentu i ovde (server je merodavan)
RegisterServerEvent('esx_phone:addContact')
AddEventHandler('esx_phone:addContact', function(name, number)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    name = type(name) == 'string' and name:gsub('^%s+', ''):gsub('%s+$', '') or ''

    if name == '' or #name > 24 then
        TriggerClientEvent('esx_phone:contactAdded', source, false, 'Ime mora imati između 1 i 24 karaktera.')
        return
    end

    if type(number) ~= 'string' or not string.match(number, '^%d%d%d%-%d%d%d%d$') then
        TriggerClientEvent('esx_phone:contactAdded', source, false, 'Format broja mora biti XXX-XXXX.')
        return
    end

    local identifier = xPlayer.identifier

    -- ne dozvoljavamo dupli broj u istom imeniku (isti igrac, dva puta isti kontakt)
    exports.oxmysql:scalar('SELECT id FROM phone_contacts WHERE owner_identifier = ? AND contact_number = ?', { identifier, number }, function(existing)
        if existing then
            TriggerClientEvent('esx_phone:contactAdded', source, false, 'Već imaš taj broj sačuvan.')
            return
        end

        exports.oxmysql:insert('INSERT INTO phone_contacts (owner_identifier, contact_name, contact_number, favorite) VALUES (?, ?, ?, 0)', { identifier, name, number }, function(insertId)
            if not insertId then
                TriggerClientEvent('esx_phone:contactAdded', source, false, 'Greška, pokušaj ponovo.')
                return
            end

            TriggerClientEvent('esx_phone:contactAdded', source, true, nil, {
                id = insertId,
                name = name,
                number = number,
                favorite = 0
            })
        end)
    end)
end)

-- brisanje kontakta (proveravamo da kontakt zaista pripada igracu koji brise)
RegisterServerEvent('esx_phone:deleteContact')
AddEventHandler('esx_phone:deleteContact', function(contactId)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    exports.oxmysql:execute('DELETE FROM phone_contacts WHERE id = ? AND owner_identifier = ?', { contactId, xPlayer.identifier }, function(affectedRows)
        -- neke verzije oxmysql-a vracaju broj, neke ceo rezultat (tabelu) sa affectedRows poljem unutra
        if type(affectedRows) == 'table' then
            affectedRows = affectedRows.affectedRows or affectedRows.affected_rows or 0
        end

        if affectedRows and affectedRows > 0 then
            TriggerClientEvent('esx_phone:contactDeleted', source, contactId)
        end
    end)
end)

-- oznacavanje/skidanje sa omiljenih
RegisterServerEvent('esx_phone:toggleFavorite')
AddEventHandler('esx_phone:toggleFavorite', function(contactId)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    exports.oxmysql:scalar('SELECT favorite FROM phone_contacts WHERE id = ? AND owner_identifier = ?', { contactId, xPlayer.identifier }, function(current)
        if current == nil then return end

        local newValue = current == 1 and 0 or 1

        exports.oxmysql:execute('UPDATE phone_contacts SET favorite = ? WHERE id = ? AND owner_identifier = ?', { newValue, contactId, xPlayer.identifier }, function()
            TriggerClientEvent('esx_phone:favoriteToggled', source, contactId, newValue)
        end)
    end)
end)

-- ================== PORUKE (SMS) ==================
-- Svaka poruka je jedan red (from_number -> to_number + tekst). Konverzacija
-- izmedju dva broja se sastavlja "u letu" iz ovih redova (nema posebne
-- tabele za "thread"-ove), isto kao sto istorija poziva radi.

-- klijent trazi listu konverzacija (poslednja poruka po svakom broju sa kojim je pricao)
ESX.RegisterServerCallback('esx_phone:getConversations', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then cb({}) return end

    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(myNumber)
        if not myNumber then cb({}) return end

        exports.oxmysql:query([[
            SELECT other_number AS number, body AS last_message, created_at FROM (
                SELECT
                    CASE WHEN from_number = ? THEN to_number ELSE from_number END AS other_number,
                    body, created_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY CASE WHEN from_number = ? THEN to_number ELSE from_number END
                        ORDER BY created_at DESC
                    ) AS rn
                FROM phone_messages
                WHERE from_number = ? OR to_number = ?
            ) t
            WHERE rn = 1
            ORDER BY created_at DESC
        ]], { myNumber, myNumber, myNumber, myNumber }, function(rows)
            cb(rows or {})
        end)
    end)
end)

-- klijent trazi celu prepisku sa jednim brojem (otvaranje thread-a), poslednjih 200 poruka
ESX.RegisterServerCallback('esx_phone:getMessages', function(source, cb, otherNumber)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then cb({}) return end

    if type(otherNumber) ~= 'string' or not string.match(otherNumber, '^%d%d%d%-%d%d%d%d$') then
        cb({})
        return
    end

    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(myNumber)
        if not myNumber then cb({}) return end

        exports.oxmysql:query([[
            SELECT id, from_number, to_number, body, created_at
            FROM phone_messages
            WHERE (from_number = ? AND to_number = ?) OR (from_number = ? AND to_number = ?)
            ORDER BY created_at ASC
            LIMIT 200
        ]], { myNumber, otherNumber, otherNumber, myNumber }, function(rows)
            rows = rows or {}
            for i = 1, #rows do
                rows[i].direction = (rows[i].from_number == myNumber) and 'out' or 'in'
            end
            cb(rows)
        end)
    end)
end)

-- slanje nove poruke; server je merodavan za validaciju broja, teksta i da li primalac postoji
RegisterServerEvent('esx_phone:sendMessage')
AddEventHandler('esx_phone:sendMessage', function(toNumber, body)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    if type(toNumber) ~= 'string' or not string.match(toNumber, '^%d%d%d%-%d%d%d%d$') then
        TriggerClientEvent('esx_phone:messageSent', source, false, 'Nevalidan broj.')
        return
    end

    body = type(body) == 'string' and body:gsub('^%s+', ''):gsub('%s+$', '') or ''
    if body == '' or #body > 160 then
        TriggerClientEvent('esx_phone:messageSent', source, false, 'Poruka mora imati između 1 i 160 karaktera.')
        return
    end

    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(myNumber)
        if not myNumber then
            TriggerClientEvent('esx_phone:messageSent', source, false, 'Nemaš aktivan broj telefona.')
            return
        end

        if myNumber == toNumber then
            TriggerClientEvent('esx_phone:messageSent', source, false, 'Ne možeš slati poruke sebi.')
            return
        end

        exports.oxmysql:scalar('SELECT identifier FROM phone_numbers WHERE phone_number = ?', { toNumber }, function(targetIdentifier)
            if not targetIdentifier then
                TriggerClientEvent('esx_phone:messageSent', source, false, 'Taj broj ne postoji.')
                return
            end

            exports.oxmysql:insert('INSERT INTO phone_messages (from_number, to_number, body) VALUES (?, ?, ?)', { myNumber, toNumber, body }, function(insertId)
                if not insertId then
                    TriggerClientEvent('esx_phone:messageSent', source, false, 'Greška, pokušaj ponovo.')
                    return
                end

                exports.oxmysql:scalar('SELECT created_at FROM phone_messages WHERE id = ?', { insertId }, function(createdAt)
                    TriggerClientEvent('esx_phone:messageSent', source, true, nil, {
                        id = insertId,
                        number = toNumber,
                        direction = 'out',
                        body = body,
                        created_at = createdAt
                    })

                    -- ako je primalac trenutno online, posalji mu poruku uzivo (bez potrebe da osvezava rucno)
                    local xTarget = ESX.GetPlayerFromIdentifier(targetIdentifier)
                    if xTarget then
                        TriggerClientEvent('esx_phone:newMessage', xTarget.source, {
                            number = myNumber,
                            message = {
                                id = insertId,
                                direction = 'in',
                                body = body,
                                created_at = createdAt
                            }
                        })
                    end
                end)
            end)
        end)
    end)
end)

--[[
    SETUP - vidi install.sql za kompletno objasnjenje (SQL + items.lua deo).
]]

-- ================== ISTORIJA POZIVA ==================

-- klijent trazi istoriju poziva (kad se otvori tab "Pozivi"), poslednjih 50, najnoviji prvi
ESX.RegisterServerCallback('esx_phone:getCallHistory', function(source, cb)
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then cb({}) return end

    exports.oxmysql:query(
        'SELECT id, other_number AS number, direction, status, duration, created_at FROM phone_calls WHERE owner_identifier = ? ORDER BY created_at DESC LIMIT 50',
        { xPlayer.identifier },
        function(rows)
            cb(rows or {})
        end
    )
end)

-- brisanje jednog zapisa iz istorije (samo sopstvenog)
RegisterServerEvent('esx_phone:deleteCallLog')
AddEventHandler('esx_phone:deleteCallLog', function(callId)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    exports.oxmysql:execute('DELETE FROM phone_calls WHERE id = ? AND owner_identifier = ?', { callId, xPlayer.identifier })
end)

-- brisanje cele istorije poziva igraca
RegisterServerEvent('esx_phone:clearCallHistory')
AddEventHandler('esx_phone:clearCallHistory', function()
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    exports.oxmysql:execute('DELETE FROM phone_calls WHERE owner_identifier = ?', { xPlayer.identifier }, function()
        TriggerClientEvent('esx_phone:callHistoryCleared', source)
    end)
end)

-- upisuje jedan zapis poziva za jednog igraca (poziva se dva puta po zavrsenom pozivu, jednom po strani)
local function insertCallLog(identifier, otherNumber, direction, status, duration)
    exports.oxmysql:insert(
        'INSERT INTO phone_calls (owner_identifier, other_number, direction, status, duration) VALUES (?, ?, ?, ?, ?)',
        { identifier, otherNumber, direction, status, duration or 0 }
    )
end

-- ================== POZIVI ==================
-- Server je jedini izvor istine ko koga zove i u kom je stanju poziv (ringing/active).
-- ActiveCalls[source] = { withSource = <source drugog igraca>, number = <njegov broj>, state = 'ringing' | 'active' }

local ActiveCalls = {}
local CallRingTimeoutMs = 25000 -- koliko dugo zvoni pre automatskog "nema odgovora"

-- ================== POVEZIVANJE GLASA (pma-voice) ==================
-- Kad obe strane podignu slusalicu, spajamo ih na isti pma-voice "call"
-- kanal da mogu da se cuju. Svaki aktivan poziv dobija SOPSTVENI broj kanala
-- (redom rastuci) da se pozivi koji se preklapaju u vremenu ne bi culi medjusobno.
local nextVoiceCallChannel = 0

local function StartVoiceCall(srcA, srcB)
    if GetResourceState('pma-voice') ~= 'started' then return nil end

    nextVoiceCallChannel = nextVoiceCallChannel + 1
    local channel = nextVoiceCallChannel

    local ok = pcall(function()
        exports['pma-voice']:setPlayerCall(srcA, channel)
        exports['pma-voice']:setPlayerCall(srcB, channel)
    end)

    if not ok then
        print('[flamingo_telefon] Nisam uspeo da pozovem pma-voice:setPlayerCall.')
        return nil
    end

    return channel
end

-- skida jednog igraca sa njegovog pma-voice call kanala (bezbedno i ako je vec offline)
local function StopVoiceCall(src)
    if not src then return end
    if GetResourceState('pma-voice') ~= 'started' then return end
    if not GetPlayerName(src) then return end -- igrac vise nije konektovan

    pcall(function()
        exports['pma-voice']:setPlayerCall(src, 0)
    end)
end

local function clearCallState(src)
    ActiveCalls[src] = nil
end

-- upisuje istoriju poziva za jednu stranu (ako jos uvek imamo njen ActiveCalls zapis) i
-- vraca da li je taj zapis postojao (koristi se da znamo da li i njoj treba poslati callEnded)
local function logCallForSide(src)
    local call = ActiveCalls[src]
    if not call then return false end

    local xPlayer = ESX.GetPlayerFromId(src)
    if xPlayer then
        local direction = call.isCaller and 'outgoing' or 'incoming'
        local status, duration

        if call.answered then
            status = 'answered'
            duration = call.startedAt and (os.time() - call.startedAt) or 0
        elseif call.declined then
            status = 'declined'
            duration = 0
        else
            -- niko nije podigao slusalicu: onaj ko je zvao vidi "nema odgovora",
            -- onaj koga su zvali vidi "propusten poziv"
            status = call.isCaller and 'no_answer' or 'missed'
            duration = 0
        end

        insertCallLog(xPlayer.identifier, call.number, direction, status, duration)
    end

    return true
end

-- zavrsava poziv za obe strane, svaka strana moze dobiti drugaciji razlog
-- (npr. onaj ko je spustio slusalicu ne treba da vidi poruku, drugi treba)
-- takodje upisuje istoriju poziva za obe strane pre nego sto obrise njihovo stanje
local function endCallBothSides(srcA, srcB, reasonForA, reasonForB)
    local callA = ActiveCalls[srcA]
    local callB = srcB and ActiveCalls[srcB]

    local hadA = logCallForSide(srcA)
    local hadB = srcB and logCallForSide(srcB)

    -- skini oba sa pma-voice call kanala AKO je poziv uopste bio spojen (odgovoren)
    if callA and callA.voiceChannel then StopVoiceCall(srcA) end
    if callB and callB.voiceChannel then StopVoiceCall(srcB) end

    if srcA and hadA then
        clearCallState(srcA)
        TriggerClientEvent('esx_phone:callEnded', srcA, reasonForA)
    end
    if srcB and hadB then
        clearCallState(srcB)
        TriggerClientEvent('esx_phone:callEnded', srcB, reasonForB)
    end
end

-- pronalazi source online igraca po broju telefona
-- rezultat je 'not_registered' (broj nikad nije aktiviran/ne postoji), 'offline' (broj postoji ali
-- vlasnik trenutno nije na serveru/u gradu), ili source broj (igrac je online i moze se pozvati)
local function findSourceByNumber(number, cb)
    exports.oxmysql:scalar('SELECT identifier FROM phone_numbers WHERE phone_number = ?', { number }, function(identifier)
        if not identifier then cb('not_registered') return end

        local xTarget = ESX.GetPlayerFromIdentifier(identifier)
        if not xTarget then cb('offline') return end -- broj postoji ali vlasnik trenutno nije na serveru

        cb(xTarget.source)
    end)
end

-- igrac zove broj (sa tastera ili iz kontakta)
RegisterServerEvent('esx_phone:callNumber')
AddEventHandler('esx_phone:callNumber', function(number)
    local source = source
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    if type(number) ~= 'string' or not string.match(number, '^%d%d%d%-%d%d%d%d$') then
        TriggerClientEvent('esx_phone:callFailed', source, 'invalid')
        return
    end

    if ActiveCalls[source] then
        TriggerClientEvent('esx_phone:callFailed', source, 'busy_self')
        return
    end

    exports.oxmysql:scalar('SELECT phone_number FROM phone_numbers WHERE identifier = ?', { xPlayer.identifier }, function(myNumber)
        -- bez aktivnog broja (SIM kartice) ne moze da zove nikog
        if not myNumber then
            TriggerClientEvent('esx_phone:callFailed', source, 'no_sim')
            return
        end

        -- ne dozvoli pozivanje sopstvenog broja
        if myNumber == number then
            TriggerClientEvent('esx_phone:callFailed', source, 'self')
            return
        end

        findSourceByNumber(number, function(result)
            -- 'not_registered' i 'offline' su string rezultati (razlog neuspeha), broj je pravi source igraca
            if result == 'not_registered' or result == 'offline' then
                TriggerClientEvent('esx_phone:callFailed', source, result)
                return
            end

            local targetSource = result

            if ActiveCalls[targetSource] then
                TriggerClientEvent('esx_phone:callFailed', source, 'busy')
                return
            end

            ActiveCalls[source] = { withSource = targetSource, number = number, state = 'ringing', isCaller = true, answered = false, declined = false }
            ActiveCalls[targetSource] = { withSource = source, number = myNumber, state = 'ringing', isCaller = false, answered = false, declined = false }

            TriggerClientEvent('esx_phone:outgoingCall', source, number)
            TriggerClientEvent('esx_phone:incomingCall', targetSource, myNumber)

            SetTimeout(CallRingTimeoutMs, function()
                local callState = ActiveCalls[source]
                if callState and callState.withSource == targetSource and callState.state == 'ringing' then
                    endCallBothSides(source, targetSource, 'no_answer', 'missed')
                end
            end)
        end)
    end)
end)

-- pozvani igrac prihvata poziv
RegisterServerEvent('esx_phone:answerCall')
AddEventHandler('esx_phone:answerCall', function()
    local source = source
    local call = ActiveCalls[source]
    if not call or call.state ~= 'ringing' then return end

    local other = ActiveCalls[call.withSource]
    if not other then return end

    local now = os.time()
    call.state = 'active'
    call.answered = true
    call.startedAt = now
    other.state = 'active'
    other.answered = true
    other.startedAt = now

    -- spoji ih preko pma-voice da mogu da se cuju dok traje poziv
    local voiceChannel = StartVoiceCall(source, call.withSource)
    call.voiceChannel = voiceChannel
    other.voiceChannel = voiceChannel

    TriggerClientEvent('esx_phone:callConnected', source)
    TriggerClientEvent('esx_phone:callConnected', call.withSource)
end)

-- pozvani igrac odbija poziv
RegisterServerEvent('esx_phone:declineCall')
AddEventHandler('esx_phone:declineCall', function()
    local source = source
    local call = ActiveCalls[source]
    if not call then return end

    call.declined = true
    local other = ActiveCalls[call.withSource]
    if other then other.declined = true end

    endCallBothSides(source, call.withSource, 'declined_self', 'declined')
end)

-- bilo koja strana prekida poziv (odlazni, dolazni ili aktivan)
RegisterServerEvent('esx_phone:endCall')
AddEventHandler('esx_phone:endCall', function()
    local source = source
    local call = ActiveCalls[source]
    if not call then return end

    endCallBothSides(source, call.withSource, 'hangup_self', 'hangup')
end)

-- ako igrac izadje sa servera dok je u pozivu, obavesti drugu stranu i upisi istoriju za oboje
AddEventHandler('playerDropped', function()
    local source = source
    local call = ActiveCalls[source]
    if not call then return end

    logCallForSide(source)
    logCallForSide(call.withSource)

    -- ako je poziv bio spojen glasom, skini preostalu stranu sa kanala
    -- (onaj ko je izasao je vec offline, njega ne treba ni pokusavati)
    if call.voiceChannel and call.withSource then
        StopVoiceCall(call.withSource)
    end

    clearCallState(source)
    if call.withSource and ActiveCalls[call.withSource] then
        clearCallState(call.withSource)
        TriggerClientEvent('esx_phone:callEnded', call.withSource, 'disconnected')
    end
end)

-- =====================================================================
-- FLAMINGO TELEFON 2.0 - BELEŠKE (tabela phone_notes se pravi sama)
-- =====================================================================
CreateThread(function()
    exports.oxmysql:execute([[
        CREATE TABLE IF NOT EXISTS `phone_notes` (
            `id` INT NOT NULL AUTO_INCREMENT,
            `identifier` VARCHAR(60) NOT NULL,
            `title` VARCHAR(80) NOT NULL DEFAULT '',
            `body` TEXT NOT NULL,
            `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`), KEY `idx_owner` (`identifier`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ]])
end)

local NOTE_MAX = 50
ESX.RegisterServerCallback('flamingo_phone:notesGet', function(src, cb)
    local x = ESX.GetPlayerFromId(src)
    if not x then return cb({}) end
    exports.oxmysql:execute('SELECT id, title, body, UNIX_TIMESTAMP(updated_at) AS ts FROM phone_notes WHERE identifier = ? ORDER BY updated_at DESC LIMIT 100',
        { x.identifier }, function(rows) cb(rows or {}) end)
end)

ESX.RegisterServerCallback('flamingo_phone:notesSave', function(src, cb, data)
    local x = ESX.GetPlayerFromId(src)
    if not x or type(data) ~= 'table' then return cb(nil) end
    local title = tostring(data.title or ''):sub(1, 80)
    local body = tostring(data.body or ''):sub(1, 4000)
    local id = tonumber(data.id)
    if id then
        exports.oxmysql:execute('UPDATE phone_notes SET title = ?, body = ? WHERE id = ? AND identifier = ?', { title, body, id, x.identifier }, function()
            cb({ id = id, title = title, body = body, ts = os.time() })
        end)
    else
        exports.oxmysql:execute('SELECT COUNT(*) AS c FROM phone_notes WHERE identifier = ?', { x.identifier }, function(r)
            if r and r[1] and tonumber(r[1].c) >= NOTE_MAX then return cb({ error = 'limit' }) end
            exports.oxmysql:insert('INSERT INTO phone_notes (identifier, title, body) VALUES (?, ?, ?)', { x.identifier, title, body }, function(newId)
                cb({ id = newId, title = title, body = body, ts = os.time() })
            end)
        end)
    end
end)

ESX.RegisterServerCallback('flamingo_phone:notesDelete', function(src, cb, id)
    local x = ESX.GetPlayerFromId(src)
    if not x then return cb(false) end
    exports.oxmysql:execute('DELETE FROM phone_notes WHERE id = ? AND identifier = ?', { tonumber(id) or 0, x.identifier }, function() cb(true) end)
end)
