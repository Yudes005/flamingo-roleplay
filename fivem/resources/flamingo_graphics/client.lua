local KVP_PRESET = 'flamingo_graphics:preset'
local KVP_STRENGTH = 'flamingo_graphics:strength'

local currentPreset = Config.DefaultPreset
local strength = Config.DefaultStrength

local wantedModifier = nil -- modifier koji treba da bude aktivan
local fading = false
local fadeToken = 0

local ESX = nil
if GetResourceState('es_extended') ~= 'missing' then
    local ok, obj = pcall(function() return exports['es_extended']:getSharedObject() end)
    if ok then ESX = obj end
end

local function notify(msg)
    if ESX and ESX.ShowNotification then
        ESX.ShowNotification(msg)
    else
        TriggerEvent('chat:addMessage', { color = { 255, 105, 180 }, args = { 'Grafika', msg } })
    end
end

local function isNight()
    local h = GetClockHours()
    if Config.NightStart > Config.NightEnd then
        return h >= Config.NightStart or h < Config.NightEnd
    end
    return h >= Config.NightStart and h < Config.NightEnd
end

local function targetModifier()
    local preset = Config.Presets[currentPreset]
    if not preset or not preset.day then return nil end
    if isNight() and preset.night then return preset.night end
    return preset.day
end

local function setModifier(name, s)
    if name then
        SetExtraTimecycleModifier(name)
        SetExtraTimecycleModifierStrength(s)
    else
        ClearExtraTimecycleModifier()
    end
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
                SetExtraTimecycleModifierStrength(strength * i / steps)
                Wait(stepWait)
            end
        end

        if token ~= fadeToken then return end
        setModifier(name, 0.0)

        if name then
            for i = 1, steps do
                if token ~= fadeToken then return end
                SetExtraTimecycleModifierStrength(strength * i / steps)
                Wait(stepWait)
            end
        end

        if token == fadeToken then fading = false end
    end)
end

local function loadSettings()
    local savedPreset = GetResourceKvpString(KVP_PRESET)
    if savedPreset and Config.Presets[savedPreset] then
        currentPreset = savedPreset
    end

    local savedStrength = tonumber(GetResourceKvpString(KVP_STRENGTH) or '')
    if savedStrength then
        strength = math.min(1.0, math.max(0.0, savedStrength))
    end
end

-- Glavna petlja: dan/noc prelaz + vracanje efekta ako ga neka skripta obrise
CreateThread(function()
    loadSettings()
    wantedModifier = targetModifier()
    setModifier(wantedModifier, strength)

    while true do
        Wait(5000)
        local target = targetModifier()
        if target ~= wantedModifier then
            fadeTo(target)
        elseif target and not fading and GetExtraTimecycleModifierIndex() == -1 then
            setModifier(target, strength)
        end
    end
end)

-- LOD boost (samo za presete koji imaju lodScale)
CreateThread(function()
    while true do
        local preset = Config.Presets[currentPreset]
        if preset and preset.lodScale then
            OverrideLodscaleThisFrame(preset.lodScale)
            Wait(0)
        else
            Wait(1000)
        end
    end
end)

local function presetList()
    local names = {}
    for _, key in ipairs(Config.PresetOrder) do
        if Config.Presets[key] then names[#names + 1] = key end
    end
    return table.concat(names, ', ')
end

RegisterCommand('grafika', function(_, args)
    local key = args[1] and args[1]:lower()

    if not key then
        notify(('Trenutno: ~b~%s~s~ (%d%%). Opcije: %s'):format(currentPreset, math.floor(strength * 100 + 0.5), presetList()))
        return
    end

    local preset = Config.Presets[key]
    if not preset then
        notify(('Nepoznat preset. Opcije: %s'):format(presetList()))
        return
    end

    currentPreset = key
    SetResourceKvp(KVP_PRESET, key)
    fadeTo(targetModifier())
    notify(('Grafika: ~g~%s'):format(preset.label))
end, false)

RegisterCommand('grafikajacina', function(_, args)
    local value = tonumber(args[1])
    if not value then
        notify(('Jacina efekta: ~b~%d%%~s~. Upotreba: /grafikajacina 0-100'):format(math.floor(strength * 100 + 0.5)))
        return
    end

    strength = math.min(100, math.max(0, value)) / 100
    SetResourceKvp(KVP_STRENGTH, tostring(strength))
    if not fading and wantedModifier then
        SetExtraTimecycleModifierStrength(strength)
    end
    notify(('Jacina efekta: ~g~%d%%'):format(math.floor(strength * 100 + 0.5)))
end, false)

CreateThread(function()
    TriggerEvent('chat:addSuggestion', '/grafika', 'Promeni izgled grafike', {
        { name = 'preset', help = presetList() },
    })
    TriggerEvent('chat:addSuggestion', '/grafikajacina', 'Jacina grafickog efekta', {
        { name = 'procenat', help = '0-100' },
    })
end)

AddEventHandler('onResourceStop', function(resource)
    if resource == GetCurrentResourceName() then
        ClearExtraTimecycleModifier()
    end
end)
