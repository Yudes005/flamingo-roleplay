// ============================================================
//  PODEŠAVANJA SAJTA
//  Ovde menjaš linkove, Discord ID-jeve uloga i tim.
//  Tajne stvari (tokeni, lozinke) NE idu ovde - one su u
//  Vercel -> Settings -> Environment Variables (vidi README.md).
//
//  ID uloge: Discord -> Server Settings -> Roles -> desni klik
//  na ulogu -> Copy Role ID (mora biti uključen Developer Mode).
// ============================================================

export const SITE = {
  ime: 'Flamingo Roleplay',
  grad: 'Flamingo City',
  opis: 'GTA V roleplay server na FiveM-u. Poslovi sa stablima veština, organizacije, pet bandi, aukcije kuća i biznisa i eventi svaki dan.',

  // adresa servera (IP:port) - za dugme "Uđi u grad" i F8 komandu
  server: '185.195.237.205:20025',

  discord: 'https://discord.gg/flamingorp',
  tiktok: 'https://www.tiktok.com/@flamingo_rp_',
};

// Adresa sajta (za login i linkove u Discord porukama).
// Kad pređeš na domen, promeni ovde ili upiši SITE_URL u Vercel.
export const ADRESA = 'https://flamingo-roleplay.vercel.app';

export function adresaSajta() {
  return (env('SITE_URL') || ADRESA).replace(/\/+$/, '');
}

// ============================================================
//  DISCORD ID-JEVI (nisu tajni, zato stoje ovde u kodu)
//  Desni klik -> Copy ID (Developer Mode mora biti uključen).
//  Tajne (token bota, SESSION_SECRET) idu SAMO u Vercel.
// ============================================================
export const ID = {
  server: '1520048594407784611',
  kanalPrijave: '1560402319512838164',
  kanalReporti: '1560402460483256371',
  kanalNovosti: '1560402433597906954',
  vlasnici: '817807470515847178',
  // ko čita prijave, glasa i komentariše (Admin, Supporter)
  panelUloge: '1554106464568741999,1554106856694226954',
  // ko prihvata/odbija, piše novosti, odgovara na predloge (Vlasništvo, Head admin)
  panelOdlukaUloge: '1520054494912581682,1554106214261067816',
  // strana Tim
  ulogaVlasnik: '1520054494912581682',
  ulogaHeadAdmin: '1554106214261067816',
  ulogaAdmin: '1554106464568741999',
  ulogaSupport: '1554106856694226954',
  ulogaDev: '1554106125987749958',
  // uloga koju bot da kad prihvatiš prijavu (prazno = daješ je ručno)
  prijavaAdmin: '1554106464568741999',
  prijavaSupport: '1554106856694226954',
  prijavaDev: '1554106125987749958',
  prijavaLider: '',
  prijavaKreator: '',
};

// Glavni meni (redosled = redosled na sajtu)
export const MENI = [
  { href: '/vodic', tekst: 'Vodič' },
  { href: '/pravila', tekst: 'Pravila' },
  { href: '/novosti', tekst: 'Novosti' },
  { href: '/prijave', tekst: 'Prijave' },
  { href: '/predlozi', tekst: 'Predlozi' },
  { href: '/tim', tekst: 'Tim' },
];

export const DISCORD = {
  // ID Discord servera (desni klik na server -> Copy Server ID)
  guildId: env('DISCORD_GUILD_ID') || ID.server,

  // kanal u koji bot javlja svaku novu prijavu (samo staff ga vidi). Prazno = ne javlja.
  prijaveKanalId: env('DISCORD_PRIJAVE_KANAL_ID') || ID.kanalPrijave,
  // kanal za reportove i bagove (prazno = ide u kanal za prijave)
  reportKanalId: env('DISCORD_REPORT_KANAL_ID') || ID.kanalReporti || env('DISCORD_PRIJAVE_KANAL_ID') || ID.kanalPrijave,
  // javni kanal gde bot objavi novost kad staff štiklira "objavi i na Discordu"
  novostiKanalId: env('DISCORD_NOVOSTI_KANAL_ID') || ID.kanalNovosti,
};

// Ko sme u staff panel (/panel)
export const PANEL = {
  // mogu da čitaju prijave, glasaju i pišu interne komentare
  citanjeUloge: lista(process.env.PANEL_ROLE_IDS || ID.panelUloge),
  // mogu i da prihvate / odbiju prijavu, pišu novosti i odgovaraju na predloge
  odlukaUloge: lista(process.env.PANEL_ODLUKA_ROLE_IDS || ID.panelOdlukaUloge),
  // Discord ID-jevi koji uvek imaju sve (npr. vlasnik) - desni klik na sebe -> Copy User ID
  vlasnici: lista(process.env.VLASNIK_DISCORD_IDS || ID.vlasnici),
};

// Strana "Tim": koje Discord uloge se prikazuju i kojim redom.
// Popuni ID-jeve uloga. Uloga bez ID-ja se ne prikazuje.
export const TIM: { naziv: string; opis: string; roleId: string }[] = [
  { naziv: 'Vlasništvo', opis: 'Vode grad i odlučuju o pravcu servera.', roleId: env('TIM_VLASNIK_ROLE_ID') || ID.ulogaVlasnik },
  { naziv: 'Head admin', opis: 'Vode staff tim i rešavaju najteže slučajeve.', roleId: env('TIM_HEADADMIN_ROLE_ID') || ID.ulogaHeadAdmin },
  { naziv: 'Admini', opis: 'Prate grad, rešavaju reportove i paze na pravila.', roleId: env('TIM_ADMIN_ROLE_ID') || ID.ulogaAdmin },
  { naziv: 'Supporteri', opis: 'Prvi kontakt za pitanja na Discordu i u gradu.', roleId: env('TIM_SUPPORT_ROLE_ID') || ID.ulogaSupport },
  { naziv: 'Developeri', opis: 'Prave skripte, mape i sve novo u gradu.', roleId: env('TIM_DEV_ROLE_ID') || ID.ulogaDev },
];

// ID-jevi iz Vercela bez slučajnih razmaka i navodnika
export function env(ime: string) {
  return (process.env[ime] || '').trim().replace(/^["']|["']$/g, '').trim();
}

function lista(v?: string) {
  return (v || '').replace(/["']/g, '').split(',').map(s => s.trim()).filter(Boolean);
}
