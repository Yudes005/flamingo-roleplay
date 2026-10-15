// ============================================================
//  PRAVILA SERVERA
//  Menjaj slobodno. Svako pravilo ima broj (npr. 3.2) da bi staff
//  mogao da se pozove na njega u reportu.
// ============================================================

export const PRAVILA_IZMENA = '15. oktobar 2026.';

export type Pravilo = { naslov: string; tekst: string };
export type Poglavlje = { id: string; naslov: string; uvod?: string; pravila: Pravilo[] };

export const PRAVILA: Poglavlje[] = [
  {
    id: 'opste',
    naslov: 'Opšta pravila',
    uvod: 'Flamingo nije hard-RP server. Hoćemo da se svi zabave, ali da grad ostane grad, a ne arena.',
    pravila: [
      { naslov: 'Poštovanje', tekst: 'Vređanje, rasizam, pretnje i provociranje van roleplaya nisu dozvoljeni - ni u gradu, ni na Discordu.' },
      { naslov: 'Odluke staffa', tekst: 'Odluka admina se poštuje u tom trenutku. Ako misliš da je pogrešna, pošalji žalbu na sajtu - ne raspravljaj se u gradu.' },
      { naslov: 'Bagovi i cheatovi', tekst: 'Korišćenje bagova, modova, makroa i bilo kakvih cheatova je zabranjeno. Ako nađeš bag, prijavi ga i dobićeš nagradu.' },
      { naslov: 'Jedan nalog', tekst: 'Svaki igrač ima jedan nalog. Pravljenje novog naloga da bi se zaobišao ban donosi trajni ban.' },
      { naslov: 'Mikrofon', tekst: 'Mikrofon je obavezan. Muzika i zvukovi preko mikrofona nisu dozvoljeni.' },
    ],
  },
  {
    id: 'roleplay',
    naslov: 'Roleplay',
    pravila: [
      { naslov: 'RDM', tekst: 'Ubijanje bez razloga i bez roleplay situacije je zabranjeno. Pre napada mora postojati jasna interakcija.' },
      { naslov: 'VDM', tekst: 'Namerno gaženje ljudi vozilom je zabranjeno.' },
      { naslov: 'Metagaming', tekst: 'Ne koristi informacije iz Discorda, streama ili poziva van grada u roleplayu.' },
      { naslov: 'Powergaming', tekst: 'Ne radi stvari koje tvoj lik realno ne bi mogao, i ne teraj druge u situaciju bez šanse da odgovore.' },
      { naslov: 'Fail RP', tekst: 'Igraj lika realno: ne skačeš sa zgrade bez posledica, ne ignorišeš pištolj uperen u tebe.' },
      { naslov: 'NLR', tekst: 'Posle smrti zaboravljaš situaciju u kojoj si poginuo i ne vraćaš se na to mesto 15 minuta.' },
      { naslov: 'Combat logging', tekst: 'Izlazak iz igre usred situacije (pljačka, potera, kidnapovanje) da bi izbegao posledice je zabranjen.' },
      { naslov: 'OOC u gradu', tekst: 'Van-karakter priča u gradu svedi na minimum. Za pitanja koristi /report.' },
    ],
  },
  {
    id: 'kriminal',
    naslov: 'Kriminal i pljačke',
    uvod: 'Kriminal je deo grada, ali uz pravila koja daju šansu i drugoj strani.',
    pravila: [
      { naslov: 'Čekaj policiju', tekst: 'Posle početka pljačke ne smeš da pobegneš sa plenom dok policija ne stigne. Ako policija ne dođe za 5 minuta, slobodan si.' },
      { naslov: 'Prodavnice', tekst: 'Pljačke prodavnica su dozvoljene samo bandama nivoa 3 i više.' },
      { naslov: 'Taoci', tekst: 'Talac mora biti pravi igrač koji učestvuje u roleplayu. Dogovoreni taoci (prijatelji) nisu dozvoljeni.' },
      { naslov: 'Pregovori', tekst: 'Pregovori sa policijom moraju biti realni. Ne tražiš helikopter i milion dolara za jednog taoca.' },
      { naslov: 'Pucnjava', tekst: 'Otvaranje vatre na policiju bez prethodne situacije i upozorenja je RDM.' },
    ],
  },
  {
    id: 'organizacije',
    naslov: 'Policija i organizacije',
    pravila: [
      { naslov: 'Dužnost', tekst: 'Opremu, vozila i oružje organizacije koristiš samo dok si na dužnosti.' },
      { naslov: 'Korupcija', tekst: 'Korumpirani policajac ili lekar je dozvoljen samo uz odobrenje lidera i staffa.' },
      { naslov: 'Lideri', tekst: 'Lider odgovara za svoje članove. Ako organizacija stalno krši pravila, lider gubi poziciju.' },
      { naslov: 'Bande i familije', tekst: 'Ratovi između bandi moraju imati roleplay razlog i biti prijavljeni staffu.' },
    ],
  },
  {
    id: 'vozila',
    naslov: 'Vozila i saobraćaj',
    pravila: [
      { naslov: 'Realna vožnja', tekst: 'Sportski auto ne vozi off-road, a niko ne preživi pad sa planine bez posledica.' },
      { naslov: 'Krađa vozila', tekst: 'Vozila organizacija (policija, bolnica) se ne kradu.' },
      { naslov: 'Potere', tekst: 'Ne izlazi iz igre i ne parkiraj auto u garažu da bi pobegao iz potere.' },
    ],
  },
  {
    id: 'zone',
    naslov: 'Bezbedne zone',
    pravila: [
      { naslov: 'Šta je bezbedna zona', tekst: 'Bolnica, spawn i označene zone su bezbedne. Tu nema napada, pljački ni kidnapovanja.' },
      { naslov: 'Bežanje u zonu', tekst: 'Ne bežiš u bezbednu zonu usred situacije da bi izbegao posledice.' },
    ],
  },
  {
    id: 'discord',
    naslov: 'Discord i sajt',
    pravila: [
      { naslov: 'Spam i reklame', tekst: 'Bez spama, reklama i linkova ka drugim serverima.' },
      { naslov: 'Lažno predstavljanje', tekst: 'Ne predstavljaj se kao član staffa ili neko drugi.' },
      { naslov: 'Prijave', tekst: 'Prijave piši sam i iskreno. Kopirani odgovori znače odbijenu prijavu.' },
      { naslov: 'Privatnost', tekst: 'Ne deli tuđe privatne podatke, slike ni poruke bez dozvole.' },
    ],
  },
  {
    id: 'kazne',
    naslov: 'Kazne',
    uvod: 'Staff bira kaznu prema težini prekršaja i ranijim kaznama.',
    pravila: [
      { naslov: 'Vrste kazni', tekst: 'Upozorenje, admin zatvor, kick, privremeni ban i trajni ban.' },
      { naslov: 'Žalba', tekst: 'Na svaku kaznu možeš da se žališ jednom, preko stranice Prijave -> Žalba na kaznu.' },
      { naslov: 'Pravila se menjaju', tekst: 'Pravila mogu da se menjaju. Datum poslednje izmene je na vrhu ove strane.' },
    ],
  },
];
