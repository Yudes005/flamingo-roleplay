-- ==========================================================
-- flamingo_graphics - klijent
-- Sva podesavanja dolaze iz M menija (flamingo_mmenu -> Podesavanja -> Grafika)
-- preko lokalnog eventa 'flamingo_graphics:setConfig'. Dok meni ne posalje
-- nista, igrac ima Config.Defaults - znaci lepsa grafika radi cim se udje.
-- ==========================================================

local state = {}
for k, v in pairs(Config.Defaults) do state[k] = v end

local wantedModifier = nil -- modifier koji treba da bude aktivan u extra slotu
local fading = false
local fadeToken = 0
local shadowsApplied = nil
local vehicleLightsApplied = false

local function clamp(v, min, max)
    v = tonumber(v)
    if not v then return nil end
    return math.min(max, math.max(min, v))
end

local function strength01()
    return (clamp(state.strength, 0, 100) or 0) / 100
end

local function isNight()
    local h = GetClockHours()
    if Config.NightStart > Config.NightEnd then
        return h >= Config.NightStart or h < Config.NightEnd
    end
    return h >= Config.NightStart and h < Config.NightEnd
end

local function targetModifier()
    local preset = Config.Presets[state.preset]
    if not preset or not preset.day then return nil end
    if state.dayNight and preset.night and isNight() then return preset.night end
    return preset.day
end

-- Glatko gasi trenutni modifier i pali novi (bez naglog "skoka" boja)
local function fadeTo(name)
    local hadModifier = wantedModifier ~= nil
    wantedModifier = name
    fadeToken = fadeToken + 1
    local token = fadeToken
    fading = true

    CreateThread(function()
        local steps = 30
        local stepWait = math.max(0, math.floor(Config.TransitionTime * 1000 / 2 / steps))

        if hadModifier then
            for i = steps, 0, -1 do
                if token ~= fadeToken then return end
                SetExtraTimecycleModifierStrength(strength01() * i / steps)
                Wait(stepWait)
            end
        end

        if token ~= fadeToken then return end

        if name then
            SetExtraTimecycleModifier(name)
            SetExtraTimecycleModifierStrength(0.0)
            for i = 1, steps do
                if token ~= fadeToken then return end
                SetExtraTimecycleModifierStrength(strength01() * i / steps)
                Wait(stepWait)
            end
        else
            ClearExtraTimecycleModifier()
        end

        if token == fadeToken then fading = false end
    end)
end

local function applyModifier()
    local target = targetModifier()
    if target ~= wantedModifier then
        fadeTo(target)
    elseif target and not fading then
        SetExtraTimecycleModifierStrength(strength01())
    end
end

local function applyShadows()
    if shadowsApplied == state.softShadows then return end
    shadowsApplied = state.softShadows

    if state.softShadows then
        CascadeShadowsSetShadowSampleType(Config.SoftShadowType)
    else
        CascadeShadowsClearShadowSampleType()
    end
end

local function setAllVehicleLights(multiplier)
    for _, veh in ipairs(GetGamePool('CVehicle')) do
        SetVehicleLightMultiplier(veh, multiplier)
    end
end

local function applyAll()
    applyModifier()
    applyShadows()
end

-- Podesavanja iz M menija. Sve vrednosti se proveravaju, pa los podatak ne moze
-- da srusi skriptu.
AddEventHandler('flamingo_graphics:setConfig', function(cfg)
    if type(cfg) ~= 'table' then return end

    if cfg.preset ~= nil and Config.Presets[cfg.preset] then state.preset = cfg.preset end
    if cfg.strength ~= nil then state.strength = clamp(cfg.strength, 0, 100) or state.strength end
    if cfg.lod ~= nil then state.lod = clamp(cfg.lod, 100, Config.MaxLod) or state.lod end
    if cfg.dayNight ~= nil then state.dayNight = cfg.dayNight == true end
    if cfg.softShadows ~= nil then state.softShadows = cfg.softShadows == true end
    if cfg.vehicleLights ~= nil then state.vehicleLights = cfg.vehicleLights == true end

    applyAll()
end)

-- Glavna petlja: dan/noc prelaz + vracanje efekta ako ga neka skripta obrise
CreateThread(function()
    wantedModifier = targetModifier()
    if wantedModifier then
        SetExtraTimecycleModifier(wantedModifier)
        SetExtraTimecycleModifierStrength(strength01())
    end
    applyShadows()

    -- Javi M meniju da smo spremni, da posalje sacuvana podesavanja igraca
    -- (bitno kad se flamingo_graphics restartuje posle menija).
    TriggerEvent('flamingo_graphics:ready')

    while true do
        Wait(5000)
        local target = targetModifier()
        if target ~= wantedModifier then
            fadeTo(target)
        elseif target and not fading and GetExtraTimecycleModifierIndex() == -1 then
            SetExtraTimecycleModifier(target)
            SetExtraTimecycleModifierStrength(strength01())
        end
    end
end)

-- Daljina detalja (LOD). Mora da se postavlja svaki frejm.
CreateThread(function()
    while true do
        local scale = (tonumber(state.lod) or 100) / 100
        if scale > 1.0 then
            OverrideLodscaleThisFrame(scale)
            Wait(0)
        else
            Wait(500)
        end
    end
end)

-- Jaca svetla vozila (samo vizuelno, kod ovog igraca)
CreateThread(function()
    while true do
        if state.vehicleLights then
            setAllVehicleLights(Config.VehicleLightMultiplier)
            vehicleLightsApplied = true
        elseif vehicleLightsApplied then
            setAllVehicleLights(1.0)
            vehicleLightsApplied = false
        end
        Wait(1500)
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    ClearExtraTimecycleModifier()
    CascadeShadowsClearShadowSampleType()
    if vehicleLightsApplied then setAllVehicleLights(1.0) end
end)
