import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';
import { SITE } from '@/config/site';
import { FAQ, TASTERI } from '@/config/grad';
import { KopirajKomandu } from '@/components/KopirajKomandu';
import { DiscordIkona } from '@/components/ikone';
import { ZaglavljeStrane } from '@/components/ZaglavljeStrane';

export const metadata: Metadata = { title: 'Vodič', description: 'Kako da uđeš u Flamingo Roleplay, tasteri i česta pitanja.' };

export default function Vodic() {
  const connect = `fivem://connect/${SITE.server}`;
  const koraci = [
    { naslov: 'Nabavi GTA V', tekst: 'Originalna igra na Steamu, Epicu ili Rockstar launcheru. Bez nje FiveM ne radi.',
      akcija: <a className="dugme dugme-obrub dugme-malo" href="https://store.steampowered.com/app/271590/Grand_Theft_Auto_V/" target="_blank" rel="noopener">GTA V na Steamu <ArrowUpRight className="size-4" /></a> },
    { naslov: 'Instaliraj FiveM', tekst: 'Besplatan program preko kog se igra na serverima. Instalacija traje par minuta, a prvi put skida i fajlove igre.',
      akcija: <a className="dugme dugme-obrub dugme-malo" href="https://fivem.net/" target="_blank" rel="noopener">Preuzmi FiveM <ArrowUpRight className="size-4" /></a> },
    { naslov: 'Uđi na Discord', tekst: 'Tu izlaze novosti, eventi i obaveštenja, a staff odgovara na pitanja.',
      akcija: <a className="dugme dugme-discord dugme-malo" href={SITE.discord} target="_blank" rel="noopener"><DiscordIkona className="size-4" /> Discord</a> },
    { naslov: 'Pročitaj pravila', tekst: 'Pet minuta čitanja štedi te kazne. Staff se u gradu poziva na pravila po broju.',
      akcija: <Link className="dugme dugme-obrub dugme-malo" href="/pravila">Pravila</Link> },
    { naslov: 'Uđi u grad', tekst: 'Klikni dugme ili otvori FiveM, pritisni F8 i nalepi komandu.',
      akcija: <span className="flex flex-wrap items-center gap-3"><a className="dugme dugme-glavno dugme-malo" href={connect}>Uđi u grad</a><KopirajKomandu server={SITE.server} svetlo /></span> },
    { naslov: 'Prvi dan', tekst: 'Napravi lika i nađi posao. Svaki posao ima svog poslodavca na mapi, a uz rad raste i stablo veština.',
      akcija: <Link className="dugme dugme-obrub dugme-malo" href="/#poslovi">Pogledaj poslove</Link> },
  ];

  return (
    <>
      <ZaglavljeStrane naslov="Vodič" slika="/img/hero.webp" pozicija="48% 30%">
        Sve što ti treba za prvi ulazak u Flamingo City: šta da instaliraš, koji tasteri šta rade i odgovori na pitanja koja svi postave prvog dana.
      </ZaglavljeStrane>

      <section className="svetlo py-20 md:py-28">
        <div className="sadrzaj">
          <h2 className="plakat naslov-sekcije">Od nule do grada</h2>
          <ol className="mt-14 grid grid-cols-1 gap-x-12 md:grid-cols-2">
            {koraci.map((k, i) => (
              <li key={k.naslov} className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-4 border-t border-mastilo/15 py-8 md:grid-cols-[80px_minmax(0,1fr)]">
                <span className="plakat text-[48px] leading-[.9] text-flamingo tabular-nums md:text-[56px]">{i + 1}</span>
                <div>
                  <h3 className="text-[21px] font-semibold">{k.naslov}</h3>
                  <p className="mt-1.5 max-w-[46ch] text-[15.5px] text-mastilo/70">{k.tekst}</p>
                  <div className="mt-4">{k.akcija}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sadrzaj py-20 md:py-28">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <h2 className="plakat naslov-sekcije">Tasteri</h2>
          <p className="uvod text-sivo md:justify-self-end">Najvažniji tasteri u gradu. Ostale ti pokažu meniji i natpisi na ekranu.</p>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TASTERI.map(t => (
            <li key={t.taster} className="flex items-center gap-4 rounded-2xl bg-noc-2 p-4">
              <kbd className="grid h-14 min-w-14 shrink-0 place-items-center rounded-xl border border-white/20 border-b-[4px] bg-noc-3 px-3 font-display text-[26px] font-extrabold leading-none text-tekst">{t.taster}</kbd>
              <span className="text-[15px] leading-snug text-tekst/90">{t.sta}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="sadrzaj pb-24 md:pb-32">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-16">
          <div className="lg:sticky lg:top-[110px] lg:self-start">
            <h2 className="plakat naslov-sekcije">Česta pitanja</h2>
            <p className="mt-5 max-w-[40ch] text-[16px] text-sivo">Nema tvog pitanja? Piši na Discordu ili u gradu otvori meni na M, pa Pomoć.</p>
            <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-discord mt-6"><DiscordIkona /> Pitaj na Discordu</a>
          </div>
          <div className="border-t border-white/12">
            {FAQ.map(f => (
              <details key={f.p} className="group border-b border-white/12">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[17.5px] font-semibold [&::-webkit-details-marker]:hidden">
                  {f.p}
                  <Plus className="size-5 shrink-0 text-flamingo-2 transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="max-w-[62ch] pb-6 text-[16px] text-sivo">{f.o}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
