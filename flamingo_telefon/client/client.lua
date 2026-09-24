-- Flamingo Telefon - client
-- Otvara/zatvara telefon, drzi status telefonskog broja i sim setup ekran.

ESX = exports['es_extended']:getSharedObject()

local phoneOpen = false
local myPhoneNumber = nil

-- ================== NOTIFIKACIJE ==================
-- Kad je esx_notify pokrenut, zovemo ga direktno preko exporta - to daje
-- pravi odvojen naslov i ikonicu (lepse nego ubacivanje naslova u sam tekst).
-- Ako esx_notify NIJE pokrenut (ili export iz nekog razloga puca), padamo
-- nazad na klasican ESX event ('esx:showNotification') kao ranije - to i
-- dalje hvata BILO KOJI drugi notify resurs koji sluša taj event ili je
-- prikacio ESX.ShowNotification, pa telefon ostaje kompatibilan bez obzira
-- sta je instalirano na serveru.
-- type: 'error' | 'success' | 'info'
local function Notify(title, message, type, icon)
    if GetResourceState('esx_notify') == 'started' then
        local ok = pcall(function()
            exports['esx_notify']:Notify(message, type or 'info', 4000, title, icon)
        end)
        if ok then return end
    end

    TriggerEvent('esx:showNotification', ('%s: %s'):format(title, message), type or 'info')
end

-- ================== PROP TELEFONA + ANIMACIJA U RUCI ==================
-- Standardni "drzim telefon u ruci" prop/anim koji koristi vecina telefon skripti.

local phoneModel = `prop_amb_phone`
local phoneBone = 28422 -- SKEL_L_Hand (leva saka)

-- obe animacije su iz istog dict-a ('cellphone@'), pa se prebacivanje
-- izmedju njih radi trenutno, bez ponovnog ucitavanja
local phoneAnims = {
    browse = { dict = 'cellphone@', anim = 'cellphone_text_in' },          -- obicno drzanje/gledanje u telefon (K, sim setup)
    call   = { dict = 'cellphone@', anim = 'cellphone_call_listen_base' }, -- drzi telefon dok razgovara (poziv)
}

local phoneProp = nil
local currentPhoneAnim = nil -- 'browse' ili 'call', koja je trenutno aktivna

-- ucitava anim dict sa vremenskim ogranicenjem (da ne blokira zauvek ako ne uspe)
local function LoadAnimDict(dict)
    RequestAnimDict(dict)
    local tries = 0
    while not HasAnimDictLoaded(dict) and tries < 100 do -- max ~1s
        Wait(10)
        tries = tries + 1
    end
    return HasAnimDictLoaded(dict)
end

-- ucitava model sa vremenskim ogranicenjem
local function LoadModel(model)
    RequestModel(model)
    local tries = 0
    while not HasModelLoaded(model) and tries < 100 do -- max ~1s
        Wait(10)
        tries = tries + 1
    end
    return HasModelLoaded(model)
end

-- pusta odgovarajucu animaciju drzanja telefona ('browse' ili 'call')
-- (ne dira prop, samo menja pozu ruke/tela)
local function PlayPhoneAnim(animKey)
    local animData = phoneAnims[animKey]
    if not animData then return end
    if not LoadAnimDict(animData.dict) then return end

    local ped = PlayerPedId()

    -- zaustavi prethodnu animaciju ako je razlicita (npr. iz browse u call)
    if currentPhoneAnim and currentPhoneAnim ~= animKey then
        local prevData = phoneAnims[currentPhoneAnim]
        if IsEntityPlayingAnim(ped, prevData.dict, prevData.anim, 3) then
            StopAnimTask(ped, prevData.dict, prevData.anim, 1.0)
        end
    end

    -- flag 50 = ostani na poslednjem frejmu (mirna poza) + dozvoli kretanje + otkazivo
    -- (flag 49 bi loop-ovao celu animaciju iz pocetka u krug - zato je izgledalo kao da
    -- stalno "vadi" telefon iznova)
    TaskPlayAnim(ped, animData.dict, animData.anim, 3.0, 3.0, -1, 50, 0, false, false, false)
    currentPhoneAnim = animKey
end

-- kreira prop u ruci (ako vec ne postoji) i pusta trazenu animaciju
local function CreatePhoneProp(animKey)
    animKey = animKey or 'browse'

    if phoneProp and DoesEntityExist(phoneProp) then
        PlayPhoneAnim(animKey) -- prop vec postoji, samo promeni pozu (npr. browse -> call)
        return
    end

    local ped = PlayerPedId()

    if not LoadModel(phoneModel) then return end -- nije se ucitalo, odustani bez blokiranja

    phoneProp = CreateObject(phoneModel, GetEntityCoords(ped), true, true, true)
    SetEntityCollision(phoneProp, false, false)

    AttachEntityToEntity(
        phoneProp, ped,
        GetPedBoneIndex(ped, phoneBone),
        0.01, 0.005, -0.02, -- pozicija u odnosu na saku
        10.0, 160.0, 0.0,   -- rotacija
        true, true, false, true, 1, true
    )

    PlayPhoneAnim(animKey)

    SetModelAsNoLongerNeeded(phoneModel)
end

-- sklanja prop i zaustavlja animaciju
local function RemovePhoneProp()
    local ped = PlayerPedId()

    if phoneProp and DoesEntityExist(phoneProp) then
        DeleteEntity(phoneProp)
    end
    phoneProp = nil

    if currentPhoneAnim then
        local animData = phoneAnims[currentPhoneAnim]
        if IsEntityPlayingAnim(ped, animData.dict, animData.anim, 3) then
            StopAnimTask(ped, animData.dict, animData.anim, 1.0)
        end
    end
    currentPhoneAnim = nil
end

-- ako igrac umre dok drzi telefon, skloni prop (da ne ostane da lebdi na lesu)
CreateThread(function()
    while true do
        Wait(500)
        if phoneProp and DoesEntityExist(phoneProp) and IsEntityDead(PlayerPedId()) then
            RemovePhoneProp()
            if phoneOpen then
                phoneOpen = false
                SetNuiFocus(false, false)
                SendNUIMessage({ action = 'closePhone' })
            end
        end
    end
end)

-- ================== OTVARANJE / ZATVARANJE TELEFONA ==================
RegisterCommand('togglephone', function()
    phoneOpen = not phoneOpen

    SetNuiFocus(phoneOpen, phoneOpen)

    if phoneOpen then
        CreateThread(function() CreatePhoneProp('browse') end)
        SendNUIMessage({ action = 'openPhone' })

        -- osvezi broj telefona svaki put kad se telefon otvori
        ESX.TriggerServerCallback('esx_phone:getNumber', function(number)
            myPhoneNumber = number
            SendNUIMessage({ action = 'setPhoneNumber', number = number or '---' })
        end)
    else
        RemovePhoneProp()
        SendNUIMessage({ action = 'closePhone' })
    end
end, false)

RegisterKeyMapping('togglephone', 'Otvori/Zatvori Telefon', 'keyboard', 'K')

RegisterNUICallback('closePhone', function(data, cb)
    phoneOpen = false
    SetNuiFocus(false, false)
    RemovePhoneProp()
    cb('ok')
end)

-------------------------------------------------
-- FLAMINGO_LIFEINVADER: OGLASNIK - slanje oglasa. UI je deo ovog telefona
-- (oglasnik-screen u html-u), samo se sadrzaj prosledjuje na server drugog
-- resursa - flamingo_lifeinvader tamo radi svu proveru (cooldown, duzina
-- teksta, itd.) i sam uzima broj telefona iz phone_numbers tabele.
-------------------------------------------------
RegisterNUICallback('oglasnikSubmit', function(data, cb)
    if data and data.content then
        TriggerServerEvent('flamingo_li:server:createAd', { content = data.content })
    end
    cb('ok')
end)

-------------------------------------------------
-- FLAMINGO_BANKE: aplikacija BANKA (samo transfer novca drugom igracu).
-- Sva provera (stanje, ID, limit, cooldown) radi se na serveru resursa
-- flamingo_banke, telefon je samo UI.
-------------------------------------------------
local function bankaAvailable()
    return GetResourceState('flamingo_banke') == 'started'
end

RegisterNUICallback('bankaGetInfo', function(data, cb)
    cb('ok')
    if not bankaAvailable() then
        SendNUIMessage({ action = 'bankaInfo', info = false })
        return
    end
    ESX.TriggerServerCallback('flamingo_banke:phoneInfo', function(info)
        SendNUIMessage({ action = 'bankaInfo', info = info or false })
    end)
end)

RegisterNUICallback('bankaTransfer', function(data, cb)
    cb('ok')
    if not bankaAvailable() then
        Notify('Banka', 'Banka trenutno nije dostupna.', 'error')
        SendNUIMessage({ action = 'bankaTransferResult', result = { ok = false, msg = 'Banka trenutno nije dostupna.' } })
        return
    end
    ESX.TriggerServerCallback('flamingo_banke:phoneTransfer', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa bankom.' }
        Notify('Banka', res.msg or '', res.ok and 'success' or 'error')
        SendNUIMessage({ action = 'bankaTransferResult', result = res })
    end, {
        target = data and data.target,
        amount = data and data.amount,
        memo   = data and data.memo
    })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() == resourceName and phoneOpen then
        SetNuiFocus(false, false)
        RemovePhoneProp()
    end
end)

-- ================== SIM KARTICA (ox_inventory usable item) ==================

-- Ovo je export koji ox_inventory poziva kad igrac klikne "Use" na sim karticu
-- (povezano preko client.export = 'esx_phone.simcard' u ox_inventory/data/items.lua).
-- 1) prvo pitamo server da li igrac uopste sme da koristi karticu (da li vec ima broj)
-- 2) tek ako sme, zovemo exports.ox_inventory:useItem koje server-side validira i
--    trosi karticu (consume = 1 iz items.lua)
-- 3) tek KAD ox_inventory potvrdi da je kartica potrosena, kazemo serveru da otvori
--    ekran za biranje broja
exports('simcard', function(data, slot)
    ESX.TriggerServerCallback('esx_phone:canUseSim', function(canUse, existingNumber)
        if not canUse then
            Notify('Telefon', ('Već imaš aktivan broj: %s'):format(existingNumber), 'error', 'fa-solid fa-sim-card')
            return
        end

        exports.ox_inventory:useItem(data, function(result)
            if not result then return end -- server je odbio upotrebu (npr. vise nema kartice)
            TriggerServerEvent('esx_phone:useSimCard')
        end)
    end)
end)

-- server nam kaze da otvorimo ekran za biranje broja (posle upotrebe sim kartice)
RegisterNetEvent('esx_phone:openSimSetup')
AddEventHandler('esx_phone:openSimSetup', function()
    phoneOpen = true
    SetNuiFocus(true, true)
    CreateThread(function() CreatePhoneProp('browse') end)
    SendNUIMessage({ action = 'openSimSetup' })
end)

-- NUI trazi predlog nasumicnog broja
RegisterNUICallback('requestRandomNumber', function(data, cb)
    TriggerServerEvent('esx_phone:requestRandomNumber')
    cb('ok')
end)

RegisterNetEvent('esx_phone:randomNumberResult')
AddEventHandler('esx_phone:randomNumberResult', function(number)
    SendNUIMessage({ action = 'randomNumberResult', number = number })
end)

-- NUI salje broj koji je igrac potvrdio
RegisterNUICallback('submitPhoneNumber', function(data, cb)
    TriggerServerEvent('esx_phone:submitNumber', data.number)
    cb('ok')
end)

RegisterNetEvent('esx_phone:simResult')
AddEventHandler('esx_phone:simResult', function(success, data)
    if success then
        myPhoneNumber = data
    end
    SendNUIMessage({ action = 'simResult', success = success, data = data })
end)

-- generisano preko ESX notifikacije (esx:showNotification / ESX.ShowNotification)
RegisterNetEvent('esx_phone:notify')
AddEventHandler('esx_phone:notify', function(msg)
    Notify('Telefon', msg, 'info', 'fa-solid fa-phone')
end)

-- ================== KONTAKTI ==================

-- NUI trazi ceo imenik (otvaranje telefon aplikacije / Kontakti tab)
RegisterNUICallback('getContacts', function(data, cb)
    ESX.TriggerServerCallback('esx_phone:getContacts', function(contacts)
        SendNUIMessage({ action = 'setContacts', contacts = contacts })
    end)
    cb('ok')
end)

-- NUI salje { name, number } iz modala za dodavanje kontakta
RegisterNUICallback('addContact', function(data, cb)
    TriggerServerEvent('esx_phone:addContact', data.name, data.number)
    cb('ok')
end)

RegisterNetEvent('esx_phone:contactAdded')
AddEventHandler('esx_phone:contactAdded', function(success, message, contact)
    SendNUIMessage({ action = 'contactAdded', success = success, message = message, contact = contact })
end)

-- NUI salje { id } kontakta koji treba obrisati
RegisterNUICallback('deleteContact', function(data, cb)
    TriggerServerEvent('esx_phone:deleteContact', data.id)
    cb('ok')
end)

RegisterNetEvent('esx_phone:contactDeleted')
AddEventHandler('esx_phone:contactDeleted', function(contactId)
    SendNUIMessage({ action = 'contactDeleted', id = contactId })
end)

-- NUI salje { id } kontakta ciji se favorit status menja
RegisterNUICallback('toggleFavorite', function(data, cb)
    TriggerServerEvent('esx_phone:toggleFavorite', data.id)
    cb('ok')
end)

RegisterNetEvent('esx_phone:favoriteToggled')
AddEventHandler('esx_phone:favoriteToggled', function(contactId, favorite)
    SendNUIMessage({ action = 'favoriteToggled', id = contactId, favorite = favorite })
end)

-- ================== PORUKE (SMS) ==================

-- NUI trazi listu konverzacija (otvaranje aplikacije Poruke)
RegisterNUICallback('getConversations', function(data, cb)
    ESX.TriggerServerCallback('esx_phone:getConversations', function(conversations)
        SendNUIMessage({ action = 'setConversations', conversations = conversations })
    end)
    cb('ok')
end)

-- NUI trazi celu prepisku sa jednim brojem (otvaranje thread-a)
RegisterNUICallback('getMessages', function(data, cb)
    ESX.TriggerServerCallback('esx_phone:getMessages', function(messages)
        SendNUIMessage({ action = 'setMessages', number = data.number, messages = messages })
    end, data.number)
    cb('ok')
end)

-- NUI salje { number, body } iz otvorenog thread-a
RegisterNUICallback('sendMessage', function(data, cb)
    TriggerServerEvent('esx_phone:sendMessage', data.number, data.body)
    cb('ok')
end)

-- server potvrdjuje da je nasa poruka poslata (ili odbija uz razlog)
RegisterNetEvent('esx_phone:messageSent')
AddEventHandler('esx_phone:messageSent', function(success, message, msgData)
    if success then
        SendNUIMessage({ action = 'messageSent', message = msgData })
    else
        Notify('Poruke', message, 'error', 'fa-solid fa-comment-sms')
    end
end)

-- neko nama salje poruku uzivo (dodaje se u otvoren thread ako gledamo bas taj broj,
-- i uvek prikazuje kratku notifikaciju kao na pravom telefonu)
RegisterNetEvent('esx_phone:newMessage')
AddEventHandler('esx_phone:newMessage', function(payload)
    SendNUIMessage({ action = 'newMessage', number = payload.number, message = payload.message })

    Notify(('Poruka od %s'):format(payload.number), payload.message.body, 'info', 'fa-solid fa-comment-sms')
end)

-- ================== ISTORIJA POZIVA ==================

-- NUI trazi istoriju poziva (otvaranje taba "Pozivi")
RegisterNUICallback('getCallHistory', function(data, cb)
    ESX.TriggerServerCallback('esx_phone:getCallHistory', function(calls)
        SendNUIMessage({ action = 'setCallHistory', calls = calls })
    end)
    cb('ok')
end)

-- NUI salje { id } zapisa poziva koji treba obrisati
RegisterNUICallback('deleteCallLog', function(data, cb)
    TriggerServerEvent('esx_phone:deleteCallLog', data.id)
    cb('ok')
end)

-- NUI trazi brisanje cele istorije poziva
RegisterNUICallback('clearCallHistory', function(data, cb)
    TriggerServerEvent('esx_phone:clearCallHistory')
    cb('ok')
end)

RegisterNetEvent('esx_phone:callHistoryCleared')
AddEventHandler('esx_phone:callHistoryCleared', function()
    SendNUIMessage({ action = 'callHistoryCleared' })
end)

-- ================== POZIVI ==================

-- NUI (dugme "Pozovi" iz kontakta ili sa tastera) trazi da se pozove broj
RegisterNUICallback('callNumber', function(data, cb)
    if data.number then
        TriggerServerEvent('esx_phone:callNumber', data.number)
    end
    cb('ok')
end)

RegisterNUICallback('answerCall', function(data, cb)
    TriggerServerEvent('esx_phone:answerCall')
    cb('ok')
end)

RegisterNUICallback('declineCall', function(data, cb)
    TriggerServerEvent('esx_phone:declineCall')
    cb('ok')
end)

RegisterNUICallback('endCall', function(data, cb)
    TriggerServerEvent('esx_phone:endCall')
    cb('ok')
end)

-- ja zovem nekog - telefon se automatski otvara na ekranu poziva
RegisterNetEvent('esx_phone:outgoingCall')
AddEventHandler('esx_phone:outgoingCall', function(number)
    phoneOpen = true
    SetNuiFocus(true, true)
    CreateThread(function() CreatePhoneProp('call') end)
    SendNUIMessage({ action = 'outgoingCall', number = number })
end)

-- neko mene zove - telefon se automatski otvara i "zvoni", cak i ako je bio zatvoren
RegisterNetEvent('esx_phone:incomingCall')
AddEventHandler('esx_phone:incomingCall', function(number)
    phoneOpen = true
    SetNuiFocus(true, true)
    CreateThread(function() CreatePhoneProp('call') end)
    SendNUIMessage({ action = 'incomingCall', number = number })
end)

-- poziv je prihvacen (na obe strane) - pocinje aktivan poziv sa tajmerom
RegisterNetEvent('esx_phone:callConnected')
AddEventHandler('esx_phone:callConnected', function()
    SendNUIMessage({ action = 'callConnected' })
end)

-- poziv je zavrsen (spusteno, odbijeno, nema odgovora, sagovornik izasao sa servera...)
RegisterNetEvent('esx_phone:callEnded')
AddEventHandler('esx_phone:callEnded', function(reason)
    SendNUIMessage({ action = 'callEnded', reason = reason })
    if phoneOpen and phoneProp and DoesEntityExist(phoneProp) then
        CreateThread(function() PlayPhoneAnim('browse') end)
    end
end)

-- poziv nije ni uspostavljen (nevalidan broj, offline, zauzeto, zoves sebe...)
RegisterNetEvent('esx_phone:callFailed')
AddEventHandler('esx_phone:callFailed', function(reason)
    SendNUIMessage({ action = 'callFailed', reason = reason })
    if phoneOpen and phoneProp and DoesEntityExist(phoneProp) then
        CreateThread(function() PlayPhoneAnim('browse') end)
    end
end)

-- ================== USLUGE: TAXI ==================
-- Ovo je most ka odvojenom resursu flamingo_taxi - telefon samo prosledjuje
-- zahteve na NJEGOVE server evente (cross-resource, sasvim normalno u FiveM)
-- i slusa NJEGOVE odgovore da azurira svoj NUI ekran.

RegisterNUICallback('taxiRequestRide', function(data, cb)
    TriggerServerEvent('flamingo_taxi:requestRide')
    cb('ok')
end)

RegisterNUICallback('taxiCancelRide', function(data, cb)
    TriggerServerEvent('flamingo_taxi:cancelRideRequest')
    cb('ok')
end)

RegisterNUICallback('taxiChooseDestination', function(data, cb)
    if data.coords then
        TriggerServerEvent('flamingo_taxi:chooseDestination', data.label, vector3(data.coords.x, data.coords.y, data.coords.z))
    end
    cb('ok')
end)

RegisterNUICallback('taxiSetCustomDestination', function(data, cb)
    local waypointBlip = GetFirstBlipInfoId(8) -- 8 = radar_waypoint
    if not DoesBlipExist(waypointBlip) then
        Notify('Taxi', 'Prvo postavi GPS na mapi (klik na mapu).', 'error', 'fa-solid fa-taxi')
        cb('ok')
        return
    end

    local coords = GetBlipInfoIdCoord(waypointBlip)
    TriggerServerEvent('flamingo_taxi:chooseDestination', 'Custom lokacija (GPS)', vector3(coords.x, coords.y, coords.z))
    cb('ok')
end)

-- server javlja status naseg poziva (waiting/accepted/in_taxi/finished/cancelled/...)
RegisterNetEvent('flamingo_taxi:rideStatus')
AddEventHandler('flamingo_taxi:rideStatus', function(status, extra)
    SendNUIMessage({ action = 'taxiStatus', status = status, extra = extra })

    local notifyMessages = {
        accepted = 'Taxi je prihvatio tvoj poziv i dolazi po tebe.',
        in_taxi = 'Ušao si u Taxi - izaberi destinaciju.',
        finished = 'Vožnja je završena.',
        driver_cancelled = 'Vozač je otkazao vožnju.',
        no_drivers = 'Trenutno nema Taxi vozača na duty-u.',
    }

    if notifyMessages[status] then
        Notify('Taxi', notifyMessages[status], 'info', 'fa-solid fa-taxi')
    end
end)

-- server trazi da otvorimo izbor destinacije (musterija upravo usla u taxi)
RegisterNetEvent('flamingo_taxi:openDestinationPicker')
AddEventHandler('flamingo_taxi:openDestinationPicker', function()
    SendNUIMessage({ action = 'taxiOpenDestinationPicker' })
    if not phoneOpen then
        Notify('Taxi', 'Otvori telefon i izaberi destinaciju.', 'info', 'fa-solid fa-taxi')
    end
end)

-- ================== USLUGE: POZOVI DOKTORA (bolnica) ==================
-- Isti most-pattern kao za Taxi iznad, samo ka flamingo_hospital resursu.

-- NUI otvara "Doktor" podekran - prvo pita koliko je doktora trenutno na dužnosti
RegisterNUICallback('hospitalGetDutyStatus', function(data, cb)
    if GetResourceState('flamingo_hospital') ~= 'started' then
        SendNUIMessage({ action = 'hospitalDutyStatusResult', available = false, onDuty = 0 })
        cb('ok')
        return
    end

    ESX.TriggerServerCallback('flamingo_hospital:server:getEmsDutyStatus', function(result)
        SendNUIMessage({ action = 'hospitalDutyStatusResult', available = true, onDuty = result and result.onDuty or 0 })
    end)
    cb('ok')
end)

-- NUI salje { reason } iz forme za poziv doktora
RegisterNUICallback('hospitalCallDoctor', function(data, cb)
    if GetResourceState('flamingo_hospital') ~= 'started' then
        SendNUIMessage({ action = 'hospitalCallResult', success = false, notified = 0, reason = 'unavailable' })
        cb('ok')
        return
    end

    TriggerServerEvent('flamingo_hospital:server:callAmbulance', data.reason)
    cb('ok')
end)

-- flamingo_hospital javlja rezultat poziva (uspešno obavešteno N doktora / neuspešno)
RegisterNetEvent('flamingo_hospital:client:callAmbulanceResult')
AddEventHandler('flamingo_hospital:client:callAmbulanceResult', function(success, notified, reason)
    SendNUIMessage({ action = 'hospitalCallResult', success = success, notified = notified, reason = reason })

    if not phoneOpen then
        if success then
            Notify('Bolnica', ('Pozvao/la si doktora. Obavešteno: %d.'):format(notified or 0), 'success', 'fa-solid fa-truck-medical')
        else
            Notify('Bolnica', 'Trenutno nema slobodnih doktora.', 'error', 'fa-solid fa-truck-medical')
        end
    end
end)

-- ================== USLUGE: POLICIJA (flamingo_policija) ==================
RegisterNUICallback('policeGetDutyStatus', function(data, cb)
    cb('ok')
    local available = GetResourceState('flamingo_policija') == 'started'
    SendNUIMessage({ action = 'policeDutyStatusResult', available = available, onDuty = available and (GlobalState.policeOnDuty or 0) or 0 })
end)

RegisterNUICallback('policeCall', function(data, cb)
    cb('ok')
    if GetResourceState('flamingo_policija') ~= 'started' then
        SendNUIMessage({ action = 'policeCallResult', success = false, notified = 0, reason = 'unavailable' })
        return
    end
    local c = GetEntityCoords(PlayerPedId())
    local street = exports['flamingo_policija']:GetStreet({ x = c.x, y = c.y, z = c.z })
    TriggerServerEvent('flamingo_policija:server:citizenCall', type(data) == 'table' and data.reason or '', street)
end)

-- flamingo_policija/client/dispatch.lua prosleđuje rezultat ovde
AddEventHandler('flamingo_telefon:client:policeCallResult', function(success, notified, reason)
    SendNUIMessage({ action = 'policeCallResult', success = success, notified = notified, reason = reason })
    if not phoneOpen then
        if success then
            Notify('Policija', ('Prijava je poslata. Obavešteno: %d.'):format(notified or 0), 'success', 'fa-solid fa-shield-halved')
        else
            Notify('Policija', reason == 'cooldown' and 'Sačekaj pre nove prijave.' or 'Trenutno nema policajaca na dužnosti.', 'error', 'fa-solid fa-shield-halved')
        end
    end
end)

-- =====================================================================
-- FLAMINGO TELEFON 2.0 - KAMERA, BELEŠKE
-- =====================================================================

-- ---------- KAMERA (prava kamera telefona u igri) ----------
-- Enter / levi klik = slikaj (efekat blica + zvuk), strelica gore = selfi,
-- Backspace / desni klik = izlaz nazad u telefon.
local cameraOn = false

-- Slika se pravi preko screenshot-basic (ako je pokrenut) i ide u Galeriju
-- u telefonu. Bez screenshot-basic kamera i dalje radi, samo bez galerije.
function TakePhoto()
    if GetResourceState('screenshot-basic') ~= 'started' then
        SendNUIMessage({ action = 'photoFailed', reason = 'no_resource' })
        return
    end
    Wait(50)
    exports['screenshot-basic']:requestScreenshot({ encoding = 'jpg', quality = 0.75 }, function(data)
        SendNUIMessage({ action = 'photoTaken', data = data })
    end)
end

RegisterNUICallback('openCamera', function(_, cb)
    cb('ok')
    if cameraOn then return end
    cameraOn = true
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'cameraMode', on = true })
    CreateThread(function()
        local selfie = false
        CreateMobilePhone(1)
        CellCamActivate(true, true)
        while cameraOn do
            Wait(0)
            HideHudComponentThisFrame(7); HideHudComponentThisFrame(8); HideHudComponentThisFrame(9)
            HideHudComponentThisFrame(6); HideHudComponentThisFrame(19)
            DisableControlAction(0, 24, true); DisableControlAction(0, 25, true)
            if IsControlJustPressed(1, 27) then          -- strelica gore = selfi
                selfie = not selfie
                Citizen.InvokeNative(0x2491A93618B7D838, selfie)   -- CELL_CAM_ACTIVATE_SELFIE_MODE
            end
            if IsControlJustPressed(1, 176) or IsDisabledControlJustPressed(0, 24) then   -- Enter / klik = slikaj
                SendNUIMessage({ action = 'cameraShot' })
                PlaySoundFrontend(-1, 'Camera_Shoot', 'Phone_Soundset_Franklin', true)
                TakePhoto()
            end
            if IsControlJustPressed(1, 177) or IsDisabledControlJustPressed(0, 25) then   -- Backspace / desni klik = izlaz
                cameraOn = false
            end
        end
        DestroyMobilePhone()
        CellCamActivate(false, false)
        SendNUIMessage({ action = 'cameraMode', on = false })
        if phoneOpen then SetNuiFocus(true, true) end
    end)
end)

-- ---------- BELEŠKE (čuvaju se u bazi, tabela phone_notes) ----------
RegisterNUICallback('notesGet', function(_, cb)
    ESX.TriggerServerCallback('flamingo_phone:notesGet', function(notes)
        SendNUIMessage({ action = 'notesList', notes = notes or {} })
    end)
    cb('ok')
end)
RegisterNUICallback('notesSave', function(data, cb)
    ESX.TriggerServerCallback('flamingo_phone:notesSave', function(res)
        SendNUIMessage({ action = 'noteSaved', note = res })
    end, data or {})
    cb('ok')
end)
RegisterNUICallback('notesDelete', function(data, cb)
    ESX.TriggerServerCallback('flamingo_phone:notesDelete', function()
        SendNUIMessage({ action = 'noteDeleted', id = data and data.id })
    end, data and data.id)
    cb('ok')
end)
