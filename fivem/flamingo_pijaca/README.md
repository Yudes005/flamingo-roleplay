# flamingo_pijaca

Klasična pijaca za igrače: NPC kod kog se iznajmljuje tezga, tezga na kojoj
vlasnik ubacuje robu preko `ox_inventory`-ja i postavlja cene, i kupovina za
sve ostale igrače koji dođu do tezge.

## Instalacija

1. Ubaci folder `flamingo_pijaca` u `resources`.
2. U `server.cfg`, POSLE `ox_inventory`, `esx_notify`, `esx_keyprompt` i
   `flamingo_npcdialog`, dodaj: `ensure flamingo_pijaca`
3. Po potrebi izmeni `config.lua` (videti ispod).

## Kako radi

- Priđeš NPC-u na `Config.Npc.coords` → izađe keyprompt (`esx_keyprompt`) →
  pritisneš `E` → otvara se dijalog (`flamingo_npcdialog`) koji ti pokazuje
  koje su tezge trenutno slobodne i nudi opciju da ih iznajmiš.
- Iznajmljivanje traje `Config.MaxRentSeconds` (podrazumevano 5h). Kad istekne,
  ili kad se odjaviš sa servera, tezga se automatski oslobađa, a roba koja je
  ostala na njoj ispadne pored tezge (`ox_inventory` drop) da ne propadne.
- Dok iznajmljuješ tezgu, kad joj priđeš dobijaš keyprompt "Upravljaj tezgom":
  otvara panel gde možeš otvoriti magacin tezge (obično `ox_inventory` sučelje,
  ubacuješ/vadiš robu) i postaviti cenu za svaki item koji trenutno stoji tamo.
  Iz istog panela možeš i da otkažeš najam ranije (roba koja stane u tvoj
  inventar ti se vraća, ostatak ispadne pored tezge).
- Kad neki drugi igrač priđe iznajmljenoj tezgi, dobija keyprompt "Pogledaj
  ponudu": otvara panel sa spiskom robe koja ima cenu > 0, bira količinu i
  kupuje. Novac ide direktno prodavcu (mora biti online, što uvek jeste dok mu
  je tezga aktivna), roba se skida sa tezge i ubacuje u kupčev inventar.

## Podešavanje (`config.lua`)

- `Config.Npc` — model, koordinate (uključujući heading kao `w`), animacija.
- `Config.Stalls` — lista tezgi, svaka sa `id`, `label` i `coords`. Dodaješ
  nove tezge prostim dodavanjem novog reda u ovu listu.
- `Config.MaxRentSeconds` — koliko traje najam (podrazumevano 5 sati).
- `Config.StallSlots` / `Config.StallMaxWeight` — kapacitet magacina tezge.
- `Config.Currency` — `'money'` (keš) ili `'bank'` (račun), i za kupovinu i
  za isplatu prodavcu.

## Pretpostavke koje sam napravio (javi ako treba drugačije)

- **Najam je besplatan** — nisi pomenuo cenu za samo iznajmljivanje tezge,
  pa trenutno igrač ništa ne plaća da je zauzme, samo je vremenski ograničena
  na `Config.MaxRentSeconds`. Lako se doda naplata u `rentStall` handleru u
  `server/main.lua` ako želiš.
- **Nema perzistencije u bazi** — sve (ko iznajmljuje šta, cene, itd.) živi u
  memoriji dok server radi; restart resursa/servera briše sva iznajmljivanja
  (roba ostaje u `ox_inventory` magacinima jer to on sam čuva, ali vlasništvo
  i cene se resetuju). Ako želiš da preživljava restart servera, treba dodati
  `oxmysql` tabelu — javi pa dodam.
- Cene se pamte **po nazivu itema** (ne po pojedinačnom slotu/metadata), što
  znači da ako isti item ubaciš sa dve različite metadata vrednosti, i dalje
  ima jednu zajedničku cenu.
- Za "postavi cene" i "kupovinu" napravio sam mali NUI panel u istom vizuelnom
  stilu kao `esx_notify`/`esx_keyprompt`/`flamingo_npcdialog` (tamne kartice,
  Manrope font, plavi akcenat) — pošto to nije nešto što prirodno ide kroz
  NPC dijalog ili keyprompt sam po sebi.
- Taster za interakciju je `E` (control id 38), isti kao kod ostalih tvojih
  resursa.
