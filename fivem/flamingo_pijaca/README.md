# flamingo_pijaca

Pijaca za igrače (ESX + ox_inventory): NPC kod kog se iznajmljuje tezga,
roba se stavlja na tezgu prevlačenjem u `ox_inventory`, a cena piše direktno
na itemu.

## Instalacija

1. Ubaci folder `flamingo_pijaca` u `resources`.
2. U `server.cfg`, POSLE `es_extended`, `ox_inventory`, `esx_notify`,
   `esx_keyprompt` i `flamingo_npcdialog`, dodaj: `ensure flamingo_pijaca`
3. Po potrebi izmeni `config.lua` (videti ispod).

## Kako radi

### Iznajmljivanje
- Priđeš NPC-u → `E` → dijalog pokazuje slobodne tezge.
- Izabereš tezgu → otvara se mali UI gde **sam upišeš koliko sati** (1–5h).
  UI odmah pokazuje ukupnu cenu (`$1.500` × broj sati).
- Posle potvrde novac se skida i tezga je tvoja do isteka vremena.

### Stavljanje robe na tezgu (vlasnik)
- Priđeš svojoj tezgi → `E` → **odmah se otvara ox_inventory** (tvoj inventar
  levo, tezga desno). Nema više posebnog panela.
- **Prevučeš item na tezgu** → iskoči UI: upišeš cenu po komadu (i po želji
  promeniš količinu) → item prelazi na tezgu.
- Na tezgi item piše sa cenom, npr. **`Hleb - $150`**, a u opisu (tooltip)
  stoji `Cena: $150 po komadu`.
- Isti item sa različitim cenama stoji u posebnim slotovima.
- Da skineš robu sa tezge, samo je prevučeš nazad u svoj inventar
  (cena se automatski skida sa itema).

### Kupovina (ostali igrači)
- Priđeš tuđoj tezgi → `E` → otvara se ox_inventory tezge, vidiš robu sa cenama.
- Prevučeš item u svoj inventar → iskoči UI za potvrdu (količina + ukupna
  cena) → `Kupi`.
- Novac ide prodavcu. Ako prodavac nije online, zarada mu se čuva i isplaćuje
  čim se sledeći put uloguje (ili kad priđe NPC-u).
- Kupac ne može da stavlja stvari na tuđu tezgu niti da je preslaguje.

### Istek / otkazivanje najma
- 10 minuta pre isteka vlasnik dobija upozorenje.
- Kad najam istekne (ili ga otkažeš kod NPC-a — novac se ne vraća), sva roba
  sa tezge se vraća vlasniku u inventar, bez cene.
- Ako vlasnik nije online ili nema mesta, roba ide u njegov lični
  **povrat magacin** — preuzima je kod NPC-a opcijom
  "Želim da preuzmem robu koja mi je ostala". Niko drugi ne može da ga otvori.

### Restart servera
- Najmovi i neisplaćena zarada se čuvaju u `data.json` u folderu resursa, a
  roba na tezgama u `ox_inventory` bazi — sve preživljava restart.

## Podešavanje (`config.lua`)

- `Config.Npc` — model, koordinate, animacija.
- `Config.Stalls` — lista tezgi (`id`, `label`, `coords`); nova tezga = novi red.
- `Config.Rent` — `pricePerHour` (1500), `minHours` (1), `maxHours` (5),
  `account` (`'money'` ili `'bank'`).
- `Config.Sale` — `account` za kupovinu/isplatu, `minPrice`, `maxPrice`.
- `Config.BlacklistedItems` — itemi koji ne mogu na tezgu (podrazumevano
  `money`, `black_money`).
- `Config.StallSlots` / `Config.StallMaxWeight` — kapacitet tezge.
- `Config.ReturnSlots` / `Config.ReturnMaxWeight` — kapacitet povrat magacina.

## Tehničke napomene

- Prevlačenje se hvata preko `ox_inventory` hooka `swapItems`: potez se
  otkaže, otvori se UI, i tek posle potvrde server sam premešta item
  (sa proverom slota, količine, cene, novca, udaljenosti).
- Ranija verzija je tezgu registrovala sa `owner = identifier`, zbog čega je
  ox_inventory pravio poseban stash `tezga:identifier`, pa server nije video
  robu koju je vlasnik ubacio (kupci su videli praznu tezgu). Sada je tezga
  jedan zajednički stash, a pristup kontrolišu hookovi.
