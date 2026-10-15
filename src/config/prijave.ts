// ============================================================
//  VRSTE PRIJAVA I REPORTOVA
//  Ovde dodaješ/menjaš pozicije, pitanja i uslove.
//   grupa           - 'tim' (staff), 'grad' (organizacije, bande, kreatori), 'report' (reportovi, žalbe, bagovi)
//   otvorena        - false = vidi se, ali ne može da se pošalje
//   ponovoPosleDana - koliko dana posle odbijanja može ponovo (0 = odmah)
//   jednom          - kad je prihvaćena, ne može ponovo (za pozicije)
//   naCekanjuMax    - koliko istih može da čeka odluku u isto vreme (podrazumevano 1)
//   samoVrh         - vide je samo vlasnici i uloge iz PANEL_ODLUKA_ROLE_IDS (npr. report na staff)
//   ulogaPriPrihvatanju - Discord uloga koju bot da kad prihvatiš (env ili prazno)
//
//  Vrste polja: 'tekst' (jedan red), 'opis' (više redova), 'broj', 'link',
//  'izbor' (padajuća lista), 'potvrda' (kvačica koja mora biti štiklirana)
// ============================================================

import { ID } from './site';

// uloga iz Vercela (ili iz site.ts); prazno ili tekst koji nije ID = bot ne daje ulogu
function uloga(ime: string, podrazumevano: string) {
  const v = (process.env[ime] || podrazumevano || '').trim();
  return /^\d{15,22}$/.test(v) ? v : undefined;
}

export type Polje =
  | { id: string; tip: 'tekst'; pitanje: string; pomoc?: string; min?: number; max?: number; obavezno?: boolean }
  | { id: string; tip: 'opis'; pitanje: string; pomoc?: string; min?: number; max?: number; obavezno?: boolean }
  | { id: string; tip: 'broj'; pitanje: string; pomoc?: string; min?: number; max?: number; obavezno?: boolean }
  | { id: string; tip: 'link'; pitanje: string; pomoc?: string; max?: number; obavezno?: boolean }
  | { id: string; tip: 'izbor'; pitanje: string; pomoc?: string; opcije: string[]; obavezno?: boolean }
  | { id: string; tip: 'potvrda'; pitanje: string; pomoc?: string };

export type Grupa = 'tim' | 'grad' | 'report';

export type VrstaPrijave = {
  id: string;
  naziv: string;
  kratko: string;
  grupa: Grupa;
  uslovi: string[];
  otvorena: boolean;
  ponovoPosleDana: number;
  jednom?: boolean;
  naCekanjuMax?: number;
  samoVrh?: boolean;
  ulogaPriPrihvatanju?: string;
  polja: Polje[];
};

export const GRUPE: { id: Grupa; naziv: string; opis: string }[] = [
  { id: 'tim', naziv: 'Staff tim', opis: 'Ljudi koji vode grad, pomažu igračima i prave nove stvari.' },
  { id: 'grad', naziv: 'Organizacije, bande i kreatori', opis: 'Posao u uniformi, mesto vođe ili snimanje grada za društvene mreže.' },
  { id: 'report', naziv: 'Reportovi i žalbe', opis: 'Kad nešto nije u redu: prekršaj, kazna koju smatraš nepravednom ili bag.' },
];

// tekstovi odluka po grupi (dugmad u panelu, pečati i poruke igraču)
export const ODLUKE: Record<Grupa | 'zalba', { da: string; ne: string; pecatDa: string; pecatNe: string; glagolDa: string; glagolNe: string }> = {
  tim: { da: 'Prihvaćena', ne: 'Odbijena', pecatDa: 'Odobreno', pecatNe: 'Odbijeno', glagolDa: 'Prihvati', glagolNe: 'Odbij' },
  grad: { da: 'Prihvaćena', ne: 'Odbijena', pecatDa: 'Odobreno', pecatNe: 'Odbijeno', glagolDa: 'Prihvati', glagolNe: 'Odbij' },
  report: { da: 'Rešeno', ne: 'Odbačeno', pecatDa: 'Rešeno', pecatNe: 'Odbačeno', glagolDa: 'Reši', glagolNe: 'Odbaci' },
  zalba: { da: 'Usvojena', ne: 'Odbijena', pecatDa: 'Usvojeno', pecatNe: 'Odbijeno', glagolDa: 'Usvoji', glagolNe: 'Odbij' },
};

export function odlukeZa(v: VrstaPrijave | null | undefined) {
  if (!v) return ODLUKE.tim;
  if (v.id === 'zalba') return ODLUKE.zalba;
  return ODLUKE[v.grupa];
}

const osnovno: Polje[] = [
  { id: 'ime', tip: 'tekst', pitanje: 'Tvoje ime (pravo, ne ime lika)', max: 40, obavezno: true },
  { id: 'godine', tip: 'broj', pitanje: 'Koliko imaš godina?', min: 10, max: 99, obavezno: true },
  { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika u gradu', max: 60, obavezno: true },
];

const vreme: Polje = { id: 'vreme', tip: 'izbor', pitanje: 'Koliko vremena dnevno možeš da odvojiš?', opcije: ['Manje od 2 sata', '2-4 sata', '4-6 sati', 'Više od 6 sati'], obavezno: true };

const pravila: Polje = {
  id: 'pravila',
  tip: 'potvrda',
  pitanje: 'Pročitao sam pravila servera i slažem se da prijava može biti odbijena bez obrazloženja.',
};

const iskreno: Polje = {
  id: 'iskreno',
  tip: 'potvrda',
  pitanje: 'Sve što sam napisao je tačno. Znam da lažan report donosi kaznu meni.',
};

const ORGANIZACIJE = ['Policija', 'Šerif (Paleto Bay)', 'FIB', 'Vojska', 'Bolnica', 'Vlada', 'Lifeinvader'];
const BANDE = ['GSF', 'Ballas', 'Vagos', 'Marabunta', 'Bloods'];

export const PRIJAVE: VrstaPrijave[] = [
  // ------------------------------------------------ STAFF TIM
  {
    id: 'admin',
    grupa: 'tim',
    naziv: 'Admin',
    kratko: 'Pratiš grad, rešavaš reportove i paziš da se pravila poštuju.',
    uslovi: ['Najmanje 17 godina', 'Mikrofon i Discord', 'Aktivan u gradu bar 2 nedelje', 'Bez ozbiljnih kazni'],
    otvorena: true,
    ponovoPosleDana: 14,
    jednom: true,
    ulogaPriPrihvatanju: uloga('PRIJAVA_ADMIN_ROLE_ID', ID.prijavaAdmin),
    polja: [
      ...osnovno,
      { id: 'iskustvo', tip: 'opis', pitanje: 'Da li si već bio staff na nekom serveru? Gde i koliko dugo?', min: 20, max: 1200, obavezno: true },
      vreme,
      { id: 'situacija1', tip: 'opis', pitanje: 'Igrač ti prijavi da ga je neko ubio bez razloga (RDM). Šta radiš, korak po korak?', min: 60, max: 1500, obavezno: true },
      { id: 'situacija2', tip: 'opis', pitanje: 'Tvoj dobar prijatelj iz grada krši pravila. Kako postupaš?', min: 40, max: 1200, obavezno: true },
      { id: 'pojmovi', tip: 'opis', pitanje: 'Svojim rečima objasni: metagaming, powergaming i fail RP.', min: 60, max: 1500, obavezno: true },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto baš ti? Šta bi doneo staff timu?', min: 60, max: 1500, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'supporter',
    grupa: 'tim',
    naziv: 'Supporter',
    kratko: 'Pomažeš novim igračima na Discordu i u gradu i odgovaraš na pitanja.',
    uslovi: ['Najmanje 16 godina', 'Strpljenje sa novim igračima', 'Aktivan na Discordu'],
    otvorena: true,
    ponovoPosleDana: 10,
    jednom: true,
    ulogaPriPrihvatanju: uloga('PRIJAVA_SUPPORT_ROLE_ID', ID.prijavaSupport),
    polja: [
      ...osnovno,
      vreme,
      { id: 'novi', tip: 'opis', pitanje: 'Novi igrač ne zna kako da nađe posao i nervozan je. Kako mu pomažeš?', min: 40, max: 1200, obavezno: true },
      { id: 'grad', tip: 'opis', pitanje: 'Koliko poznaješ grad? Navedi poslove i mesta koja bi preporučio novom igraču.', min: 40, max: 1200, obavezno: true },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto želiš da budeš supporter?', min: 40, max: 1200, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'developer',
    grupa: 'tim',
    naziv: 'Developer',
    kratko: 'Praviš skripte, interfejse i mape za grad zajedno sa ostatkom tima.',
    uslovi: ['Lua i JavaScript', 'Iskustvo sa ESX-om ili ox bibliotekama', 'Primeri svog rada'],
    otvorena: true,
    ponovoPosleDana: 14,
    jednom: true,
    ulogaPriPrihvatanju: uloga('PRIJAVA_DEV_ROLE_ID', ID.prijavaDev),
    polja: [
      ...osnovno,
      { id: 'jezici', tip: 'opis', pitanje: 'Šta znaš? Jezici, frameworci, alati (Lua, JS, React, Vue, SQL...)', min: 20, max: 1000, obavezno: true },
      { id: 'radovi', tip: 'link', pitanje: 'Link na tvoj rad (GitHub, video, portfolio)', max: 300, obavezno: true },
      { id: 'iskustvo', tip: 'opis', pitanje: 'Na kojim serverima si radio i šta si napravio?', min: 40, max: 1500, obavezno: true },
      vreme,
      pravila,
    ],
  },

  // ------------------------------------------------ ORGANIZACIJE, BANDE, KREATORI
  {
    id: 'posao',
    grupa: 'grad',
    naziv: 'Posao u organizaciji',
    kratko: 'Policija, šerif, FIB, vojska, bolnica, vlada ili Lifeinvader.',
    uslovi: ['Najmanje 16 godina', 'Mikrofon', 'Znaš pravila servera'],
    otvorena: true,
    ponovoPosleDana: 7,
    polja: [
      ...osnovno,
      { id: 'organizacija', tip: 'izbor', pitanje: 'Gde želiš da radiš?', opcije: ORGANIZACIJE, obavezno: true },
      vreme,
      { id: 'iskustvo', tip: 'opis', pitanje: 'Da li si već radio u toj organizaciji, ovde ili na drugom serveru?', min: 20, max: 1200, obavezno: true },
      { id: 'situacija', tip: 'opis', pitanje: 'Opiši jednu RP situaciju u kojoj si bio i kako si je odigrao.', min: 60, max: 1500, obavezno: true },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto baš ova organizacija?', min: 40, max: 1200, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'lider',
    grupa: 'grad',
    naziv: 'Lider organizacije ili bande',
    kratko: 'Vodiš organizaciju ili jednu od pet bandi i brineš o svojim ljudima.',
    uslovi: ['Najmanje 16 godina', 'Iskustvo u roleplayu', 'Plan za organizaciju', 'Aktivnost svaki dan'],
    otvorena: true,
    ponovoPosleDana: 14,
    jednom: true,
    ulogaPriPrihvatanju: uloga('PRIJAVA_LIDER_ROLE_ID', ID.prijavaLider),
    polja: [
      ...osnovno,
      { id: 'organizacija', tip: 'izbor', pitanje: 'Šta želiš da vodiš?', opcije: [...ORGANIZACIJE, ...BANDE], obavezno: true },
      { id: 'iskustvo', tip: 'opis', pitanje: 'Da li si već vodio organizaciju? Gde, koliko dugo i kako je išlo?', min: 40, max: 1500, obavezno: true },
      { id: 'plan', tip: 'opis', pitanje: 'Kako bi vodio organizaciju? Pravila, činovi, aktivnosti, roleplay ideje.', min: 120, max: 2500, obavezno: true },
      { id: 'clanovi', tip: 'opis', pitanje: 'Imaš li već ljude koji bi bili sa tobom? Ako da, koliko?', min: 10, max: 1000, obavezno: true },
      { id: 'sukob', tip: 'opis', pitanje: 'Dva tvoja člana se posvađaju i jedan hoće da ode. Šta radiš?', min: 40, max: 1200, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'kreator',
    grupa: 'grad',
    naziv: 'Content creator',
    kratko: 'Snimaš ili strimuješ grad. Dobijaš ulogu na Discordu i podršku servera.',
    uslovi: ['Redovno objavljuješ', 'Snimaš iz Flamingo grada', 'Link ka našem Discordu u opisu'],
    otvorena: true,
    ponovoPosleDana: 14,
    jednom: true,
    ulogaPriPrihvatanju: uloga('PRIJAVA_KREATOR_ROLE_ID', ID.prijavaKreator),
    polja: [
      { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika u gradu', max: 60, obavezno: true },
      { id: 'platforma', tip: 'izbor', pitanje: 'Gde objavljuješ najviše?', opcije: ['TikTok', 'YouTube', 'Twitch', 'Kick', 'Instagram'], obavezno: true },
      { id: 'kanal', tip: 'link', pitanje: 'Link na tvoj kanal ili profil', max: 300, obavezno: true },
      { id: 'pratioci', tip: 'broj', pitanje: 'Koliko pratilaca imaš?', min: 0, max: 100000000, obavezno: true },
      { id: 'sadrzaj', tip: 'opis', pitanje: 'Šta bi snimao iz grada i koliko često?', min: 30, max: 1200, obavezno: true },
      pravila,
    ],
  },

  // ------------------------------------------------ REPORTOVI I ŽALBE
  {
    id: 'report',
    grupa: 'report',
    naziv: 'Report igrača',
    kratko: 'Neko je prekršio pravila, a za to imaš snimak ili sliku.',
    uslovi: ['Dokaz (snimak ili slika)', 'Broj pravila koje je prekršeno', 'Bez vređanja'],
    otvorena: true,
    ponovoPosleDana: 0,
    naCekanjuMax: 3,
    polja: [
      { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika', max: 60, obavezno: true },
      { id: 'prijavljeni', tip: 'tekst', pitanje: 'Koga prijavljuješ? Ime lika ili ID u gradu', max: 80, obavezno: true },
      { id: 'kada', tip: 'tekst', pitanje: 'Kada se to desilo? (datum i otprilike vreme)', max: 60, obavezno: true },
      { id: 'pravilo', tip: 'tekst', pitanje: 'Koje pravilo je prekršeno?', pomoc: 'Broj i naziv sa strane Pravila, npr. 2.1 RDM.', max: 80, obavezno: true },
      { id: 'prica', tip: 'opis', pitanje: 'Šta se tačno desilo?', min: 40, max: 2500, obavezno: true },
      { id: 'dokaz', tip: 'link', pitanje: 'Link na snimak ili sliku', pomoc: 'YouTube, Streamable, Medal, Imgur ili slično. Bez dokaza report se retko rešava.', max: 300, obavezno: true },
      iskreno,
    ],
  },
  {
    id: 'staff-report',
    grupa: 'report',
    naziv: 'Report na staff',
    kratko: 'Admin ili supporter je zloupotrebio poziciju. Čita samo vlasništvo.',
    uslovi: ['Vidi samo vlasništvo servera', 'Dokaz (snimak ili slika)', 'Bez vređanja'],
    otvorena: true,
    ponovoPosleDana: 0,
    naCekanjuMax: 2,
    samoVrh: true,
    polja: [
      { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika', max: 60, obavezno: true },
      { id: 'prijavljeni', tip: 'tekst', pitanje: 'Koga iz staffa prijavljuješ? (ime u gradu ili na Discordu)', max: 80, obavezno: true },
      { id: 'kada', tip: 'tekst', pitanje: 'Kada se to desilo? (datum i otprilike vreme)', max: 60, obavezno: true },
      { id: 'prica', tip: 'opis', pitanje: 'Šta je uradio i zašto misliš da nije bilo u redu?', min: 60, max: 2500, obavezno: true },
      { id: 'dokaz', tip: 'link', pitanje: 'Link na snimak ili sliku', max: 300, obavezno: true },
      iskreno,
    ],
  },
  {
    id: 'zalba',
    grupa: 'report',
    naziv: 'Žalba na kaznu',
    kratko: 'Misliš da si dobio ban ili kaznu nepravedno? Objasni šta se desilo.',
    uslovi: ['Iskreno i bez vređanja', 'Jedna žalba po kazni'],
    otvorena: true,
    ponovoPosleDana: 7,
    polja: [
      { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika', max: 60, obavezno: true },
      { id: 'kazna', tip: 'izbor', pitanje: 'Koju kaznu si dobio?', opcije: ['Ban', 'Kick', 'Zatvor (admin jail)', 'Upozorenje', 'Mute', 'Nešto drugo'], obavezno: true },
      { id: 'ko', tip: 'tekst', pitanje: 'Ko ti je dao kaznu (ako znaš)?', max: 60 },
      { id: 'kada', tip: 'tekst', pitanje: 'Kada se to desilo? (datum i otprilike vreme)', max: 60, obavezno: true },
      { id: 'razlog', tip: 'tekst', pitanje: 'Razlog koji je naveden uz kaznu', max: 200, obavezno: true },
      { id: 'prica', tip: 'opis', pitanje: 'Šta se tačno desilo?', min: 60, max: 2500, obavezno: true },
      { id: 'dokaz', tip: 'link', pitanje: 'Snimak situacije, ako ga imaš', max: 300 },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto misliš da kazna treba da se skine ili smanji?', min: 40, max: 1500, obavezno: true },
    ],
  },
  {
    id: 'bag',
    grupa: 'report',
    naziv: 'Prijava baga',
    kratko: 'Nešto ne radi kako treba. Za bag koji pomogne gradu dobijaš nagradu.',
    uslovi: ['Jedan bag po prijavi', 'Koraci da ga ponovimo', 'Ne koristi bag dok čekaš'],
    otvorena: true,
    ponovoPosleDana: 0,
    naCekanjuMax: 5,
    polja: [
      { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika', max: 60, obavezno: true },
      { id: 'gde', tip: 'izbor', pitanje: 'Gde je bag?', opcije: ['U gradu', 'Na sajtu', 'Na Discordu'], obavezno: true },
      { id: 'sistem', tip: 'tekst', pitanje: 'Koji deo? (posao, meni, vozilo, kuća, telefon...)', max: 80, obavezno: true },
      { id: 'opis', tip: 'opis', pitanje: 'Šta se desilo i šta je trebalo da se desi?', min: 30, max: 2000, obavezno: true },
      { id: 'koraci', tip: 'opis', pitanje: 'Kako da ponovimo bag, korak po korak?', max: 1500 },
      { id: 'dokaz', tip: 'link', pitanje: 'Snimak ili slika', max: 300 },
    ],
  },
];

export function nadjiPrijavu(id: string) {
  return PRIJAVE.find(p => p.id === id) || null;
}
