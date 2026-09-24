# flamingo_biznisi: bankomati kao biznis

## Kako radi

1. Nema markera ni posebnog menija. Sve se vidi u **meniju bankomata** (`flamingo_banke`):
   - gore desno piše **VLASNIK** i ime vlasnika tog bankomata (ili „Na prodaju“)
   - u levom meniju je nova kategorija **Biznis**: cena, status i zarada po kartici
2. **Kupovina (TEST):** dugme „Kupi“ je u kategoriji Biznis samo za testiranje (`Config.AllowDirectBuy = true`).
   Kad napraviš aukciju, stavi `false`. Vlasnika onda postavlja aukcija preko exporta `SetOwner`.
   Jedan igrač može imati samo **jedan** biznis (`Config.MaxPerPlayer = 1`).
3. Kad neko podigne novac na tvom bankomatu, provizija njegove kartice ide u **kasu biznisa**:
   Standard 15%, Premium 10%, Gold 5%. Procenti se čitaju iz `flamingo_banke` (`Config.Cards`).
   Uplate su bez provizije i pune bankomat gotovinom (do 2.500.000$).
4. Svaki bankomat ima najviše **2.500.000$** gotovine. Kad se isprazni, ne isplaćuje novac dok se ne dopuni.
5. Na tabletu, u aplikaciji **Moj biznis**, možeš:
   - podići novac iz kase, uložiti novac u kasu i podići svu proviziju odjednom (na račun ili u gotovinu)
   - videti gotovinu u bankomatu i pokrenuti **Dopuni bankomat [Transport]**
   - pratiti grafik zarade za 7 dana, zaradu po kartici i istoriju transakcija
   - promeniti naziv biznisa i uključiti navigaciju do bankomata
   - **prodati biznis državi** za pola cene (`Config.SellToStateRatio = 0.5`), uz isplatu kase
6. **Prodaja igraču:** radial meni (**G**) → **Prodaj biznis** (vidi ga samo vlasnik). Biraš igrača pored sebe i cenu.
   Kupac dobija ponudu i ima 30 sekundi da je prihvati. Novac ide sa njegovog računa na tvoj, a kasa se isplaćuje tebi.
   Kupac ne sme već imati biznis.

## Instalacija

1. Ubaci `flamingo_biznisi` u resources i zameni `flamingo_banke`, `flamingo_tablet` i `flamingo_radialmenu` ovim verzijama.
2. Proveri redosled u `server.cfg`:
   ```
   ensure esx_notify
   ensure flamingo_tablet
   ensure flamingo_banke
   ensure flamingo_biznisi
   ensure flamingo_radialmenu
   ```
3. SQL se ne pokreće ručno. Tabele `flamingo_biznisi` i `flamingo_biznisi_log` se prave same pri prvom startu,
   i tada se ubacuju svi bankomati iz `Config.ATMs`.

## Admin komande (admin / superadmin)

| Komanda | Šta radi |
|---|---|
| `/biznis_dodaj [cena]` | Stani ispred bankomata. Taj bankomat postaje biznis. |
| `/biznis_obrisi [id]` | Uklanja biznis. |
| `/biznis_vlasnik [id] [igrač]` | Postavlja vlasnika, za test ili ručnu dodelu. |
| `/biznis_oduzmi [id]` | Vraća biznis državi. |
| `/biznis_dopuni [id] [iznos]` | Dopunjuje bankomat, za test dok ne postoji transport. |

## Za tvoje skripte

**Aukcija**

```lua
exports['flamingo_biznisi']:SetOwner(bizId, identifier, 'Ime Prezime') -- nil identifier = vraća državi
exports['flamingo_biznisi']:GetBusiness(bizId)
exports['flamingo_biznisi']:GetBusinesses(identifier) -- id-jevi biznisa igrača (nil = svi)
```

Pri promeni vlasnika kasa se prazni, pa stari vlasnik treba da podigne novac pre prodaje.

**Transport (dopuna bankomata)**

U `config.lua` upiši ime svoje skripte u `Config.Refill.resource`. Kad vlasnik klikne „Dopuni bankomat“:

```lua
AddEventHandler('flamingo_biznisi:refillRequested', function(src, bizId, nedostaje)
    -- ovde pokreneš transport
end)

-- kad je transport završen:
local ubaceno = exports['flamingo_biznisi']:RefillAtm(bizId, iznos, 'Ime vozača')
exports['flamingo_biznisi']:GetAtmMissing(bizId) -- koliko fali do punog
```

## Napomene

- Koordinate bankomata u `Config.ATMs` su približne. Skripta sama nađe pravi bankomat u krugu od 3 m i upiše
  njegovu tačnu poziciju u bazu, čim prvi igrač dođe u blizinu. Ako na nekom bankomatu ne piše „Vlasnik“ a trebalo bi,
  stani ispred njega i dodaj ga komandom `/biznis_dodaj`.
- Bankomati koji nisu biznis rade kao i ranije, bez limita gotovine, a provizija ide državi.
