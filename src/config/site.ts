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
  guildId: env('DISCORD_GUILD_ID'),

  // kanal u koji bot javlja svaku novu prijavu (samo staff ga vidi). Prazno = ne javlja.
  prijaveKanalId: env('DISCORD_PRIJAVE_KANAL_ID'),
  // kanal za reportove i bagove (prazno = ide u kanal za prijave)
  reportKanalId: env('DISCORD_REPORT_KANAL_ID') || env('DISCORD_PRIJAVE_KANAL_ID'),
  // javni kanal gde bot objavi novost kad staff štiklira "objavi i na Discordu"
  novostiKanalId: env('DISCORD_NOVOSTI_KANAL_ID'),
};

// Ko sme u staff panel (/panel)
export const PANEL = {
  // mogu da čitaju prijave, glasaju i pišu interne komentare
  citanjeUloge: lista(process.env.PANEL_ROLE_IDS),
  // mogu i da prihvate / odbiju prijavu, pišu novosti i odgovaraju na predloge
  odlukaUloge: lista(process.env.PANEL_ODLUKA_ROLE_IDS),
  // Discord ID-jevi koji uvek imaju sve (npr. vlasnik) - desni klik na sebe -> Copy User ID
  vlasnici: lista(process.env.VLASNIK_DISCORD_IDS),
};

// Strana "Tim": koje Discord uloge se prikazuju i kojim redom.
// Popuni ID-jeve uloga. Uloga bez ID-ja se ne prikazuje.
export const TIM: { naziv: string; opis: string; roleId: string }[] = [
  { naziv: 'Vlasništvo', opis: 'Vode grad i odlučuju o pravcu servera.', roleId: env('TIM_VLASNIK_ROLE_ID') },
  { naziv: 'Head admin', opis: 'Vode staff tim i rešavaju najteže slučajeve.', roleId: env('TIM_HEADADMIN_ROLE_ID') },
  { naziv: 'Admini', opis: 'Prate grad, rešavaju reportove i paze na pravila.', roleId: env('TIM_ADMIN_ROLE_ID') },
  { naziv: 'Supporteri', opis: 'Prvi kontakt za pitanja na Discordu i u gradu.', roleId: env('TIM_SUPPORT_ROLE_ID') },
  { naziv: 'Developeri', opis: 'Prave skripte, mape i sve novo u gradu.', roleId: env('TIM_DEV_ROLE_ID') },
];

// ID-jevi iz Vercela bez slučajnih razmaka i navodnika
export function env(ime: string) {
  return (process.env[ime] || '').trim().replace(/^["']|["']$/g, '').trim();
}

function lista(v?: string) {
  return (v || '').replace(/["']/g, '').split(',').map(s => s.trim()).filter(Boolean);
}
