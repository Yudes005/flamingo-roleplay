# Flamingo resursi – kockice + custom unos

## Instalacija (server.cfg)

Redosled je bitan:

```
ensure esx_notify
ensure flamingo_odbiprihvati
ensure flamingo_input
ensure flamingo_kockice
ensure flamingo_radialmenu
```

## flamingo_input

Custom prozor za unos (iznos, količina, tekst, izbor...) umesto `lib.inputDialog`.

- `/testinput` – test prozora
- `exports['flamingo_input']:Input({...})` – jedno polje, vraća vrednost ili `nil`
- `exports['flamingo_input']:InputDialog(naslov, polja, opcije)` – isti potpis kao `lib.inputDialog`

### Bolnica (prodaja medkita)

U `flamingo_hospital` (klijent, handler za `flamingo_hospital:client:radialMedkit`)
zameni `lib.inputDialog(` sa `exports['flamingo_input']:InputDialog(` – ostatak koda ostaje isti:

```lua
local input = exports['flamingo_input']:InputDialog('Prodaja medkita', {
    { type = 'number', label = 'Količina', default = 1, min = 1, max = 10, required = true },
    { type = 'number', label = 'Cena po komadu', prefix = '$', min = 1, required = true }
}, { description = 'Unesite količinu i cenu za pacijenta', icon = 'fa-solid fa-suitcase-medical' })

if not input then return end -- otkazano
local kolicina, cena = input[1], input[2]
```

U `fxmanifest.lua` bolnice dodaj `'flamingo_input'` u `dependencies`.

## flamingo_kockice

G na drugog igrača → **Osnovne akcije** → **Kockice** (ili `/kockice`).

1. Unese se suma uloga (min/max iz `config.lua`)
2. Najbliži igrač dobija ponudu (Prihvati/Odbij, `flamingo_odbiprihvati`)
3. Bacaju se kockice, rezultat stiže u `esx_notify`, npr.
   `#56866 je dobio 2, #67556 je dobio 2. Nerešeno!`
4. Gubitnik plaća ulog pobedniku; kod nerešenog se novac ne menja

UUID igrača (`#12345`) se čita u `Config.GetUid` (`config.lua`) – prilagodi svom serveru.
