local ESX = exports['es_extended']:getSharedObject()

-- ============================================================
--  FLAMINGO RADIAL MENU - klijent
--
--  VAZNO (zbog cega je meni ranije "bagovao"):
--  RegisterPedheadshotTransparent nije trenutan - GTA-u treba
--  200-800ms (a ponekad i vise) da renderuje glavu lika u teksturu.
--  Ranije se na to CEKALO unutar openRadial(), pre nego sto se
--  meni uopste posalje NUI-u. Zbog toga je izmedju pritiska na G
--  i pojave menija postojala "mrtva zona" u kojoj je menuOpen vec
--  bio true, ali meni jos nije bio na ekranu. Drugi pritisak na G
--  u toj zoni je pozvao closeRadial(), pa je stara, jos uvek
--  aktivna openRadial() korutina posle toga poslala 'open' i
--  SetNuiFocus(true) - meni na ekranu, a menuOpen = false.
--  Odatle "otvori se pa zatvori pa opet otvori" i zaglavljen fokus.
--
--  Sada: meni se salje ODMAH, bez ijednog Wait-a. Fotografija se
--  hvata u pozadini i naknadno "dolepi" u NUI kad bude gotova,
--  a rezultat se kesira da se ne hvata iznova pri svakom otvaranju.
-- ============================================================

local menuOpen      = false
local lastToggle    = 0
local TOGGLE_DEBOUNCE = 200   -- ms, koliko brzo uzastopno G sme da se okine

-- ============================================================
--  FOTOGRAFIJA LIKA (headshot)
-- ============================================================

local HEADSHOT_TIMEOUT = 5000    -- ms, koliko najduze cekamo na teksturu
local MY_PHOTO_TTL     = 600000  -- ms, koliko dugo svoja slika vazi (10 min)
local FOREIGN_TTL      = 60000   -- ms, koliko dugo tudja slika vazi (1 min)

local myPhoto      = { url = nil, handle = nil, model = nil, at = 0 }
local myPhotoBusy  = false
local myPhotoQueue = {}

local foreignPhoto = { url = nil, handle = nil, serverId = nil, at = 0 }
local foreignBusy  = false

--- Hvata headshot u zasebnoj korutini i vraca rezultat kroz callback.
--- NIKAD ne blokira pozivaoca.
local function captureHeadshot(ped, cb)
    if not ped or ped == 0 or not DoesEntityExist(ped) then
        return cb(nil, nil)
    end

    CreateThread(function()
        local handle = RegisterPedheadshotTransparent(ped)

        if not handle or handle == 0 or handle == -1 then
            return cb(nil, nil)
        end

        local deadline = GetGameTimer() + HEADSHOT_TIMEOUT

        -- Wait(50) umesto Wait(10): tekstura ionako nije gotova pre
        -- nekoliko stotina ms, a ovako je 5x manje provera po hvatanju.
        while not IsPedheadshotReady(handle) or not IsPedheadshotValid(handle) do
            Wait(50)

            if GetGameTimer() > deadline then
                UnregisterPedheadshot(handle)
                return cb(nil, nil)
            end
        end

        local txd = GetPedheadshotTxdString(handle)

        if not txd or txd == '' then
            UnregisterPedheadshot(handle)
            return cb(nil, nil)
        end

        cb(('https://nui-img/%s/%s'):format(txd, txd), handle)
    end)
end

local function flushMyPhotoQueue(url)
    local waiters = myPhotoQueue
    myPhotoQueue = {}

    for _, cb in ipairs(waiters) do
        cb(url)
    end
end

--- Vraca URL svoje fotografije kroz callback.
--- Ako je vec kesirana i lik se nije presvukao/promenio model - odmah.
--- Ako nije - callback stize kasnije, a pozivaoc ide dalje bez cekanja.
local function getMyPhoto(cb)
    local ped   = PlayerPedId()
    local model = GetEntityModel(ped)

    local cacheValid = myPhoto.url
        and myPhoto.model == model
        and (GetGameTimer() - myPhoto.at) < MY_PHOTO_TTL

    if cacheValid then
        return cb(myPhoto.url)
    end

    myPhotoQueue[#myPhotoQueue + 1] = cb

    if myPhotoBusy then return end
    myPhotoBusy = true

    captureHeadshot(ped, function(url, handle)
        myPhotoBusy = false

        if not url then
            return flushMyPhotoQueue(nil)
        end

        -- Stari slot se oslobadja tek kad je novi spreman, da NUI
        -- ne bi ni na trenutak ostao bez vazece teksture.
        if myPhoto.handle then
            UnregisterPedheadshot(myPhoto.handle)
        end

        myPhoto.url    = url
        myPhoto.handle = handle
        myPhoto.model  = model
        myPhoto.at     = GetGameTimer()

        flushMyPhotoQueue(url)
    end)
end

--- Fotografija drugog igraca (za "pokazi dokument" i policijsku proveru).
local function getPhotoOf(serverId, cb)
    local player = GetPlayerFromServerId(serverId)
    if player == -1 then return cb(nil) end

    if foreignPhoto.url
        and foreignPhoto.serverId == serverId
        and (GetGameTimer() - foreignPhoto.at) < FOREIGN_TTL then
        return cb(foreignPhoto.url)
    end

    if foreignBusy then return cb(nil) end
    foreignBusy = true

    captureHeadshot(GetPlayerPed(player), function(url, handle)
        foreignBusy = false

        if not url then return cb(nil) end

        if foreignPhoto.handle then
            UnregisterPedheadshot(foreignPhoto.handle)
        end

        foreignPhoto.url      = url
        foreignPhoto.handle   = handle
        foreignPhoto.serverId = serverId
        foreignPhoto.at       = GetGameTimer()

        cb(url)
    end)
end

--- Kesirana slika, ali samo ako i dalje odgovara trenutnom liku.
--- Koristi se da kartica odmah ima sliku kad je vec imamo od ranije.
local function cachedMyPhotoUrl()
    if not myPhoto.url then return nil end
    if myPhoto.model ~= GetEntityModel(PlayerPedId()) then return nil end
    if (GetGameTimer() - myPhoto.at) >= MY_PHOTO_TTL then return nil end

    return myPhoto.url
end

--- Salje fotografiju NUI-u tek kad je spremna. `token` je generacija
--- menija - ako se meni u medjuvremenu zatvorio i opet otvorio,
--- zakasnela slika iz proslog otvaranja se ignorise.
local menuGeneration = 0

local function pushMyPhoto(token)
    getMyPhoto(function(url)
        if not url then return end
        if token ~= menuGeneration then return end

        SendNUIMessage({ action = 'photo', url = url })
    end)
end

--- Rucno osvezavanje slike - pozovi posle presvlacenja lika.
--- exports['flamingo_radialmenu']:RefreshPhoto()
local function refreshMyPhoto()
    myPhoto.url   = nil
    myPhoto.model = nil
    myPhoto.at    = 0
end

exports('RefreshPhoto', refreshMyPhoto)

AddEventHandler('skinchanger:modelLoaded', refreshMyPhoto)
AddEventHandler('esx_skin:hasEnteredLastPosition', refreshMyPhoto)
RegisterNetEvent('esx:playerLoaded', refreshMyPhoto)

-- ============================================================
--  OPEN / CLOSE
-- ============================================================

local function canOpen()
    local ped = PlayerPedId()

    if IsPauseMenuActive() then return false end
    if IsEntityDead(ped) then return false end
    if IsPedCuffed(ped) then return false end

    -- U vozilu G pripada flamingo_radialmenuauta (meni za kola).
    -- Bez ove provere bi oba menija pokusala da se otvore istovremeno.
    if IsPedInAnyVehicle(ped, false) then return false end

    return true
end


-- ============================================================
--  SPOLJNI PROVIDERI (npr. flamingo_policija)
--  Resurs izloži export koji vraća listu kategorija:
--    { key, label, icon, type = 'category', children = {
--        { key, label, icon, type = 'action', event = 'ime:eventa', args = {...} } } }
--  Radial ih samo nacrta; klik pokreće TriggerEvent(event, table.unpack(args)).
--  Resurs sam odlučuje KO vidi šta (npr. samo policajac na dužnosti),
--  a server tog resursa ponovo proverava svaku akciju.
-- ============================================================
local EXTERNAL_PROVIDERS = {
    { resource = 'flamingo_policija', export = 'GetRadialCategories' },
    { resource = 'flamingo_fib', export = 'GetRadialCategories' },
}
local externalActions = {}

local function collectExternal()
    externalActions = {}
    local cats = {}
    for _, p in ipairs(EXTERNAL_PROVIDERS) do
        if GetResourceState(p.resource) == 'started' then
            local ok, list = pcall(function() return exports[p.resource][p.export]() end)
            if ok and type(list) == 'table' then
                local function walk(items)
                    for _, it in ipairs(items) do
                        if it.type == 'category' and it.children then walk(it.children)
                        elseif it.key and it.event then
                            externalActions[it.key] = { event = it.event, args = it.args or {} }
                            it.event, it.args = nil, nil
                        end
                    end
                end
                walk(list)
                for _, c in ipairs(list) do cats[#cats + 1] = c end
            end
        end
    end
    return cats
end

local function openRadial()
    if menuOpen then return end
    if not canOpen() then return end

    menuOpen = true
    menuGeneration = menuGeneration + 1
    local token = menuGeneration

    local playerData = ESX.GetPlayerData() or {}

    local isHospitalBoss = false
    if GetResourceState('flamingo_hospital') == 'started' then
        local ok, result = pcall(function()
            return exports['flamingo_hospital']:IsHospitalBoss()
        end)
        isHospitalBoss = ok and result or false
    end

    local isGovBoss = false
    local isGovMember = false
    if GetResourceState('flamingo_vlada') == 'started' then
        local ok, result = pcall(function()
            return exports['flamingo_vlada']:IsGovBoss()
        end)
        isGovBoss = ok and result or false

        local ok2, result2 = pcall(function()
            return exports['flamingo_vlada']:IsOrgMember()
        end)
        isGovMember = ok2 and result2 or false
    end

    local isLifeinvaderBoss = false
    if GetResourceState('flamingo_lifeinvader') == 'started' then
        local ok, result = pcall(function()
            return exports['flamingo_lifeinvader']:IsLifeinvaderBoss()
        end)
        isLifeinvaderBoss = ok and result or false
    end

    -- FLAMINGO_KUCE: dugme "Prodaj kuću" se prikazuje samo vlasniku kuće
    local hasHouse = false
    if GetResourceState('flamingo_kuce') == 'started' then
        local ok, result = pcall(function()
            return exports['flamingo_kuce']:HasOwnedHouse()
        end)
        hasHouse = ok and result or false
    end

    -- FLAMINGO_BIZNISI: dugme "Prodaj biznis" se prikazuje samo vlasniku biznisa
    local hasBusiness = false
    if GetResourceState('flamingo_biznisi') == 'started' then
        local ok, result = pcall(function()
            return exports['flamingo_biznisi']:HasBusiness()
        end)
        hasBusiness = ok and result or false
    end

    -- Meni ide odmah. Ako slika jos nije kesirana, salje se nil -
    -- NUI nacrta placeholder ikonicu i zameni je cim slika stigne.
    SendNUIMessage({
        action = 'open',
        player = {
            serverId         = GetPlayerServerId(PlayerId()),
            job              = playerData.job and playerData.job.name or nil,
            isHospitalBoss   = isHospitalBoss,
            isLifeinvaderBoss = isLifeinvaderBoss,
            isGovBoss        = isGovBoss,
            isGovMember      = isGovMember,
            hasHouse         = hasHouse,
            hasBusiness      = hasBusiness,
            photo            = cachedMyPhotoUrl(),
            external         = collectExternal(),
            policeSystem     = GetResourceState('flamingo_policija') == 'started'
        }
    })

    SetNuiFocus(true, true)

    pushMyPhoto(token)
end

local function closeRadial()
    if not menuOpen then return end

    menuOpen = false
    menuGeneration = menuGeneration + 1

    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })
end

-- ============================================================
--  KEYBIND (G)
-- ============================================================

RegisterCommand('+flamingo_radial_open', function()
    -- Debounce: dva G-a u istom kadru ili dupli okidaj tastature
    -- vise ne mogu da razminu stanje menija.
    local now = GetGameTimer()
    if now - lastToggle < TOGGLE_DEBOUNCE then return end
    lastToggle = now

    if menuOpen then closeRadial() else openRadial() end
end, false)

-- Prazna "release" komanda - bez nje konzola prijavljuje nepoznatu
-- komandu pri svakom otpustanju tastera.
RegisterCommand('-flamingo_radial_open', function() end, false)

RegisterKeyMapping('+flamingo_radial_open', 'Otvori Flamingo Radial Meni', 'keyboard', 'G')

RegisterCommand('testradial', openRadial, false)

-- ============================================================
--  NUI CALLBACKS
-- ============================================================

RegisterNUICallback('close', function(_, cb)
    closeRadial()
    cb('ok')
end)

--- Otvaranje bilo kog dokumenta - uvek svez podatak sa servera,
--- da bi rok/status bili tacni u trenutku gledanja.
local docRequest = 0

RegisterNUICallback('openDocument', function(data, cb)
    -- Uvek prvo odgovori NUI-u, pa tek onda radi posao.
    cb('ok')

    local view = data.view or 'idcard'

    if GetResourceState('flamingo_documents') ~= 'started' then
        ESX.ShowNotification('Sistem dokumenata trenutno nije dostupan.')
        return closeRadial()
    end

    docRequest = docRequest + 1
    local reqId = docRequest
    local token = menuGeneration

    ESX.TriggerServerCallback('flamingo_documents:getMyDocuments', function(payload)
        -- Zakasneli odgovor na stari zahtev se baca.
        if reqId ~= docRequest or token ~= menuGeneration then return end

        if not payload then
            ESX.ShowNotification('Ne mogu da učitam tvoja dokumenta.')
            return closeRadial()
        end

        SendNUIMessage({
            action  = 'documents',
            view    = view,
            payload = payload,
            photo   = cachedMyPhotoUrl()
        })

        pushMyPhoto(token)
    end)
end)

--- Pokazivanje dokumenta najblizem igracu.
--- Salje se SAMO koji dokument - sadrzaj server sam cita iz baze,
--- da se NUI ne bi mogao izmeniti i pokazati lazan dokument.
RegisterNUICallback('showToNearby', function(data, cb)
    cb('ok')
    TriggerServerEvent('flamingo_radialmenu:server:showDocument', data.view)
end)

local RADIAL_ACTIONS = {
    hospital_revive       = function() TriggerEvent('flamingo_hospital:client:radialRevive') end,
    hospital_heal         = function() TriggerEvent('flamingo_hospital:client:radialHeal') end,
    hospital_medkit       = function() TriggerEvent('flamingo_hospital:client:radialMedkit') end,
    hospital_medkitstock  = function() TriggerEvent('flamingo_hospital:client:checkMedkitStock') end,
    hospital_invite       = function() TriggerEvent('flamingo_hospital:client:radialInvite') end,
    hospital_kick         = function() TriggerEvent('flamingo_hospital:client:radialKick') end,
    hospital_rankup       = function() TriggerEvent('flamingo_hospital:client:radialRankUp') end,
    hospital_rankdown     = function() TriggerEvent('flamingo_hospital:client:radialRankDown') end,
    -- Vlada (Lider) - isti obrazac kao hospital_*; najbliži igrač se traži
    -- u flamingo_vlada, a server ponovo proverava permisije i udaljenost.
    gov_invite            = function() TriggerEvent('flamingo_vlada:client:radialInvite') end,
    gov_kick              = function() TriggerEvent('flamingo_vlada:client:radialKick') end,
    gov_rankup            = function() TriggerEvent('flamingo_vlada:client:radialRankUp') end,
    gov_rankdown          = function() TriggerEvent('flamingo_vlada:client:radialRankDown') end,

    -- Vlada - osnovne akcije (dostupno svakom zaposlenom, ne samo lideru)
    gov_cuff              = function() TriggerEvent('flamingo_vlada:client:radialCuff') end,
    gov_uncuff            = function() TriggerEvent('flamingo_vlada:client:radialUncuff') end,
    gov_search            = function() TriggerEvent('flamingo_vlada:client:radialSearch') end,
    gov_vehicle_in        = function() TriggerEvent('flamingo_vlada:client:radialPutInVehicle') end,
    gov_vehicle_out       = function() TriggerEvent('flamingo_vlada:client:radialPullFromVehicle') end,

    -- Vlada - izdavanje lične karte i dozvola (rok 30 dana za dozvole podešen u flamingo_documents)
    gov_issue_idcard      = function() TriggerEvent('flamingo_vlada:client:radialIssueIdCard') end,
    gov_renew_idcard      = function() TriggerEvent('flamingo_vlada:client:radialRenewIdCard') end,
    gov_renew_weapon      = function() TriggerEvent('flamingo_vlada:client:radialRenewLicense', 'weapon') end,
    gov_renew_fishing     = function() TriggerEvent('flamingo_vlada:client:radialRenewLicense', 'fishing') end,
    gov_issue_weapon      = function() TriggerEvent('flamingo_vlada:client:radialIssueLicense', 'weapon') end,
    gov_issue_fishing     = function() TriggerEvent('flamingo_vlada:client:radialIssueLicense', 'fishing') end,
    basic_medkit_revive   = function() TriggerEvent('flamingo_hospital:client:medkitRevive') end,
    basic_introduce       = function() TriggerServerEvent('flamingo_radialmenu:server:introduceRequest') end,
    docs_check_nearby     = function() TriggerEvent('flamingo_documents:client:checkNearby') end,

    -- FLAMINGO_KUCE: prodaja kuće drugom igraču. Kratka pauza da se radial
    -- prvo zatvori (i pusti NUI fokus), pa tek onda otvara prozor prodaje.
    house_sell            = function()
        if GetResourceState('flamingo_kuce') ~= 'started' then return end
        CreateThread(function()
            Wait(150)
            exports['flamingo_kuce']:OpenSellMenu()
        end)
    end,

    -- FLAMINGO_BIZNISI: prodaja biznisa drugom igraču (isto kao kuća)
    biz_sell              = function()
        if GetResourceState('flamingo_biznisi') ~= 'started' then return end
        CreateThread(function()
            Wait(150)
            exports['flamingo_biznisi']:OpenSellMenu()
        end)
    end,

    -- Lifeinvader sef - server sam bira najblizeg igraca (isto kao
    -- docs_check_nearby), pa ovde nema potrebe za dodatnim podacima.
    li_invite             = function() TriggerServerEvent('flamingo_li:server:invite') end,
    li_kick               = function() TriggerServerEvent('flamingo_li:server:kick') end,
    li_rankup             = function() TriggerServerEvent('flamingo_li:server:rankup') end,
    li_rankdown           = function() TriggerServerEvent('flamingo_li:server:rankdown') end,

    docs_issue_medcert = function()
        if GetResourceState('flamingo_documents') ~= 'started' then
            return ESX.ShowNotification('Sistem dokumenata trenutno nije dostupan.')
        end

        local target = exports['flamingo_documents']:GetClosestPlayer()

        if target then
            TriggerServerEvent('flamingo_documents:server:requestIssueMedCert', target)
        else
            ESX.ShowNotification('Nema pacijenta dovoljno blizu.')
        end
    end
}

RegisterNUICallback('selectOption', function(data, cb)
    cb('ok')

    local handler = RADIAL_ACTIONS[data.option]
    local ext = externalActions[data.option]

    if ext then
        closeRadial()
        TriggerEvent(ext.event, table.unpack(ext.args))
    elseif handler then
        handler()
    else
        print(('[flamingo_radialmenu] Nepoznata opcija: %s'):format(tostring(data.option)))
    end
end)

-- ============================================================
--  PRIMANJE TUDJEG DOKUMENTA
-- ============================================================

--- Kartica se prikazuje odmah, sa praznim mestom za sliku.
--- Slika se dolepi cim je headshot spreman (obicno za pola sekunde,
--- a kartica stoji 12 sekundi - stigne bez problema).
local receivedGeneration = 0

local function showReceived(view, payload, fromServerId)
    receivedGeneration = receivedGeneration + 1
    local token = receivedGeneration

    SendNUIMessage({
        action  = 'showReceived',
        view    = view,
        payload = payload,
        photo   = (foreignPhoto.serverId == fromServerId) and foreignPhoto.url or nil
    })

    getPhotoOf(fromServerId, function(url)
        if not url then return end
        if token ~= receivedGeneration then return end

        SendNUIMessage({ action = 'receivedPhoto', url = url })
    end)
end

RegisterNetEvent('flamingo_radialmenu:client:receiveDocument', function(view, payload, senderId)
    showReceived(view, payload, senderId)
end)

-- Policijska provera - flamingo_documents javi rezultat, ovde se crta
RegisterNetEvent('flamingo_radialmenu:client:showForeignDocuments', function(payload, targetId)
    showReceived('all', payload, targetId)
end)

-- ============================================================
--  UPOZNAJ SE
-- ============================================================

RegisterNetEvent('flamingo_radialmenu:client:introduceIncoming', function(data)
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'introduceIncoming', data = data })
end)

RegisterNUICallback('introduceResponse', function(data, cb)
    cb('ok')
    TriggerServerEvent('flamingo_radialmenu:server:introduceResponse', data.requesterSrc, data.accepted)
end)

RegisterNUICallback('introduceHandled', function(_, cb)
    cb('ok')
    -- Ako je radial meni i dalje otvoren ispod poziva, fokus ostaje njemu.
    if not menuOpen then
        SetNuiFocus(false, false)
    end
end)

RegisterNetEvent('flamingo_radialmenu:client:introduceResult', function(accepted, targetName)
    if accepted then
        ESX.ShowNotification(('%s je prihvatio/la da se upozna sa tobom.'):format(targetName))
    else
        ESX.ShowNotification(('%s ne želi da se upozna sa tobom.'):format(targetName))
    end
end)

-- ============================================================
--  SIGURNOSNE KOCNICE
--  ESC se hvata u NUI-u (script.js), pa ovde vise nema petlje
--  na Wait(0). Ostaje samo lagana provera (2x u sekundi) da igrac
--  ne ostane zakljucan sa otvorenim menijem ako pogine ili udje
--  u pause menu.
-- ============================================================

CreateThread(function()
    while true do
        Wait(500)

        if menuOpen and (IsEntityDead(PlayerPedId()) or IsPauseMenuActive()) then
            closeRadial()
        end
    end
end)

-- ============================================================
--  CISCENJE
-- ============================================================

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end

    if myPhoto.handle then UnregisterPedheadshot(myPhoto.handle) end
    if foreignPhoto.handle then UnregisterPedheadshot(foreignPhoto.handle) end

    -- Da restart resursa ne ostavi igraca sa zakljucanim misem.
    SetNuiFocus(false, false)
end)
