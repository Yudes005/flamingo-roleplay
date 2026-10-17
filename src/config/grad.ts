// ============================================================
//  SADRŽAJ GRADA (naslovna, Vodič, Česta pitanja)
//  Ovde menjaš tekstove o gradu. Slike idu u public/img/...
//  Ako slika ne postoji (slika: undefined), sajt pokaže boju i ikonu.
// ============================================================

// ---------- Tvoja priča (4 scene na naslovnoj, redom) ----------
export const PRICA = [
  { slika: '/img/hero.webp', pozicija: '38% 30%', naslov: 'Dolaziš u grad', tekst: 'Napraviš lika, uđeš u Flamingo City i kreneš od nule. Sve ostalo zavisi od tebe.' },
  { slika: '/img/poslovi/rudar.webp', pozicija: '70% 50%', naslov: 'Nađeš posao', tekst: 'Osam poslova, svaki sa svojim stablom veština. Što više radiš, više zarađuješ.' },
  { slika: '/img/zivot.webp', pozicija: '30% 50%', naslov: 'Kupiš svoje', tekst: 'Kuće i biznisi se dobijaju na aukciji. Garaža, radionica, vila iznad grada.' },
  { slika: '/img/hero.webp', pozicija: '88% 40%', naslov: 'Biraš stranu', tekst: 'Uniforma u policiji, bolnici i vojsci, ili boje jedne od pet bandi.' },
];

// ---------- Poslovi (traka na naslovnoj) ----------
export const POSLOVI = [
  { slika: 'rudar', naziv: 'Rudar', opis: 'Kramp, kamen i mini-igra za svaki grumen. Rudu voziš kolicima do otkupa.' },
  { slika: 'drvoseca', naziv: 'Drvoseča', opis: 'Šuma kod Paleta za početak, napredna šuma na istočnoj obali kad porasteš.' },
  { slika: 'ribar', naziv: 'Ribar', opis: 'Reka kod Cassidy Creeka. Sa veštinom Majstor mora izlaziš na otvoreno more.' },
  { slika: 'farmer', naziv: 'Farmer', opis: 'Svoja parcela u Grapeseedu: traktor, njiva, krave, kokoške i voćnjak.' },
  { slika: 'elektricar', naziv: 'Električar', opis: 'Tražiš kvarove po kvartovima. Kad grad ostane u mraku, ti ga pališ.' },
  { slika: 'smetlar', naziv: 'Smećar', opis: 'Radiš sam ili u ekipi do četiri čoveka. Kamion, ruta, reciklaža.' },
  { slika: 'taksista', naziv: 'Taksista', opis: 'Voziš ljude po celom gradu. VIP vožnje nose najviše.' },
  { slika: 'autobus', naziv: 'Vozač autobusa', opis: 'Gradske i međugradske linije po redu vožnje. Mirna smena i siguran novac.' },
];

// ---------- Organizacije (država) ----------
export type Organizacija = { naziv: string; opis: string; ikona: 'policija' | 'serif' | 'fib' | 'vojska' | 'bolnica' | 'vlada' | 'oglasi' };
export const ORGANIZACIJE: Organizacija[] = [
  { naziv: 'Policija', ikona: 'policija', opis: 'Deset činova od kadeta do načelnika. MDT, potere, poternice, dosijei i zaplena vozila.' },
  { naziv: 'Šerif', ikona: 'serif', opis: 'Jedna stanica, u Paleto Bayu. Šerif izdaje i osiguranje vozila.' },
  { naziv: 'FIB', ikona: 'fib', opis: 'Federalni istražitelji za slučajeve koji su preveliki za policiju.' },
  { naziv: 'Vojska', ikona: 'vojska', opis: 'Fort Zancudo. Vojska snabdeva ostale organizacije oružjem kad im ponestane.' },
  { naziv: 'Bolnica', ikona: 'bolnica', opis: 'Dve bolnice, u gradu i u Sandyju. Reanimacija, lečenje i dostava medkita.' },
  { naziv: 'Vlada', ikona: 'vlada', opis: 'Državna kasa, aukcije i osiguranje kuća od provale.' },
  { naziv: 'Lifeinvader', ikona: 'oglasi', opis: 'Oglasi celog grada prolaze kroz njihov tablet pre nego što izađu.' },
];

// ---------- Bande (boje su boje bandi u gradu) ----------
export const BANDE = [
  { naziv: 'GSF', puno: 'Grove Street Families', boja: '#3aa856' },
  { naziv: 'Ballas', puno: 'Ballas', boja: '#9b5bd4' },
  { naziv: 'Vagos', puno: 'Los Santos Vagos', boja: '#f2c230' },
  { naziv: 'Marabunta', puno: 'Marabunta Grande', boja: '#3fb6d9' },
  { naziv: 'Bloods', puno: 'Bloods', boja: '#e03a44' },
];
export const BANDE_TEKST = [
  { naslov: 'Teritorije', tekst: 'Ceo hood u južnom Los Santosu je podeljen na pet bandi. Teritorija menja vlasnika samo kroz rat od 30 minuta.' },
  { naslov: 'Materijali', tekst: 'Dva puta dnevno kod Sandy Shoresa pada teretni avion. Ko odveze tovar u bazu, pravi oružje u radionici.' },
  { naslov: 'Pljačke', tekst: 'Prodavnice, bankomati i, za najjače bande, Pacific Standard. Policija uvek dobije poziv.' },
  { naslov: 'Nivo bande', tekst: 'Grafiti, dnevni zadaci i nedeljna lista Kralj ulice. Viši nivo otključava teže poslove.' },
];

// ---------- Eventi (repertoar) ----------
export const EVENTI = [
  { naziv: 'Revolver', opis: 'Svi sa po jednim revolverom. Poslednji koji stoji nosi nagradu.' },
  { naziv: 'Trka', opis: 'Ista kola za sve, staza kroz grad i bez prečica.' },
  { naziv: 'Gun Game', opis: 'Svaki kill menja oružje. Prvi do kraja liste pobeđuje.' },
  { naziv: 'Sumo', opis: 'Izgurati druge sa platforme, a ostati gore.' },
  { naziv: 'Derby', opis: 'Arena, limovi i jedan auto koji na kraju još vozi.' },
  { naziv: 'Nož', opis: 'Samo nož. Blizu, brzo i bez skrivanja.' },
  { naziv: 'Padobran', opis: 'Skok iz aviona i sletanje što bliže meti.' },
];
export const EVENTI_PRAVILA = ['Pet eventa dnevno', 'Pokreću se sami', 'Najmanje 5 igrača', 'Novac za prva tri mesta'];

// ---------- Imovina ----------
export const KUCE = [
  { naziv: 'Mala kuća', garaza: 1, dnevno: 1000 },
  { naziv: 'Srednja kuća', garaza: 2, dnevno: 2500 },
  { naziv: 'Velika kuća', garaza: 4, dnevno: 5000 },
  { naziv: 'Luksuzna kuća', garaza: 6, dnevno: 10000 },
  { naziv: 'Vila', garaza: 8, dnevno: 15000 },
  { naziv: 'Luksuzna vila', garaza: 15, dnevno: 20000 },
];
export const BIZNISI = ['Bankomati', 'Marketi', 'Benzinske pumpe', 'Perionice', 'Rent a car', 'Oružarnice', 'Prodavnice odeće', 'Frizeri', 'Tattoo saloni'];
export const AUKCIJA_SAT = '21:30';

// ---------- Još u gradu ----------
export type Stavka = { naslov: string; tekst: string; ikona: 'kazino' | 'pijaca' | 'auto' | 'nagrade' | 'vestine' | 'kamion' };
export const JOS = [
  { ikona: 'kazino', naslov: 'Kazino', tekst: 'Blackjack za stolom sa krupijeom, rulet i besplatan okret točka sreće svaka 24 sata.' },
  { ikona: 'vestine', naslov: 'Stabla veština', tekst: 'Svaki posao ima svoje stablo. Poeni su retki, jedan na svakih pet nivoa, pa biraj pametno.' },
  { ikona: 'nagrade', naslov: 'Dnevne nagrade', tekst: 'Kalendar od 30 dana, dnevni i nedeljni zadaci i nagrade za prijatelje koje dovedeš.' },
  { ikona: 'pijaca', naslov: 'Pijaca', tekst: 'Iznajmiš tezgu na par sati i prodaješ svoje stvari drugim igračima.' },
  { ikona: 'auto', naslov: 'Auto pijaca', tekst: 'Parkiraš auto na prodajno mesto, a kupac seda i vozi. Bez oglasa i čekanja.' },
  { ikona: 'kamion', naslov: 'Transport', tekst: 'Kamiondžije voze gorivo i robu za biznise igrača. Svoj kamion, svoja tura.' },
] satisfies Stavka[];

// ---------- Tasteri (Vodič) - proveri da odgovaraju serveru ----------
export const TASTERI = [
  { taster: 'M', sta: 'Glavni meni: profil, statistika, zadaci, nagrade, prodavnica' },
  { taster: 'G', sta: 'Radijalni meni: dokumenti, posao, akcije nad igračem' },
  { taster: 'J', sta: 'Tablet: aukcije, market, organizacija, transport' },
  { taster: 'K', sta: 'Telefon: banka, taksi, oglasi, eventi' },
  { taster: 'F6', sta: 'Meni vozila' },
  { taster: 'L', sta: 'Zaključaj i otključaj vozilo' },
  { taster: 'E', sta: 'Razgovor sa NPC-jem i interakcija' },
  { taster: 'T', sta: 'Čet (RP i NON-RP)' },
];

// ---------- Česta pitanja ----------
export const FAQ = [
  { p: 'Da li mi treba originalna GTA V?', o: 'Da. FiveM radi samo sa legalnom kopijom sa Steama, Epica ili Rockstar launchera.' },
  { p: 'Šta treba da uradim pre prvog ulaska?', o: 'Uđi na Discord. Tu prvo izlaze novosti, a uskoro i pravila servera.' },
  { p: 'Kako da zaradim prvi novac?', o: 'Uzmi jedan od legalnih poslova. Rudar i drvoseča su dobri za početak, a uz posao raste i stablo veština.' },
  { p: 'Kako da dobijem kuću ili biznis?', o: 'Samo na aukciji, u tabletu (taster J). Aukcije se zatvaraju svako veče u 21:30. Kuća i biznis se plaćaju dnevno, najviše 14 dana unapred.' },
  { p: 'Mogu li da uđem u policiju ili bolnicu?', o: 'Možeš. Organizacije primaju ljude u gradu, preko svog vođe. Prati Discord za otvorene prijeme.' },
  { p: 'Kako da uđem u bandu?', o: 'Bande primaju ljude kroz roleplay u gradu. Za vođu bande se šalje prijava na sajtu.' },
  { p: 'Neko mi je prekršio pravila. Šta da radim?', o: 'U gradu koristi report u meniju (M, pa Pomoć). Ako treba dokaz ili je stvar ozbiljnija, pošalji Report igrača na sajtu sa snimkom.' },
  { p: 'Dobio sam ban. Kako da se žalim?', o: 'Preko Prijave, pa Žalba na kaznu. Jedna žalba po kazni, iskreno i bez vređanja.' },
  { p: 'Našao sam bag. Kome da javim?', o: 'Pošalji Prijavu baga na sajtu. Za bag koji pomogne serveru dobiješ nagradu u gradu.' },
  { p: 'Gde vidim novosti i update-e?', o: 'Na strani Novosti i u kanalu za obaveštenja na Discordu.' },
];
