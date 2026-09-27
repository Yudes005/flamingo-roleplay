# flamingo_kladionica

Sportska kladionica za ESX Legacy sa **pravim utakmicama i pravim kvotama** (fudbal i košarka).
Kvote, raspored i rezultati dolaze sa [The Odds API](https://the-odds-api.com). Tiketi se obračunavaju automatski,
a igrač dobija **papirni tiket kao item** u ox_inventory.

**Zavisnosti:** `es_extended` (Legacy), `oxmysql`, `ox_lib`, `ox_inventory`. `ox_target` nije obavezan (ako ga imaš, koristi se automatski).

---

## Instalacija

1. Kopiraj folder `flamingo_kladionica` u `resources`.
2. U `server.cfg` (ispod `es_extended`, `oxmysql`, `ox_lib` i `ox_inventory`):
   ```cfg
   set kladionica_api_key "OVDJE_TVOJ_API_KLJUC"
   ensure flamingo_kladionica
   ```
3. **Item:** otvori `install/ox_inventory_item.lua` i sadržaj kopiraj u `ox_inventory/data/items.lua`.
4. **Slika itema:** `install/kladionica_tiket.png` kopiraj u `ox_inventory/web/images/`.
5. **Baza:** tabele se prave same pri prvom startu. Ako želiš ručno, koristi `install/kladionica.sql`.
6. **Lokacija:** u `config.lua` promijeni `Config.Locations` na mjesto gdje želiš NPC-a.
   Upiši koordinate na kojima NPC stoji (x, y, z, heading).
7. Restartuj server i u konzoli upiši `kladionica_status`.

---

## API ključ (The Odds API): šta je i kako ga dobiti

Skripta ne izmišlja kvote. Svakih nekoliko sati pita The Odds API koje se utakmice igraju i koje su kvote,
na isti način kao aplikacije koje uspoređuju kvote. Kvote su prave i dolaze sa evropskih kladionica
(Pinnacle, Unibet, William Hill, Betfair…).

**Kako dobiti ključ:**
1. Idi na <https://the-odds-api.com> i klikni **Get API Key**.
2. Izaberi paket (**Starter** je besplatan) i upiši email.
3. Ključ stiže na email. To je dugačak niz slova i brojeva.
4. Stavi ga u `server.cfg` kao `set kladionica_api_key "..."`.
   Ključ **nikome ne šalji** i ne stavljaj ga u `config.lua` (taj fajl vide i igrači).

### Krediti: najvažnije za razumjeti

Svaki upit API-ju troši kredite:

| Upit | Cijena |
|---|---|
| Lista liga (koje su u sezoni) | besplatno |
| Kvote za 1 fudbalsku ligu (1X2 + golovi) | 2 kredita |
| Kvote za 1 košarkašku ligu (pobjednik + poeni + hendikep) | 3 kredita |
| Rezultati za 1 ligu (za isplatu tiketa) | 2 kredita |

Dupla šansa (1X, 12, X2) se računa iz 1X2 kvota i **ne troši kredite**.

U `sv_config.lua` upiši koliko kredita imaš (`SvConfig.MonthlyCredits`). Skripta sama izračuna koliko često smije
osvježavati kvote da ti krediti potraju do kraja mjeseca, i to ispiše u konzoli pri startu:

```
[kladionica] Aktivnih liga: 18 | cijena jednog kruga: 38 kredita | kvote se osvježavaju svakih 78.2 sati
```

- **Besplatni paket (500 kredita):** dobar za testiranje ili za **3–5 liga**. Sa svim ligama iz liste kvote bi se
  osvježavale tek svakih nekoliko dana. Zakomentariši (`--`) lige koje ne trebaš u `SvConfig.Leagues`.
- **Plaćeni paket (npr. 20.000 kredita, oko 30 $ mjesečno, tačnu cijenu provjeri na sajtu):** sve lige iz liste,
  sa kvotama koje se osvježavaju svakih ~2–3 sata. Za **baš sve** lige koje API ima stavi `SvConfig.LeagueMode = 'all'`.

Kad ostane malo kredita (`SvConfig.StopOddsBelowCredits`), skripta prestaje povlačiti kvote, a **rezultati i isplate
rade dalje**, tako da niko ne ostane bez para za dobitni tiket.

---

## Kako radi u igri

1. Igrač dođe do NPC-a (blip **Kladionica**) i pritisne **[E]** (ili koristi ox_target).
2. Ponuda: lijevo sport i lige, gore dani (Danas, Sutra, …) i pretraga, desno tiket.
3. Klikne na kvote, upiše uplatu i klikne **Uplati tiket**. Pare se skidaju iz keša,
   a u inventar dobija item **Tiket kladionice** (kod, kvota, uplata i mogući dobitak piše na itemu).
4. Kad utakmice završe, server sam povuče rezultate i obračuna tiket. Ako je vlasnik online, dobije obavijest.
5. **Isplata:** kod NPC-a, tab **Moji tiketi**, dugme **Isplati**. Tiket nestaje iz inventara, a pare idu u keš.
6. Klik na **Koristi** na tiketu u inventaru prikazuje stanje tiketa bilo gdje na mapi.

**Tiket je "na donosioca", kao u stvarnoj kladionici.** Ko ima papir u inventaru, taj ga može isplatiti.
Tiket se može pokloniti, prodati ili ukrasti, što je dobro za RP.

### Opklade

| Fudbal | Košarka |
|---|---|
| Konačan ishod 1 X 2 (90 min + nadoknada) | Pobjednik 1 2 (uključeni produžeci) |
| Dupla šansa 1X, 12, X2 | Hendikep H1 / H2 |
| Ukupno golova: Manje/Više (npr. 2.5) | Ukupno poena: Manje/Više (npr. 165.5) |

Kombinovani tiketi (više parova na jednom tiketu), jedan par po utakmici.

### Pravila obračuna
- Jedan promašen par znači da je cijeli tiket gubitan.
- Otkazana ili odgođena utakmica (rezultat ne stigne za `SvConfig.VoidAfterHours` sati) znači da je par storniran
  i računa se kvota 1.00. Ako su svi parovi stornirani, uplata se vraća.
- Ako je rezultat tačno na liniji (npr. hendikep -5 i razlika 5), par je storniran, kao u pravim kladionicama.
- Kvota se zaključava u trenutku uplate. Ako se kvota promijenila dok je igrač gledao ponudu,
  tiket se ne uplaćuje, a igrač vidi nove kvote.

---

## Podešavanja

- **`config.lua`** (vide ga i igrači): lokacije i NPC, blip, ox_target ili [E], ime itema, valuta.
- **`sv_config.lua`** (samo server): API, krediti, lige, limiti (min/max uplata, max dobitak, max parova), keš ili banka.
  - `SvConfig.OddsFactor = 1.0` znači kvote iste kao u stvarnosti. Ako želiš da server "zarađuje", stavi npr. `0.95`.
  - `SvConfig.Account = 'money'` je keš. Za banku stavi `'bank'`.

## Admin komande
- `kladionica_status`: broj liga, osvježavanje, preostali krediti, zadnja greška.
- `kladionica_sync`: odmah povuci ponudu i rezultate (troši kredite!).

Obje rade iz konzole i za `group.admin` (`SvConfig.AdminGroup`).

## Problemi
| Poruka u konzoli | Rješenje |
|---|---|
| `API ključ NIJE postavljen` | Dodaj `set kladionica_api_key "..."` u server.cfg **iznad** `ensure flamingo_kladionica`. |
| `HTTP 401` | Pogrešan ključ ili su potrošeni krediti za ovaj mjesec. |
| `Van sezone (ili pogrešan ključ), preskačem: ...` | Normalno: ta liga trenutno ne igra (npr. Svjetsko prvenstvo). Kad krene sezona, pojavi se sama. |
| U kladionici nema utakmica | Provjeri `kladionica_status`. Prvo povlačenje kreće odmah nakon starta resursa. |

> ⚠️ Kladionica je samo za **in-game novac**. FiveM/Rockstar pravila zabranjuju klađenje pravim novcem
> i prodaju in-game novca za pravi.
