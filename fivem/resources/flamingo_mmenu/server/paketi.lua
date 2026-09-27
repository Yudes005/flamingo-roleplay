-- ============================================================
--  MOJI PAKETI + KUTIJE (flamingo_mmenu)
--  Kupovina kutija, otvaranje, aktiviranje nagrada, prodaja
--  paketa za Flamingo Coine i "Dropovi" traka uživo.
-- ============================================================
local ESX = exports['es_extended']:getSharedObject()

local busy = {}          -- [src] = true dok se obrađuje zahtev (štiti od duplog klika / spama)
local recentDrops = {}   -- poslednji dobici svih igrača (za traku "Dropovi")
local dropSeq = 0

local function notify(src, msg, typ, icon)
    if GetResourceState('esx_notify') == 'started' then
        TriggerClientEvent('esx_notify:notify', src, msg, typ or 'info', 4500, 'Flamingo', icon or 'fa-solid fa-box-open')
    else
        TriggerClientEvent('esx:showNotification', src, msg, typ)
    end
end

local function fmt(n)
    local s = tostring(math.floor(tonumber(n) or 0))
    local out = s:reverse():gsub('(%d%d%d)', '%1.'):reverse()
    return (out:gsub('^%.', ''))
end

local function findKutija(id)
    for _, k in ipairs(Config.Kutije or {}) do
        if k.id == id then return k end
    end
end

-- Jedan zahtev po igraču u isto vreme. Bez ovoga brz dupli klik može
-- da prođe proveru "imaš li dovoljno kutija/coina" dva puta.
local function guarded(src, fn)
    if busy[src] then return end
    busy[src] = true
    local ok, err = pcall(fn)
    busy[src] = nil
    if not ok then
        print(('^1[flamingo_mmenu] paketi greška: %s^0'):format(err))
        TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
    end
end

AddEventHandler('playerDropped', function()
    busy[source] = nil
end)

-- ============================================================
--  COINI (flamingo_coins)
-- ============================================================
local function coins(src)
    local ok, amount = pcall(function() return exports['flamingo_coins']:GetCoins(src) end)
    if ok and type(amount) == 'number' then return amount end
    ok, amount = pcall(function() return exports['flamingo_coins']:GetPlayerCoins(src) end)
    return (ok and type(amount) == 'number') and amount or 0
end

local function takeCoins(src, amount)
    local ok, had = pcall(function() return exports['flamingo_coins']:TryTakeCoins(src, amount) end)
    return ok and had
end

local function giveCoins(src, amount)
    pcall(function() exports['flamingo_coins']:AddCoins(src, amount) end)
end

-- ============================================================
--  ROK KUTIJE ("Ostalo: X dana")
-- ============================================================
local function parseDate(s)
    if type(s) ~= 'string' then return nil end
    local y, m, d, h, mi = s:match('^(%d+)%-(%d+)%-(%d+)%s*(%d*):?(%d*)')
    if not y then return nil end
    return os.time({
        year = tonumber(y), month = tonumber(m), day = tonumber(d),
        hour = tonumber(h) or 23, min = tonumber(mi) or 59, sec = 59
    })
end

-- vraća: broj preostalih dana (ili nil = bez oznake), da li je istekla
local function crateTime(k)
    local endsAt = parseDate(k.ends)
    if endsAt then
        local left = endsAt - os.time()
        if left <= 0 then return nil, true end
        return math.ceil(left / 86400), false
    end
    return Config.KutijeTrajanje, false
end

-- ============================================================
--  SLIKE
-- ============================================================
local function resolveImage(img)
    if type(img) ~= 'string' or img == '' then return nil end
    if img:find('^https?://') or img:find('^nui://') or img:find('^img/') then return img end
    return 'img/kutije/' .. img
end

-- flamingo_autosalon (ako ima GetVehicleImage i vraća pun link) - samo uspešni se keširaju
local vehicleImageCache = {}
local function vehicleImage(model)
    if vehicleImageCache[model] then return vehicleImageCache[model] end
    if GetResourceState('flamingo_autosalon') ~= 'started' then return nil end
    local ok, res = pcall(function() return exports['flamingo_autosalon']:GetVehicleImage(model) end)
    if ok and type(res) == 'string' and (res:find('^https?://') or res:find('^nui://')) then
        vehicleImageCache[model] = res
        return res
    end
    return nil
end

local function rewardImage(r)
    local custom = resolveImage(r.image)
    if custom then return custom end
    if r.kind == 'predmet' then return ('nui://ox_inventory/web/images/%s.png'):format(r.ref) end
    if r.kind == 'novac' then return 'img/money_bag.png' end
    if r.kind == 'vozilo' then return vehicleImage(r.ref) end
    return nil
end

-- slika za red iz "Moji paketi" (kutija -> slika kutije, ostalo -> slika nagrade)
local function packageImage(p)
    if p.kind == 'kutija' then
        local k = findKutija(p.ref)
        return k and resolveImage(k.image) or nil
    end
    if p.kind == 'vozilo' then
        for _, k in ipairs(Config.Kutije or {}) do
            for _, r in ipairs(k.rewards or {}) do
                if r.kind == 'vozilo' and r.ref == p.ref and r.image then
                    return resolveImage(r.image)
                end
            end
        end
    end
    return rewardImage({ kind = p.kind, ref = p.ref })
end

-- ============================================================
--  PAKETI U BAZI
-- ============================================================
local function packagesOf(identifier)
    return MySQL.query.await('SELECT * FROM flamingo_mmenu_paketi WHERE identifier = ? ORDER BY id DESC', { identifier }) or {}
end

-- kutije se slažu u jedan red, ostalo ide kao poseban paket
local function addPackage(identifier, pkg)
    if pkg.kind == 'kutija' then
        local row = MySQL.single.await('SELECT id FROM flamingo_mmenu_paketi WHERE identifier = ? AND kind = ? AND ref = ? LIMIT 1',
            { identifier, 'kutija', pkg.ref })
        if row then
            MySQL.update.await('UPDATE flamingo_mmenu_paketi SET qty = qty + ? WHERE id = ?', { pkg.qty or 1, row.id })
            return row.id
        end
    end

    return MySQL.insert.await([[
        INSERT INTO flamingo_mmenu_paketi (identifier, kind, ref, label, rarity, qty, value, coin_value, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ]], {
        identifier, pkg.kind, pkg.ref, pkg.label, pkg.rarity or 'obicno',
        pkg.qty or 1, pkg.value or 0, pkg.coinValue or 0, pkg.source, os.time()
    })
end

-- skida qty komada; vraća red ili nil ako ga nema / nema dovoljno
local function takePackage(identifier, id, qty)
    local row = MySQL.single.await('SELECT * FROM flamingo_mmenu_paketi WHERE id = ? AND identifier = ?', { id, identifier })
    if not row then return nil end

    qty = math.max(1, math.floor(tonumber(qty) or 1))
    if qty > row.qty then return nil end

    if row.qty > qty then
        MySQL.update.await('UPDATE flamingo_mmenu_paketi SET qty = qty - ? WHERE id = ?', { qty, id })
    else
        MySQL.query.await('DELETE FROM flamingo_mmenu_paketi WHERE id = ?', { id })
    end

    row.takenQty = qty
    return row
end

-- ============================================================
--  SNAPSHOT ZA UI
-- ============================================================
local function snapshot(src)
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return nil end

    local packages = packagesOf(xPlayer.identifier)
    local owned = {}
    for _, p in ipairs(packages) do
        if p.kind == 'kutija' then owned[p.ref] = (owned[p.ref] or 0) + p.qty end
        p.image = packageImage(p)
    end

    local crates = {}
    for _, k in ipairs(Config.Kutije or {}) do
        local days, expired = crateTime(k)
        local have = owned[k.id] or 0

        -- istekla kutija se više ne prikazuje, osim ako igrač još ima neotvorenih
        if not expired or have > 0 then
            local rewards = {}
            for _, r in ipairs(k.rewards or {}) do
                rewards[#rewards + 1] = {
                    label = r.label, kind = r.kind, ref = r.ref,
                    rarity = r.rarity, chance = r.chance, image = rewardImage(r),
                    coinValue = r.coinValue or 0
                }
            end

            crates[#crates + 1] = {
                id = k.id, name = k.name, desc = k.desc, price = k.price,
                icon = k.icon, image = resolveImage(k.image), rarity = k.rarity,
                owned = have, days = days, expired = expired,
                rewards = rewards,
            }
        end
    end

    return {
        crates = crates,
        packages = packages,
        coins = coins(src),
        rarities = Config.Retkosti,
        sellPercent = Config.PaketProdajaProcenat,
        maxBuy = Config.KutijeMaxKupovina or 50,
        drops = Config.KutijeDropovi ~= false and recentDrops or {},
    }
end

local function push(src)
    TriggerClientEvent('flamingo_mmenu:paketi:data', src, snapshot(src))
end

RegisterNetEvent('flamingo_mmenu:paketi:request', function()
    push(source)
end)

-- ============================================================
--  DROPOVI (šta su igrači dobili - vide svi)
-- ============================================================
local function pushDrop(src, crate, r)
    if Config.KutijeDropovi == false then return end

    dropSeq = dropSeq + 1
    local drop = {
        id = dropSeq, label = r.label, kind = r.kind, rarity = r.rarity,
        image = r.image, crate = crate.name, by = src,
    }

    table.insert(recentDrops, 1, drop)
    local max = Config.KutijeDropoviBroj or 20
    while #recentDrops > max do table.remove(recentDrops) end

    TriggerClientEvent('flamingo_mmenu:paketi:drop', -1, drop)
end

-- ============================================================
--  KUPOVINA KUTIJA
-- ============================================================
RegisterNetEvent('flamingo_mmenu:paketi:buy', function(crateId, amount)
    local src = source
    guarded(src, function()
        local xPlayer = ESX.GetPlayerFromId(src)
        local crate = findKutija(crateId)
        amount = math.floor(tonumber(amount) or 0)
        if not xPlayer then return end
        if not crate then push(src) return end

        local maxBuy = Config.KutijeMaxKupovina or 50
        if amount < 1 or amount > maxBuy then
            notify(src, ('Možeš kupiti od 1 do %d kutija odjednom.'):format(maxBuy), 'error')
            TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
            return
        end

        local _, expired = crateTime(crate)
        if expired then
            notify(src, 'Ova kutija se više ne prodaje.', 'error')
            TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
            push(src)
            return
        end

        local cost = crate.price * amount
        if not takeCoins(src, cost) then
            notify(src, ('Nemaš %s Flamingo Coina.'):format(fmt(cost)), 'error', 'fa-solid fa-circle-exclamation')
            TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
            return
        end

        addPackage(xPlayer.identifier, {
            kind = 'kutija', ref = crate.id, label = crate.name, rarity = crate.rarity,
            qty = amount, coinValue = crate.price, source = 'prodavnica'
        })

        notify(src, ('Uspešno si kupio %s u količini %d kom.'):format(crate.name, amount), 'success')
        TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = true, bought = amount })
        push(src)
    end)
end)

-- ============================================================
--  OTVARANJE KUTIJA
-- ============================================================
local function rollReward(crate)
    local total = 0
    for _, r in ipairs(crate.rewards) do total = total + (r.chance or 0) end
    if total <= 0 then return crate.rewards[1] end

    local roll = math.random() * total
    local acc = 0
    for _, r in ipairs(crate.rewards) do
        acc = acc + (r.chance or 0)
        if roll <= acc then return r end
    end
    return crate.rewards[#crate.rewards]
end

RegisterNetEvent('flamingo_mmenu:paketi:open', function(crateId, count)
    local src = source
    guarded(src, function()
        local xPlayer = ESX.GetPlayerFromId(src)
        local crate = findKutija(crateId)
        count = math.min(math.max(1, math.floor(tonumber(count) or 1)), 5)
        if not xPlayer then return end
        if not crate or not crate.rewards or #crate.rewards == 0 then push(src) return end

        local row = MySQL.single.await('SELECT id, qty FROM flamingo_mmenu_paketi WHERE identifier = ? AND kind = ? AND ref = ? LIMIT 1',
            { xPlayer.identifier, 'kutija', crate.id })
        if not row or row.qty < count or not takePackage(xPlayer.identifier, row.id, count) then
            notify(src, 'Nemaš toliko kutija.', 'error')
            TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
            push(src)
            return
        end

        local results = {}
        for _ = 1, count do
            local r = rollReward(crate)
            local value = r.amount or 0
            local label = r.label

            if r.kind == 'novac' then
                value = math.random(r.min or 1000, r.max or 5000)
                label = ('%s$'):format(fmt(value))
            end

            addPackage(xPlayer.identifier, {
                kind = r.kind, ref = r.ref, label = label, rarity = r.rarity,
                qty = 1, value = value, coinValue = r.coinValue or 0, source = crate.id
            })

            results[#results + 1] = {
                label = label, kind = r.kind, ref = r.ref, rarity = r.rarity,
                value = value, image = rewardImage(r), coinValue = r.coinValue or 0
            }
        end

        -- prvo rezultat (pokreće rulet kod igrača), pa dropovi, pa novi snapshot
        TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = true, opened = results, crateId = crate.id })
        for _, r in ipairs(results) do pushDrop(src, crate, r) end
        push(src)
    end)
end)

-- ============================================================
--  AKTIVIRANJE PAKETA
-- ============================================================
local function randomPlate()
    local chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for _ = 1, 10 do
        local plate = ''
        for _ = 1, 3 do
            local i = math.random(#chars)
            plate = plate .. chars:sub(i, i)
        end
        plate = plate .. ' ' .. math.random(100, 999)
        local taken = MySQL.scalar.await('SELECT 1 FROM owned_vehicles WHERE plate = ? LIMIT 1', { plate })
        if not taken then return plate end
    end
    return ('FL %05d'):format(math.random(0, 99999))
end

local function vehicleLimitOk(xPlayer)
    local limit = 10
    if GetResourceState('flamingo_garage') == 'started' then
        local ok, max = pcall(function() return exports['flamingo_garage']:GetMaxSlots(xPlayer.identifier) end)
        if ok and type(max) == 'number' then limit = max end
    end
    local owned = MySQL.scalar.await('SELECT COUNT(*) FROM owned_vehicles WHERE owner = ?', { xPlayer.identifier }) or 0
    return owned < limit, limit
end

RegisterNetEvent('flamingo_mmenu:paketi:activate', function(packageId)
    local src = source
    guarded(src, function()
        local xPlayer = ESX.GetPlayerFromId(src)
        if not xPlayer then return end

        -- javi UI-u (zvuk greške + skini spinner) i osveži podatke
        local function fail()
            TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
            push(src)
        end

        local row = MySQL.single.await('SELECT * FROM flamingo_mmenu_paketi WHERE id = ? AND identifier = ?', { packageId, xPlayer.identifier })
        if not row then fail() return end

        if row.kind == 'kutija' then
            notify(src, 'Kutija se otvara, ne aktivira.', 'error')
            fail()
            return
        end

        if row.kind == 'vozilo' then
            local ok, limit = vehicleLimitOk(xPlayer)
            if not ok then
                notify(src, ('Imaš maksimalan broj vozila (%d). Oslobodi mesto pa probaj ponovo.'):format(limit), 'error')
                fail()
                return
            end
            if not takePackage(xPlayer.identifier, row.id, 1) then fail() return end

            local plate = randomPlate()
            local props = { model = GetHashKey(row.ref), plate = plate, fuelLevel = 100, engineHealth = 1000.0, bodyHealth = 1000.0 }
            MySQL.insert.await('INSERT INTO owned_vehicles (owner, plate, vehicle, type, `stored`) VALUES (?, ?, ?, ?, 1)',
                { xPlayer.identifier, plate, json.encode(props), 'car' })

            notify(src, ('%s je parkiran u tvojoj garaži (tablice %s).'):format(row.label, plate), 'success', 'fa-solid fa-car-side')

        elseif row.kind == 'predmet' then
            local amount = math.max(1, row.value > 0 and row.value or 1)
            if not exports.ox_inventory:CanCarryItem(src, row.ref, amount) then
                notify(src, 'Nemaš mesta u inventaru.', 'error')
                fail()
                return
            end
            if not takePackage(xPlayer.identifier, row.id, 1) then fail() return end
            if not exports.ox_inventory:AddItem(src, row.ref, amount) then
                -- vrati paket ako predmet ipak nije ubačen
                addPackage(xPlayer.identifier, {
                    kind = row.kind, ref = row.ref, label = row.label, rarity = row.rarity,
                    qty = 1, value = row.value, coinValue = row.coin_value, source = row.source
                })
                notify(src, 'Predmet nije mogao da se doda.', 'error')
                fail()
                return
            end
            notify(src, ('Preuzeo si: %s'):format(row.label), 'success')

        elseif row.kind == 'novac' then
            if not takePackage(xPlayer.identifier, row.id, 1) then fail() return end
            local amount = math.max(0, row.value)
            if Config.KutijeNovacRacun == 'bank' then
                xPlayer.addAccountMoney('bank', amount)
            else
                xPlayer.addMoney(amount)
            end
            notify(src, ('Preuzeo si %s$.'):format(fmt(amount)), 'success', 'fa-solid fa-sack-dollar')
        else
            fail()
            return
        end

        TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = true, activated = row.kind })
        push(src)
    end)
end)

-- ============================================================
--  PRODAJA PAKETA ZA COINE
-- ============================================================
RegisterNetEvent('flamingo_mmenu:paketi:sell', function(packageId, qty)
    local src = source
    guarded(src, function()
        local xPlayer = ESX.GetPlayerFromId(src)
        if not xPlayer then return end

        local function fail()
            TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = false })
            push(src)
        end

        local row = MySQL.single.await('SELECT * FROM flamingo_mmenu_paketi WHERE id = ? AND identifier = ?', { packageId, xPlayer.identifier })
        if not row then fail() return end

        qty = math.min(math.max(1, math.floor(tonumber(qty) or 1)), row.qty)
        local perPiece = math.floor((row.coin_value or 0) * (Config.PaketProdajaProcenat or 0.5))
        local payout = perPiece * qty

        if payout <= 0 then
            notify(src, 'Ovaj paket se ne može prodati.', 'error')
            fail()
            return
        end

        if not takePackage(xPlayer.identifier, row.id, qty) then fail() return end
        giveCoins(src, payout)
        notify(src, ('Prodao si %s za %s Flamingo Coina.'):format(row.label, fmt(payout)), 'success', 'fa-solid fa-coins')
        TriggerClientEvent('flamingo_mmenu:paketi:result', src, { ok = true, sold = payout })
        push(src)
    end)
end)
