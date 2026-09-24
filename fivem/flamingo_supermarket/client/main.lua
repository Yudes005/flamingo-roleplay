
-- Stabilan E prompt: ne zavisi od esx_keyprompt (koji moze sam da sakrije prompt).
local interactionPrompt = nil


local function Notify(message, notifyType, duration, title)
    local ok = pcall(function()
        exports['esx_notify']:Notify(message, notifyType or 'info', duration or 4000, title)
    end)
    if not ok then
        TriggerEvent('esx:showNotification', message, notifyType or 'info', duration or 4000)
    end
end

local function ShowInteractionPrompt(text)
    interactionPrompt = text
end

local function HideInteractionPrompt()
    interactionPrompt = nil
end

CreateThread(function()
    while true do
        if interactionPrompt then
            Wait(0)
            SetTextFont(4)
            SetTextScale(0.34, 0.34)
            SetTextColour(255, 255, 255, 255)
            SetTextCentre(true)
            SetTextOutline()
            BeginTextCommandDisplayText('STRING')
            AddTextComponentSubstringPlayerName(('[E] %s'):format(interactionPrompt))
            EndTextCommandDisplayText(0.5, 0.88)
        else
            Wait(250)
        end
    end
end)

local ESX = ESX or exports['es_extended']:getSharedObject()

local spawnedPeds = {}
local spawnedBlips = {}
local pedShopId = {}

local Shops = Config.Shops
local NuiCacheById = {}   -- [index marketa] = tabela za NUI (svaki market se prepoznaje po indexu u Config.Shops)

local OxItems = nil
local LoadedModels = {}

local isMenuOpen = false
local currentShopId = nil
local promptShown = false

-- ===================== HELPERS =====================
local function normalizeImage(itemName, image)
    if type(image) ~= 'string' or image == '' then
        return ('nui://ox_inventory/web/images/%s.png'):format(itemName)
    end

    if image:find('://', 1, true) then
        return image
    end

    if not image:find('/', 1, true) then
        return ('nui://ox_inventory/web/images/%s'):format(image)
    end

    return ('nui://ox_inventory/%s'):format(image)
end

local function loadModel(model)
    local hash = type(model) == 'number' and model or joaat(model)
    if LoadedModels[hash] then return hash end
    if not HasModelLoaded(hash) then
        RequestModel(hash)
        while not HasModelLoaded(hash) do Wait(0) end
    end
    LoadedModels[hash] = true
    return hash
end

-- Ceka da se kolizija/teren ucita na datim koordinatama, pa tek onda postavi
-- peda na pravi pod.
--
-- VAZNA IZMENA: stara verzija je posle ovoga jos i SKENIRALA visinu odozgo na
-- dole (testZ = 120.0 do -30.0) preko GetGroundZFor_3dCoord i UVEK prihvatala
-- prvi pogodak. To je bas ono sto je pravilo da "svaki NPC lebdi iznad mape" -
-- kod dosta prodavnica taj zrak odozgo prvo pogodi NADSTRESNICU/KROV iznad
-- ulaza (ili gornji sprat) PRE nego stigne do pravog chodnika, pa je ped
-- zavrsavao gore na krovu/tendi umesto na zemlji.
--
-- Config koordinate su vec ispravne (citane STOJECI na terenu u igri), pa se
-- sada VEC njima veruje kao glavnom izvoru istine. PlaceObjectOnGroundProperly
-- se i dalje koristi, ali samo kao SITNA korekcija (koristi ped-ov sopstveni
-- kolizioni box, ne slep zrak odozgo, pa ne moze da "zakaci" krov), i njegov
-- rezultat se odbacuje ako pomeri peda vise od GROUND_MAX_CORRECTION metara -
-- to je "provera zdravog razuma" koja spreci upravo ovaj bug.
local GROUND_MAX_CORRECTION = 2.0

local function placeOnGround(ped, x, y, z, heading)
    -- Ucitaj koliziju na tacnoj lokaciji pre bilo kakvog freeze-a.
    RequestCollisionAtCoord(x, y, z)
    SetEntityLoadCollisionFlag(ped, true, 1)

    local timeout = GetGameTimer() + 5000
    while GetGameTimer() < timeout do
        RequestCollisionAtCoord(x, y, z)
        if HasCollisionLoadedAroundEntity(ped) then
            break
        end
        Wait(50)
    end

    -- Postavi peda TACNO na konfigurisane koordinate - ovo je glavni izvor
    -- istine (vec je ground-level, procitano stojeci na terenu).
    SetEntityCoordsNoOffset(ped, x, y, z, false, false, false)
    SetEntityHeading(ped, heading or 0.0)
    Wait(150)

    -- Sitna korekcija preko GTA nativa (koristi ped-ov sopstveni kolizioni
    -- box na TRENUTNOJ poziciji - ne moze da "odleti" na krov/tendu kao stari
    -- pristup sa GetGroundZFor_3dCoord skenom odozgo).
    PlaceObjectOnGroundProperly(ped)
    Wait(50)

    -- Provera zdravog razuma: ako se posle korekcije ped nasao predaleko od
    -- konfigurisanog Z (zakacio krov/tendu/drugi sprat), vrati ga nazad na
    -- konfigurisani Z umesto pogresne korekcije.
    local coords = GetEntityCoords(ped)
    if math.abs(coords.z - z) > GROUND_MAX_CORRECTION then
        SetEntityCoordsNoOffset(ped, x, y, z, false, false, false)
    end

    SetEntityHeading(ped, heading or 0.0)
    Wait(50)

    -- Freeze tek nakon sto su X/Y/Z definitivno postavljeni.
    FreezeEntityPosition(ped, true)
end

local function getShopCoords(shop)
    if shop.shopCoords then return shop.shopCoords end
    if shop.ped and shop.ped.coords then
        return vec3(shop.ped.coords.x, shop.ped.coords.y, shop.ped.coords.z)
    end
    return vec3(0.0, 0.0, 0.0)
end

local function buildNuiTable(shop)
    local shopItems = shop.items or Config.DefaultItems or {}
    local artikli = {}

    for i = 1, #shopItems do
        local it = shopItems[i]
        local itemName = it.name
        if itemName then
            local itemData = OxItems and OxItems[itemName] or nil
            local label = it.label or (itemData and itemData.label) or itemName
            local img = nil
            if itemData then
                img = (itemData.client and itemData.client.image) or itemData.image
            end

            artikli[#artikli + 1] = {
                ime = label,
                id = itemName,
                slika = normalizeImage(itemName, img),
                cijena = it.price,
                kategorija = 'artikli',
            }
        end
    end

    return {
        ime = shop.label,
        javno = { artikli = artikli }
    }
end

-- Server salje notifikacije preko ovog eventa (vidi server/main.lua) - prolazi
-- kroz isti robustan Notify() wrapper sa vrha fajla (koji koristi esx_notify
-- export, sa fallback-om ako iz nekog razloga nije dostupan).
RegisterNetEvent('flamingo_supermarket:notify', function(msg, notifyType, duration, title)
    Notify(msg, notifyType, duration, title)
end)

-- ===================== PROMPT (E) - koristi esx_keyprompt =====================
local function showPrompt()
    if promptShown then return end
    promptShown = true
    exports['esx_keyprompt']:ShowKeyPrompt(Config.Locales.promptText, 'E')
end

local function hidePrompt()
    if not promptShown then return end
    promptShown = false
    exports['esx_keyprompt']:HideKeyPrompt()
end

-- ===================== OTVARANJE SUPERMARKETA (klasicno - direktno na E, bez dijaloga) =====================
local openBusy = false

local function openShopNui(shopId)
    local shop = Shops[shopId]
    if not shop or openBusy then return end

    local tablica = NuiCacheById[shopId]
    if not tablica then
        tablica = buildNuiTable(shop)
        NuiCacheById[shopId] = tablica
    end

    -- vlasnik marketa + zalihe (flamingo_biznisi); bez njega market radi kao ranije
    openBusy = true
    hidePrompt()
    ESX.TriggerServerCallback('flamingo_supermarket:cb:info', function(bizInfo)
        openBusy = false
        isMenuOpen = true
        currentShopId = shopId
        SetNuiFocus(true, true)

        SendNUIMessage({
            action = 'openShop',
            Otvori = true,
            Tablica = tablica,
            id = shopId,
            biz = bizInfo,
            welcomeTitle = Config.Locales.welcomeTitle,
            payCard = Config.Locales.payCard,
            payCash = Config.Locales.payCash,
            totalLabel = Config.Locales.total,
            cartLabel = Config.Locales.cart,
            emptyCartLabel = Config.Locales.emptyCart,
        })
    end, shopId)
end

local function closeAll()
    isMenuOpen = false
    currentShopId = nil
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'closeAll' })
end

-- ===================== SPAWN SHOPS (bez ox_target) =====================
-- NPC-i se spawnuju SAMO kad im igrac priblizi (tako je teren/kolizija
-- garantovano ucitana pa GetGroundZFor_3dCoord i FreezeEntityPosition rade
-- tacno). Blipovi ostaju uvek postavljeni, cim resurs krene.
local SPAWN_RADIUS = 30.0
local DESPAWN_RADIUS = 40.0

local function clearWorld()
    for _, ped in pairs(spawnedPeds) do
        if ped and DoesEntityExist(ped) then DeleteEntity(ped) end
    end
    for _, bl in pairs(spawnedBlips) do
        RemoveBlip(bl)
    end
    spawnedPeds = {}
    spawnedBlips = {}
    pedShopId = {}
end

local function spawnBlips()
    for i = 1, #Shops do
        local shop = Shops[i]
        if Config.Blip.enabled then
            local c = getShopCoords(shop)
            local bl = AddBlipForCoord(c.x, c.y, c.z)
            SetBlipSprite(bl, Config.Blip.sprite)
            SetBlipColour(bl, Config.Blip.color)
            SetBlipScale(bl, Config.Blip.scale)
            SetBlipAsShortRange(bl, true)
            BeginTextCommandSetBlipName('STRING')
            AddTextComponentString(Config.Blip.name or 'Market 24/7')
            EndTextCommandSetBlipName(bl)
            spawnedBlips[i] = bl
        end
    end
end

local function spawnShopPed(i)
    local shop = Shops[i]
    local pedCfg = shop.ped or Config.DefaultPed
    if not (pedCfg and pedCfg.coords) then return end

    local hash = loadModel(pedCfg.model or Config.DefaultPed.model)
    local heading = pedCfg.coords.w or 0.0
    local ped = CreatePed(0, hash, pedCfg.coords.x, pedCfg.coords.y, pedCfg.coords.z, heading, false, true)
    SetEntityAsMissionEntity(ped, true, true)
    SetBlockingOfNonTemporaryEvents(ped, true)
    SetEntityInvincible(ped, true)

    -- Z se automatski koriguje na stvarni pod; freeze se radi unutar funkcije
    -- tek nakon završenog pozicioniranja.
    placeOnGround(ped, pedCfg.coords.x, pedCfg.coords.y, pedCfg.coords.z, heading)

    if pedCfg.scenario then
        TaskStartScenarioInPlace(ped, pedCfg.scenario, 0, true)
    end

    spawnedPeds[i] = ped
    pedShopId[i] = i
end

local function despawnShopPed(i)
    local ped = spawnedPeds[i]
    if ped and DoesEntityExist(ped) then
        DeleteEntity(ped)
    end
    spawnedPeds[i] = nil
    pedShopId[i] = nil
end

CreateThread(function()
    pcall(function()
        OxItems = exports.ox_inventory:Items()
    end)

    for i = 1, #Shops do
        NuiCacheById[i] = buildNuiTable(Shops[i])
    end

    Wait(1000)
    spawnBlips()
end)

-- Proximity spawn/despawn NPC-a (samo kad je igrac blizu - resava
-- lebdenje/tonjenje kroz pod jer je tako teren garantovano ucitan)
CreateThread(function()
    while true do
        local pcoords = GetEntityCoords(PlayerPedId())

        for i = 1, #Shops do
            local shop = Shops[i]
            local pedCfg = shop.ped or Config.DefaultPed
            if pedCfg and pedCfg.coords then
                local dist = #(pcoords - vector3(pedCfg.coords.x, pedCfg.coords.y, pedCfg.coords.z))

                if dist <= SPAWN_RADIUS and not spawnedPeds[i] then
                    spawnShopPed(i)
                elseif dist > DESPAWN_RADIUS and spawnedPeds[i] then
                    despawnShopPed(i)
                end
            end
        end

        Wait(1000)
    end
end)

-- ===================== INTERAKCIJA (E umesto ox_target) =====================
CreateThread(function()
    while true do
        local sleep = 800
        local ped = PlayerPedId()
        local pcoords = GetEntityCoords(ped)

        local closestDist = 999999.0
        local closestShopId = nil

        for i = 1, #Shops do
            local shopPed = spawnedPeds[i]
            if shopPed and DoesEntityExist(shopPed) then
                local shopCoords = GetEntityCoords(shopPed)
                local dist = #(pcoords - shopCoords)
                if dist < closestDist then
                    closestDist = dist
                    closestShopId = pedShopId[i]
                end
            end
        end

        if closestShopId and closestDist <= Config.InteractDistance then
            sleep = 0

            if not isMenuOpen then
                showPrompt()

                if IsControlJustPressed(0, 38) then -- E
                    openShopNui(closestShopId)
                end
            end
        else
            if not isMenuOpen then
                hidePrompt()
            end
        end

        Wait(sleep)
    end
end)

-- ===================== NUI CALLBACKS =====================
RegisterNUICallback('zatvori_menu', function(_, cb)
    closeAll()
    cb(true)
end)

RegisterNUICallback('plati', function(data, cb)
    ESX.TriggerServerCallback('flamingo_supermarket:cb:pay', function(success, reason)
        if success then
            Notify('Kupovina uspesna.', 'success')
            closeAll()
            cb(true)
        else
            Notify(reason or 'Nemate dovoljno para.', 'error')
            cb(false)
        end
    end, data.id, data.itemi, data.vrsta)
end)

-- Biznis (TEST kupovina marketa iz menija, kasnije aukcija) - ide na flamingo_biznisi
RegisterNUICallback('bizBuy', function(data, cb)
    if GetResourceState('flamingo_biznisi') ~= 'started' then
        Notify('Biznisi trenutno nisu dostupni.', 'error')
        return cb(false)
    end
    local shopId = currentShopId
    ESX.TriggerServerCallback('flamingo_biznisi:buy', function(res)
        res = res or { ok = false, msg = 'Greška u komunikaciji sa serverom.' }
        if res.msg then Notify(res.msg, res.ok and 'success' or 'error', 5000, 'Biznis') end
        if not res.ok or not shopId then return cb(false) end
        ESX.TriggerServerCallback('flamingo_supermarket:cb:info', function(info)
            cb(info or false)
        end, shopId)
    end, type(data) == 'table' and data.id or nil)
end)

-- ESC zatvara meni/market
CreateThread(function()
    while true do
        if isMenuOpen then
            Wait(0)
            if IsControlJustPressed(0, 322) then -- ESC
                closeAll()
            end
        else
            Wait(500)
        end
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName ~= GetCurrentResourceName() then return end
    clearWorld()
    if isMenuOpen then
        SetNuiFocus(false, false)
    end
end)
