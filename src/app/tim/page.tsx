import type { Metadata } from 'next';
import Image from 'next/image';
import { TIM, SITE } from '@/config/site';
import { avatarUrl, sviClanovi } from '@/lib/discord';
import { DiscordIkona } from '@/components/ikone';

export const metadata: Metadata = { title: 'Tim', description: 'Ljudi koji vode Flamingo Roleplay.' };
export const revalidate = 600;

export default async function Tim() {
  const grupe = TIM.filter(g => g.roleId);
  const clanovi = grupe.length ? await sviClanovi() : [];
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
    <div className="sadrzaj pb-10 pt-[120px] md:pt-[140px]">
      <header className="max-w-2xl">
        <h1 className="text-[clamp(34px,5vw,56px)] font-bold">Ljudi iza grada</h1>
        <p className="mt-4 text-[17px] text-sivo">
          Staff i developeri Flamingo Roleplaya. Za pitanja piši na Discordu, a za probleme u gradu koristi /report.
        </p>
      </header>

      {popunjeno.length === 0 ? (
        <div className="povrsina mt-12 max-w-xl p-8">
          <h2 className="font-sans text-[19px] font-semibold tracking-normal">Spisak tima se puni sa Discorda</h2>
          <p className="mt-2 text-[15.5px] text-sivo">Uskoro ovde. Do tada nas nađi na Discordu.</p>
          <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-discord mt-6"><DiscordIkona /> Discord</a>
        </div>
      ) : (
        <div className="mt-14 space-y-14">
          {popunjeno.map(g => (
            <section key={g.naziv}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/[.08] pb-4">
                <h2 className="text-[clamp(22px,2.6vw,28px)] font-bold">{g.naziv}</h2>
                <p className="text-[15px] text-sivo">{g.opis}</p>
              </div>
              <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {g.ljudi.map(c => (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-noc-2 p-3">
                    <Image src={c.avatar} alt="" unoptimized width={48} height={48} className="size-12 shrink-0 rounded-full bg-noc-3" />
                    <span className="min-w-0 truncate font-medium">{c.ime}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
