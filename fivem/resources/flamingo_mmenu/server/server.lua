-- Obaveštenje preko esx_notify (naslov + ikonica); ako esx_notify nije pokrenut -> običan ESX
local function FlNotify(src, msg, notifyType, title, icon)
    if GetResourceState('esx_notify') == 'started' then
        TriggerClientEvent('esx_notify:notify', src, msg, notifyType or 'info', 4500, title, icon)
    else
        TriggerClientEvent('esx:showNotification', src, msg, notifyType)
    end
end

local ESX = nil

CreateThread(function()
    while ESX == nil do
        local ok, obj = pcall(function()
            return exports['es_extended']:getSharedObject()
        end)
        if ok and obj then
            ESX = obj
        end
        Wait(0)
    end
end)

-- ==========================================================
-- FLAMINGO PROGRESSION / ACHIEVEMENTS
-- ==========================================================

-- =========================================================
-- STABLO VEŠTINA - radi za svaki posao iz Config.SkillJobs
-- =========================================================
local function IsKnownSkill(skill)
    return type(skill) == 'string' and Config.SkillJobs and Config.SkillJobs[skill] ~= nil
end

local function BuildSkillTree(src, skill)
    if GetResourceState('flamingo_skills') ~= 'started' then
        print('[flamingo_mmenu] flamingo_skills nije pokrenut - Veštine tab ostaje prazan.')
        return { error = 'resource_not_started' }
    end
    local ok, data = pcall(function()
        return exports['flamingo_skills']:GetSkillTree(src, skill)
    end)
    if not ok then
        print('[flamingo_mmenu] Greska pri pozivu flamingo_skills:GetSkillTree - ' .. tostring(data))
        return { error = 'export_error' }
    end
    if not data then return { error = 'no_data' } end

    -- Podaci o poslu za "Kako funkcioniše" (XP po poslu, lokacije, nagrade...)
    local jobResource = Config.SkillJobs[skill]
    if jobResource and GetResourceState(jobResource) == 'started' then
        local okInfo, info = pcall(function() return exports[jobResource]:GetGuideInfo() end)
        if okInfo then data.jobInfo = info end
        -- Album riba / rang lista (samo poslovi koji to imaju, npr. ribar)
        local okAlbum, album = pcall(function() return exports[jobResource]:GetPlayerAlbum(src) end)
        if okAlbum and album then data.album = album end
    end
    return data
end

RegisterNetEvent('flamingo_mmenu:requestSkillTree', function(skill)
    local src = source
    if not IsKnownSkill(skill) then return end
    TriggerClientEvent('flamingo_mmenu:receiveSkillTree', src, skill, BuildSkillTree(src, skill))
end)

RegisterNetEvent('flamingo_mmenu:unlockSkillPerk', function(skill, perkId)
    local src = source
    if not IsKnownSkill(skill) then return end
    if type(perkId) ~= 'string' or #perkId > 50 then return end
    if GetResourceState('flamingo_skills') ~= 'started' then return end
    local ok, result = pcall(function()
        return exports['flamingo_skills']:UnlockPerk(src, skill, perkId)
    end)
    if not ok then
        print('[flamingo_mmenu] Greska pri pozivu flamingo_skills:UnlockPerk - ' .. tostring(result))
    end
    TriggerClientEvent('flamingo_mmenu:receiveSkillTree', src, skill, BuildSkillTree(src, skill))
end)

-- Stari nazivi (samo rudar) - ostavljeno zbog kompatibilnosti
RegisterNetEvent('flamingo_mmenu:requestMiningSkillTree', function()
    local src = source
    TriggerClientEvent('flamingo_mmenu:receiveSkillTree', src, 'mining', BuildSkillTree(src, 'mining'))
end)

RegisterNetEvent('flamingo_mmenu:requestProgressionData', function()
    local src = source
    if GetResourceState('flamingo_progression') ~= 'started' then
        print('[flamingo_mmenu] flamingo_progression nije pokrenut (state: ' .. tostring(GetResourceState('flamingo_progression')) .. ') - Karijera/Battle Pass izazovi nece imati podatke.')
        TriggerClientEvent('flamingo_mmenu:receiveProgressionData', src, {})
        return
    end

    local ok, data = pcall(function()
        return exports['flamingo_progression']:GetProgressionData(src)
    end)

    if not ok then
        print('[flamingo_mmenu] Greska pri pozivu flamingo_progression:GetProgressionData - ' .. tostring(data))
    end

    TriggerClientEvent('flamingo_mmenu:receiveProgressionData', src, (ok and data) or {})
end)

RegisterNetEvent('flamingo_mmenu:requestAchievementData', function()
    local src = source
    if GetResourceState('flamingo_achievements') ~= 'started' then
        print('[flamingo_mmenu] flamingo_achievements nije pokrenut (state: ' .. tostring(GetResourceState('flamingo_achievements')) .. ') - Dostignuca nece imati podatke.')
        TriggerClientEvent('flamingo_mmenu:receiveAchievementData', src, {})
        return
    end

    local ok, data = pcall(function()
        return exports['flamingo_achievements']:GetPlayerAchievements(src)
    end)

    if not ok then
        print('[flamingo_mmenu] Greska pri pozivu flamingo_achievements:GetPlayerAchievements - ' .. tostring(data))
    end

    TriggerClientEvent('flamingo_mmenu:receiveAchievementData', src, (ok and data) or {})
end)


-- iz flamingo_staff exporta (IsOnDutyRoster, server/duty.lua tog resursa).
-- pcall je tu da NE PUKNE ako flamingo_staff nije instaliran/pokrenut -
-- u tom slucaju samo vracamo 0 i staffInstalled = false, a NUI to
-- prikazuje kao "sistem trenutno nije dostupan" umesto da se zaglavi.
-- ==========================================================
RegisterNetEvent('flamingo_mmenu:requestOnDutyCount', function()
    local src = source
    local count = 0
    local staffInstalled = GetResourceState('flamingo_staff') == 'started'

    if staffInstalled then
        local ok, roster = pcall(function()
            return exports['flamingo_staff']:IsOnDutyRoster()
        end)
        if ok and type(roster) == 'table' then
            count = #roster
        end
    end

    TriggerClientEvent('flamingo_mmenu:onDutyCountResult', src, count, staffInstalled)
end)

-- Prosledjuje zahtev za level/xp podacima ka flamingo_payday resursu
-- (tamo se level sistem racuna i cuva u bazi) i vraca rezultat nazad klijentu.
RegisterNetEvent('flamingo_mmenu:requestLevelData', function()
    local src = source
    local levelData = nil

    local ok, result = pcall(function()
        return exports['flamingo_payday']:GetPlayerLevelData(src)
    end)

    if ok and result then
        levelData = result
    end

    TriggerClientEvent('flamingo_mmenu:receiveLevelData', src, levelData)
end)

-- ==========================================================
-- DATUM REGISTRACIJE
-- ==========================================================
-- Prvi put kad se igrac konektuje (esx:playerLoaded), upisujemo trenutni
-- datum/vreme u `flamingo_profile` tabelu ako red za njega jos ne postoji.
-- Svaki sledeci put se samo cita taj isti, prvobitni datum - to je "datum
-- registracije" u smislu "kad je prvi put vidjen na ovom serveru".

local RegisteredDates = {} -- [identifier] = 'YYYY-MM-DD HH:MM:SS' (string iz baze)

local function LoadRegistration(identifier, cb)
    exports.oxmysql:execute('SELECT registered_at FROM flamingo_profile WHERE identifier = ?', { identifier }, function(result)
        if result and result[1] then
            RegisteredDates[identifier] = result[1].registered_at
            if cb then cb() end
        else
            exports.oxmysql:insert('INSERT INTO flamingo_profile (identifier) VALUES (?)', { identifier }, function()
                -- ponovo procitamo da dobijemo tacan CURRENT_TIMESTAMP koji je baza upisala
                exports.oxmysql:execute('SELECT registered_at FROM flamingo_profile WHERE identifier = ?', { identifier }, function(result2)
                    RegisteredDates[identifier] = result2 and result2[1] and result2[1].registered_at or nil
                    if cb then cb() end
                end)
            end)
        end
    end)
end

AddEventHandler('esx:playerLoaded', function(playerId, xPlayer)
    LoadRegistration(xPlayer.identifier)
end)

AddEventHandler('playerDropped', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if xPlayer then
        RegisteredDates[xPlayer.identifier] = nil
    end
end)

CreateThread(function()
    while ESX == nil do Wait(100) end

    -- Ako se resurs restartuje dok su igraci vec online, esx:playerLoaded se
    -- nece ponovo okinuti za njih, pa im ovde rucno ucitamo podatak.
    local xPlayers = ESX.GetExtendedPlayers()
    for _, xPlayer in pairs(xPlayers) do
        LoadRegistration(xPlayer.identifier)
    end
end)

RegisterNetEvent('flamingo_mmenu:requestProfileData', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    local function respond()
        TriggerClientEvent('flamingo_mmenu:receiveProfileData', src, {
            registeredAt = RegisteredDates[identifier]
        })
    end

    if RegisteredDates[identifier] then
        respond()
    else
        LoadRegistration(identifier, respond)
    end
end)

-- ==========================================================
-- FINANSIJE (Statistika -> Finansije tab)
-- ==========================================================
-- Nema potrebe da diramo bank-nui - i on i mi koristimo isti ESX novac
-- (xPlayer.getMoney() za kes, xPlayer.getAccount('bank').money za banku),
-- pa samo citamo direktno odavde.

RegisterNetEvent('flamingo_mmenu:requestFinanceData', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local bankAccount = xPlayer.getAccount('bank')

    local earnings = nil
    local ok, result = pcall(function()
        return exports['flamingo_earnings']:GetEarningsData(src)
    end)
    if ok and result then
        earnings = result
    end

    local coinsSpent = nil
    local ok2, result2 = pcall(function()
        return exports['flamingo_coins']:GetPlayerCoinsSpent(src)
    end)
    if ok2 and result2 then
        coinsSpent = result2
    end

    TriggerClientEvent('flamingo_mmenu:receiveFinanceData', src, {
        cash = xPlayer.getMoney(),
        bank = bankAccount and bankAccount.money or 0,
        totalEarned = earnings and earnings.totalEarned or nil,
        totalSpent = earnings and earnings.totalSpent or nil,
        dailyEarned = earnings and earnings.dailyEarned or nil,
        coinsSpent = coinsSpent
    })
end)

-- ==========================================================
-- KUTIJE (Prodavnica)
-- ==========================================================

local function FindCrate(crateId)
    for _, crate in ipairs(Config.Crates or {}) do
        if crate.id == crateId then
            return crate
        end
    end
    return nil
end

-- Bira nagradu na osnovu "chance" vrednosti (0-100). Ako sabir chance-ova
-- ne daje tacno 100, poslednja nagrada iz liste se koristi kao fallback.
local function RollReward(crate)
    local roll = math.random(1, 100)
    local cumulative = 0

    for _, reward in ipairs(crate.rewards) do
        cumulative = cumulative + reward.chance
        if roll <= cumulative then
            return reward
        end
    end

    return crate.rewards[#crate.rewards]
end

RegisterNetEvent('flamingo_mmenu:openCrate', function(crateId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local crate = FindCrate(crateId)
    if not crate then return end

    local ok, hadEnough = pcall(function()
        return exports['flamingo_coins']:TryTakeCoins(src, crate.price)
    end)

    if not ok or not hadEnough then
        FlNotify(src, 'Nemaš dovoljno Flamingo Coina za ovu kutiju.', 'error', 'Flamingo', 'fa-solid fa-circle-exclamation')
        TriggerClientEvent('flamingo_mmenu:crateResult', src, { success = false })
        return
    end

    local reward = RollReward(crate)
    local resultData = { success = true, label = reward.label, rewardType = reward.type }

    if reward.type == 'weapon' then
        exports.ox_inventory:AddItem(src, reward.item, 1)
        resultData.item = reward.item
    elseif reward.type == 'money' then
        local amount = math.random(reward.min, reward.max)

        if crate.moneyAccount == 'bank' then
            xPlayer.addAccountMoney('bank', amount)
        else
            xPlayer.addMoney(amount)
        end

        resultData.amount = amount
    end

    FlNotify(src, ('Otvorio si kutiju i dobio: %s'):format(reward.label), 'success', 'Flamingo', 'fa-solid fa-gift')
    TriggerClientEvent('flamingo_mmenu:crateResult', src, resultData)
end)

-- ==========================================================
-- NOVAC (Prodavnica -> Novac tab)
-- ==========================================================
-- Direktna kupovina - bez slucajnosti, za razliku od kutija iznad.

local function FindMoneyPackage(packageId)
    for _, pkg in ipairs(Config.MoneyPackages or {}) do
        if pkg.id == packageId then
            return pkg
        end
    end
    return nil
end

RegisterNetEvent('flamingo_mmenu:buyMoneyPackage', function(packageId)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local pkg = FindMoneyPackage(packageId)
    if not pkg then
        TriggerClientEvent('flamingo_mmenu:moneyPackagePurchased', src, { success = false, packageId = packageId, message = 'Nepoznat paket.' })
        return
    end

    local ok, hadEnough = pcall(function()
        return exports['flamingo_coins']:TryTakeCoins(src, pkg.price)
    end)

    if not ok or not hadEnough then
        FlNotify(src, 'Nemaš dovoljno Flamingo Coina za ovaj paket.', 'error', 'Flamingo', 'fa-solid fa-circle-exclamation')
        TriggerClientEvent('flamingo_mmenu:moneyPackagePurchased', src, { success = false, packageId = pkg.id, message = 'Nemaš dovoljno Flamingo Coina.' })
        return
    end

    if Config.MoneyPackageAccount == 'bank' then
        xPlayer.addAccountMoney('bank', pkg.amount)
    else
        xPlayer.addMoney(pkg.amount)
    end

    FlNotify(src, ('Kupio si $%d za %d Flamingo Coina!'):format(pkg.amount, pkg.price), 'success', 'Flamingo', 'fa-solid fa-coins')
    TriggerClientEvent('flamingo_mmenu:moneyPackagePurchased', src, { success = true, packageId = pkg.id, amount = pkg.amount, price = pkg.price })
end)

-- ==========================================================
-- POZIVNI KOD (Nagrade -> Pozivni Kod tab)
-- ==========================================================
-- flamingo_referral_codes  - jedan red po igracu koji je NAPRAVIO kod (identifier je PK, code je UNIQUE)
-- flamingo_referral_redeems - jedan red po igracu koji je ISKORISTIO neki kod (identifier je PK - sprecava duplo iskoriscenje)

-- Ociscen/validiran kod: samo slova i brojevi, uvek VELIKIM slovima (da "abc123"
-- i "ABC123" budu isti kod), duzina izmedju Config.Referral.codeMinLength/codeMaxLength.
local function NormalizeReferralCode(raw)
    if type(raw) ~= 'string' then return nil end

    local code = raw:gsub('%s+', ''):upper()
    if code == '' then return nil end
    if #code < Config.Referral.codeMinLength or #code > Config.Referral.codeMaxLength then return nil end
    if not code:match('^[A-Z0-9]+$') then return nil end

    return code
end

-- Vraca listu brojeva (npr. {5, 10}) koje je taj identifier vec pokupio sa
-- trake sa nivoima (Config.ReferralMilestones) - koristi se i pri ucitavanju
-- taba i pri osvezavanju posle iskoriscenja tudjeg koda ispod.
local function GetClaimedMilestones(identifier, cb)
    exports.oxmysql:execute('SELECT milestone FROM flamingo_referral_milestones WHERE identifier = ?', { identifier }, function(result)
        local claimed = {}
        for _, row in ipairs(result or {}) do
            table.insert(claimed, row.milestone)
        end
        cb(claimed)
    end)
end

-- Belezi da je vlasnik koda zaradio ownerRewardMoney za JEDNO iskoriscenje
-- njegovog koda. Novac se NIKAD ne dodaje automatski na racun - ni ako je
-- vlasnik trenutno online - vec se samo gomila u `pending` koloni dok ga
-- igrac sam ne pokupi dugmetom "Pokupi Novac" u meniju (vidi
-- flamingo_mmenu:collectReferralEarnings ispod). `earned` je odvojen,
-- istorijski zbir koji se nikad ne smanjuje (za prikaz "ukupno zaradio").
-- Ako je vlasnik trenutno online, samo dobija obavestenje da ima novu paru
-- koja ga ceka - ali para i dalje stoji u bazi dok je ne pokupi.
local function CreditReferralOwner(ownerIdentifier, amount)
    exports.oxmysql:update('UPDATE flamingo_referral_codes SET earned = earned + ?, pending = pending + ? WHERE identifier = ?', { amount, amount, ownerIdentifier })

    local xOwner = ESX.GetPlayerFromIdentifier(ownerIdentifier)
    if xOwner then
        FlNotify(xOwner.source, ('Neko je iskoristio tvoj pozivni kod! Zaradio si %s$ - pokupi ga u meniju (Nagrade -> Pozivni Kod).'):format(amount), 'success', 'Flamingo', 'fa-solid fa-coins')

        -- Osvezimo mu odmah "Ukupno zaradio" / "Za pokupiti" u meniju ako mu je
        -- otvoren, tako sto ponovo procitamo njegov red i posaljemo ga klijentu
        -- (isti dogadjaj koji se salje kad klijent sam zatrazi podatke).
        exports.oxmysql:execute('SELECT code, uses, earned, pending FROM flamingo_referral_codes WHERE identifier = ?', { ownerIdentifier }, function(result)
            local row = result and result[1]
            if not row then return end

            exports.oxmysql:execute('SELECT code FROM flamingo_referral_redeems WHERE identifier = ?', { ownerIdentifier }, function(redeemResult)
                GetClaimedMilestones(ownerIdentifier, function(claimedMilestones)
                    TriggerClientEvent('flamingo_mmenu:receiveReferralData', xOwner.source, {
                        code = row.code,
                        uses = row.uses,
                        earned = row.earned,
                        pending = row.pending,
                        hasRedeemed = (redeemResult and redeemResult[1]) ~= nil,
                        milestonesClaimed = claimedMilestones
                    })
                end)
            end)
        end)
    end
end

RegisterNetEvent('flamingo_mmenu:requestReferralData', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    exports.oxmysql:execute('SELECT code, uses, earned, pending FROM flamingo_referral_codes WHERE identifier = ?', { identifier }, function(ownResult)
        exports.oxmysql:execute('SELECT code FROM flamingo_referral_redeems WHERE identifier = ?', { identifier }, function(redeemResult)
            local own = ownResult and ownResult[1]
            local redeemed = redeemResult and redeemResult[1]

            GetClaimedMilestones(identifier, function(claimedMilestones)
                TriggerClientEvent('flamingo_mmenu:receiveReferralData', src, {
                    code = own and own.code or nil,
                    uses = own and own.uses or 0,
                    earned = own and own.earned or 0,
                    pending = own and own.pending or 0,
                    hasRedeemed = redeemed ~= nil,
                    milestonesClaimed = claimedMilestones
                })
            end)
        end)
    end)
end)

-- ==========================================================
-- TRAKA SA NIVOIMA (Nagrade -> Pozivni Kod -> Config.ReferralMilestones)
-- ==========================================================

local function FindReferralMilestone(threshold)
    for _, m in ipairs(Config.ReferralMilestones or {}) do
        if m.uses == threshold then
            return m
        end
    end
    return nil
end

-- Deljena funkcija za dodelu nagrade oblika { money, coins, xp, levels } -
-- koristi je i traka sa nivoima (pozivni kod) i kalendar dnevnih nagrada
-- ispod. flamingo_payday treba da izlozi export-e AddXP(source, amount) i
-- AddLevels(source, amount) - GetPlayerLevelData vec postoji tamo (koristi
-- se gore za requestLevelData), pa samo dodaj ova dva pored njega. Dok ih ne
-- dodas, pcall ovde samo tiho ne uradi nista (nece srusiti resurs), a
-- kes/coin deo nagrade i dalje normalno stize.
local function GrantMmenuReward(src, xPlayer, reward)
    if reward.money and reward.money > 0 then
        xPlayer.addMoney(reward.money)
    end

    if reward.coins and reward.coins > 0 then
        pcall(function()
            exports['flamingo_coins']:AddCoins(src, reward.coins)
        end)
    end

    if reward.xp and reward.xp > 0 then
        pcall(function()
            exports['flamingo_payday']:AddXP(src, reward.xp)
        end)
    end

    if reward.levels and reward.levels > 0 then
        pcall(function()
            exports['flamingo_payday']:AddLevels(src, reward.levels)
        end)
    end
end

-- Igrac klikne "Pokupi" na jednom od nivoa u traci. Server ponovo proverava
-- SVE (da li je zaista dostigao taj broj ljudi, da li ga je vec pokupio) -
-- nikad se ne oslanja na ono sto NUI misli da je stanje.
RegisterNetEvent('flamingo_mmenu:claimReferralMilestone', function(rawThreshold)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local threshold = tonumber(rawThreshold)
    local milestone = threshold and FindReferralMilestone(threshold)

    if not milestone then
        TriggerClientEvent('flamingo_mmenu:milestoneClaimed', src, { success = false, message = 'Nepoznat nivo nagrade.' })
        return
    end

    local identifier = xPlayer.identifier

    exports.oxmysql:execute('SELECT uses FROM flamingo_referral_codes WHERE identifier = ?', { identifier }, function(codeResult)
        local uses = codeResult and codeResult[1] and codeResult[1].uses or 0

        if uses < milestone.uses then
            TriggerClientEvent('flamingo_mmenu:milestoneClaimed', src, { success = false, message = ('Treba ti %d ljudi da iskoriste tvoj kod za ovaj nivo.'):format(milestone.uses) })
            return
        end

        exports.oxmysql:execute('SELECT identifier FROM flamingo_referral_milestones WHERE identifier = ? AND milestone = ?', { identifier, milestone.uses }, function(already)
            if already and already[1] then
                TriggerClientEvent('flamingo_mmenu:milestoneClaimed', src, { success = false, message = 'Već si pokupio ovu nagradu.' })
                return
            end

            exports.oxmysql:insert('INSERT INTO flamingo_referral_milestones (identifier, milestone) VALUES (?, ?)', { identifier, milestone.uses }, function(insertId)
                if not insertId then
                    TriggerClientEvent('flamingo_mmenu:milestoneClaimed', src, { success = false, message = 'Greška, pokušaj ponovo.' })
                    return
                end

                GrantMmenuReward(src, xPlayer, milestone)

                FlNotify(src, ('Pokupio si nagradu za %d pozvanih drugara!'):format(milestone.uses), 'success', 'Flamingo', 'fa-solid fa-gift')
                TriggerClientEvent('flamingo_mmenu:milestoneClaimed', src, { success = true, milestone = milestone.uses })
            end)
        end)
    end)
end)

-- Igrac klikne "Pokupi Novac" - uzima SVE sto mu je nagomilano u `pending`
-- (od svih drugara koji su ikad iskoristili njegov kod, otkad je poslednji
-- put pokupio) i prebacuje odjednom na keš, pa `pending` vraca na 0.
RegisterNetEvent('flamingo_mmenu:collectReferralEarnings', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    exports.oxmysql:execute('SELECT pending FROM flamingo_referral_codes WHERE identifier = ?', { identifier }, function(result)
        local row = result and result[1]
        local pending = row and row.pending or 0

        if not row or pending <= 0 then
            TriggerClientEvent('flamingo_mmenu:referralEarningsCollected', src, { success = false, message = 'Nemaš ništa za pokupiti.' })
            return
        end

        exports.oxmysql:update('UPDATE flamingo_referral_codes SET pending = 0 WHERE identifier = ?', { identifier }, function(affectedRows)
            if not affectedRows or affectedRows == 0 then
                TriggerClientEvent('flamingo_mmenu:referralEarningsCollected', src, { success = false, message = 'Greška, pokušaj ponovo.' })
                return
            end

            xPlayer.addMoney(pending)
            FlNotify(src, ('Pokupio si %s$ od pozivnog koda!'):format(pending), 'success', 'Flamingo', 'fa-solid fa-coins')
            TriggerClientEvent('flamingo_mmenu:referralEarningsCollected', src, { success = true, collected = pending, pending = 0 })
        end)
    end)
end)

-- Igrac pravi SVOJ kod - samo jednom po nalogu (identifier je PK u tabeli), i
-- kod mora biti globalno jedinstven (code je UNIQUE).
RegisterNetEvent('flamingo_mmenu:createReferralCode', function(rawCode)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier
    local code = NormalizeReferralCode(rawCode)

    if not code then
        TriggerClientEvent('flamingo_mmenu:referralCodeCreated', src, {
            success = false,
            message = ('Kod mora imati %d-%d slova/brojeva, bez razmaka i specijalnih znakova.'):format(Config.Referral.codeMinLength, Config.Referral.codeMaxLength)
        })
        return
    end

    exports.oxmysql:execute('SELECT identifier FROM flamingo_referral_codes WHERE identifier = ?', { identifier }, function(existing)
        if existing and existing[1] then
            TriggerClientEvent('flamingo_mmenu:referralCodeCreated', src, { success = false, message = 'Već imaš svoj pozivni kod.' })
            return
        end

        exports.oxmysql:execute('SELECT identifier FROM flamingo_referral_codes WHERE code = ?', { code }, function(taken)
            if taken and taken[1] then
                TriggerClientEvent('flamingo_mmenu:referralCodeCreated', src, { success = false, message = 'Ovaj kod je već zauzet, probaj neki drugi.' })
                return
            end

            exports.oxmysql:insert('INSERT INTO flamingo_referral_codes (identifier, code) VALUES (?, ?)', { identifier, code }, function(insertId)
                if not insertId then
                    TriggerClientEvent('flamingo_mmenu:referralCodeCreated', src, { success = false, message = 'Greška pri čuvanju koda, pokušaj ponovo.' })
                    return
                end

                TriggerClientEvent('flamingo_mmenu:referralCodeCreated', src, {
                    success = true,
                    message = 'Tvoj pozivni kod je kreiran!',
                    code = code,
                    uses = 0
                })
            end)
        end)
    end)
end)

-- Igrac unosi TUDJI kod - samo jednom po nalogu, i ne sme biti sopstveni kod.
-- Nagrada (Config.Referral.rewardMoney kes + rewardCoins Flamingo Coina) ide
-- igracu koji je kod UNEO (redeemer), ne vlasniku koda.
RegisterNetEvent('flamingo_mmenu:redeemReferralCode', function(rawCode)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier
    local code = NormalizeReferralCode(rawCode)

    if not code then
        TriggerClientEvent('flamingo_mmenu:referralCodeRedeemed', src, { success = false, message = 'Nevažeći kod.' })
        return
    end

    exports.oxmysql:execute('SELECT identifier FROM flamingo_referral_redeems WHERE identifier = ?', { identifier }, function(already)
        if already and already[1] then
            TriggerClientEvent('flamingo_mmenu:referralCodeRedeemed', src, { success = false, message = 'Već si iskoristio pozivni kod na ovom nalogu.' })
            return
        end

        exports.oxmysql:execute('SELECT identifier FROM flamingo_referral_codes WHERE code = ?', { code }, function(owner)
            local ownerRow = owner and owner[1]

            if not ownerRow then
                TriggerClientEvent('flamingo_mmenu:referralCodeRedeemed', src, { success = false, message = 'Ovaj kod ne postoji.' })
                return
            end

            if ownerRow.identifier == identifier then
                TriggerClientEvent('flamingo_mmenu:referralCodeRedeemed', src, { success = false, message = 'Ne možeš iskoristiti sopstveni kod.' })
                return
            end

            exports.oxmysql:insert('INSERT INTO flamingo_referral_redeems (identifier, code) VALUES (?, ?)', { identifier, code }, function(insertId)
                if not insertId then
                    TriggerClientEvent('flamingo_mmenu:referralCodeRedeemed', src, { success = false, message = 'Greška, pokušaj ponovo.' })
                    return
                end

                exports.oxmysql:update('UPDATE flamingo_referral_codes SET uses = uses + 1 WHERE code = ?', { code })

                xPlayer.addMoney(Config.Referral.rewardMoney)

                -- flamingo_coins treba da izlozi export AddCoins(source, amount) koji dodaje
                -- Coine igracu - ako export ima drugo ime, samo promeni ime ovde.
                pcall(function()
                    exports['flamingo_coins']:AddCoins(src, Config.Referral.rewardCoins)
                end)

                -- Vlasnik koda (ownerRow.identifier) belezi zaradu od ovog iskoriscenja -
                -- ne dobija je odmah automatski, vec je pokuplja sam u meniju.
                CreditReferralOwner(ownerRow.identifier, Config.Referral.ownerRewardMoney)

                FlNotify(src, ('Iskoristio si pozivni kod i dobio %s$ i %d Flamingo Coina!'):format(Config.Referral.rewardMoney, Config.Referral.rewardCoins), 'success', 'Flamingo', 'fa-solid fa-coins')
                TriggerClientEvent('flamingo_mmenu:referralCodeRedeemed', src, { success = true, message = 'Kod uspešno iskorišćen! Nagrada je stigla na tvoj račun.' })
            end)
        end)
    end)
end)

-- ==========================================================
-- DNEVNE NAGRADE (Nagrade -> Dnevne Nagrade -> kalendar 1-30)
-- ==========================================================
-- flamingo_daily_rewards - jedan red po igracu (identifier je PK):
--   current_day     - koji dan (1-30) je SLEDECI na redu za pokupljanje
--   last_claim_date - datum poslednjeg pokupljanja (DATE, bez vremena)
--
-- Sve DATUMSKO poredjenje (da li je vec pokupljeno danas, da li je igrac
-- propustio dan) radi se u samom SQL-u preko CURDATE() - ne racunamo datume
-- rucno u Lua-i da izbegnemo probleme sa vremenskom zonom izmedju servera i baze.

RegisterNetEvent('flamingo_mmenu:requestDailyRewardData', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    exports.oxmysql:execute([[
        SELECT
            current_day,
            (last_claim_date IS NOT NULL AND last_claim_date = CURDATE()) AS claimed_today
        FROM flamingo_daily_rewards WHERE identifier = ?
    ]], { identifier }, function(result)
        local row = result and result[1]

        TriggerClientEvent('flamingo_mmenu:receiveDailyRewardData', src, {
            day = row and row.current_day or 1,
            claimedToday = row and (row.claimed_today == 1 or row.claimed_today == true) or false
        })
    end)
end)

-- Igrac klikne "Pokupi" na kalendaru. Server sam odredjuje da li niz
-- nastavlja normalno, da li je PROPUSTIO dan (pa se resetuje na Dan 1), ili
-- je vec pokupio danas - nikad se ne oslanja na dan koji NUI misli da je na redu.
RegisterNetEvent('flamingo_mmenu:claimDailyReward', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    exports.oxmysql:execute([[
        SELECT
            current_day,
            (last_claim_date IS NOT NULL AND last_claim_date = CURDATE()) AS claimed_today,
            (last_claim_date IS NOT NULL AND last_claim_date < DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS streak_broken
        FROM flamingo_daily_rewards WHERE identifier = ?
    ]], { identifier }, function(result)
        local row = result and result[1]

        if row and (row.claimed_today == 1 or row.claimed_today == true) then
            TriggerClientEvent('flamingo_mmenu:dailyRewardClaimed', src, { success = false, message = 'Već si pokupio današnju nagradu.' })
            return
        end

        -- Ako reda jos nema (prvi put ikad) ili je propustio dan, krece/vraca
        -- se na Dan 1. U suprotnom nastavlja tacno od current_day.
        local claimDay = 1
        if row and not (row.streak_broken == 1 or row.streak_broken == true) then
            claimDay = row.current_day
        end

        local reward = Config.DailyRewards[claimDay]
        if not reward then
            TriggerClientEvent('flamingo_mmenu:dailyRewardClaimed', src, { success = false, message = 'Greška u podešavanjima nagrada, obavesti admina.' })
            return
        end

        local nextDay = (claimDay >= #Config.DailyRewards) and 1 or (claimDay + 1)

        exports.oxmysql:execute('INSERT INTO flamingo_daily_rewards (identifier, current_day, last_claim_date) VALUES (?, ?, CURDATE()) ON DUPLICATE KEY UPDATE current_day = ?, last_claim_date = CURDATE()', { identifier, nextDay, nextDay }, function(affectedRows)
            if not affectedRows or affectedRows == 0 then
                TriggerClientEvent('flamingo_mmenu:dailyRewardClaimed', src, { success = false, message = 'Greška, pokušaj ponovo.' })
                return
            end

            GrantMmenuReward(src, xPlayer, reward)

            if FlTasks_Add then
                FlTasks_Add(src, 'daily_reward', 1)
            end

            FlNotify(src, ('Pokupio si dnevnu nagradu za Dan %d!'):format(claimDay), 'success', 'Flamingo', 'fa-solid fa-gift')
            TriggerClientEvent('flamingo_mmenu:dailyRewardClaimed', src, { success = true, day = claimDay, nextDay = nextDay })
        end)
    end)
end)

-- ==========================================================
-- NAGRADE ZA VREME (Nagrade -> Nagrade za Vreme tab)
-- ==========================================================
-- Ukupno vreme na serveru se prati OVDE (ne u dnevnim nagradama iznad, koje
-- se resetuju) - jedan globalni thread na 60s koji prolazi kroz sve online
-- igrace i dodaje po 1 minut svakom. Cuva se u bazu na svakih 5 minuta (ne
-- svaki minut, da se baza ne spamuje) i odmah kad igrac izadje sa servera.

local PlaytimeMinutes = {} -- [identifier] = minuti (in-memory cache, ogledalo baze)

local function LoadPlaytime(identifier, cb)
    exports.oxmysql:execute('SELECT minutes FROM flamingo_playtime WHERE identifier = ?', { identifier }, function(result)
        cb(result and result[1] and result[1].minutes or 0)
    end)
end

local function SavePlaytime(identifier)
    local minutes = PlaytimeMinutes[identifier]
    if minutes == nil then return end
    exports.oxmysql:execute('INSERT INTO flamingo_playtime (identifier, minutes) VALUES (?, ?) ON DUPLICATE KEY UPDATE minutes = ?', { identifier, minutes, minutes })
end

CreateThread(function()
    while true do
        Wait(60000)

        for _, playerId in ipairs(ESX.GetPlayers and ESX.GetPlayers() or {}) do
            local xPlayer = ESX.GetPlayerFromId(playerId)
            if xPlayer then
                local identifier = xPlayer.identifier

                if PlaytimeMinutes[identifier] == nil then
                    -- prvi put da ovaj thread vidi ovog igraca (npr. resurs se restartovao
                    -- dok je vec bio online) - ucitaj postojece stanje pre nego sto dodas minut
                    LoadPlaytime(identifier, function(minutes)
                        PlaytimeMinutes[identifier] = minutes + 1
                        SavePlaytime(identifier)
                    end)
                else
                    PlaytimeMinutes[identifier] = PlaytimeMinutes[identifier] + 1

                    if PlaytimeMinutes[identifier] % 5 == 0 then
                        SavePlaytime(identifier)
                    end
                end

                -- Zadaci (server/zadaci.lua) - +1 minut za dnevne/nedeljne 'playtime' zadatke
                if FlTasks_Add then
                    FlTasks_Add(playerId, 'playtime', 1)
                end
            end
        end
    end
end)

AddEventHandler('playerDropped', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    SavePlaytime(identifier)
    PlaytimeMinutes[identifier] = nil

end)

local function FindPlaytimeMilestone(hours)
    for _, m in ipairs(Config.PlaytimeMilestones or {}) do
        if m.hours == hours then
            return m
        end
    end
    return nil
end

-- Koliko dana je ostalo do kraja trenutne "sezone" nagrada za vreme (vidi
-- komentar u config.lua) - prikazuje se kao "ISTIČE ZA Xd" u NUI. Ovo MORA
-- da racuna server (os.time/os.date ne postoje na FiveM klijentu - client.lua
-- bi pukao sa "attempt to index a nil value (global 'os')").
local function GetPlaytimeSeasonDaysLeft()
    local y, mo, d = Config.PlaytimeSeasonStart:match('(%d+)-(%d+)-(%d+)')
    if not y then return 0 end

    local startTime = os.time({ year = tonumber(y), month = tonumber(mo), day = tonumber(d), hour = 0, min = 0, sec = 0 })
    local endTime = startTime + (Config.PlaytimeSeasonDays * 86400)
    local daysLeft = math.ceil((endTime - os.time()) / 86400)

    return math.max(0, daysLeft)
end

local function SendPlaytimeMilestoneData(src, identifier, minutes)
    exports.oxmysql:execute('SELECT milestone FROM flamingo_playtime_milestones WHERE identifier = ?', { identifier }, function(result)
        local claimed = {}
        for _, row in ipairs(result or {}) do
            table.insert(claimed, row.milestone)
        end

        TriggerClientEvent('flamingo_mmenu:receivePlaytimeMilestoneData', src, {
            minutes = minutes,
            claimed = claimed,
            seasonDaysLeft = GetPlaytimeSeasonDaysLeft()
        })
    end)
end

RegisterNetEvent('flamingo_mmenu:requestPlaytimeMilestoneData', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.identifier

    if PlaytimeMinutes[identifier] ~= nil then
        SendPlaytimeMilestoneData(src, identifier, PlaytimeMinutes[identifier])
    else
        LoadPlaytime(identifier, function(minutes)
            PlaytimeMinutes[identifier] = minutes
            SendPlaytimeMilestoneData(src, identifier, minutes)
        end)
    end
end)

-- Igrac klikne "Pokupi" na jednom od pragova. Server ponovo proverava SVE
-- (da li je zaista dostigao taj broj sati, da li ga je vec pokupio).
RegisterNetEvent('flamingo_mmenu:claimPlaytimeMilestone', function(rawHours)
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local hours = tonumber(rawHours)
    local milestone = hours and FindPlaytimeMilestone(hours)

    if not milestone then
        TriggerClientEvent('flamingo_mmenu:playtimeMilestoneClaimed', src, { success = false, message = 'Nepoznat nivo nagrade.' })
        return
    end

    local identifier = xPlayer.identifier
    local minutes = PlaytimeMinutes[identifier] or 0
    local requiredMinutes = milestone.hours * 60

    if minutes < requiredMinutes then
        TriggerClientEvent('flamingo_mmenu:playtimeMilestoneClaimed', src, { success = false, message = ('Treba ti %dh ukupnog vremena na serveru za ovaj nivo.'):format(milestone.hours) })
        return
    end

    exports.oxmysql:execute('SELECT identifier FROM flamingo_playtime_milestones WHERE identifier = ? AND milestone = ?', { identifier, milestone.hours }, function(already)
        if already and already[1] then
            TriggerClientEvent('flamingo_mmenu:playtimeMilestoneClaimed', src, { success = false, message = 'Već si pokupio ovu nagradu.' })
            return
        end

        exports.oxmysql:insert('INSERT INTO flamingo_playtime_milestones (identifier, milestone) VALUES (?, ?)', { identifier, milestone.hours }, function(insertId)
            if not insertId then
                TriggerClientEvent('flamingo_mmenu:playtimeMilestoneClaimed', src, { success = false, message = 'Greška, pokušaj ponovo.' })
                return
            end

            GrantMmenuReward(src, xPlayer, milestone)

            FlNotify(src, ('Pokupio si nagradu za %dh vremena na serveru!'):format(milestone.hours), 'success', 'Flamingo', 'fa-solid fa-gift')
            TriggerClientEvent('flamingo_mmenu:playtimeMilestoneClaimed', src, { success = true, milestone = milestone.hours })
        end)
    end)
end)

-- ============================================================
-- POSLOVI - Rudar je jedini sa stvarnom logikom (flamingo_rudar resurs),
-- ostali poslovi (Građevinar/Ribar/Taksista) ostaju mock/"uskoro" u NUI-ju.
-- ============================================================

RegisterNetEvent('flamingo_mmenu:requestPosloviData', function()
    local src = source

    local ok, data = pcall(function()
        return exports['flamingo_rudar']:GetSkillData(src)
    end)

    if not ok or not data then
        TriggerClientEvent('flamingo_mmenu:receivePosloviData', src, { rudar = nil })
        return
    end

    TriggerClientEvent('flamingo_mmenu:receivePosloviData', src, { rudar = data })
end)
