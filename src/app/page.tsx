import Image from 'next/image';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { SITE } from '@/config/site';
import { statusServera } from '@/lib/status';
import { KopirajKomandu } from '@/components/KopirajKomandu';
import { DiscordIkona, TikTokIkona } from '@/components/ikone';

export const revalidate = 30;

// Naslovna je jedan ekran: naslov, broj igrača, dugmad i komanda za F8.
// Sve ostalo je u meniju gore, svako na svojoj strani.
export default async function Pocetna() {
  const status = await statusServera();
  const connect = `fivem://connect/${SITE.server}`;
  const popunjeno = status.max > 0 ? Math.min(100, Math.round((status.igraca / status.max) * 100)) : 0;

  return (
    <section className="zrno relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-black">
      <div className="ken-burns absolute inset-0 -z-20">
        <Image src="/img/hero-noc.webp" alt="Noć iznad Flamingo grada, auto i ekipa na terasi vile" fill priority sizes="100vw"
          className="object-cover object-[30%_50%] md:object-[45%_50%]" />
      </div>
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(11_10_13/.94)_0%,rgb(11_10_13/.72)_32%,rgb(11_10_13/.12)_68%,rgb(11_10_13/0)_100%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(11_10_13/.95)_0%,rgb(11_10_13/0)_38%),linear-gradient(180deg,rgb(11_10_13/.7)_0%,rgb(11_10_13/0)_18%)]" />

      <div className="sadrzaj relative flex flex-1 flex-col justify-center pb-10 pt-[120px]">
        <p className="pojava inline-flex w-fit items-center gap-2.5 rounded-full border border-white/12 bg-black/40 px-4 py-2 text-[13.5px] font-semibold backdrop-blur-md [animation-delay:.2s]" role="status">
          {status.online ? (
            <><span className="tacka-uzivo" /><span><b className="font-extrabold tabular-nums">{status.igraca}</b>{status.max > 0 && <> od {status.max}</>} igrača je sada u gradu</span></>
          ) : (
            <><span className="size-2 rounded-full bg-sivo-2" /><span className="text-tekst/85">Server je trenutno ugašen</span></>
          )}
        </p>

        <h1 className="plakat mt-7 text-[clamp(58px,10.5vw,156px)] leading-[.9]">
          <span className="block overflow-hidden pt-[.06em]"><span className="uzlet [animation-delay:.35s]">Flamingo</span></span>
          <span className="block overflow-hidden pb-[.04em]"><span className="uzlet text-flamingo [animation-delay:.5s]">Roleplay</span></span>
        </h1>

        <p className="pojava mt-7 max-w-[30ch] text-[clamp(17px,1.5vw,21px)] font-medium leading-snug text-white/85 [animation-delay:.75s]">
          Tvoja priča počinje ovde, u gradu gde svaka odluka menja tvoj život.
        </p>

        <div className="pojava mt-9 flex flex-wrap gap-3 [animation-delay:.9s]">
          <a href={connect} className="dugme dugme-glavno"><Play className="size-[18px] fill-current" /> Počni da igraš</a>
          <Link href="/vodic" className="dugme dugme-obicno backdrop-blur-md">Vodič za nove</Link>
        </div>

        <div className="pojava mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 [animation-delay:1.05s]">
          <span className="text-[13.5px] text-white/60">Dugme ne radi? Otvori FiveM, pritisni F8 i nalepi:</span>
          <KopirajKomandu server={SITE.server} />
        </div>
      </div>

      {/* desno dole: server i Discord (samo na većim ekranima) */}
      <div className="pojava pointer-events-none absolute bottom-24 right-0 hidden w-full lg:block [animation-delay:1.2s]">
        <div className="sadrzaj flex justify-end">
          <div className="pointer-events-auto w-[320px] rounded-[22px] border border-white/10 bg-black/45 p-5 backdrop-blur-xl">
            <p className="oznaka text-flamingo-2">{SITE.grad}</p>
            {status.online ? (
              <>
                <p className="mt-2 text-[30px] font-black leading-none tabular-nums">{status.igraca}<span className="text-[15px] font-bold text-white/55"> / {status.max} igrača</span></p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-flamingo" style={{ width: `${Math.max(popunjeno, 3)}%` }} /></div>
              </>
            ) : (
              <p className="mt-2 text-[15px] font-semibold text-white/75">Server je ugašen. Novosti o otvaranju su na Discordu.</p>
            )}
            <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-discord dugme-malo mt-4 w-full"><DiscordIkona className="size-[18px]" /> Uđi na Discord</a>
          </div>
        </div>
      </div>

      <div className="sadrzaj relative pb-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-[13px] font-semibold text-white/55">
          <span className="mr-auto">© {new Date().getFullYear()} {SITE.ime}</span>
          <Link href="/pravila" className="hover:text-white">Pravila</Link>
          <a href={SITE.discord} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-white"><DiscordIkona className="size-4" /> Discord</a>
          <a href={SITE.tiktok} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-white"><TikTokIkona className="size-4" /> TikTok</a>
        </div>
      </div>
    </section>
  );
}
