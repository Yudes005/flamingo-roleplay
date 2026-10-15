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
  opis: 'GTA V roleplay server na FiveM-u. Posao, organizacije, bande i grad koji živi i kad nisi tu.',

  // adresa servera (IP:port) - za dugme "Uđi u grad" i F8 komandu
  server: '185.195.237.205:20025',

  discord: 'https://discord.gg/flamingorp',
  tiktok: 'https://www.tiktok.com/@flamingo_rp_',
};

export const DISCORD = {
  // ID Discord servera (desni klik na server -> Copy Server ID)
  guildId: process.env.DISCORD_GUILD_ID || '',

  // kanal u koji bot javlja svaku novu prijavu (samo staff ga vidi). Prazno = ne javlja.
  prijaveKanalId: process.env.DISCORD_PRIJAVE_KANAL_ID || '',
};

// Ko sme u staff panel (/panel)
export const PANEL = {
  // mogu da čitaju prijave, glasaju i pišu interne komentare
  citanjeUloge: lista(process.env.PANEL_ROLE_IDS),
  // mogu i da prihvate / odbiju prijavu
  odlukaUloge: lista(process.env.PANEL_ODLUKA_ROLE_IDS),
  // Discord ID-jevi koji uvek imaju sve (npr. vlasnik) - desni klik na sebe -> Copy User ID
  vlasnici: lista(process.env.VLASNIK_DISCORD_IDS),
};

// Strana "Tim": koje Discord uloge se prikazuju i kojim redom.
// Popuni ID-jeve uloga. Uloga bez ID-ja se ne prikazuje.
export const TIM: { naziv: string; opis: string; roleId: string }[] = [
  { naziv: 'Vlasništvo', opis: 'Vode grad i odlučuju o pravcu servera.', roleId: process.env.TIM_VLASNIK_ROLE_ID || '' },
  { naziv: 'Head admin', opis: 'Vode staff tim i rešavaju najteže slučajeve.', roleId: process.env.TIM_HEADADMIN_ROLE_ID || '' },
  { naziv: 'Admini', opis: 'Prate grad, rešavaju reportove i paze na pravila.', roleId: process.env.TIM_ADMIN_ROLE_ID || '' },
  { naziv: 'Supporteri', opis: 'Prvi kontakt za pitanja na Discordu i u gradu.', roleId: process.env.TIM_SUPPORT_ROLE_ID || '' },
  { naziv: 'Developeri', opis: 'Prave skripte, mape i sve novo u gradu.', roleId: process.env.TIM_DEV_ROLE_ID || '' },
];

function lista(v?: string) {
  return (v || '').split(',').map(s => s.trim()).filter(Boolean);
}
