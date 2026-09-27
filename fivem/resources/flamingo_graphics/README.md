# flamingo_graphics

Lepša grafika za **sve igrače** na Flamingo Roleplay serveru. Radi odmah čim igrač uđe, bez komandi.
Igrač sve menja u **M meni → Podešavanja → Grafika** (resurs `flamingo_mmenu`).

## Šta sve ima

| Opcija | Šta radi |
|---|---|
| **Izgled sveta** (7 preseta) | Isključeno, Prirodno *(podrazumevano)*, Živopisno, Filmski, Toplo, Hladno, Crno-belo |
| **Jačina efekta** | 0–100%, glatko se menja |
| **Noćni izgled** | Poseban izgled noću, sa jačim sjajem svetala grada i glatkim prelazom kad padne mrak |
| **Daljina detalja** | 100–150%, zgrade, drveće i auta se vide oštrije i dalje (troši FPS) |
| **Meke senke** | Prirodnije ivice senki |
| **Jača svetla vozila** | Farovi i stop svetla jače svetle |
| **Brzi profili** | Slabiji PC / Balans / Maksimum, jednim klikom |

Meni prikazuje i **pregled uživo** svakog preseta (dan/noć), procenu uticaja na FPS i savete za GTA podešavanja.

Efekti rade u *extra* timecycle slotu, pa **ne kvare** skripte koje koriste obične timecycle efekte (droge, kamere, enterijeri).

## Instalacija

1. Kopiraj foldere `flamingo_graphics` i `flamingo_mmenu` u `resources/`.
2. U `server.cfg`:
   ```
   ensure flamingo_graphics
   ensure flamingo_mmenu
   ```
3. Restartuj server. Igrači koji su već bili online moraju ponovo da se konektuju, jer se timecycle fajl učitava pri ulasku.

`flamingo_graphics` radi i bez menija. Tada svi igrači imaju `Config.Defaults`.

## Kako radi veza sa menijem

- Meni čuva izbor igrača u svojim podešavanjima (dugme **Sačuvaj podešavanja**, KVP kod igrača).
- Svaka promena se odmah šalje preko lokalnog eventa `flamingo_graphics:setConfig`.
- Kad se `flamingo_graphics` (re)startuje, pošalje `flamingo_graphics:ready`, a meni mu ponovo pošalje sačuvana podešavanja.

## Podešavanje

- `config.lua`: podrazumevane vrednosti, satnica dana i noći, jačina svetala vozila, tip mekih senki.
  Ako menjaš `Config.Defaults`, promeni i `DefaultSettings()` u `flamingo_mmenu/client/client.lua` (`graphics*` ključevi).
- `data/timecycle_mods_flamingo.xml`: same vrednosti efekata (objašnjenje je na vrhu fajla).
- Novi preset: dodaj modifier u XML, u `Config.Presets` i u `GRAPHICS_PRESETS` u `flamingo_mmenu/html/js/script.js` (isti `id`).

Vrednosti su dobra početna tačka, ali ih treba proveriti u igri (dan, noć, kiša) i doterati po ukusu.
Izmene u XML fajlu se vide tek posle ponovnog konektovanja.

## Šta server NE može

Server ne može da promeni igraču podešavanja u GTA (teksture, senke, MSAA), niti da mu instalira ENB, ReShade ili NaturalVision.
Zato meni u delu „Saveti za najlepšu sliku“ igračima preporučuje šta da uključe u ESC → Settings → Graphics.
