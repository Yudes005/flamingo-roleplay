-- ============================================================
--  FLAMINGO INPUT - klijent
--
--  Custom prozor za unos (suma, kolicina, cena, tekst...) u stilu
--  Flamingo UI-ja. Pravljen kao zamena za lib.inputDialog iz ox_lib,
--  da svi prozori za unos na serveru izgledaju isto.
--
--  1) Jednostavno - jedno polje, vraca vrednost ili nil (otkazano):
--
--     local iznos = exports['flamingo_input']:Input({
--         title       = 'Suma uloga',
--         description = 'Unesite sumu u dolarima',
--         type        = 'number',          -- 'number' | 'input' | 'textarea'
--         placeholder = 'npr. 5000',
--         default     = 1000,
--         min         = 100,
--         max         = 5000000,
--         prefix      = '$',               -- opciono, prikazuje se ispred polja
--         quick       = { 1000, 10000 },   -- opciono, brzi iznosi (samo number)
--         icon        = 'fa-solid fa-dice',-- opciono
--         confirm     = 'Ok',              -- opciono, tekst dugmeta
--         cancel      = 'Otkaži'           -- opciono, tekst dugmeta
--     })
--
--  2) Isti potpis kao lib.inputDialog - vise polja, vraca tabelu
--     vrednosti ili nil. Postojeci kod se prebacuje samo zamenom
--     `lib.inputDialog(` sa `exports['flamingo_input']:InputDialog(`:
--
--     local input = exports['flamingo_input']:InputDialog('Prodaja medkita', {
--         { type = 'number', label = 'Količina', default = 1, min = 1, max = 10, required = true },
--         { type = 'number', label = 'Cena po komadu', prefix = '$', min = 1, required = true }
--     })
--     if not input then return end
--     local kolicina, cena = input[1], input[2]
--
--  Oba exporta BLOKIRAJU pozivaoca dok igrac ne odgovori, pa se
--  pozivaju iz niti (CreateThread / event handler / komanda).
--  Ako ti treba bez blokiranja: exports['flamingo_input']:Open(opts, function(value) end)
--
--  VAZNO: ovo je samo unos na klijentu - server UVEK mora ponovo da
--  proveri iznos (min/max, novac...), jer klijent moze da se izmeni.
-- ============================================================

local isOpen      = false
local dialogId    = 0
local activeCb    = nil
local activeRows  = nil

local ROW_TYPES = { number = true, input = true, textarea = true, select = true, checkbox = true }

local function normalizeRows(rows)
    local out = {}
    if type(rows) ~= 'table' then return out end

    for i = 1, #rows do
        local row = rows[i]
        if type(row) == 'string' then row = { type = 'input', label = row } end

        if type(row) == 'table' then
            local rowType = ROW_TYPES[row.type] and row.type or 'input'

            out[#out + 1] = {
                type        = rowType,
                label       = row.label,
                description = row.description,
                placeholder = row.placeholder,
                default     = row.default,
                min         = tonumber(row.min),
                max         = tonumber(row.max),
                required    = row.required and true or false,
                options     = row.options,
                prefix      = row.prefix,
                icon        = row.icon,
                quick       = row.quick,
                maxLength   = tonumber(row.maxLength),
                disabled    = row.disabled and true or false,
                checked     = row.checked and true or false
            }
        end
    end

    return out
end

--- Vrednosti iz NUI-a se ponovo "cicste" po tipu polja.
local function coerceValues(values)
    local result = {}
    values = type(values) == 'table' and values or {}

    for i = 1, #activeRows do
        local row = activeRows[i]
        local v   = values[i]

        if row.type == 'number' then
            v = tonumber(v)
            if v and row.min and v < row.min then v = row.min end
            if v and row.max and v > row.max then v = row.max end
        elseif row.type == 'checkbox' then
            v = v == true
        elseif v ~= nil then
            v = tostring(v)
            if v == '' then v = nil end
        end

        result[i] = v
    end

    return result
end

local function finish(result)
    if not isOpen then return end

    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'close' })

    local cb = activeCb
    activeCb, activeRows = nil, nil

    if cb then cb(result) end
end

--- Otvara prozor. `cb(values)` dobija tabelu vrednosti ili nil (otkazano).
local function openDialog(heading, rows, options, cb)
    -- Novi prozor uvek ima prioritet - prethodni se tretira kao otkazan.
    if isOpen then finish(nil) end

    options = type(options) == 'table' and options or {}

    dialogId   = dialogId + 1
    isOpen     = true
    activeCb   = cb
    activeRows = normalizeRows(rows)

    SendNUIMessage({
        action       = 'open',
        id           = dialogId,
        title        = heading or 'Unos',
        description  = options.description,
        icon         = options.icon,
        confirmLabel = options.confirm or 'Ok',
        cancelLabel  = options.cancel or 'Otkaži',
        rows         = activeRows
    })

    SetNuiFocus(true, true)
end

local function awaitDialog(heading, rows, options)
    local p = promise.new()

    openDialog(heading, rows, options, function(values)
        p:resolve(values or false)
    end)

    local result = Citizen.Await(p)
    return result or nil
end

--- lib.inputDialog kompatibilan potpis.
local function InputDialog(heading, rows, options)
    return awaitDialog(heading, rows, options)
end

--- Jedno polje -> jedna vrednost.
local function singleRow(opts)
    return {
        type        = opts.type or 'number',
        label       = opts.label,
        description = opts.fieldDescription,
        placeholder = opts.placeholder,
        default     = opts.default,
        min         = opts.min,
        max         = opts.max,
        required    = opts.required ~= false,
        prefix      = opts.prefix,
        quick       = opts.quick,
        maxLength   = opts.maxLength,
        options     = opts.options
    }
end

local function Input(opts)
    opts = type(opts) == 'table' and opts or {}

    local values = awaitDialog(opts.title, { singleRow(opts) }, opts)
    if not values then return nil end

    return values[1]
end

--- Bez blokiranja - rezultat stize u callback (vrednost ili nil).
local function Open(opts, cb)
    opts = type(opts) == 'table' and opts or {}

    openDialog(opts.title, { singleRow(opts) }, opts, function(values)
        if cb then cb(values and values[1] or nil) end
    end)
end

exports('Input', Input)
exports('InputDialog', InputDialog)
exports('Open', Open)
exports('Close', function() finish(nil) end)
exports('IsOpen', function() return isOpen end)

-- ============================================================
--  NUI CALLBACKS
-- ============================================================

RegisterNUICallback('submit', function(data, cb)
    cb('ok')

    if not isOpen or tonumber(data.id) ~= dialogId then return end
    finish(coerceValues(data.values))
end)

RegisterNUICallback('cancel', function(data, cb)
    cb('ok')

    if not isOpen or tonumber(data.id) ~= dialogId then return end
    finish(nil)
end)

-- ============================================================
--  SIGURNOSNE KOCNICE - igrac ne sme ostati zakljucan sa
--  otvorenim prozorom ako pogine ili udje u pause meni.
-- ============================================================

CreateThread(function()
    while true do
        Wait(500)

        if isOpen and (IsEntityDead(PlayerPedId()) or IsPauseMenuActive()) then
            finish(nil)
        end
    end
end)

AddEventHandler('onResourceStop', function(resource)
    if resource ~= GetCurrentResourceName() then return end
    SetNuiFocus(false, false)
end)

-- Test: /testinput
RegisterCommand('testinput', function()
    local value = Input({
        title       = 'Suma uloga',
        description = 'Unesite sumu u dolarima',
        placeholder = 'npr. 5000',
        min         = 100,
        max         = 5000000,
        prefix      = '$',
        quick       = { 1000, 10000, 100000, 1000000 },
        icon        = 'fa-solid fa-dice'
    })

    print(('[flamingo_input] rezultat: %s'):format(tostring(value)))
end, false)
