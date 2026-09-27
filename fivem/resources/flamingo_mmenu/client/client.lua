local ESX = exports['es_extended']:getSharedObject()

local menuOpen = false
local latestLevelData = nil -- { level, xp, xpRequired } - dolazi iz flamingo_payday
local latestCoins = 0 -- dolazi iz flamingo_coins
local latestProfileData = nil -- { registeredAt } - dolazi sa ovog istog resursa (server.lua)
local latestFinanceData = nil -- { cash, bank } - direktno sa ESX, isti novac koji bank-nui koristi
local latestReferralData = nil -- { code, uses, earned, pending, hasRedeemed } - Nagrade -> Pozivni Kod tab
local latestDailyRewardData = nil -- { day, claimedToday } - Nagrade -> Dnevne Nagrade kalendar
local latestPlaytimeData = nil -- { minutes, claimed } - Nagrade -> Nagrade za Vreme
local latestTaskData = nil -- { daily, weekly, account } - leva traka -> Zadaci (server/zadaci.lua)

-- ==========================================================
-- PODEŠAVANJA - deo koji radi bez ikakvog drugog resursa (cisti FiveM native-i).
-- Cuva se lokalno kod igraca preko KVP-a (Key/Value Pairs) - ne treba baza,
-- ovo je licna preferenca svakog igraca na njegovom racunu.
-- ==========================================================

local function DefaultSettings()
    return {
        minimapEnabled = true,
        cinematicMode = false,
        theme = 'neutral',
        hudEnabled = true,
        chatEnabled = true,
        idEnabled = true,
        crosshairEnabled = false,
        crosshairThickness = 2,
        crosshairSize = 10,
        crosshairGap = 4,
        crosshairOpacity = 1,
        crosshairColor = '#ff4d8d',
        menuSounds = true,  -- zvukovi u M meniju (klikovi, kutije, nagrade)
        menuVolume = 60,    -- jačina zvukova menija 0-100
        -- Grafika (resurs flamingo_graphics) - iste vrednosti kao Config.Defaults tamo
        graphicsPreset = 'prirodno',
        graphicsStrength = 80,         -- 0-100
        graphicsDayNight = true,       -- poseban izgled nocu
        graphicsLod = 100,             -- daljina detalja u %, 100-150
        graphicsSoftShadows = false,
        graphicsVehicleLights = false,
        keybinds = {} -- [keybindId] = 'IME_TASTERA' (samo oni koje je igrac promenio)
    }
end

local Settings = DefaultSettings()

local function LoadSettings()
    local raw = GetResourceKvpString('flamingo_settings')
    if not raw then return end

    local ok, decoded = pcall(json.decode, raw)
    if ok and type(decoded) == 'table' then
        for k, v in pairs(decoded) do
            Settings[k] = v
        end
    end
end

local function SaveSettings()
    SetResourceKvp('flamingo_settings', json.encode(Settings))
end

LoadSettings()

-- Primenjuje HUD/Chat/ID podesavanja na ostale resurse. Poziva se pri startu
-- (da se ucitano stanje iz KVP-a odmah primeni) i svaki put kad igrac promeni
-- neki od ovih prekidaca u Podesavanjima. Koristi TriggerEvent (lokalno, ne
-- ide na server) jer je ovo cisto vizuelna, po-igracu preferenca.
local function ApplyInterfaceSettings()
    TriggerEvent('flamingo_hud:setEnabled', Settings.hudEnabled ~= false)
    TriggerEvent('flamingo_chat:setEnabled', Settings.chatEnabled ~= false)
    TriggerEvent('flamingo_hudinfo:setEnabled', Settings.idEnabled ~= false)
    TriggerEvent('flamingo_id:setEnabled', Settings.idEnabled ~= false)
    TriggerEvent('flamingo_crosshair:setEnabled', Settings.crosshairEnabled == true)

    -- Detaljna podesavanja izgleda crosshair-a (debljina/duzina/razmak/providnost/boja).
    -- Prosledjuje se kao jedan config objekat - resurs "flamingo_crosshair" treba da
    -- oslushkuje ovaj event i da tim vrednostima iscrta crosshair.
    TriggerEvent('flamingo_crosshair:setConfig', {
        thickness = Settings.crosshairThickness or 2,
        size = Settings.crosshairSize or 10,
        gap = Settings.crosshairGap or 4,
        opacity = Settings.crosshairOpacity or 1,
        color = Settings.crosshairColor or '#ff4d8d'
    })
end

-- Malo sacekamo da se flamingo_hud/flamingo_chat/flamingo_hudinfo/flamingo_id
-- pokrenu i registruju svoje evente pre nego sto im nesto posaljemo.
-- Salje grafička podesavanja resursu flamingo_graphics (timecycle preset,
-- jacina, dan/noc, LOD, senke, svetla vozila). Ako resurs nije pokrenut,
-- event jednostavno niko ne slusa.
local function ApplyGraphicsSettings()
    TriggerEvent('flamingo_graphics:setConfig', {
        preset = Settings.graphicsPreset,
        strength = Settings.graphicsStrength,
        dayNight = Settings.graphicsDayNight ~= false,
        lod = Settings.graphicsLod,
        softShadows = Settings.graphicsSoftShadows == true,
        vehicleLights = Settings.graphicsVehicleLights == true
    })
end

-- flamingo_graphics javlja kad se (re)startuje - tada mu ponovo posaljemo
-- sacuvana podesavanja igraca.
AddEventHandler('flamingo_graphics:ready', ApplyGraphicsSettings)

CreateThread(function()
    Wait(2000)
    ApplyInterfaceSettings()
    ApplyGraphicsSettings()
end)

-- Primenjuje trenutna podesavanja svaki frejm (DisplayRadar/DisplayHud se
-- moraju stalno "drzati" jer ih igra/druge skripte mogu resetovati).
CreateThread(function()
    while true do
        Wait(0)

        if Settings.cinematicMode then
            DisplayRadar(false)
            DisplayHud(false)
        else
            DisplayRadar(Settings.minimapEnabled)
            DisplayHud(true)
        end
    end
end)

RegisterNUICallback('updateSetting', function(data, cb)
    if data and data.key ~= nil then
        Settings[data.key] = data.value

        local crosshairKeys = {
            crosshairEnabled = true, crosshairThickness = true, crosshairSize = true,
            crosshairGap = true, crosshairOpacity = true, crosshairColor = true
        }

        if data.key == 'hudEnabled' or data.key == 'chatEnabled' or data.key == 'idEnabled' or crosshairKeys[data.key] then
            ApplyInterfaceSettings()
        end

        if type(data.key) == 'string' and data.key:sub(1, 8) == 'graphics' then
            ApplyGraphicsSettings()
        end
    end
    cb('ok')
end)

RegisterNUICallback('saveSettings', function(_, cb)
    SaveSettings()
    cb('ok')
end)

RegisterNUICallback('resetSettings', function(_, cb)
    Settings = DefaultSettings()
    SaveSettings()
    ApplyInterfaceSettings()
    ApplyGraphicsSettings()
    ApplyAllKeybinds()
    cb(Settings)
end)

-- ==========================================================
-- KONTROLE - izvlacimo tastere iz FiveM-ovog default sistema (RegisterKeyMapping)
-- i dajemo mogucnost da se promene direktno kroz nas meni, umesto kroz
-- Escape > Settings > Key Bindings. Promena se radi preko konzolne komande
-- "bind" (isti mehanizam koji FiveM interno koristi), a hvatanje pritisnutog
-- tastera ide preko IsRawKeyDown (native za citanje sirovog tastera).
-- ==========================================================

local Keybinds = {
    { id = 'menu',         label = 'Otvori Meni',        command = '+flamingo_mmenu',        mapper = 'keyboard', defaultKey = 'M' },
    { id = 'chat',         label = 'Otvori Chat',        command = 'flamingo_chat_open',      mapper = 'keyboard', defaultKey = 'T' },
    { id = 'hud_cursor',   label = 'HUD Kursor',         command = 'flamingo_hud_cursor',     mapper = 'keyboard', defaultKey = 'U' },
    { id = 'seatbelt',     label = 'Kaiš',                command = 'flamingo_hud_seatbelt',   mapper = 'keyboard', defaultKey = 'B' },
    { id = 'cruise',       label = 'Tempomat',           command = 'flamingo_hud_cruise',     mapper = 'keyboard', defaultKey = 'Z' },
    { id = 'vehicle_lock', label = 'Zaključaj Vozilo',   command = 'flamingo_hud_vehicle_lock', mapper = 'keyboard', defaultKey = 'L' }
}

-- Mapa "sirovih" tastera koje umemo da uhvatimo i njihova imena onako kako
-- ih FiveM-ova "bind" komanda ocekuje. Prosiri po potrebi.
local RAW_KEYS = {
    [8] = 'BACKSPACE', [9] = 'TAB', [13] = 'ENTER', [16] = 'LSHIFT', [17] = 'LCONTROL', [18] = 'LMENU',
    [20] = 'CAPITAL', [32] = 'SPACE',
    [37] = 'LEFT', [38] = 'UP', [39] = 'RIGHT', [40] = 'DOWN', [45] = 'INSERT', [46] = 'DELETE',
    [48] = '0', [49] = '1', [50] = '2', [51] = '3', [52] = '4', [53] = '5', [54] = '6', [55] = '7', [56] = '8', [57] = '9',
    [65] = 'A', [66] = 'B', [67] = 'C', [68] = 'D', [69] = 'E', [70] = 'F', [71] = 'G', [72] = 'H', [73] = 'I', [74] = 'J',
    [75] = 'K', [76] = 'L', [77] = 'M', [78] = 'N', [79] = 'O', [80] = 'P', [81] = 'Q', [82] = 'R', [83] = 'S', [84] = 'T',
    [85] = 'U', [86] = 'V', [87] = 'W', [88] = 'X', [89] = 'Y', [90] = 'Z',
    [112] = 'F1', [113] = 'F2', [114] = 'F3', [115] = 'F4', [116] = 'F5', [117] = 'F6',
    [118] = 'F7', [119] = 'F8', [120] = 'F9', [121] = 'F10', [122] = 'F11', [123] = 'F12'
}

local function FindKeybind(id)
    for _, kb in ipairs(Keybinds) do
        if kb.id == id then return kb end
    end
    return nil
end

local function BindKey(keybind, keyName)
    ExecuteCommand(('bind %s %s %s'):format(keybind.mapper, keyName, keybind.command))
end

-- Primenjuje trenutne tastere (izmenjene ili default) - poziva se pri startu
-- i posle reset-a, da fizicki bind uvek odgovara onome sto Settings kaze.
function ApplyAllKeybinds()
    for _, kb in ipairs(Keybinds) do
        local key = (Settings.keybinds and Settings.keybinds[kb.id]) or kb.defaultKey
        BindKey(kb, key)
    end
end

CreateThread(function()
    Wait(2500)
    ApplyAllKeybinds()
end)

local capturing = false

-- Ceka sledeci pritisnut taster (do 8 sekundi) i onda ga vezuje za dati keybind
local function CaptureKeyFor(keybindId, cb)
    if capturing then return end
    capturing = true

    CreateThread(function()
        Wait(250) -- da ne uhvati Enter/klik kojim je pokrenuto "Promeni"

        local startTime = GetGameTimer()
        local found = nil

        while capturing do
            if GetGameTimer() - startTime > 8000 then
                break
            end

            for vk, name in pairs(RAW_KEYS) do
                if IsRawKeyDown(vk) then
                    found = name
                    break
                end
            end

            if found then break end
            Wait(0)
        end

        capturing = false

        if found then
            local keybind = FindKeybind(keybindId)
            if keybind then
                BindKey(keybind, found)
                Settings.keybinds = Settings.keybinds or {}
                Settings.keybinds[keybindId] = found
            end
        end

        cb(found)
    end)
end

RegisterNUICallback('startRebind', function(data, cb)
    local id = data and data.id
    cb('ok')

    if not id or capturing then return end

    CaptureKeyFor(id, function(keyName)
        SendNUIMessage({
            action = 'keybindResult',
            id = id,
            key = keyName -- nil ako je isteklo vreme (8s) bez pritiska
        })
    end)
end)

RegisterNetEvent('flamingo_mmenu:receiveLevelData', function(data)
    latestLevelData = data

    -- Ako je meni vec otvoren dok stigne odgovor sa servera, azuriramo NUI odmah
    if menuOpen then
        SendNUIMessage({
            action = 'updateLevel',
            level = latestLevelData
        })
    end
end)

RegisterNetEvent('flamingo_mmenu:receiveProfileData', function(data)
    latestProfileData = data

    if menuOpen then
        SendNUIMessage({
            action = 'updateProfile',
            profile = latestProfileData
        })
    end
end)

-- flamingo_coins salje ovaj event svom vlasniku klijenta pri loadu i pri
-- svakoj promeni balansa (npr. kad owner odradi /setcoins) - ovde ga samo
-- osluskujemo i prosledjujemo dalje u NUI ako je meni otvoren.
RegisterNetEvent('flamingo_coins:update', function(amount)
    latestCoins = amount

    if menuOpen then
        SendNUIMessage({
            action = 'updateCoins',
            coins = latestCoins
        })
    end
end)

RegisterNetEvent('flamingo_mmenu:receiveFinanceData', function(data)
    latestFinanceData = data

    if menuOpen then
        SendNUIMessage({
            action = 'updateFinance',
            finance = latestFinanceData
        })
    end
end)

-- bank-nui okine ovaj event svom UI-u posle svake uplate/podizanja/transfera -
-- mi ga isto oslukujemo da nam Finansije sekcija ostane azurna u realnom vremenu,
-- bez ikakve izmene bank-nui koda.
RegisterNetEvent('bank-nui:refreshUI', function()
    TriggerServerEvent('flamingo_mmenu:requestFinanceData')
end)

-- ==========================================================
-- POZIVNI KOD (Nagrade -> Pozivni Kod tab)
-- ==========================================================

RegisterNetEvent('flamingo_mmenu:receiveReferralData', function(data)
    latestReferralData = data

    if menuOpen then
        SendNUIMessage({
            action = 'updateReferral',
            referral = latestReferralData
        })
    end
end)

-- Odgovor servera na pokusaj kreiranja sopstvenog koda (uspeh ili razlog odbijanja).
RegisterNetEvent('flamingo_mmenu:referralCodeCreated', function(result)
    if result and result.success then
        latestReferralData = latestReferralData or {}
        latestReferralData.code = result.code
        latestReferralData.uses = result.uses or 0
    end

    if menuOpen then
        SendNUIMessage({
            action = 'referralCodeCreated',
            result = result
        })
    end
end)

-- Odgovor servera na pokusaj iskoriscenja tudjeg koda (uspeh ili razlog odbijanja).
RegisterNetEvent('flamingo_mmenu:referralCodeRedeemed', function(result)
    if result and result.success then
        latestReferralData = latestReferralData or {}
        latestReferralData.hasRedeemed = true
    end

    if menuOpen then
        SendNUIMessage({
            action = 'referralCodeRedeemed',
            result = result
        })
    end
end)

RegisterNUICallback('createReferralCode', function(data, cb)
    cb('ok')
    if data and data.code then
        TriggerServerEvent('flamingo_mmenu:createReferralCode', data.code)
    end
end)

-- Poziva se svaki put kad igrac otvori "Pozivni Kod" tab u meniju (ne samo
-- kad se ceo meni otvori) - garantuje svez podatak i sprecava da UI ostane
-- na zastarelom/praznom prikazu ako je prvi odgovor kasnio.
RegisterNUICallback('requestReferralData', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:requestReferralData')
end)

RegisterNUICallback('redeemReferralCode', function(data, cb)
    cb('ok')
    if data and data.code then
        TriggerServerEvent('flamingo_mmenu:redeemReferralCode', data.code)
    end
end)

-- Igrac klikne "Pokupi Novac" - server prebaci sve nagomilano na keš i vrati
-- novo stanje (uses/earned/pending ostaju azurni preko receiveReferralData).
RegisterNUICallback('collectReferralEarnings', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:collectReferralEarnings')
end)

RegisterNetEvent('flamingo_mmenu:referralEarningsCollected', function(result)
    if result and result.success then
        latestReferralData = latestReferralData or {}
        latestReferralData.pending = 0
    end

    if menuOpen then
        SendNUIMessage({
            action = 'referralEarningsCollected',
            result = result
        })
    end
end)

-- Igrac klikne "Pokupi" na jednom od nivoa u traci (5/10/30/50 ljudi...).
RegisterNUICallback('claimReferralMilestone', function(data, cb)
    cb('ok')
    if data and data.milestone then
        TriggerServerEvent('flamingo_mmenu:claimReferralMilestone', data.milestone)
    end
end)

RegisterNetEvent('flamingo_mmenu:milestoneClaimed', function(result)
    if result and result.success then
        latestReferralData = latestReferralData or {}
        latestReferralData.milestonesClaimed = latestReferralData.milestonesClaimed or {}
        table.insert(latestReferralData.milestonesClaimed, result.milestone)
    end

    if menuOpen then
        SendNUIMessage({
            action = 'milestoneClaimed',
            result = result
        })
    end
end)

-- ==========================================================
-- DNEVNE NAGRADE (Nagrade -> Dnevne Nagrade -> kalendar 1-30)
-- ==========================================================

RegisterNetEvent('flamingo_mmenu:receiveDailyRewardData', function(data)
    latestDailyRewardData = data

    if menuOpen then
        SendNUIMessage({
            action = 'updateDailyRewards',
            dailyReward = latestDailyRewardData
        })
    end
end)

-- Poziva se svaki put kad igrac udje u "Dnevne Nagrade" tab - garantuje svez
-- podatak (isti razlog kao requestReferralData iznad).
RegisterNUICallback('requestDailyRewardData', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:requestDailyRewardData')
end)

RegisterNUICallback('claimDailyReward', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:claimDailyReward')
end)

RegisterNetEvent('flamingo_mmenu:dailyRewardClaimed', function(result)
    if result and result.success then
        latestDailyRewardData = latestDailyRewardData or {}
        latestDailyRewardData.day = result.nextDay
        latestDailyRewardData.claimedToday = true
    end

    if menuOpen then
        SendNUIMessage({
            action = 'dailyRewardClaimed',
            result = result
        })
    end
end)

-- ==========================================================
-- NAGRADE ZA VREME (Nagrade -> Nagrade za Vreme -> Config.PlaytimeMilestones)
-- ==========================================================

RegisterNetEvent('flamingo_mmenu:receivePlaytimeMilestoneData', function(data)
    latestPlaytimeData = data

    if menuOpen then
        SendNUIMessage({
            action = 'updatePlaytimeMilestones',
            playtime = latestPlaytimeData
        })
    end
end)

RegisterNUICallback('requestPlaytimeMilestoneData', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:requestPlaytimeMilestoneData')
end)

RegisterNUICallback('claimPlaytimeMilestone', function(data, cb)
    cb('ok')
    if data and data.hours then
        TriggerServerEvent('flamingo_mmenu:claimPlaytimeMilestone', data.hours)
    end
end)

RegisterNetEvent('flamingo_mmenu:playtimeMilestoneClaimed', function(result)
    if result and result.success then
        latestPlaytimeData = latestPlaytimeData or {}
        latestPlaytimeData.claimed = latestPlaytimeData.claimed or {}
        table.insert(latestPlaytimeData.claimed, result.milestone)
    end

    if menuOpen then
        SendNUIMessage({
            action = 'playtimeMilestoneClaimed',
            result = result
        })
    end
end)

-- ==========================================================
-- ZADACI (leva traka -> Zadaci, dnevni + nedeljni) - server/zadaci.lua
-- ==========================================================

RegisterNetEvent('flamingo_mmenu:receiveTaskData', function(data)
    latestTaskData = data

    if menuOpen then
        SendNUIMessage({ action = 'updateTasks', tasks = latestTaskData })
    end
end)

RegisterNUICallback('requestTaskData', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:requestTaskData')
end)

RegisterNUICallback('claimTask', function(data, cb)
    cb('ok')
    if data and data.taskId and data.period then
        TriggerServerEvent('flamingo_mmenu:claimTask', data.period, data.taskId)
    end
end)

RegisterNetEvent('flamingo_mmenu:taskClaimed', function(result)
    if menuOpen then
        SendNUIMessage({ action = 'taskClaimed', result = result })
    end
end)

-- zadatak upravo završen (server je već poslao esx_notify) - osveži ako je meni otvoren
RegisterNetEvent('flamingo_mmenu:taskCompleted', function()
    if menuOpen then
        TriggerServerEvent('flamingo_mmenu:requestTaskData')
    end
end)

-- flamingo_novacnagrada (dnevna nagrada za 3h igranja) salje ovo svom
-- vlasniku klijenta pri loginu i posle svakog "heartbeat"-a (na 30s) -
-- osluskujemo isti event, bez ikakve izmene tog resursa.
local latestRewardData = nil -- { playtime, required, claimed, reward, resetIn }

RegisterNetEvent('moneyreward:updateClient', function(data)
    latestRewardData = data

    if menuOpen then
        SendNUIMessage({
            action = 'updateReward',
            reward = latestRewardData
        })
    end
end)

-- Osnovni podaci o igracu koji se salju u NUI (samo za prikaz u headeru menija,
-- battle pass/nagrade/statistika sistemi NISU implementirani ovde)
local function GetPlayerHeaderData()
    local playerData = ESX.GetPlayerData()

    return {
        name = (playerData and playerData.name) or GetPlayerName(PlayerId()),
        identifier = (playerData and playerData.identifier) or '',
        job = (playerData and playerData.job and playerData.job.label) or 'Nezaposlen',
        serverId = GetPlayerServerId(PlayerId()),
        level = latestLevelData,
        coins = latestCoins,
        registeredAt = latestProfileData and latestProfileData.registeredAt or nil,
        finance = latestFinanceData,
        referral = latestReferralData,
        dailyReward = latestDailyRewardData,
        playtime = latestPlaytimeData,
        tasks = latestTaskData,
        settings = Settings,
        reward = latestRewardData,
        onlinePlayers = #GetActivePlayers(),
        social = Config.SocialLinks
    }
end

-- Salje se u NUI ono sto je potrebno za prikaz kartice I detalj-ekrana kad
-- igrac klikne na kutiju (ime/cena/ikonica + spisak mogucih nagrada sa
-- sansama, radi transparentnosti - tacan item/iznos za "money" tip ostaje
-- samo na serveru, NUI dobija samo prikazni "label" i procenat).
local function GetCrateDisplayList()
    local list = {}
    for _, crate in ipairs(Config.Crates or {}) do
        local rewards = {}
        for _, r in ipairs(crate.rewards) do
            table.insert(rewards, {
                type = r.type,
                label = r.label,
                chance = r.chance
            })
        end

        table.insert(list, {
            id = crate.id,
            name = crate.name,
            icon = crate.icon,
            price = crate.price,
            rewards = rewards
        })
    end
    return list
end

-- Lista nivoa za "Nagrade za pozivanje" traku - staticka, ista za sve
-- igrace (nema tajni/slucajnosti kao kod kutija), pa se salje kompletna
-- odjednom pri otvaranju menija (uses/milestonesClaimed dolaze posebno
-- preko latestReferralData, jer su to podaci PO IGRACU).
local function GetMilestoneDisplayList()
    local list = {}
    for _, m in ipairs(Config.ReferralMilestones or {}) do
        table.insert(list, {
            uses = m.uses,
            money = m.money or 0,
            coins = m.coins or 0,
            xp = m.xp or 0,
            levels = m.levels or 0
        })
    end
    return list
end

-- Lista svih paketa u Prodavnica -> Novac tabu - staticka, ista za sve
-- igrace (direktna kupovina, bez slucajnosti kao kod kutija).
local function GetMoneyPackageDisplayList()
    local list = {}
    for _, pkg in ipairs(Config.MoneyPackages or {}) do
        table.insert(list, {
            id = pkg.id,
            amount = pkg.amount,
            price = pkg.price,
            image = pkg.image
        })
    end
    return list
end

-- Lista svih 30 dana za kalendar dnevnih nagrada - staticka, ista za sve
-- igrace (dan/nagrada se ne menja po igracu, samo TRENUTNI dan i da li je
-- danas vec pokupljeno - to dolazi posebno preko latestDailyRewardData).
local function GetDailyRewardDisplayList()
    local list = {}
    for day, reward in ipairs(Config.DailyRewards or {}) do
        table.insert(list, {
            day = day,
            money = reward.money or 0,
            coins = reward.coins or 0,
            xp = reward.xp or 0,
            levels = reward.levels or 0
        })
    end
    return list
end

-- Lista pragova za Nagrade -> Nagrade za Vreme - staticka, ista za sve
-- igrace (broj sati/nagrada se ne menja po igracu, samo TRENUTNO odigrano
-- vreme i sta je vec pokupljeno - to dolazi posebno preko latestPlaytimeData).
local function GetPlaytimeMilestoneDisplayList()
    local list = {}
    for _, m in ipairs(Config.PlaytimeMilestones or {}) do
        table.insert(list, {
            hours = m.hours,
            money = m.money or 0,
            coins = m.coins or 0,
            xp = m.xp or 0,
            levels = m.levels or 0
        })
    end
    return list
end

-- Lista keybind-ova sa TRENUTNIM tasterom (izmenjen ili default) za prikaz u NUI
local function GetKeybindDisplayList()
    local list = {}
    for _, kb in ipairs(Keybinds) do
        table.insert(list, {
            id = kb.id,
            label = kb.label,
            key = (Settings.keybinds and Settings.keybinds[kb.id]) or kb.defaultKey
        })
    end
    return list
end

local function OpenMenu()
    if menuOpen then return end
    menuOpen = true

    -- Trazimo svez level/xp, coin i profil (datum registracije) podatak svaki put
    -- kad se meni otvori (stize asinhrono, NUI se azurira preko 'updateLevel' /
    -- 'updateCoins' / 'updateProfile' kad stigne)
    TriggerServerEvent('flamingo_mmenu:requestLevelData')
    TriggerServerEvent('flamingo_coins:requestBalance')
    TriggerServerEvent('flamingo_mmenu:requestProfileData')
    TriggerServerEvent('flamingo_mmenu:requestFinanceData')
    TriggerServerEvent('flamingo_mmenu:requestReferralData')
    TriggerServerEvent('flamingo_mmenu:requestDailyRewardData')
    TriggerServerEvent('flamingo_mmenu:requestPlaytimeMilestoneData')
    TriggerServerEvent('flamingo_mmenu:requestTaskData')
    TriggerServerEvent('flamingo_mmenu:requestProgressionData')
    TriggerServerEvent('flamingo_mmenu:requestAchievementData')
    for skill in pairs(Config.SkillJobs or {}) do
        TriggerServerEvent('flamingo_mmenu:requestSkillTree', skill)
    end

    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'openMenu',
        player = GetPlayerHeaderData(),
        crates = GetCrateDisplayList(),
        keybinds = GetKeybindDisplayList(),
        milestones = GetMilestoneDisplayList(),
        dailyRewards = GetDailyRewardDisplayList(),
        moneyPackages = GetMoneyPackageDisplayList(),
        playtimeMilestones = GetPlaytimeMilestoneDisplayList(),
        levelUpReward = Config.LevelUpRewardDisplay
    })
end

local function CloseMenu()
    if not menuOpen then return end
    menuOpen = false

    SetNuiFocus(false, false)
    SendNUIMessage({
        action = 'closeMenu'
    })
end

RegisterCommand('+flamingo_mmenu', function()
    if menuOpen then
        CloseMenu()
    else
        OpenMenu()
    end
end, false)

RegisterKeyMapping('+flamingo_mmenu', 'Otvori Flamingo Meni', 'keyboard', 'M')

-- Rezultat otvaranja kutije stize sa servera - prosledjujemo ga u NUI da
-- prikaze "reveal" ekran sa dobijenom nagradom.
RegisterNetEvent('flamingo_mmenu:crateResult', function(data)
    SendNUIMessage({
        action = 'crateResult',
        result = data
    })
end)

RegisterNUICallback('closeMenu', function(_, cb)
    CloseMenu()
    cb('ok')
end)

-- ==========================================================
-- POMOĆ - koliko admina je trenutno on-duty (iz flamingo_staff, ako je
-- pokrenut) i slanje prijave (isti report sistem kao /report, samo
-- bez slash komande - vidi flamingo_staff:server:submitReport).
-- ==========================================================
RegisterNUICallback('requestOnDutyCount', function(_, cb)
    TriggerServerEvent('flamingo_mmenu:requestOnDutyCount')
    cb('ok')
end)

RegisterNetEvent('flamingo_mmenu:onDutyCountResult', function(count, staffInstalled)
    if menuOpen then
        SendNUIMessage({ action = 'onDutyCountResult', count = count, staffInstalled = staffInstalled })
    end
end)

RegisterNUICallback('submitHelpReport', function(data, cb)
    local message = data and data.message
    if message and message ~= '' then
        TriggerServerEvent('flamingo_staff:server:submitReport', message)
    end
    cb('ok')
end)


-- ==========================================================
-- FLAMINGO PROGRESSION
-- ==========================================================
RegisterNetEvent('flamingo_mmenu:receiveProgressionData', function(data)
    if menuOpen then
        SendNUIMessage({ action = 'updateProgression', progression = data or {} })
    end
end)

RegisterNetEvent('flamingo_mmenu:receiveAchievementData', function(data)
    if menuOpen then
        SendNUIMessage({ action = 'updateAchievements', achievements = data or {} })
    end
end)



-- Stablo veština za bilo koji posao iz Config.SkillJobs
RegisterNUICallback('getSkillTree', function(data, cb)
    cb('ok')
    local skill = data and data.skill
    if type(skill) == 'string' and Config.SkillJobs[skill] then
        TriggerServerEvent('flamingo_mmenu:requestSkillTree', skill)
    end
end)

RegisterNUICallback('unlockSkillPerk', function(data, cb)
    cb('ok')
    local skill = data and data.skill
    local perkId = data and data.perkId
    if type(skill) == 'string' and Config.SkillJobs[skill] and type(perkId) == 'string' and #perkId <= 50 then
        TriggerServerEvent('flamingo_mmenu:unlockSkillPerk', skill, perkId)
    end
end)

-- Stari nazivi (rudar)
RegisterNUICallback('getMiningSkillTree', function(_, cb)
    cb('ok')
    TriggerServerEvent('flamingo_mmenu:requestSkillTree', 'mining')
end)
RegisterNUICallback('unlockMiningPerk', function(data, cb)
    cb('ok')
    local perkId = data and data.perkId
    if type(perkId) == 'string' and #perkId <= 50 then
        TriggerServerEvent('flamingo_mmenu:unlockSkillPerk', 'mining', perkId)
    end
end)

RegisterNetEvent('flamingo_mmenu:receiveSkillTree', function(skill, data)
    if menuOpen then
        SendNUIMessage({ action = 'updateSkillTree', skill = skill, skillTree = data or {} })
    end
end)

RegisterNUICallback('claimBattlePass', function(data, cb)
    cb('ok')
    local level = data and tonumber(data.level)
    if level then
        TriggerServerEvent('flamingo_progression:claimBattlePass', level)
    end
end)

RegisterNUICallback('claimProgressionChallenge', function(data, cb)
    cb('ok')
    local id = data and data.challengeId
    if type(id) == 'string' and #id <= 100 then
        TriggerServerEvent('flamingo_progression:claimChallenge', id)
    end
end)

-- Placeholder callback-i za buduce kategorije (Battle Pass, Nagrade, Statistika...)
-- Sistemi se NE implementiraju sada, samo vracaju prazan/dummy odgovor da NUI ne puca.
RegisterNUICallback('requestCategoryData', function(data, cb)
    local category = data and data.category or nil

    if category == 'poslovi' then
        cb('ok')
        TriggerServerEvent('flamingo_mmenu:requestPosloviData')
        return
    end

    cb({
        category = category,
        implemented = false
    })
end)

RegisterNetEvent('flamingo_mmenu:receivePosloviData', function(payload)
    SendNUIMessage({ action = 'posloviData', data = payload })
end)

RegisterNUICallback('openCrate', function(data, cb)
    if data and data.crateId then
        TriggerServerEvent('flamingo_mmenu:openCrate', data.crateId)
    end
    cb('ok')
end)

-- Prodavnica -> Novac tab: direktna kupovina, bez reveal animacije kao kod
-- kutija - server odmah vraca uspeh/neuspeh preko moneyPackagePurchased.
RegisterNUICallback('buyMoneyPackage', function(data, cb)
    cb('ok')
    if data and data.packageId then
        TriggerServerEvent('flamingo_mmenu:buyMoneyPackage', data.packageId)
    end
end)

RegisterNetEvent('flamingo_mmenu:moneyPackagePurchased', function(result)
    if menuOpen then
        SendNUIMessage({
            action = 'moneyPackagePurchased',
            result = result
        })
    end
end)

AddEventHandler('onResourceStop', function(resourceName)
    if GetCurrentResourceName() ~= resourceName then return end
    if menuOpen then
        SetNuiFocus(false, false)
    end
end)

