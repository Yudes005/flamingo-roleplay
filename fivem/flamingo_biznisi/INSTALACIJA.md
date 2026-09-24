# flamingo_biznisi: bankomati, supermarketi, perionice i pumpe kao biznis

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

## Supermarketi (flamingo_supermarket)

1. Svaki market iz `Config.Shops` je **poseban biznis**. Prepoznaje se po poziciji prodavca, pa isti `id` u configu nije problem.
2. U meniju marketa (E kod prodavca) gore desno piše **VLASNIK**, a dugme **Biznis** prikazuje cenu i kupovinu (TEST).
3. **Zalihe:** svaki artikal iz configa kreće sa **100 kom.** (`Config.Market.startStock`, max `Config.Market.maxStock`).
   Kad igrač kupi, zaliha opada. Kad je 0, artikal se ne može kupiti. Svaki novi artikal dodat u config automatski dobija 100 kom.
4. **Zarada:** cela cena prodaje ide u kasu vlasnika.
5. **Tablet → Moj biznis → Naruči robu:** vlasnik naručuje robu za **pola cene** (`Config.Market.orderRatio = 0.5`),
   plaća se iz kase. Može da upiše broj komada ili klikne „Do punog“.
6. **Transport robe (tvoja skripta):** dok je `Config.Supply.resource = nil`, roba stiže odmah. Kad upišeš ime svoje skripte:
   ```lua
   AddEventHandler('flamingo_biznisi:orderCreated', function(src, orderId, bizId, item, amount) end)
   exports['flamingo_biznisi']:DeliverOrder(orderId, 'Ime vozača')   -- kad je roba dovezena
   exports['flamingo_biznisi']:GetPendingOrders(bizId)              -- narudžbine koje čekaju (nil = sve)
   ```
7. Market **bez vlasnika** (država) radi kao i ranije, bez ograničenja zaliha.
8. Cena marketa: `bizPrice = 900000` u marketu u `flamingo_supermarket/config.lua`, inače `Config.Market.defaultPrice`.

## Perionice (flamingo_perionica)

1. Svaka lokacija iz `flamingo_perionica/config.lua` je **poseban biznis** (prepoznaje se po `coords`).
2. **Zarada:** vlasnik dobija **35% od cene svakog pranja** u kasu (`Config.Carwash.share = 35`). Detailing 1.400$ → 490$.
3. Perionica **nema robu ni narudžbine**, samo zaradu od pranja.
4. U meniju perionice (E) gore piše **VLASNIK**, a dugme **Biznis** prikazuje cenu, zaradu po paketu i test kupovinu.
5. Na tabletu: kasa, zarada danas/7 dana, zarada po paketu, grafik, istorija pranja i prodaja.
6. Cena: `bizPrice = 600000` u lokaciji, inače `Config.Carwash.defaultPrice` (500.000$).

## Benzinske pumpe (flamingo_pumpa)

1. Svaka stanica iz `flamingo_pumpa/data/stations.lua` je **poseban biznis** sa rezervoarom od **5.000 L**
   (`Config.Fuel.maxLiters`, na početku `Config.Fuel.startLiters`).
2. **Zarada:** kad igrač sipa, litri izlaze iz rezervoara stanice, a **cela cena** (20$/L) ide u kasu vlasnika.
3. **Prazan rezervoar:** pumpa ne toči gorivo dok vlasnik ne naruči novo. Igrač ne može sipati više nego što stanica ima.
4. **Tablet → Naruči gorivo:** vlasnik plaća iz kase **10$/L** (`Config.Fuel.orderRatio = 0.5`). Upiše litre ili klikne „Do punog“.
5. **Transport goriva:** ide kroz isti sistem kao roba za market (`Config.Supply.resource`, event `flamingo_biznisi:orderCreated`
   sa `item = 'fuel'`, pa `DeliverOrder(orderId)`). Dok je `resource = nil`, gorivo stiže odmah.
6. U meniju pumpe gore piše **VLASNIK**, na displeju piše **„Na pumpi X L“**, a dugme **Biznis** prikazuje cenu, rezervoar i računicu.
7. Kanister i repair kit se plaćaju kao i ranije i ne idu vlasniku.
8. Pumpa **bez vlasnika** (država) radi kao i ranije, bez ograničenja goriva.
9. Cena pumpe: `Config.Fuel.defaultPrice` (800.000$).

## Instalacija

1. Ubaci `flamingo_biznisi` u resources i zameni `flamingo_banke`, `flamingo_tablet` i `flamingo_radialmenu` ovim verzijama.
2. Proveri redosled u `server.cfg`:
   ```
   ensure esx_notify
   ensure flamingo_tablet
   ensure flamingo_banke
   ensure flamingo_biznisi
   ensure flamingo_supermarket
   ensure flamingo_perionica
   ensure flamingo_pumpa
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
