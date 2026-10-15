import type { Metadata } from 'next';
import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { DISCORD, PANEL, TIM, adresaSajta } from '@/config/site';
import { bot } from '@/lib/discord';
import { db, imaBazu } from '@/lib/db';
import { statusServera } from '@/lib/status';

export const metadata: Metadata = { title: 'Provera podešavanja', robots: { index: false } };
export const dynamic = 'force-dynamic';

type Stavka = { naziv: string; stanje: 'ok' | 'upozorenje' | 'greska'; poruka: string };

// Proverava podešavanja sajta. Ne prikazuje nijednu tajnu vrednost, samo da li postoji i da li radi.
async function proveri(): Promise<{ naslov: string; stavke: Stavka[] }[]> {
  const site = adresaSajta();
  const sesija = process.env.SESSION_SECRET || '';

  const login: Stavka[] = [
    { naziv: 'Adresa sajta', stanje: site.startsWith('https://') ? 'ok' : 'upozorenje', poruka: site.startsWith('https://') ? site : 'Mora da počinje sa https://' },
    sesija.length >= 32
      ? { naziv: 'SESSION_SECRET', stanje: 'ok', poruka: `Upisan (${sesija.length} znakova)` }
      : { naziv: 'SESSION_SECRET', stanje: 'greska', poruka: sesija ? `Prekratak (${sesija.length} znakova, treba bar 32)` : 'Nije upisan. Bez njega login ne radi.' },
    process.env.DISCORD_CLIENT_ID
      ? { naziv: 'DISCORD_CLIENT_ID', stanje: 'ok', poruka: 'Upisan' }
      : { naziv: 'DISCORD_CLIENT_ID', stanje: 'greska', poruka: 'Nije upisan (Developer Portal, pa OAuth2, pa Client ID)' },
    process.env.DISCORD_CLIENT_SECRET
      ? { naziv: 'DISCORD_CLIENT_SECRET', stanje: 'ok', poruka: 'Upisan. Ako login javlja grešku, uradi Reset Secret i upiši novi.' }
      : { naziv: 'DISCORD_CLIENT_SECRET', stanje: 'greska', poruka: 'Nije upisan (Developer Portal, pa OAuth2, pa Reset Secret)' },
  ];

  let baza: Stavka;
  if (!imaBazu()) {
    baza = { naziv: 'DATABASE_URL', stanje: 'greska', poruka: 'Nije povezana. Vercel, pa Storage, pa Neon, pa Connect.' };
  } else {
    try {
      const sql = await db();
      await sql`SELECT 1`;
      baza = { naziv: 'Baza', stanje: 'ok', poruka: 'Povezana, tabele su spremne.' };
    } catch {
      baza = { naziv: 'Baza', stanje: 'greska', poruka: 'DATABASE_URL postoji, ali veza ne radi. Proveri Neon bazu u Vercelu.' };
    }
  }

  const discord: Stavka[] = [];
  if (!process.env.DISCORD_BOT_TOKEN) {
    discord.push({ naziv: 'DISCORD_BOT_TOKEN', stanje: 'greska', poruka: 'Nije upisan u Vercel. Bez bota nema poruka, uloga, panela ni strane Tim.' });
  } else {
    const ja = await bot<{ username: string }>('GET', '/users/@me');
    discord.push(ja.ok
      ? { naziv: 'DISCORD_BOT_TOKEN', stanje: 'ok', poruka: `Bot radi: ${ja.data?.username}` }
      : { naziv: 'DISCORD_BOT_TOKEN', stanje: 'greska', poruka: `Token ne radi (${ja.poruka}). Developer Portal, pa Bot, pa Reset Token.` });
    if (!DISCORD.guildId) {
      discord.push({ naziv: 'DISCORD_GUILD_ID', stanje: 'greska', poruka: 'Nije upisan (desni klik na server, pa Copy Server ID).' });
    } else if (ja.ok) {
      const g = await bot<{ name: string }>('GET', `/guilds/${DISCORD.guildId}`);
      discord.push(g.ok
        ? { naziv: 'Discord server', stanje: 'ok', poruka: `Server: ${g.data?.name}` }
        : { naziv: 'Discord server', stanje: 'greska', poruka: `Bot ne vidi server (${g.poruka}). Proveri ID i da li je bot na serveru.` });
    }
    for (const [ime, id, obavezan] of [
      ['Kanal za prijave', DISCORD.prijaveKanalId, true],
      ['Kanal za reportove', DISCORD.reportKanalId, false],
      ['Kanal za novosti', DISCORD.novostiKanalId, false],
    ] as const) {
      if (!id) {
        discord.push({ naziv: ime, stanje: obavezan ? 'upozorenje' : 'upozorenje', poruka: ime === 'Kanal za reportove' ? 'Nije upisan, reportovi idu u kanal za prijave.' : 'Nije upisan, bot ne javlja u kanal.' });
      } else if (ja.ok) {
        const c = await bot<{ name: string }>('GET', `/channels/${id}`);
        discord.push(c.ok
          ? { naziv: ime, stanje: 'ok', poruka: `#${c.data?.name}` }
          : { naziv: ime, stanje: 'greska', poruka: `Bot ne vidi kanal (${c.poruka}). Daj botu pristup kanalu.` });
      }
    }
  }

  const panel: Stavka[] = [
    PANEL.vlasnici.length
      ? { naziv: 'VLASNIK_DISCORD_IDS', stanje: 'ok', poruka: `${PANEL.vlasnici.length} ${PANEL.vlasnici.length === 1 ? 'vlasnik' : 'vlasnika'}` }
      : { naziv: 'VLASNIK_DISCORD_IDS', stanje: 'greska', poruka: 'Nije upisan. Upiši svoj Discord ID da bi ušao u panel.' },
    PANEL.odlukaUloge.length || PANEL.citanjeUloge.length
      ? { naziv: 'PANEL_ROLE_IDS / PANEL_ODLUKA_ROLE_IDS', stanje: 'ok', poruka: `${PANEL.citanjeUloge.length} za čitanje, ${PANEL.odlukaUloge.length} za odluke` }
      : { naziv: 'PANEL_ROLE_IDS / PANEL_ODLUKA_ROLE_IDS', stanje: 'upozorenje', poruka: 'Nije upisano. U panel za sada ulaze samo vlasnici.' },
    TIM.some(t => t.roleId)
      ? { naziv: 'TIM_*_ROLE_ID', stanje: 'ok', poruka: `${TIM.filter(t => t.roleId).length} od ${TIM.length} grupa` }
      : { naziv: 'TIM_*_ROLE_ID', stanje: 'upozorenje', poruka: 'Nije upisano. Strana Tim je prazna.' },
  ];

  const s = await statusServera();
  const igra: Stavka[] = [s.online
    ? { naziv: 'FiveM server', stanje: 'ok', poruka: `Odgovara, ${s.igraca} igrača` }
    : { naziv: 'FiveM server', stanje: 'upozorenje', poruka: 'Ne odgovara. Broj igrača se ne vidi dok je server ugašen.' }];

  return [
    { naslov: 'Login preko Discorda', stavke: login },
    { naslov: 'Baza (prijave, novosti, predlozi)', stavke: [baza] },
    { naslov: 'Discord bot', stavke: discord },
    { naslov: 'Panel i tim', stavke: panel },
    { naslov: 'Grad', stavke: igra },
  ];
}

export default async function Provera() {
  const grupe = await proveri();
  const sajt = adresaSajta();
  const greske = grupe.flatMap(g => g.stavke).filter(s => s.stanje === 'greska').length;

  return (
    <div className="sadrzaj pb-24 pt-[130px] md:pt-[160px]">
      <h1 className="plakat naslov-strane">Provera</h1>
      <p className="uvod mt-5 text-sivo">
        Šta je podešeno u Vercelu, a šta fali. Vrednosti se ne prikazuju, samo da li postoje i da li rade. Posle svake izmene u Vercelu uradi Redeploy.
      </p>
      <p className={`mt-6 inline-flex rounded-full px-4 py-2 text-[15px] font-semibold ${greske ? 'bg-crvena/15 text-[#ff8a8e]' : 'bg-zelena/15 text-zelena'}`}>
        {greske ? `${greske} ${greske === 1 ? 'stvar treba' : 'stvari treba'} popraviti` : 'Sve bitno radi'}
      </p>

      <div className="mt-12 grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-2">
        {grupe.map(g => (
          <section key={g.naslov}>
            <h2 className="text-[20px] font-semibold">{g.naslov}</h2>
            <ul className="mt-4 border-t border-white/12">
              {g.stavke.map(s => (
                <li key={s.naziv} className="flex gap-3 border-b border-white/12 py-3.5">
                  {s.stanje === 'ok' ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-zelena" /> : s.stanje === 'greska' ? <CircleX className="mt-0.5 size-5 shrink-0 text-crvena" /> : <TriangleAlert className="mt-0.5 size-5 shrink-0 text-zlato" />}
                  <div className="min-w-0">
                    <p className="break-words text-[14.5px] font-semibold">{s.naziv}</p>
                    <p className="mt-0.5 break-words text-[14.5px] text-sivo">{s.poruka}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="povrsina mt-14 p-6">
        <h2 className="text-[18px] font-semibold">Redirect URL za Discord</h2>
        <p className="mt-1.5 text-[15px] text-sivo">Ovo mora da stoji u Discord Developer Portalu, pod OAuth2, pa Redirects, slovo po slovo:</p>
        <p className="mt-3 break-all rounded-xl bg-black/40 px-4 py-3 text-[15px]">{sajt}/api/auth/discord</p>
      </section>
    </div>
  );
}
