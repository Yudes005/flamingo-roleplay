-- Dodaj ovo u  ox_inventory/data/items.lua  (unutar glavne return { ... } tabele)
-- Sliku  kladionica_tiket.png  kopiraj u  ox_inventory/web/images/

['kladionica_tiket'] = {
    label = 'Tiket kladionice',
    weight = 5,
    stack = false,
    close = true,
    consume = 0,
    description = 'Papirni tiket iz kladionice. Klikni "Koristi" da vidiš stanje tiketa.',
    client = {
        export = 'flamingo_kladionica.useTicket',
    },
},
