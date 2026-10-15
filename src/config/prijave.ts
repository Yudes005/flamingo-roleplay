// ============================================================
//  VRSTE PRIJAVA
//  Ovde dodaješ/menjaš pozicije, pitanja i uslove.
//   otvorena      - false = prijava se vidi, ali ne može da se pošalje
//   ponovoPosleDana - koliko dana posle odbijanja može ponovo
//   ulogaPriPrihvatanju - Discord uloga koju bot da kad prihvatiš (env ili prazno)
//
//  Vrste polja: 'tekst' (jedan red), 'opis' (više redova), 'broj',
//  'izbor' (padajuća lista), 'potvrda' (kvačica koja mora biti štiklirana)
// ============================================================

export type Polje =
  | { id: string; tip: 'tekst'; pitanje: string; pomoc?: string; min?: number; max?: number; obavezno?: boolean }
  | { id: string; tip: 'opis'; pitanje: string; pomoc?: string; min?: number; max?: number; obavezno?: boolean }
  | { id: string; tip: 'broj'; pitanje: string; pomoc?: string; min?: number; max?: number; obavezno?: boolean }
  | { id: string; tip: 'izbor'; pitanje: string; pomoc?: string; opcije: string[]; obavezno?: boolean }
  | { id: string; tip: 'potvrda'; pitanje: string; pomoc?: string };

export type VrstaPrijave = {
  id: string;
  naziv: string;
  kratko: string;
  uslovi: string[];
  otvorena: boolean;
  ponovoPosleDana: number;
  ulogaPriPrihvatanju?: string;
  polja: Polje[];
};

const osnovno: Polje[] = [
  { id: 'ime', tip: 'tekst', pitanje: 'Tvoje ime (pravo, ne ime lika)', max: 40, obavezno: true },
  { id: 'godine', tip: 'broj', pitanje: 'Koliko imaš godina?', min: 10, max: 99, obavezno: true },
  { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika u gradu', max: 60, obavezno: true },
];

const pravila: Polje = {
  id: 'pravila',
  tip: 'potvrda',
  pitanje: 'Pročitao sam pravila servera i slažem se da prijava može biti odbijena bez obrazloženja.',
};

export const PRIJAVE: VrstaPrijave[] = [
  {
    id: 'admin',
    naziv: 'Admin',
    kratko: 'Pratiš grad, rešavaš reportove i paziš da se pravila poštuju.',
    uslovi: ['Najmanje 17 godina', 'Mikrofon i Discord', 'Aktivan u gradu bar 2 nedelje', 'Bez ozbiljnih kazni'],
    otvorena: true,
    ponovoPosleDana: 14,
    ulogaPriPrihvatanju: process.env.PRIJAVA_ADMIN_ROLE_ID,
    polja: [
      ...osnovno,
      { id: 'iskustvo', tip: 'opis', pitanje: 'Da li si već bio staff na nekom serveru? Gde i koliko dugo?', min: 20, max: 1200, obavezno: true },
      { id: 'vreme', tip: 'izbor', pitanje: 'Koliko vremena dnevno možeš da odvojiš?', opcije: ['Manje od 2 sata', '2-4 sata', '4-6 sati', 'Više od 6 sati'], obavezno: true },
      { id: 'situacija1', tip: 'opis', pitanje: 'Igrač ti prijavi da ga je neko ubio bez razloga (RDM). Šta radiš, korak po korak?', min: 60, max: 1500, obavezno: true },
      { id: 'situacija2', tip: 'opis', pitanje: 'Tvoj dobar prijatelj iz grada krši pravila. Kako postupaš?', min: 40, max: 1200, obavezno: true },
      { id: 'pojmovi', tip: 'opis', pitanje: 'Svojim rečima objasni: metagaming, powergaming i fail RP.', min: 60, max: 1500, obavezno: true },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto baš ti? Šta bi doneo staff timu?', min: 60, max: 1500, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'supporter',
    naziv: 'Supporter',
    kratko: 'Pomažeš novim igračima na Discordu i u gradu i odgovaraš na pitanja.',
    uslovi: ['Najmanje 16 godina', 'Strpljenje sa novim igračima', 'Aktivan na Discordu'],
    otvorena: true,
    ponovoPosleDana: 10,
    ulogaPriPrihvatanju: process.env.PRIJAVA_SUPPORT_ROLE_ID,
    polja: [
      ...osnovno,
      { id: 'vreme', tip: 'izbor', pitanje: 'Koliko vremena dnevno možeš da odvojiš?', opcije: ['Manje od 2 sata', '2-4 sata', '4-6 sati', 'Više od 6 sati'], obavezno: true },
      { id: 'novi', tip: 'opis', pitanje: 'Novi igrač ne zna kako da nađe posao i nervozan je. Kako mu pomažeš?', min: 40, max: 1200, obavezno: true },
      { id: 'grad', tip: 'opis', pitanje: 'Koliko poznaješ grad? Navedi poslove i mesta koja bi preporučio novom igraču.', min: 40, max: 1200, obavezno: true },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto želiš da budeš supporter?', min: 40, max: 1200, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'lider',
    naziv: 'Lider organizacije',
    kratko: 'Vodiš policiju, bolnicu, mehaničare, bandu ili familiju i brineš o svojim ljudima.',
    uslovi: ['Najmanje 16 godina', 'Iskustvo u roleplayu', 'Ideja i plan za organizaciju', 'Aktivnost svaki dan'],
    otvorena: true,
    ponovoPosleDana: 14,
    ulogaPriPrihvatanju: process.env.PRIJAVA_LIDER_ROLE_ID,
    polja: [
      ...osnovno,
      { id: 'organizacija', tip: 'izbor', pitanje: 'Za koju organizaciju se prijavljuješ?', opcije: ['Policija', 'Bolnica', 'Mehaničari', 'Banda', 'Familija', 'Nešto drugo'], obavezno: true },
      { id: 'naziv', tip: 'tekst', pitanje: 'Naziv organizacije (za bandu, familiju ili nešto novo)', max: 60 },
      { id: 'iskustvo', tip: 'opis', pitanje: 'Da li si već vodio organizaciju? Gde, koliko dugo i kako je išlo?', min: 40, max: 1500, obavezno: true },
      { id: 'plan', tip: 'opis', pitanje: 'Kako bi vodio organizaciju? Pravila, činovi, aktivnosti, roleplay ideje.', min: 120, max: 2500, obavezno: true },
      { id: 'clanovi', tip: 'opis', pitanje: 'Imaš li već ljude koji bi bili u organizaciji? Ako da, ko i koliko?', min: 10, max: 1000, obavezno: true },
      { id: 'sukob', tip: 'opis', pitanje: 'Dva člana tvoje organizacije se posvađaju i jedan hoće da ode. Šta radiš?', min: 40, max: 1200, obavezno: true },
      pravila,
    ],
  },
  {
    id: 'zalba',
    naziv: 'Žalba na kaznu',
    kratko: 'Misliš da si dobio ban ili kaznu nepravedno? Objasni šta se desilo.',
    uslovi: ['Iskreno i bez vređanja', 'Jedna žalba po kazni'],
    otvorena: true,
    ponovoPosleDana: 7,
    polja: [
      { id: 'ingame', tip: 'tekst', pitanje: 'Ime i prezime tvog lika', max: 60, obavezno: true },
      { id: 'kazna', tip: 'izbor', pitanje: 'Koju kaznu si dobio?', opcije: ['Ban', 'Kick', 'Zatvor (admin jail)', 'Upozorenje', 'Nešto drugo'], obavezno: true },
      { id: 'ko', tip: 'tekst', pitanje: 'Ko ti je dao kaznu (ako znaš)?', max: 60 },
      { id: 'kada', tip: 'tekst', pitanje: 'Kada se to desilo? (datum i otprilike vreme)', max: 60, obavezno: true },
      { id: 'razlog', tip: 'tekst', pitanje: 'Razlog koji je naveden uz kaznu', max: 200, obavezno: true },
      { id: 'prica', tip: 'opis', pitanje: 'Šta se tačno desilo? Ako imaš snimak, ubaci link.', min: 60, max: 2500, obavezno: true },
      { id: 'zasto', tip: 'opis', pitanje: 'Zašto misliš da kazna treba da se skine ili smanji?', min: 40, max: 1500, obavezno: true },
    ],
  },
];

export function nadjiPrijavu(id: string) {
  return PRIJAVE.find(p => p.id === id) || null;
}
