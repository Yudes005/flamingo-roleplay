-- ============================================================
--  MOJI PAKETI + KUTIJE (klijentski most ka NUI-u)
--  NUI šalje zahteve, server vraća podatke, mi ih prosleđujemo u UI.
-- ============================================================

RegisterNUICallback('paketiRequest', function(_, cb)
    TriggerServerEvent('flamingo_mmenu:paketi:request')
    cb('ok')
end)

RegisterNUICallback('paketiBuy', function(data, cb)
    TriggerServerEvent('flamingo_mmenu:paketi:buy', data.crateId, data.amount)
    cb('ok')
end)

RegisterNUICallback('paketiOpen', function(data, cb)
    TriggerServerEvent('flamingo_mmenu:paketi:open', data.crateId, data.count)
    cb('ok')
end)

RegisterNUICallback('paketiActivate', function(data, cb)
    TriggerServerEvent('flamingo_mmenu:paketi:activate', data.id)
    cb('ok')
end)

RegisterNUICallback('paketiSell', function(data, cb)
    TriggerServerEvent('flamingo_mmenu:paketi:sell', data.id, data.qty)
    cb('ok')
end)

RegisterNetEvent('flamingo_mmenu:paketi:data', function(data)
    SendNUIMessage({ action = 'paketiData', data = data })
end)

RegisterNetEvent('flamingo_mmenu:paketi:result', function(result)
    SendNUIMessage({ action = 'paketiResult', result = result })
end)

-- "Dropovi" traka: server javlja svima šta je neko upravo dobio
RegisterNetEvent('flamingo_mmenu:paketi:drop', function(drop)
    SendNUIMessage({ action = 'paketiDrop', drop = drop })
end)
