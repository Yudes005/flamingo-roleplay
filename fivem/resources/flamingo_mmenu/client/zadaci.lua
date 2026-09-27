-- ============================================================
--  ZADACI - merenje pređenog puta (vožnja / peške / plivanje / bicikl)
--  Meri se na 1s, šalje serveru na 30s. Server ima svoje granice
--  po izveštaju, pa teleport/noclip ne može da "napuni" zadatak.
-- ============================================================

local SEND_EVERY = 30000

-- max metara u JEDNOJ sekundi da bi se računalo (veće = teleport, ignoriše se)
local MAX_STEP = { drive = 90, cycle = 20, walk = 10, swim = 5 }

-- klase vozila koje se NE računaju kao "vožnja": 13 bicikl (ide u cycle),
-- 14 brodovi, 15 helikopteri, 16 avioni, 21 vozovi
local NOT_DRIVE = { [14] = true, [15] = true, [16] = true, [21] = true }

CreateThread(function()
    local acc = { drive = 0.0, walk = 0.0, swim = 0.0, cycle = 0.0 }
    local lastPos = nil
    local lastSend = GetGameTimer()

    while true do
        Wait(1000)

        local ped = PlayerPedId()
        local pos = GetEntityCoords(ped)

        if lastPos and not IsEntityDead(ped) and not IsPlayerSwitchInProgress() then
            local step = #(pos - lastPos)
            local veh = GetVehiclePedIsIn(ped, false)

            if veh ~= 0 then
                if GetPedInVehicleSeat(veh, -1) == ped then
                    local class = GetVehicleClass(veh)
                    if class == 13 then
                        if step <= MAX_STEP.cycle then acc.cycle = acc.cycle + step end
                    elseif not NOT_DRIVE[class] then
                        if step <= MAX_STEP.drive then acc.drive = acc.drive + step end
                    end
                end
            elseif IsPedSwimming(ped) then
                if step <= MAX_STEP.swim then acc.swim = acc.swim + step end
            elseif not IsPedFalling(ped) and not IsPedRagdoll(ped) and not IsPedInParachuteFreeFall(ped)
                and GetPedParachuteState(ped) <= 0 then
                if step <= MAX_STEP.walk then acc.walk = acc.walk + step end
            end
        end

        lastPos = pos

        if GetGameTimer() - lastSend >= SEND_EVERY then
            lastSend = GetGameTimer()

            if acc.drive + acc.walk + acc.swim + acc.cycle >= 1.0 then
                TriggerServerEvent('flamingo_mmenu:taskDistance', {
                    drive = math.floor(acc.drive),
                    walk  = math.floor(acc.walk),
                    swim  = math.floor(acc.swim),
                    cycle = math.floor(acc.cycle),
                })
            end

            acc.drive, acc.walk, acc.swim, acc.cycle = 0.0, 0.0, 0.0, 0.0
        end
    end
end)
