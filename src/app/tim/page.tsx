import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { TIM, SITE } from '@/config/site';
import { avatarUrl, sviClanovi } from '@/lib/discord';
import { DiscordIkona } from '@/components/ikone';

export const metadata: Metadata = { title: 'Tim', description: 'Ljudi koji vode Flamingo Roleplay.' };
export const revalidate = 600;

export default async function Tim() {
  const grupe = TIM.filter(g => g.roleId);
  const clanovi = grupe.length ? await sviClanovi().catch(() => []) : [];
  const vidjeni = new Set<string>();

  // svako se prikazuje samo u svojoj najvišoj grupi
  const popunjeno = grupe.map(g => {
    const ljudi = clanovi
      .filter(c => !c.user.bot && c.roles.includes(g.roleId) && !vidjeni.has(c.user.id))
      .map(c => {
        vidjeni.add(c.user.id);
        return {
          id: c.user.id,
          ime: c.nick || c.user.global_name || c.user.username,
          avatar: c.avatar ? `https://cdn.discordapp.com/guilds/${process.env.DISCORD_GUILD_ID}/users/${c.user.id}/avatars/${c.avatar}.png?size=128` : avatarUrl(c.user),
        };
      })
      .sort((a, b) => a.ime.localeCompare(b.ime, 'sr'));
    return { ...g, ljudi };
  }).filter(g => g.ljudi.length);

  return (
    <div className="zrno relative isolate min-h-screen overflow-hidden bg-black">
      <div className="sadrzaj pb-28 pt-[150px] text-center md:pt-[190px]">
        <p className="pojava text-[15px] text-sivo">{SITE.ime} predstavlja</p>
        <h1 className="plakat naslov-strane mt-2 overflow-hidden pb-[.04em] pt-[.16em]"><span className="uzlet [animation-delay:.15s]">Ljudi iza grada</span></h1>
        <p className="pojava mx-auto mt-6 max-w-[48ch] text-[17px] text-white/80 [animation-delay:.4s]">
          Staff i developeri Flamingo Roleplaya. Za pitanja piši na Discordu, a za probleme u gradu koristi report.
        </p>

        {popunjeno.length === 0 ? (
          <div className="mx-auto mt-20 max-w-md">
            <p className="text-[17px] text-sivo">Spisak tima se puni sa Discorda čim se podese uloge.</p>
            <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-discord mt-6"><DiscordIkona /> Upoznaj nas na Discordu</a>
          </div>
        ) : (
          <div className="mt-24 space-y-24">
            {popunjeno.map(g => (
              <section key={g.naziv} className="otkrij-tekst">
                <h2 className="text-[15px] font-medium text-flamingo-2">{g.naziv}</h2>
                <p className="mx-auto mt-1 max-w-[44ch] text-[14.5px] text-sivo-2">{g.opis}</p>
                <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-10 gap-y-6">
                  {g.ljudi.map(c => (
                    <li key={c.id} className="flex items-center gap-3">
                      <Image src={c.avatar} alt="" unoptimized width={44} height={44} className="size-11 shrink-0 rounded-full bg-noc-3 grayscale transition-[filter] duration-500 hover:grayscale-0" />
                      <span className="plakat text-[clamp(20px,2.2vw,28px)]">{c.ime}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="mt-32">
          <p className="text-[15px] text-sivo">I ti možeš biti ovde.</p>
          <Link href="/prijave" className="dugme dugme-obicno mt-5">Prijavi se za staff</Link>
        </div>
      </div>
    </div>
  );
}
