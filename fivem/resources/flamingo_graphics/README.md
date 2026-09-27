# flamingo_graphics

Lepša grafika za **sve igrače** na Flamingo Roleplay serveru. Radi uz ESX, ali ne zavisi od njega.

## Šta radi

- **Custom timecycle** (`data/timecycle_mods_flamingo.xml`): življe boje, bloom na svetlima i blaga vinjeta.
  Server ga šalje svakom igraču automatski, igrač ne mora ništa da instalira.
- **Poseban izgled za dan i noć**, sa glatkim prelazom kad padne mrak (`Config.NightStart` / `Config.NightEnd`).
- **Ultra preset** povećava LOD, pa se detalji (zgrade, drveće) vide dalje. Troši FPS, pa je opcionalan.
- Radi u *extra* timecycle slotu, tako da **ne kvari** skripte koje koriste obične timecycle efekte (droge, kamere, enterijeri).
- Svaki igrač bira svoj preset i jačinu, a izbor se pamti kod njega (KVP).

## Instalacija

1. Kopiraj folder `flamingo_graphics` u `resources/` na serveru.
2. U `server.cfg` dodaj:
   ```
   ensure flamingo_graphics
   ```
3. Restartuj server. Igrači koji su već bili online moraju ponovo da se konektuju, jer se timecycle fajl učitava pri ulasku.

## Komande (za igrače)

| Komanda | Opis |
|---|---|
| `/grafika` | Prikaže trenutni preset i sve opcije |
| `/grafika prirodno` | Blago lepše boje (podrazumevano) |
| `/grafika film` | Filmski izgled |
| `/grafika ultra` | Filmski izgled + dalji LOD (za jače PC-jeve) |
| `/grafika off` | Vanilla GTA izgled |
| `/grafikajacina 0-100` | Jačina efekta |

## Podešavanje

- `config.lua`: podrazumevani preset za nove igrače, jačina, dan/noć satnica, `lodScale`.
- `data/timecycle_mods_flamingo.xml`: same vrednosti efekata.
  - `postfx_desaturation`: iznad 1.0 su jače boje, ispod 1.0 bleđe.
  - `postfx_intensity_bloom`: koliko svetla „sijaju“.
  - `postfx_vignetting_intensity`: tamnije ivice ekrana.
  - Ako dodaješ nove linije, `numMods` mora da odgovara broju linija u tom `<modifier>` bloku.

Vrednosti su dobra početna tačka, ali ih treba proveriti u igri (dan, noć, kiša), pa doterati po ukusu.
Za brzo testiranje koristi `/grafikajacina`. Izmene u XML fajlu se vide tek posle ponovnog konektovanja.

## Šta server NE može

Server ne može da promeni igraču podešavanja u GTA (teksture, senke, MSAA), niti da mu instalira ENB, ReShade ili NaturalVision.
To je sve na strani klijenta. Igrače možeš uputiti da u GTA podešavanjima uključe:

- **Texture Quality**: High ili Very High
- **Shadow Quality**: High, **Soft Shadows**: Softer
- **Post FX**: Ultra (bez ovoga se bloom iz ovog resursa slabije vidi)
- **Extended Distance Scaling**: što više ide bez pada FPS-a
