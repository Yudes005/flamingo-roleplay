// ============================================================
//  PRAVILA SERVERA
//  Menjaj slobodno. Svako pravilo dobija broj (npr. 3.2) po redu,
//  da bi staff i igrači mogli da se pozovu na njega u reportu.
//  Kad nešto promeniš, dodaj red u IZMENE (najnovije gore).
// ============================================================

// false = na sajtu piše "Uskoro" (pravila i tabela kazni se ne prikazuju).
// Kad pravila budu gotova, upiši ih ispod i stavi true.
export const PRAVILA_OBJAVLJENA = false;

export const PRAVILA_IZMENA = '15. oktobar 2026.';

export const IZMENE = [
  { datum: '15. oktobar 2026.', tekst: 'Nova pravila za bande, teritorije i pljačke. Dodata tabela kazni.' },
];

export type Pravilo = { naslov: string; tekst: string };
export type Poglavlje = { id: string; naslov: string; uvod?: string; pravila: Pravilo[] };

export const PRAVILA: Poglavlje[] = [
  {
    id: 'opste',
    naslov: 'Opšta pravila',
    uvod: 'Flamingo nije hard-RP server. Hoćemo da se svi zabave, ali da grad ostane grad, a ne arena.',
    pravila: [
      { naslov: 'Poštovanje', tekst: 'Vređanje, rasizam, pretnje i provociranje van roleplaya nisu dozvoljeni, ni u gradu ni na Discordu.' },
      { naslov: 'Odluke staffa', tekst: 'Odluka admina se poštuje u tom trenutku. Ako misliš da je pogrešna, pošalji žalbu na sajtu. Ne raspravljaj se u gradu.' },
      { naslov: 'Bagovi i cheatovi', tekst: 'Korišćenje bagova, modova, makroa i bilo kakvih cheatova je zabranjeno. Bag prijavi na sajtu i dobićeš nagradu.' },
      { naslov: 'Jedan nalog', tekst: 'Svaki igrač ima jedan nalog. Novi nalog da bi se zaobišao ban donosi trajni ban.' },
      { naslov: 'Mikrofon', tekst: 'Mikrofon je obavezan. Muzika i zvukovi preko mikrofona nisu dozvoljeni.' },
      { naslov: 'Ime lika', tekst: 'Ime i prezime lika moraju biti realni. Bez imena poznatih ličnosti, psovki i šala.' },
    ],
  },
  {
    id: 'roleplay',
    naslov: 'Roleplay',
    pravila: [
      { naslov: 'RDM', tekst: 'Ubijanje bez razloga i bez roleplay situacije je zabranjeno. Pre napada mora postojati jasna interakcija.' },
      { naslov: 'VDM', tekst: 'Namerno gaženje ljudi vozilom je zabranjeno.' },
      { naslov: 'Metagaming', tekst: 'Ne koristi u roleplayu informacije sa Discorda, streama ili poziva van grada.' },
      { naslov: 'Powergaming', tekst: 'Ne radi stvari koje tvoj lik realno ne bi mogao i ne teraj druge u situaciju bez šanse da odgovore.' },
      { naslov: 'Fail RP', tekst: 'Igraj lika realno: ne skačeš sa zgrade bez posledica i ne ignorišeš pištolj uperen u tebe.' },
      { naslov: 'NLR', tekst: 'Posle smrti zaboravljaš situaciju u kojoj si poginuo i ne vraćaš se na to mesto 15 minuta.' },
      { naslov: 'Combat logging', tekst: 'Izlazak iz igre usred situacije (pljačka, potera, rat) da bi izbegao posledice je zabranjen.' },
      { naslov: 'OOC u gradu', tekst: 'Van-karakter priču u gradu svedi na minimum. Za pitanja koristi report u meniju (M, pa Pomoć).' },
    ],
  },
  {
    id: 'bande',
    naslov: 'Bande i teritorije',
    uvod: 'U gradu postoji pet bandi: GSF, Ballas, Vagos, Marabunta i Bloods. Nove bande ne mogu da se prave.',
    pravila: [
      { naslov: 'Ulazak u bandu', tekst: 'U bandu se ulazi kroz roleplay i odluku vođe. Prelazak iz bande u bandu ne sme da služi za prenos informacija.' },
      { naslov: 'Rat za teritoriju', tekst: 'Rat se pokreće samo preko tableta i traje 30 minuta. Van rata pucnjava na teritoriji mora imati roleplay razlog.' },
      { naslov: 'Hood', tekst: 'Teritorije i grafiti postoje samo u hoodu u južnom Los Santosu. Van hooda nema ratova za teritoriju.' },
      { naslov: 'Materijali', tekst: 'Za tovar iz palog aviona se bori na licu mesta. Napad na kombi sa tovarom je dozvoljen dok ne stigne u bazu.' },
      { naslov: 'Maska', tekst: 'Ubistvo bez maske donosi poternicu. To je posledica u gradu, ne izgovor za pucanje bez razloga.' },
      { naslov: 'Vođa', tekst: 'Vođa odgovara za članove. Ako banda stalno krši pravila, vođa gubi poziciju.' },
    ],
  },
  {
    id: 'pljacke',
    naslov: 'Pljačke',
    uvod: 'Policija uvek dobija poziv, a svaki učesnik pljačke dobija poternicu.',
    pravila: [
      { naslov: 'Prodavnice', tekst: 'Prodavnice pljačkaju samo bande, i to jednom dnevno po bandi.' },
      { naslov: 'Bankomati', tekst: 'Hakovanje bankomata je dozvoljeno samo kad su najmanje 3 policajca na dužnosti.' },
      { naslov: 'Pacific Standard', tekst: 'Samo bande nivoa 7 i više, jednom nedeljno po bandi, i samo kad je na dužnosti najmanje 8 policajaca.' },
      { naslov: 'Taoci', tekst: 'Talac mora biti igrač koji učestvuje u roleplayu. Dogovoreni taoci (prijatelji) nisu dozvoljeni.' },
      { naslov: 'Pregovori', tekst: 'Pregovori sa policijom moraju biti realni. Ne tražiš helikopter i milion dolara za jednog taoca.' },
      { naslov: 'Pretres igrača', tekst: 'Vezanog igrača banda može da pretrese samo u roleplay situaciji. Uzimaju se samo ilegalne stvari.' },
    ],
  },
  {
    id: 'organizacije',
    naslov: 'Policija i organizacije',
    pravila: [
      { naslov: 'Dužnost', tekst: 'Opremu, vozila i oružje organizacije koristiš samo dok si na dužnosti.' },
      { naslov: 'Korupcija', tekst: 'Korumpirani policajac, vojnik ili lekar je dozvoljen samo uz odobrenje vođe i staffa.' },
      { naslov: 'Vođe', tekst: 'Vođa odgovara za svoje članove. Ako organizacija stalno krši pravila, vođa gubi poziciju.' },
      { naslov: 'Lekari', tekst: 'Lekari i bolničari se ne napadaju dok rade na pozivu, osim ako učestvuju u situaciji.' },
    ],
  },
  {
    id: 'vozila',
    naslov: 'Vozila i saobraćaj',
    pravila: [
      { naslov: 'Realna vožnja', tekst: 'Sportski auto ne vozi off-road, a niko ne preživi pad sa planine bez posledica.' },
      { naslov: 'Krađa vozila', tekst: 'Vozila organizacija (policija, šerif, vojska, bolnica) se ne kradu.' },
      { naslov: 'Potere', tekst: 'Ne izlazi iz igre i ne vraćaj auto u garažu da bi pobegao iz potere.' },
    ],
  },
  {
    id: 'zone',
    naslov: 'Bezbedne zone',
    pravila: [
      { naslov: 'Šta je bezbedna zona', tekst: 'Bolnice, spawn i označene zone su bezbedne. Tu nema napada, pljački ni otmica.' },
      { naslov: 'Bežanje u zonu', tekst: 'Ne bežiš u bezbednu zonu usred situacije da bi izbegao posledice.' },
    ],
  },
  {
    id: 'discord',
    naslov: 'Discord i sajt',
    pravila: [
      { naslov: 'Spam i reklame', tekst: 'Bez spama, reklama i linkova ka drugim serverima.' },
      { naslov: 'Lažno predstavljanje', tekst: 'Ne predstavljaj se kao član staffa ili neko drugi.' },
      { naslov: 'Prijave', tekst: 'Prijave piši sam i iskreno. Kopirani odgovori znače odbijenu prijavu, a lažan report kaznu.' },
      { naslov: 'Privatnost', tekst: 'Ne deli tuđe privatne podatke, slike ni poruke bez dozvole.' },
    ],
  },
];

// ============================================================
//  TABELA KAZNI - staff bira kaznu po ovoj tabeli.
//  Za ponovljen prekršaj ide sledeća kolona.
// ============================================================
export const KAZNE = [
  { prekrsaj: 'RDM / VDM', pravilo: '2.1, 2.2', prvi: 'Zatvor 30 min', drugi: 'Ban 1 dan', treci: 'Ban 7 dana' },
  { prekrsaj: 'Metagaming', pravilo: '2.3', prvi: 'Upozorenje', drugi: 'Zatvor 60 min', treci: 'Ban 3 dana' },
  { prekrsaj: 'Powergaming / Fail RP', pravilo: '2.4, 2.5', prvi: 'Upozorenje', drugi: 'Zatvor 30 min', treci: 'Ban 1 dan' },
  { prekrsaj: 'NLR', pravilo: '2.6', prvi: 'Upozorenje', drugi: 'Zatvor 30 min', treci: 'Ban 1 dan' },
  { prekrsaj: 'Combat logging', pravilo: '2.7', prvi: 'Ban 1 dan', drugi: 'Ban 7 dana', treci: 'Ban 30 dana' },
  { prekrsaj: 'Pljačka van pravila', pravilo: '4', prvi: 'Zatvor 60 min', drugi: 'Ban 3 dana', treci: 'Ban 14 dana' },
  { prekrsaj: 'Vređanje i rasizam', pravilo: '1.1', prvi: 'Mute ili ban 1 dan', drugi: 'Ban 7 dana', treci: 'Trajni ban' },
  { prekrsaj: 'Bagovi i cheatovi', pravilo: '1.3', prvi: 'Trajni ban', drugi: '', treci: '' },
  { prekrsaj: 'Zaobilaženje bana', pravilo: '1.4', prvi: 'Trajni ban', drugi: '', treci: '' },
];
