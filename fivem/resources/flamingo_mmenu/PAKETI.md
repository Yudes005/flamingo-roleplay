# Kutije i "Moji paketi" (flamingo_mmenu)

## Šta je novo
- **Prodavnica** ima podkategorije u levoj traci (Auta, Odeća, Kutije, Novac, Ostalo),
  isto kao Statistika. Unutar strane više nema bočnog menija.
- **Kutije (grid)**: kartice sa slikom, "Ostalo: X dana", "Imaš: N" i cenom.
- **Detalj kutije**: traka "Dropovi" (šta su igrači upravo dobili, uživo), opis,
  velika slika, "Kupi kutije" (polje + klizač + dugme), otvaranje 1-5,
  "Brzo otvaranje" (preskače vrćenje, pamti se) i "Sadržaj kutije" sa šansom na (i).
- **Rulet je direktno u stranici kutije** (nema prozora preko): traka sa karticama,
  zlatna linija po sredini, dobitak ostaje osvetljen, dugme "Stavi u Moji paketi".
  Za 2-5 kutija vrti se po jedna traka za svaku. "Otvori" iz Moji paketi te prebaci
  na stranicu te kutije i tamo se vrti.
- **Server**: zaštita od duplog klika/spama, rok kutije preko datuma (`ends`),
  slike nagrada (ox_inventory slike za predmete automatski), stvaran iznos novca u paketu.

## Instalacija
1. Zameni ceo folder. `config.lua` je sada u zipu - bez njega ne rade dnevne
   nagrade, pozivni kod, nagrade za vreme, zadaci ni veštine.
2. SQL se nije menjao.
3. `restart flamingo_mmenu`

## Slike
- Kutije: PNG/JPG/WEBP u `html/img/kutije/`, pa u kutiji `image = 'ime.png'`.
  Bez slike se crta kofer u boji retkosti.
- Predmeti: automatski iz `ox_inventory/web/images/<ref>.png`.
- Vozila: stavi sliku u `html/img/kutije/` i u nagradi `image = 'comet6.png'`.

## Podešavanje (`config_kutije.lua`)
- `Config.Kutije` - kutije, cene, slike, rok (`ends`) i nagrade sa šansama
- `Config.Retkosti` - nazivi i boje retkosti
- `Config.KutijeMaxKupovina` - max kutija po kupovini (klizač)
- `Config.KutijeDropovi` / `Config.KutijeDropoviBroj` - traka "Dropovi"
- `Config.PaketProdajaProcenat` - koliko Coina vraća prodaja paketa
- `Config.KutijeNovacRacun` - 'money' ili 'bank'

Roze boja kutija je u `html/css/paketi.css` (`--pk-accent`). Ako hoćeš da prati
temu iz Podešavanja, stavi `--pk-accent: var(--fl-pink);`.

## Zvukovi (`html/js/zvuk.js`)
Svi zvuci se prave u kodu (Web Audio), nema mp3 fajlova.
- Otvaranje/zatvaranje menija, klik na dugmad, klizač
- Kutije: zamah na početku, "tik" za svaku karticu ispod linije, zvuk dobitka
  po retkosti (obično → ekskluzivno sve jači; legendarno/ekskluzivno imaju udar + iskre)
- Kupovina (novčići), prodaja paketa, aktiviranje, greška
- Pokupljene nagrade (dnevne, za vreme, pozivni kod, zadaci), kupovina novca
- Tuđi legendarni/ekskluzivni drop u traci "Dropovi"

Igrač gasi zvuk i menja jačinu u Podešavanja → Zvuk (pa "Sačuvaj podešavanja").
Za svoju retkost možeš da zadaš jačinu zvuka: `zvuk = 0..4` u `Config.Retkosti`.
