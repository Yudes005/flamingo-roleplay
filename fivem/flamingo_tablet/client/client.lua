-- Flamingo Tablet - client
-- Frame/pozadina + "Bolnica" aplikacija: prikazuje pozive za EMS koje šalje
-- flamingo_hospital (dugme "Pozovi Doktora" na downed ekranu).

ESX = exports['es_extended']:getSharedObject()

local tabletOpen = false
local emsCalls = {} -- lista primljenih poziva, najnoviji prvi (u memoriji, resetuje se na relog)
local MAX_STORED_CALLS = 30

-------------------------------------------------
-- ESX_NOTIFY integracija - koristi se ISKLJUCIVO za dogadjaje koji stizu
-- kao "push" sa servera dok je tablet ZATVOREN (npr. novi EMS poziv, neko
-- drugi je preuzeo poziv, odobren je novi LI oglas). Dok je tablet OTVOREN
-- ti isti dogadjaji se i dalje prikazuju kroz sopstveni toast unutar
-- tableta (html/script.js), pa ovde namerno ne dupliramo sa esx_notify.
-------------------------------------------------
local function Notify(msg, notifyType, length, title, icon)
    if GetResourceState('esx_notify') ~= 'started' then return end
    local ok = pcall(function()
        exports['esx_notify']:Notify(msg, notifyType, length, title, icon)
    end)
    if not ok then
        print('[flamingo_tablet] Nisam uspeo da pozovem esx_notify export.')
    end
end

-- ================== PROP TABLETA + ANIMACIJA U RUCI ==================
-- Normalna poza drzanja tableta ispred sebe (kao da ga citas), potvrdjena
-- kombinacija koju koristi vise FiveM tablet skripti.

local tabletModel = `prop_cs_tablet`
local tabletAnimDict = 'amb@world_human_seat_wall_tablet@female@base'
local tabletAnimName = 'base'
local tabletBone = 57005 -- SKEL_R_Hand (desna saka)
local tabletOffset = vector3(0.17, 0.10, -0.13)
local tabletRotation = vector3(20.0, 180.0, 180.0)

local tabletProp = nil

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

-- kreira tablet prop u ruci i pokrece animaciju drzanja
local function CreateTabletProp()
    if tabletProp and DoesEntityExist(tabletProp) then return end -- vec postoji, ne dupliraj

    if not LoadAnimDict(tabletAnimDict) then return end
    if not LoadModel(tabletModel) then return end

    local ped = PlayerPedId()

    tabletProp = CreateObject(tabletModel, GetEntityCoords(ped), true, true, true)
    SetEntityCollision(tabletProp, false, false)

    AttachEntityToEntity(
        tabletProp, ped,
        GetPedBoneIndex(ped, tabletBone),
        tabletOffset.x, tabletOffset.y, tabletOffset.z,
        tabletRotation.x, tabletRotation.y, tabletRotation.z,
        true, true, false, true, 1, true
    )

    -- flag 50 = ostani na poslednjem frejmu (mirna poza), ne loop-uje animaciju iznova
    TaskPlayAnim(ped, tabletAnimDict, tabletAnimName, 3.0, 3.0, -1, 50, 0, false, false, false)

    SetModelAsNoLongerNeeded(tabletModel)
end

-- sklanja tablet prop i zaustavlja animaciju
local function RemoveTabletProp()
    local ped = PlayerPedId()

    if tabletProp and DoesEntityExist(tabletProp) then
        DeleteEntity(tabletProp)
    end
    tabletProp = nil

    if IsEntityPlayingAnim(ped, tabletAnimDict, tabletAnimName, 3) then
        StopAnimTask(ped, tabletAnimDict, tabletAnimName, 1.0)
    end
end

-- ako igrac umre dok drzi tablet, skloni prop (da ne ostane da lebdi na lesu)
CreateThread(function()
    while true do
        Wait(500)
        if tabletProp and DoesEntityExist(tabletProp) and IsEntityDead(PlayerPedId()) then
            RemoveTabletProp()
            if tabletOpen then
                tabletOpen = false
                SetNuiFocus(false, false)
                SendNUIMessage({ action = 'closeTablet' })
            end
        end
    end
end)

local function GetJobName()
    local playerData = ESX.GetPlayerData()
    return playerData and playerData.job and playerData.job.name or nil
end

-------------------------------------------------
-- Organizacija (Lider Organizacije + Organizacija za obicne clanove) -
-- preseljeno iz flamingo_mmenu. Deljena je izmedju flamingo_hospital i
-- flamingo_lifeinvader - koji od njih napaja panel se odredjuje ovde, na
-- osnovu toga za koju organizaciju je igrac trenutno vezan (posao je
-- uvek jedan, pa nikad ne moze pripadati obema istovremeno). currentOrgResource
-- se postavlja pri svakom otvaranju tableta (GetOrgFlags) i koriste ga svi
-- 'org*' NUI callback-ovi ispod (vidi ForwardOrg) da znaju kome da
-- prosledjuju zahtev.
-------------------------------------------------
local currentOrgResource = nil -- 'flamingo_hospital' | 'flamingo_lifeinvader' | nil

local function GetOrgFlags()
    currentOrgResource = nil

    -- FLAMINGO_POLICIJA: član = posao 'police', lider = čin sa dozvolom uprave
    if GetResourceState('flamingo_policija') == 'started' then
        local okM, isMember = pcall(function() return exports['flamingo_policija']:IsPoliceMember() end)
        if okM and isMember then
            local okB, isBoss = pcall(function() return exports['flamingo_policija']:IsPoliceBoss() end)
            currentOrgResource = 'flamingo_policija'
            return okB and isBoss or false, true
        end
    end

    if GetResourceState('flamingo_hospital') == 'started' then
        local isBoss, isMember = false, false

        local ok, result = pcall(function()
            return exports['flamingo_hospital']:IsHospitalBoss()
        end)
        if ok then isBoss = result end

        local ok2, result2 = pcall(function()
            return exports['flamingo_hospital']:IsOrgMember()
        end)
        if ok2 then isMember = result2 end

        if isBoss or isMember then
            currentOrgResource = 'flamingo_hospital'
            return isBoss, isMember
        end
    end

    if GetResourceState('flamingo_lifeinvader') == 'started' then
        local isBoss, isMember = false, false

        local ok, result = pcall(function()
            return exports['flamingo_lifeinvader']:IsLifeinvaderBoss()
        end)
        if ok then isBoss = result end

        local ok2, result2 = pcall(function()
            return exports['flamingo_lifeinvader']:IsLifeinvaderMember()
        end)
        if ok2 then isMember = result2 end

        if isBoss or isMember then
            currentOrgResource = 'flamingo_lifeinvader'
            return isBoss, isMember
        end
    end

    -- FLAMINGO_VLADA: isti obrazac kao bolnica/lifeinvader iznad - proverava
    -- da li je igrač trenutno zaposlen u "vladi" (Config.GovJobs u
    -- flamingo_vlada) i da li ima čin 'boss'.
    if GetResourceState('flamingo_vlada') == 'started' then
        local isBoss, isMember = false, false

        local ok, result = pcall(function()
            return exports['flamingo_vlada']:IsGovBoss()
        end)
        if ok then isBoss = result end

        local ok2, result2 = pcall(function()
            return exports['flamingo_vlada']:IsOrgMember()
        end)
        if ok2 then isMember = result2 end

        if isBoss or isMember then
            currentOrgResource = 'flamingo_vlada'
            return isBoss, isMember
        end
    end

    return false, false
end

-- Prosledjuje isti 'org*' zahtev ka onom resursu koji trenutno "drzi"
-- organizaciju za ovog igraca (postavljeno u GetOrgFlags/toggleTablet).
-- Sad podržava i flamingo_vlada pored bolnice i Lifeinvader-a.
local function PoliceEventName(hospitalEvent)
    return (hospitalEvent:gsub('^flamingo_hospital:', 'flamingo_policija:'))
end

local function ForwardOrg(hospitalEvent, lifeinvaderEvent, vladaEvent, ...)
    if currentOrgResource == 'flamingo_policija' then
        if GetResourceState('flamingo_policija') ~= 'started' then return end
        TriggerServerEvent(PoliceEventName(hospitalEvent), ...)
    elseif currentOrgResource == 'flamingo_hospital' then
        if GetResourceState('flamingo_hospital') ~= 'started' then return end
        TriggerServerEvent(hospitalEvent, ...)
    elseif currentOrgResource == 'flamingo_lifeinvader' then
        if GetResourceState('flamingo_lifeinvader') ~= 'started' then return end
        TriggerServerEvent(lifeinvaderEvent, ...)
    elseif currentOrgResource == 'flamingo_vlada' then
        if GetResourceState('flamingo_vlada') ~= 'started' then return end
        TriggerServerEvent(vladaEvent, ...)
    end
end

-- Rankovi/permisije/plate postoje samo kod bolnice i vlade (Lifeinvader nema
-- taj sistem - vidi ORG_TABS_LIFEINVADER u script.js), pa ove akcije imaju
-- svoj, uži forwarder.
local function ForwardHospitalOrVlada(hospitalEvent, vladaEvent, ...)
    if currentOrgResource == 'flamingo_policija' then
        if GetResourceState('flamingo_policija') ~= 'started' then return end
        TriggerServerEvent(PoliceEventName(hospitalEvent), ...)
    elseif currentOrgResource == 'flamingo_hospital' then
        if GetResourceState('flamingo_hospital') ~= 'started' then return end
        TriggerServerEvent(hospitalEvent, ...)
    elseif currentOrgResource == 'flamingo_vlada' then
        if GetResourceState('flamingo_vlada') ~= 'started' then return end
        TriggerServerEvent(vladaEvent, ...)
    end
end

-- MDT (Vlada): ikonica aplikacije se prikazuje SAMO ako server potvrdi da
-- igrač sme da koristi bazu građana (boss ili čin sa can_manage_database).
-- Lokalna provera "da li je uopšte član vlade" štedi round-trip ka serveru
-- svima koji nisu u vladi. Odgovor stiže odmah posle 'openTablet' poruke.
local function CheckMdtAccess()
    if GetResourceState('flamingo_vlada') ~= 'started' then return end

    local ok, isMember = pcall(function()
        return exports['flamingo_vlada']:IsOrgMember()
    end)
    if not ok or not isMember then return end

    ESX.TriggerServerCallback('flamingo_vlada:mdt:access', function(res)
        if tabletOpen and res and res.ok and res.canUse then
            SendNUIMessage({ action = 'mdtAccess', access = res })
        end
    end)
end

-- MDT (Policija): ikonica samo policajcu; server (flamingo_policija) vraća
-- čin, dozvole i krivični zakonik. MDT radi samo na dužnosti (server proverava).
local function CheckPdAccess()
    if GetResourceState('flamingo_policija') ~= 'started' then return end
    local okM, isMember = pcall(function() return exports['flamingo_policija']:IsPoliceMember() end)
    if not okM or not isMember then return end
    ESX.TriggerServerCallback('flamingo_policija:mdt', function(res)
        if tabletOpen and res and res.ok then
            SendNUIMessage({ action = 'pdAccess', access = res })
        end
    end, 'access', {})
end

local function toggleTablet()
    tabletOpen = not tabletOpen

    SetNuiFocus(tabletOpen, tabletOpen)

    -- NAPOMENA: ranije je otvaranje tableta kao bolnicar automatski slalo
    -- flamingo_hospital:server:medkitGetStock da bi se odmah prikazao bedz
    -- na "Dostava Medkita" ikonici. Uklonjeno - taj event je iz
    -- flamingo_hospital resursa izbacivao notifikaciju (esx:showNotification)
    -- sa sirovim HTML tekstom ("<i class=fa-solid...>") umesto ikonice, sto
    -- je nepotrebno i ruzno iskakalo. Badge za zalihu se sad popuni tek kad
    -- se otvori sama "Dostava Medkita" aplikacija (supplyGetStock callback).

    if tabletOpen then
        CreateThread(CreateTabletProp)

        local isOrgBoss, isOrgMember = GetOrgFlags()
        local playerData = ESX.GetPlayerData()

        SendNUIMessage({
            action = 'openTablet',
            job = GetJobName(),
            emsCalls = emsCalls,
            isHospitalBoss = isOrgBoss, -- ime polja ostalo je isto, sad znaci "boss trenutne organizacije" (bolnica, vlada ili Lifeinvader)
            isOrgMember = isOrgMember,
            orgType = currentOrgResource == 'flamingo_policija' and (({ fib = 'fib', sheriff = 'sheriff' })[(ESX.GetPlayerData().job or {}).name] or 'policija')
                or currentOrgResource == 'flamingo_lifeinvader' and 'lifeinvader'
                or currentOrgResource == 'flamingo_vlada' and 'vlada'
                or currentOrgResource == 'flamingo_hospital' and 'hospital'
                or nil,
            orgPlayer = {
                name = (playerData and playerData.name) or GetPlayerName(PlayerId()),
                job = (playerData and playerData.job and playerData.job.label) or 'Nezaposlen'
            }
        })

        CheckMdtAccess()
        CheckPdAccess()
    else
        RemoveTabletProp()
        SendNUIMessage({ action = 'closeTablet' })
    end
end

RegisterCommand('toggletablet', toggleTablet, false)

-- Export za druge resurse (npr. flamingo_lifeinvader) koji zele da otvore
-- tablet umesto da drze svoj poseban NUI prozor. Ne zatvara tablet ako je
-- vec otvoren - samo ga otvara ako je zatvoren.
exports('OpenTablet', function()
    if not tabletOpen then toggleTablet() end
end)

-- Otvara tablet direktno u aplikaciji (npr. 'policija' iz G menija:
-- exports['flamingo_tablet']:OpenApp('policija', { serverId = 12 }))
exports('OpenApp', function(app, opts)
    if not tabletOpen then toggleTablet() end
    SendNUIMessage({ action = 'openApp', app = app, opts = opts })
end)

-- NAPOMENA ako "J" ne otvara tablet in-game: FiveM ume da ne primeni default
-- taster automatski ako je "J" vec zauzet nekim drugim bindom (iz drugog
-- resursa ili iz same igre) - u tom slucaju treba rucno namestiti u
-- Settings > Key Bindings > FiveM > potrazi "Otvori/Zatvori Tablet".
-- Zbog toga dodajem i /tablet komandu kao 100% siguran nacin da se otvori,
-- bez obzira na taster.
RegisterKeyMapping('toggletablet', 'Otvori/Zatvori Tablet', 'keyboard', 'J')
RegisterCommand('tablet', toggleTablet, false)

RegisterNUICallback('closeTablet', function(data, cb)
    tabletOpen = false
    SetNuiFocus(false, false)
    RemoveTabletProp()
    cb('ok')
end)

-------------------------------------------------
-- FLAMINGO_LIFEINVADER: panel drzavne sluzbe se sada prikazuje kao
-- obicna aplikacija UNUTAR tableta (ne otvara vise svoj poseban NUI
-- prozor/overlay iz drugog resursa). Ovde samo prosledjujemo pozive ka
-- server-side callback-ovima/eventima koje registruje flamingo_lifeinvader
-- (taj resurs i dalje mora biti pokrenut - on drzi bazu i proveru prava),
-- ali sav UI zivi u flamingo_tablet/html.
-------------------------------------------------
local function lifeinvaderRunning()
    if GetResourceState('flamingo_lifeinvader') == 'started' then return true end
    print('[flamingo_tablet] Resurs flamingo_lifeinvader nije pokrenut.')
    return false
end

RegisterNUICallback('li:getMyPermissions', function(data, cb)
    if not lifeinvaderRunning() then cb({ isEmployee = false }) return end
    ESX.TriggerServerCallback('flamingo_li:server:getMyPermissions', function(result)
        cb(result)
    end)
end)

RegisterNUICallback('li:getPendingAds', function(data, cb)
    if not lifeinvaderRunning() then cb({}) return end
    ESX.TriggerServerCallback('flamingo_li:server:getPendingAds', function(result)
        cb(result)
    end, data and data.payload)
end)

RegisterNUICallback('li:moderateAd', function(data, cb)
    if lifeinvaderRunning() then
        TriggerServerEvent('flamingo_li:server:moderateAd', data and data.payload)
    end
    cb('ok')
end)

-- Feed odobrenih oglasa (vidi ga BILO KOJI igrac, ne samo zaposleni)
RegisterNUICallback('li:getApprovedAds', function(data, cb)
    if not lifeinvaderRunning() then cb({}) return end
    ESX.TriggerServerCallback('flamingo_li:server:getApprovedAds', function(result)
        cb(result)
    end)
end)

-- Slanje novog oglasa na proveru (BILO KOJI igrac)
RegisterNUICallback('li:createAd', function(data, cb)
    if lifeinvaderRunning() then
        TriggerServerEvent('flamingo_li:server:createAd', data and data.payload)
    end
    cb('ok')
end)

-- Live push: novi oglas je upravo odobren negde na serveru - ako je tablet
-- otvoren, gurni ga direktno u feed (bez potrebe da igrac ponovo otvara
-- aplikaciju da bi ga video).
RegisterNetEvent('flamingo_li:client:newAd', function(ad)
    if tabletOpen then
        SendNUIMessage({ action = 'liNewAd', ad = ad })
    else
        Notify('Novi oglas je objavljen na Lifeinvader-u.', 'info', 4000, 'Lifeinvader', 'fa-solid fa-bullhorn')
    end
end)

-------------------------------------------------
-- LIFEINVADER - "Statistika" tab u deljenoj Organizacija aplikaciji (samo
-- za Lifeinvader; kod bolnice se taj tab uopste ne prikazuje). Direktan
-- request/response (ESX callback), ne "posalji pa slusaj" kao ostatak
-- org modula - ovde nema potrebe za tim, tab je specifican za jedan resurs.
-------------------------------------------------

RegisterNUICallback('orgGetMyStats', function(data, cb)
    cb('ok')
    if currentOrgResource ~= 'flamingo_lifeinvader' then return end

    ESX.TriggerServerCallback('flamingo_li:server:getOrgData', function(result)
        if tabletOpen then
            SendNUIMessage({ action = 'orgLiStatsResult', data = result })
        end
    end)
end)

RegisterNUICallback('setWaypoint', function(data, cb)
    if data and data.x and data.y then
        SetNewWaypoint(data.x + 0.0, data.y + 0.0)
    end
    cb('ok')
end)

-------------------------------------------------
-- MDT POLICIJA - sve ide na flamingo_policija (server/mdt.lua), jedan
-- callback sa rutom. Server proverava posao, dužnost i čin za SVAKU rutu.
-------------------------------------------------
local function modelLabel(model)
    local hash = tonumber(model)
    if not hash then
        if type(model) == 'string' and model ~= '' then hash = joaat(model) else return nil end
    end
    local name = GetDisplayNameFromVehicleModel(hash)
    if not name or name == 'CARNOTFOUND' then return nil end
    local label = GetLabelText(name)
    return (label and label ~= 'NULL') and label or name
end

RegisterNUICallback('pd', function(data, cb)
    local p = type(data) == 'table' and data.payload or nil
    if GetResourceState('flamingo_policija') ~= 'started' or type(p) ~= 'table' or type(p.route) ~= 'string' then
        return cb({ ok = false, error = 'Policijski sistem nije dostupan.' })
    end
    ESX.TriggerServerCallback('flamingo_policija:mdt', function(res)
        if type(res) == 'table' then
            if p.route == 'searchVehicle' and res.results then
                for _, v in ipairs(res.results) do v.modelLabel = modelLabel(v.model) end
            elseif p.route == 'vehicle' and res.vehicle then
                res.vehicle.modelLabel = modelLabel(res.vehicle.model)
            elseif (p.route == 'dispatch' or p.route == 'dashboard') and (res.list or res.calls) then
                for _, c in ipairs(res.list or res.calls) do
                    if c.coords and (not c.street or c.street == '') then
                        local ok, street = pcall(function() return exports['flamingo_policija']:GetStreet(c.coords) end)
                        if ok then c.street = street end
                    end
                end
            end
        end
        cb(res or { ok = false, error = 'Nema odgovora.' })
    end, p.route, p.payload or {})
end)

-- FIB sekcija MDT-a -> flamingo_fib (server/main.lua), iste provere (posao, dužnost, čin)
RegisterNUICallback('fib', function(data, cb)
    local p = type(data) == 'table' and data.payload or nil
    if GetResourceState('flamingo_fib') ~= 'started' or type(p) ~= 'table' or type(p.route) ~= 'string' then
        return cb({ ok = false, error = 'FIB modul nije dostupan.' })
    end
    ESX.TriggerServerCallback('flamingo_fib:mdt', function(res) cb(res or { ok = false, error = 'Nema odgovora.' }) end, p.route, p.payload or {})
end)

-- Dispatch uživo u MDT-u (isti net event koji prima flamingo_policija klijent)
RegisterNetEvent('flamingo_policija:client:dispatchNew', function(call)
    if tabletOpen then SendNUIMessage({ action = 'pdDispatch', call = call, isNew = true }) end
end)
RegisterNetEvent('flamingo_policija:client:dispatchUpdate', function(call)
    if tabletOpen then SendNUIMessage({ action = 'pdDispatch', call = call }) end
end)

-------------------------------------------------
-- Snabdevanje (MedKit supply) - sve ide preko flamingo_hospital resursa
-------------------------------------------------
local function ForwardToHospital(eventName, ...)
    if GetResourceState('flamingo_hospital') ~= 'started' then return end
    TriggerServerEvent(eventName, ...)
end

-------------------------------------------------
-- Preuzimanje poziva ("Preuzmi poziv" dugme na tabletu) - prosledjuje se
-- flamingo_hospital koji odlucuje da li je poziv jos slobodan, i ako jeste
-- obavestava SVE doktore kojima je poziv stigao da ga uklone iz liste.
-------------------------------------------------
RegisterNUICallback('preuzmiPoziv', function(data, cb)
    if data and data.id then
        ForwardToHospital('flamingo_hospital:server:claimEmsCall', data.id)
    end
    cb('ok')
end)

RegisterNUICallback('supplyGetStock', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:medkitGetStock')
    cb('ok')
end)

RegisterNUICallback('supplyGetDeliveryStatus', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:medkitGetDeliveryStatus')
    cb('ok')
end)

RegisterNUICallback('supplyGetLogs', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:medkitGetLogs')
    cb('ok')
end)

RegisterNUICallback('supplyOrderDelivery', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:medkitOrderDelivery')
    cb('ok')
end)

RegisterNUICallback('supplyMarkLocation', function(data, cb)
    if GetResourceState('flamingo_hospital') == 'started' then
        local ok = pcall(function()
            exports['flamingo_hospital']:SetMedkitDeliveryWaypoint()
        end)
        if not ok then
            print('[flamingo_tablet] Nisam uspeo da pozovem SetMedkitDeliveryWaypoint export iz flamingo_hospital.')
        end
    end
    cb('ok')
end)

RegisterNetEvent('flamingo_hospital:client:medkitStockResult', function(data)
    if tabletOpen then
        SendNUIMessage({ action = 'supplyStockResult', data = data })
    end
end)

RegisterNetEvent('flamingo_hospital:client:medkitDeliveryStatusResult', function(delivery)
    if tabletOpen then
        SendNUIMessage({ action = 'supplyDeliveryResult', delivery = delivery })
    end
end)

RegisterNetEvent('flamingo_hospital:client:medkitLogsResult', function(logs)
    if tabletOpen then
        SendNUIMessage({ action = 'supplyLogsResult', logs = logs })
    end
end)

-------------------------------------------------
-- Primanje EMS poziva (šalje flamingo_hospital kad neko klikne "Pozovi Doktora"
-- na downed ekranu ILI kad neko pozove doktora preko flamingo_telefon)
-------------------------------------------------
RegisterNetEvent('flamingo_tablet:client:receiveEmsCall', function(data)
    table.insert(emsCalls, 1, data)

    while #emsCalls > MAX_STORED_CALLS do
        table.remove(emsCalls)
    end

    if tabletOpen then
        SendNUIMessage({ action = 'newEmsCall', call = data })
    else
        Notify(('Novi poziv: %s'):format(data and data.name or 'nepoznat igrač'), 'info', 5000, 'Bolnica', 'fa-solid fa-truck-medical')
    end
end)

-------------------------------------------------
-- Neko je preuzeo poziv (moglo je da bude i sam igrac klikom na "Preuzmi
-- poziv") - ukloni ga iz lokalne liste i sa tableta ako je otvoren.
-------------------------------------------------
RegisterNetEvent('flamingo_tablet:client:callTaken', function(callId, takenByName, byMe)
    for i = #emsCalls, 1, -1 do
        if emsCalls[i].id == callId then
            table.remove(emsCalls, i)
            break
        end
    end

    if tabletOpen then
        SendNUIMessage({ action = 'callTaken', id = callId, takenBy = takenByName, byMe = byMe })
    elseif byMe then
        Notify('Preuzeo/la si poziv. Kreni prema lokaciji.', 'success', 5000, 'Bolnica', 'fa-solid fa-truck-medical')
    else
        Notify(('Poziv je preuzeo/la %s.'):format(takenByName or 'drugi doktor'), 'info', 4000, 'Bolnica', 'fa-solid fa-truck-medical')
    end
end)

-- Preuzimanje nije uspelo (poziv vise ne postoji / vec ga je neko preuzeo)
RegisterNetEvent('flamingo_tablet:client:claimFailed', function(callId, reason)
    if tabletOpen then
        SendNUIMessage({ action = 'claimFailed', id = callId, reason = reason })
    end
end)

-------------------------------------------------
-- Status dežurnih doktora za Bolnica aplikaciju (koliko je EMS-ovaca trenutno na duty-u)
-------------------------------------------------
RegisterNUICallback('bolnicaGetDutyStatus', function(data, cb)
    if GetResourceState('flamingo_hospital') ~= 'started' then
        SendNUIMessage({ action = 'bolnicaDutyStatusResult', available = false, onDuty = 0 })
        cb('ok')
        return
    end

    ESX.TriggerServerCallback('flamingo_hospital:server:getEmsDutyStatus', function(result)
        SendNUIMessage({ action = 'bolnicaDutyStatusResult', available = true, onDuty = result and result.onDuty or 0 })
    end)
    cb('ok')
end)

-------------------------------------------------
-- LIDER ORGANIZACIJE - prosleđuje sve akcije ka flamingo_hospital resursu
-- (koji poseduje 'ambulance' job/boss logiku) i vraća rezultate nazad u NUI.
-- Preseljeno iz flamingo_mmenu bez izmena u ponašanju.
-------------------------------------------------

RegisterNUICallback('orgGetMembers', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgGetMembers', 'flamingo_li:server:orgGetMembers', 'flamingo_vlada:server:orgGetMembers')
    cb('ok')
end)

RegisterNUICallback('orgKickMember', function(data, cb)
    ForwardOrg('flamingo_hospital:server:orgKickMember', 'flamingo_li:server:orgKickMember', 'flamingo_vlada:server:orgKickMember', data.name, data.identifier)
    cb('ok')
end)

RegisterNUICallback('orgSetMemberGrade', function(data, cb)
    ForwardOrg('flamingo_hospital:server:orgSetMemberGrade', 'flamingo_li:server:orgSetMemberGrade', 'flamingo_vlada:server:orgSetMemberGrade', data.name, data.grade, data.identifier)
    cb('ok')
end)

RegisterNUICallback('orgGetRanks', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgGetRanks', 'flamingo_li:server:orgGetRanks', 'flamingo_vlada:server:orgGetRanks')
    cb('ok')
end)

RegisterNUICallback('orgSetRankLabel', function(data, cb)
    ForwardHospitalOrVlada('flamingo_hospital:server:orgSetRankLabel', 'flamingo_vlada:server:orgSetRankLabel', data.grade, data.label)
    cb('ok')
end)

RegisterNUICallback('orgSetRankPermissions', function(data, cb)
    ForwardHospitalOrVlada('flamingo_hospital:server:orgSetRankPermissions', 'flamingo_vlada:server:orgSetRankPermissions', data.grade, data.perms)
    cb('ok')
end)

RegisterNUICallback('orgSetSalary', function(data, cb)
    ForwardHospitalOrVlada('flamingo_hospital:server:orgSetSalary', 'flamingo_vlada:server:orgSetSalary', data.grade, data.salary)
    cb('ok')
end)

RegisterNUICallback('orgToggleSalaries', function(data, cb)
    ForwardHospitalOrVlada('flamingo_hospital:server:orgToggleSalaries', 'flamingo_vlada:server:orgToggleSalaries', data.enabled)
    cb('ok')
end)

RegisterNUICallback('orgGetSafe', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgGetSafe', 'flamingo_li:server:orgGetSafe', 'flamingo_vlada:server:orgGetSafe')
    cb('ok')
end)

RegisterNUICallback('orgSafeDeposit', function(data, cb)
    ForwardOrg('flamingo_hospital:server:orgSafeDeposit', 'flamingo_li:server:orgSafeDeposit', 'flamingo_vlada:server:orgSafeDeposit', data.amount)
    cb('ok')
end)

RegisterNUICallback('orgSafeWithdraw', function(data, cb)
    ForwardOrg('flamingo_hospital:server:orgSafeWithdraw', 'flamingo_li:server:orgSafeWithdraw', 'flamingo_vlada:server:orgSafeWithdraw', data.amount)
    cb('ok')
end)

RegisterNUICallback('orgGetVehicles', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetVehicles')
    cb('ok')
end)

RegisterNUICallback('orgSpawnVehicle', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:orgSpawnVehicle', data.model)
    cb('ok')
end)

RegisterNUICallback('orgGetSettings', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgGetSettings', 'flamingo_li:server:orgGetSettings', 'flamingo_vlada:server:orgGetSettings')
    cb('ok')
end)

RegisterNUICallback('orgSetSettings', function(data, cb)
    ForwardOrg('flamingo_hospital:server:orgSetSettings', 'flamingo_li:server:orgSetSettings', 'flamingo_vlada:server:orgSetSettings', data)
    cb('ok')
end)

RegisterNUICallback('orgGetLogs', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgGetLogs', 'flamingo_li:server:orgGetLogs', 'flamingo_vlada:server:orgGetLogs')
    cb('ok')
end)

RegisterNUICallback('orgAnnounce', function(data, cb)
    ForwardOrg('flamingo_hospital:server:orgAnnounce', 'flamingo_li:server:orgAnnounce', 'flamingo_vlada:server:orgAnnounce', data.title, data.message)
    cb('ok')
end)

-- Rezultati koji stižu nazad sa servera (flamingo_hospital ILI
-- flamingo_lifeinvader, zavisno od organizacije) - samo se prosleđuju u
-- NUI ako je tablet trenutno otvoren. Oba resursa salju ISTI NUI 'action'
-- ime, pa im script.js ne pravi nikakvu razliku pri prikazu.

RegisterNetEvent('flamingo_hospital:client:orgMembersResult', function(members)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgMembersResult', members = members })
end)

RegisterNetEvent('flamingo_li:client:orgMembersResult', function(members)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgMembersResult', members = members })
end)

RegisterNetEvent('flamingo_vlada:client:orgMembersResult', function(members)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgMembersResult', members = members })
end)

RegisterNetEvent('flamingo_hospital:client:orgRanksResult', function(ranks)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgRanksResult', ranks = ranks })
end)

RegisterNetEvent('flamingo_li:client:orgRanksResult', function(ranks)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgRanksResult', ranks = ranks })
end)

RegisterNetEvent('flamingo_vlada:client:orgRanksResult', function(ranks)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgRanksResult', ranks = ranks })
end)

RegisterNetEvent('flamingo_hospital:client:orgSafeResult', function(balance, logs)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgSafeResult', balance = balance, logs = logs })
end)

RegisterNetEvent('flamingo_li:client:orgSafeResult', function(balance, logs)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgSafeResult', balance = balance, logs = logs })
end)

RegisterNetEvent('flamingo_vlada:client:orgSafeResult', function(balance, logs)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgSafeResult', balance = balance, logs = logs })
end)

RegisterNetEvent('flamingo_hospital:client:orgVehiclesResult', function(vehicles)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgVehiclesResult', vehicles = vehicles })
end)

RegisterNetEvent('flamingo_hospital:client:orgSettingsResult', function(settings)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgSettingsResult', settings = settings })
end)

RegisterNetEvent('flamingo_li:client:orgSettingsResult', function(settings)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgSettingsResult', settings = settings })
end)

RegisterNetEvent('flamingo_vlada:client:orgSettingsResult', function(settings)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgSettingsResult', settings = settings })
end)

RegisterNetEvent('flamingo_hospital:client:orgLogsResult', function(logs)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgLogsResult', logs = logs })
end)

RegisterNetEvent('flamingo_li:client:orgLogsResult', function(logs)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgLogsResult', logs = logs })
end)

RegisterNetEvent('flamingo_vlada:client:orgLogsResult', function(logs)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgLogsResult', logs = logs })
end)

-- FLAMINGO_POLICIJA: isti rezultati kao kod vlade/bolnice
RegisterNetEvent('flamingo_policija:client:orgMembersResult', function(members)
    if tabletOpen then SendNUIMessage({ action = 'orgMembersResult', members = members }) end
end)
RegisterNetEvent('flamingo_policija:client:orgRanksResult', function(ranks)
    if tabletOpen then SendNUIMessage({ action = 'orgRanksResult', ranks = ranks }) end
end)
RegisterNetEvent('flamingo_policija:client:orgSafeResult', function(balance, logs)
    if tabletOpen then SendNUIMessage({ action = 'orgSafeResult', balance = balance, logs = logs }) end
end)
RegisterNetEvent('flamingo_policija:client:orgSettingsResult', function(settings)
    if tabletOpen then SendNUIMessage({ action = 'orgSettingsResult', settings = settings }) end
end)
RegisterNetEvent('flamingo_policija:client:orgLogsResult', function(logs)
    if tabletOpen then SendNUIMessage({ action = 'orgLogsResult', logs = logs }) end
end)
RegisterNetEvent('flamingo_policija:client:orgAnnouncementsResult', function(list, lastRead)
    if tabletOpen then SendNUIMessage({ action = 'orgAnnouncementsResult', list = list, lastRead = lastRead }) end
end)

-------------------------------------------------
-- ORGANIZACIJA (svi članovi) - dodatne akcije pored onih iz Lider panela
-------------------------------------------------

RegisterNUICallback('orgGetAnnouncements', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgGetAnnouncements', 'flamingo_li:server:orgGetAnnouncements', 'flamingo_vlada:server:orgGetAnnouncements')
    cb('ok')
end)

RegisterNUICallback('orgMarkAnnouncementsRead', function(_, cb)
    ForwardOrg('flamingo_hospital:server:orgMarkAnnouncementsRead', 'flamingo_li:server:orgMarkAnnouncementsRead', 'flamingo_vlada:server:orgMarkAnnouncementsRead')
    cb('ok')
end)

RegisterNetEvent('flamingo_li:client:orgAnnouncementsResult', function(list, lastRead)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgAnnouncementsResult', list = list, lastRead = lastRead })
end)

RegisterNetEvent('flamingo_vlada:client:orgAnnouncementsResult', function(list, lastRead)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgAnnouncementsResult', list = list, lastRead = lastRead })
end)

RegisterNUICallback('orgGetMyProfile', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetMyProfile')
    cb('ok')
end)

RegisterNUICallback('orgGetDutyStats', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetDutyStats')
    cb('ok')
end)

RegisterNetEvent('flamingo_hospital:client:orgDutyStatsResult', function(stats)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgDutyStatsResult', stats = stats })
end)

RegisterNUICallback('orgGetLeaderboard', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetLeaderboard')
    cb('ok')
end)

RegisterNUICallback('orgGetInfo', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetInfo')
    cb('ok')
end)

RegisterNUICallback('orgGetEvents', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetEvents')
    cb('ok')
end)

RegisterNUICallback('orgSignupEvent', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:orgSignupEvent', data.eventId)
    cb('ok')
end)

RegisterNUICallback('orgCancelEventSignup', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:orgCancelEventSignup', data.eventId)
    cb('ok')
end)

RegisterNUICallback('orgGetActivities', function(_, cb)
    ForwardToHospital('flamingo_hospital:server:orgGetActivities')
    cb('ok')
end)

RegisterNUICallback('orgSignupActivity', function(data, cb)
    ForwardToHospital('flamingo_hospital:server:orgSignupActivity', data.activityId)
    cb('ok')
end)

RegisterNetEvent('flamingo_hospital:client:orgAnnouncementsResult', function(list, lastRead)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgAnnouncementsResult', list = list, lastRead = lastRead })
end)

RegisterNetEvent('flamingo_hospital:client:orgMyProfileResult', function(profile)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgMyProfileResult', profile = profile })
end)

RegisterNetEvent('flamingo_hospital:client:orgLeaderboardResult', function(list)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgLeaderboardResult', list = list })
end)

RegisterNetEvent('flamingo_hospital:client:orgInfoResult', function(info)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgInfoResult', info = info })
end)

RegisterNetEvent('flamingo_hospital:client:orgEventsResult', function(list)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgEventsResult', list = list })
end)

RegisterNetEvent('flamingo_hospital:client:orgActivitiesResult', function(list)
    if not tabletOpen then return end
    SendNUIMessage({ action = 'orgActivitiesResult', list = list })
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() == resourceName and tabletOpen then
        SetNuiFocus(false, false)
        RemoveTabletProp()
    end
end)

-------------------------------------------------
-- ZAHTEVI (Vlada) - tab "Zahtevi" u aplikaciji Organizacija.
-- Tablet samo prosleđuje ono što korisnik unese ka flamingo_vlada serveru
-- (flamingo_vlada/requests/server.lua). Sve provere prava, statusa i
-- podnosioca rade se TAMO - ovde nema nikakve odluke.
-------------------------------------------------
local REQUEST_ROUTES = {
    ['req:list']    = 'flamingo_vlada:requests:list',
    ['req:get']     = 'flamingo_vlada:requests:get',
    ['req:create']  = 'flamingo_vlada:requests:create',
    ['req:cancel']  = 'flamingo_vlada:requests:cancel',
    ['req:approve'] = 'flamingo_vlada:requests:approve',
    ['req:reject']  = 'flamingo_vlada:requests:reject'
}

for nuiName, serverCallback in pairs(REQUEST_ROUTES) do
    RegisterNUICallback(nuiName, function(data, cb)
        if GetResourceState('flamingo_vlada') ~= 'started' then
            cb({ ok = false, error = 'Sistem zahteva trenutno nije dostupan.' })
            return
        end

        ESX.TriggerServerCallback(serverCallback, function(result)
            cb(result or { ok = false, error = 'Nema odgovora sa servera.' })
        end, data and data.payload)
    end)
end

-- Server javlja da se nešto promenilo (novi zahtev / obrada) - tablet osvežava listu ako je tab otvoren.
RegisterNetEvent('flamingo_vlada:requests:client:changed', function()
    if tabletOpen then
        SendNUIMessage({ action = 'requestsChanged' })
    end
end)

-------------------------------------------------
-- MDT (Vlada) - aplikacija "MDT" u tabletu: baza građana, beleške, dokumenta.
-- Kao i kod Zahteva, tablet samo prosleđuje ono što korisnik unese ka
-- flamingo_vlada serveru (flamingo_vlada/mdt/server.lua). Sve provere
-- prava, pretragu i upise radi SERVER - ovde nema nikakve odluke.
-------------------------------------------------
local MDT_ROUTES = {
    ['mdt:search']     = 'flamingo_vlada:mdt:search',
    ['mdt:profile']    = 'flamingo_vlada:mdt:profile',
    ['mdt:noteAdd']    = 'flamingo_vlada:mdt:noteAdd',
    ['mdt:noteDelete'] = 'flamingo_vlada:mdt:noteDelete',
    ['mdt:documents']  = 'flamingo_vlada:mdt:documents',
    ['mdt:audit']      = 'flamingo_vlada:mdt:audit'
}

for nuiName, serverCallback in pairs(MDT_ROUTES) do
    RegisterNUICallback(nuiName, function(data, cb)
        if GetResourceState('flamingo_vlada') ~= 'started' then
            cb({ ok = false, error = 'MDT trenutno nije dostupan.' })
            return
        end

        ESX.TriggerServerCallback(serverCallback, function(result)
            cb(result or { ok = false, error = 'Nema odgovora sa servera.' })
        end, data and data.payload)
    end)
end

-- Izdavanje/obnova dokumenata iz profila građanina. Koristi POSTOJEĆE server
-- evente iz flamingo_vlada (isti kao G-meni) - oni sami proveravaju permisiju
-- can_manage_documents, da li je građanin u blizini i uslove iz
-- flamingo_documents. Rezultat stiže kao obična notifikacija
-- ('flamingo_vlada:notify'), pa je ovde prosleđujemo u tablet dok čekamo.
local mdtIssuePendingUntil = 0

RegisterNUICallback('mdt:issue', function(data, cb)
    cb('ok')

    if GetResourceState('flamingo_vlada') ~= 'started' or type(data) ~= 'table' then return end

    local targetId = tonumber(data.targetId)
    if not targetId then return end

    local mode = data.mode == 'renew' and 'renew' or 'issue'
    mdtIssuePendingUntil = GetGameTimer() + 5000

    if data.kind == 'idcard' then
        TriggerServerEvent('flamingo_vlada:server:issueIdCard', targetId, mode)
    elseif data.kind == 'license' and type(data.category) == 'string' then
        TriggerServerEvent('flamingo_vlada:server:issueLicense', targetId, data.category, mode)
    end
end)

RegisterNetEvent('flamingo_vlada:notify', function(message, notifyType)
    if tabletOpen and GetGameTimer() < mdtIssuePendingUntil then
        mdtIssuePendingUntil = 0
        SendNUIMessage({ action = 'mdtIssueResult', message = message, type = notifyType })
    end
end)

-------------------------------------------------
-- DIJAGNOSTIKA (privremeno): /orgdebug u F8 konzoli ispisuje zašto tablet
-- prikazuje ili ne prikazuje aplikaciju Organizacija. Može da se obriše
-- kad se sve sredi.
-------------------------------------------------
RegisterCommand('orgdebug', function()
    local pd = ESX.GetPlayerData()
    local job = pd and pd.job
    print('[orgdebug] posao:', job and job.name, '| grade:', job and job.grade, '| grade_name:', job and job.grade_name)

    for _, res in ipairs({ 'flamingo_hospital', 'flamingo_lifeinvader', 'flamingo_vlada', 'flamingo_npcdialog' }) do
        print(('[orgdebug] resurs %s = %s'):format(res, GetResourceState(res)))
    end

    local checks = {
        { 'flamingo_hospital', 'IsHospitalBoss' }, { 'flamingo_hospital', 'IsOrgMember' },
        { 'flamingo_lifeinvader', 'IsLifeinvaderBoss' }, { 'flamingo_lifeinvader', 'IsLifeinvaderMember' },
        { 'flamingo_vlada', 'IsGovBoss' }, { 'flamingo_vlada', 'IsOrgMember' },
    }
    for _, c in ipairs(checks) do
        local ok, result = pcall(function() return exports[c[1]][c[2]](exports[c[1]]) end)
        print(('[orgdebug] %s:%s -> ok=%s, rezultat=%s'):format(c[1], c[2], tostring(ok), tostring(result)))
    end

    local b, m = GetOrgFlags()
    print('[orgdebug] GetOrgFlags -> boss:', b, '| member:', m, '| currentOrgResource:', currentOrgResource)
end, false)

-------------------------------------------------
-- NEKRETNINE (flamingo_kuce) - aplikacija "Nekretnine" u tabletu.
-- Tablet samo prosleđuje zahteve ka flamingo_kuce serveru; sve provere
-- (vlasnik/stanar, popunjenost, prodaja) rade se TAMO.
-------------------------------------------------
local KUCE_ROUTES = {
    ['kuce:list']   = 'flamingo_kuce:tablet:list',
    ['kuce:action'] = 'flamingo_kuce:tablet:action'
}

for nuiName, serverCallback in pairs(KUCE_ROUTES) do
    RegisterNUICallback(nuiName, function(data, cb)
        if GetResourceState('flamingo_kuce') ~= 'started' then
            cb({ ok = false, error = 'Sistem kuća trenutno nije dostupan.' })
            return
        end

        ESX.TriggerServerCallback(serverCallback, function(result)
            cb(result or { ok = false, error = 'Nema odgovora sa servera.' })
        end, data and data.payload)
    end)
end

-------------------------------------------------
-- MARKET (flamingo_market) - aplikacija "Market" u tabletu.
-- Tablet samo prosleđuje zahteve; sve provere (vlasništvo, novac,
-- prenos vozila/kuća/predmeta) rade se na flamingo_market serveru.
-------------------------------------------------
local MARKET_ROUTES = {
    ['market:list']      = 'flamingo_market:tablet:list',
    ['market:detail']    = 'flamingo_market:tablet:detail',
    ['market:sellables'] = 'flamingo_market:tablet:sellables',
    ['market:create']    = 'flamingo_market:tablet:create',
    ['market:cancel']    = 'flamingo_market:tablet:cancel',
    ['market:favorite']  = 'flamingo_market:tablet:favorite',
    ['market:buy']       = 'flamingo_market:tablet:buy'
}

for nuiName, serverCallback in pairs(MARKET_ROUTES) do
    RegisterNUICallback(nuiName, function(data, cb)
        if GetResourceState('flamingo_market') ~= 'started' then
            cb({ ok = false, error = 'Market trenutno nije dostupan.' })
            return
        end

        ESX.TriggerServerCallback(serverCallback, function(result)
            cb(result or { ok = false, error = 'Nema odgovora sa servera.' })
        end, data and data.payload)
    end)
end

-- Nazivi, marke i slike vozila (natives + flamingo_autosalon) za kartice u Marketu.
RegisterNUICallback('market:vehicleInfo', function(data, cb)
    local out = {}
    local models = (data and data.payload and data.payload.models) or {}

    for _, model in ipairs(models) do
        local hash = (type(model) == 'string') and GetHashKey(model) or model
        local name = GetDisplayNameFromVehicleModel(hash)
        local label = GetLabelText(name)
        if label == 'NULL' or label == '' then label = name end

        local brand = ''
        local make = GetMakeNameFromVehicleModel and GetMakeNameFromVehicleModel(hash) or nil
        if make and make ~= '' and make ~= 'NULL' then
            local ml = GetLabelText(make)
            brand = (ml ~= 'NULL' and ml ~= '') and ml or make
        end

        local image
        if GetResourceState('flamingo_autosalon') == 'started' then
            local ok, img = pcall(function() return exports['flamingo_autosalon']:GetVehicleImage(hash) end)
            if ok and type(img) == 'string' and img ~= '' then
                image = img:find('://') and img or ('nui://flamingo_autosalon/html/%s'):format(img)
            end
        end

        out[tostring(model)] = { label = label, brand = brand, image = image }
    end

    cb(out)
end)
