import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Play, Ticket } from 'lucide-react';
import { SITE } from '@/config/site';
import { PRIJAVE } from '@/config/prijave';
import {
  AUKCIJA_SAT, BANDE, BANDE_TEKST, BIZNISI, EVENTI, EVENTI_PRAVILA, JOS, KUCE, ORGANIZACIJE, POSLOVI, PRICA,
} from '@/config/grad';
import { kategorijaNovosti } from '@/config/zajednica';
import { statusServera } from '@/lib/status';
import { poslednjeNovosti } from '@/lib/novosti';
import { datum } from '@/lib/format';
import { KopirajKomandu } from '@/components/KopirajKomandu';
import { DiscordIkona, SistemIkona } from '@/components/ikone';
import { Traka } from '@/components/Traka';

export const revalidate = 30;

const novac = (n: number) => `${n.toLocaleString('sr-RS')}$`;

export default async function Pocetna() {
  const [status, novosti] = await Promise.all([statusServera(), poslednjeNovosti(3)]);
  const connect = `fivem://connect/${SITE.server}`;
  const otvorene = PRIJAVE.filter(p => p.otvorena && p.grupa !== 'report');

  return (
    <>
      {/* ================= HERO: filmsko otvaranje ================= */}
      <section className="zrno relative isolate h-[100svh] min-h-[660px] overflow-hidden bg-black">
        <div className="ken-burns absolute inset-0 -z-20">
          <Image src="/img/hero.webp" alt="Ljudi iz Flamingo grada na zalasku sunca, iznad grada leti helikopter" fill priority sizes="100vw"
            className="object-cover object-[62%_22%]" />
        </div>
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(0_0_0/.78)_0%,rgb(0_0_0/.38)_45%,rgb(0_0_0/0)_75%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,rgb(0_0_0/.85)_0%,rgb(0_0_0/0)_42%)]" />

        <div className="letterbox-gore" aria-hidden="true" />
        <div className="letterbox-dole h-[132px] sm:h-[96px]">
          <div className="sadrzaj pojava flex h-full flex-col justify-center gap-3 [animation-delay:1.5s] sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2.5 text-[14.5px] text-sivo" role="status">
              {status.online ? (
                <><span className="tacka-uzivo" /><span><b className="font-semibold text-tekst tabular-nums">{status.igraca}</b>{status.max > 0 && <> od {status.max}</>} igrača je sada u gradu</span></>
              ) : (
                <><span className="size-2 shrink-0 rounded-full bg-sivo-2" /><span>Server je trenutno ugašen. Novosti su na Discordu.</span></>
              )}
            </p>
            <div className="flex items-center gap-3">
              <span className="hidden text-[13.5px] text-sivo-2 md:inline">F8 u FiveM-u:</span>
              <KopirajKomandu server={SITE.server} />
            </div>
          </div>
        </div>

        <div className="sadrzaj absolute inset-x-0 bottom-[156px] sm:bottom-[128px]">
          <h1 className="plakat text-[clamp(88px,17vw,248px)] leading-[.8]">
            <span className="block -mt-[.16em] overflow-hidden pb-[.04em] pt-[.16em]"><span className="uzlet [animation-delay:1.05s]">Flamingo</span></span>
            <span className="block -mt-[.16em] overflow-hidden pb-[.04em] pt-[.16em]"><span className="uzlet [animation-delay:1.2s]">Roleplay</span></span>
          </h1>
          <div className="pojava mt-6 flex flex-col gap-6 [animation-delay:1.55s] md:flex-row md:items-end md:justify-between">
            <p className="max-w-[34ch] text-[clamp(17px,1.6vw,20px)] leading-snug text-white/90">
              Tvoja priča počinje ovde, u gradu gde svaka odluka menja tvoj život.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={connect} className="dugme dugme-glavno"><Play className="size-[18px] fill-current" /> Uđi u grad</a>
              <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-obicno backdrop-blur-sm"><DiscordIkona /> Discord</a>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TVOJA PRIČA: četiri scene ================= */}
      <section className="sadrzaj py-24 md:py-36">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <h2 className="plakat naslov-sekcije otkrij-tekst">Jedan grad,<br />četiri scene</h2>
          <p className="uvod otkrij-tekst text-sivo md:justify-self-end">
            Od prvog posla do sopstvene vile i mesta u organizaciji. Redosled biraš ti, a grad pamti svaki potez.
          </p>
        </div>
        <ol className="mt-14 grid grid-cols-1 gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {PRICA.map((s, i) => (
            <li key={s.naslov}>
              <div className="otkrij relative aspect-[4/5] overflow-hidden rounded-md bg-noc-3" style={{ transitionDelay: `${i * 120}ms` }}>
                <Image src={s.slika} alt="" fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 300px" className="object-cover"
                  style={{ objectPosition: s.pozicija }} />
              </div>
              <p className="mt-5 text-[14px] font-medium text-flamingo-2">Scena {i + 1}</p>
              <h3 className="mt-1 text-[22px] font-semibold">{s.naslov}</h3>
              <p className="mt-2 text-[15.5px] text-sivo">{s.tekst}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ================= POSLOVI: filmska traka ================= */}
      <section id="poslovi" className="scroll-mt-24 pb-24 md:pb-36">
        <Traka oznaka="Poslovi" zaglavlje={
          <div className="max-w-2xl">
            <h2 className="plakat naslov-sekcije otkrij-tekst">Posao od prvog dana</h2>
            <p className="uvod otkrij-tekst mt-5 text-sivo">Osam legalnih poslova. Svaki ima svoje stablo veština, opremu i otkup gde prodaješ ono što zaradiš.</p>
          </div>
        }>
          <ul className="flex w-max snap-x snap-mandatory gap-5 px-4 sm:px-6 lg:px-[max(40px,calc((100vw-1280px)/2+40px))]">
            {POSLOVI.map(p => (
              <li key={p.slika} className="group w-[84vw] max-w-[460px] shrink-0 snap-start">
                <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-noc-3">
                  <Image src={`/img/poslovi/${p.slika}.webp`} alt="" fill sizes="(max-width:768px) 84vw, 460px"
                    className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-izlaz)] group-hover:scale-[1.06]" />
                  <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(0_0_0/.7),rgb(0_0_0/0)_55%)]" />
                  <h3 className="plakat absolute bottom-4 left-5 text-[52px]">{p.naziv}</h3>
                </div>
                <p className="mt-4 max-w-[46ch] text-[15.5px] text-sivo">{p.opis}</p>
              </li>
            ))}
          </ul>
        </Traka>
      </section>

      {/* ================= DRŽAVA: organizacije (svetlo) ================= */}
      <section className="svetlo py-24 md:py-36">
        <div className="sadrzaj">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
            <h2 className="plakat naslov-sekcije otkrij-tekst">Uniforma</h2>
            <p className="uvod otkrij-tekst text-mastilo/70 md:justify-self-end">
              Sedam organizacija koje drže grad na okupu. Prijave za posao i za mesto vođe idu preko sajta.
            </p>
          </div>
          <ul className="mt-14 grid border-t border-mastilo/15 sm:grid-cols-2 lg:grid-cols-3">
            {ORGANIZACIJE.map(o => (
              <li key={o.naziv} className="flex gap-4 border-b border-mastilo/15 py-7 sm:pr-8">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-mastilo text-pesak">
                  <SistemIkona ime={o.ikona} className="size-[22px]" />
                </span>
                <div>
                  <h3 className="text-[20px] font-semibold">{o.naziv}</h3>
                  <p className="mt-1 text-[15.5px] text-mastilo/70">{o.opis}</p>
                </div>
              </li>
            ))}
            <li className="flex items-center border-b border-mastilo/15 py-7">
              <Link href="/prijave/posao" className="dugme dugme-tamno">Prijavi se za posao <ArrowUpRight className="size-4" /></Link>
            </li>
          </ul>
        </div>
      </section>

      {/* ================= ULICA: pet bandi ================= */}
      <section className="bg-black py-24 md:py-36">
        <div className="sadrzaj">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
            <h2 className="plakat naslov-sekcije otkrij-tekst">Ulica</h2>
            <p className="uvod otkrij-tekst text-sivo md:justify-self-end">
              Pet bandi, jedan hood. Svaka ulica u južnom Los Santosu nekome pripada, a granice se pomeraju samo u ratu.
            </p>
          </div>
          <ul className="otkrij mt-14 flex h-[460px] flex-col gap-1.5 md:h-[440px] md:flex-row" aria-label="Bande">
            {BANDE.map(b => (
              <li key={b.naziv} tabIndex={0} aria-label={b.puno}
                className="group relative flex min-h-0 flex-1 cursor-default items-end overflow-hidden rounded-md p-4 outline-none transition-[flex-grow] duration-700 ease-[var(--ease-film)] hover:flex-[2.4] focus-visible:flex-[2.4] md:p-5"
                style={{ background: b.boja }}>
                <span className="plakat text-[clamp(44px,5vw,76px)] text-black/85 md:[writing-mode:vertical-rl] md:rotate-180">{b.naziv}</span>
                <span className="absolute right-4 top-4 text-[13px] font-semibold text-black/70 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100">{b.puno}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {BANDE_TEKST.map(t => (
              <li key={t.naslov} className="border-t border-white/15 pt-5">
                <h3 className="text-[19px] font-semibold">{t.naslov}</h3>
                <p className="mt-2 text-[15.5px] text-sivo">{t.tekst}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= REPERTOAR: eventi ================= */}
      <section className="sadrzaj py-24 md:py-36">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="lg:sticky lg:top-[120px] lg:self-start">
            <h2 className="plakat naslov-sekcije otkrij-tekst">Repertoar</h2>
            <p className="uvod otkrij-tekst mt-5 text-sivo">Eventi se pokreću sami, bez čekanja na admina. Obaveštenje stiže u gradu, a prijava ide preko telefona.</p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {EVENTI_PRAVILA.map(p => (
                <li key={p} className="inline-flex items-center gap-2 rounded-full border border-zlato/35 px-3.5 py-1.5 text-[14px] text-zlato">
                  <Ticket className="size-4" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <ul className="border-t border-white/12">
            {EVENTI.map(e => (
              <li key={e.naziv} className="group grid gap-1 border-b border-white/12 py-6 sm:grid-cols-[minmax(0,240px)_minmax(0,1fr)] sm:items-center sm:gap-8">
                <h3 className="plakat text-[56px] transition-colors duration-300 group-hover:text-flamingo">{e.naziv}</h3>
                <p className="text-[16px] text-sivo">{e.opis}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ================= IMOVINA: kuće, biznisi, aukcija ================= */}
      <section className="pb-24 md:pb-36">
        <div className="otkrij relative h-[70vh] min-h-[440px] overflow-hidden">
          <Image src="/img/zivot.webp" alt="Veče na bazenu vile iznad grada, helikopter na krovu" fill sizes="100vw" className="object-cover object-[35%_50%]" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,rgb(0_0_0/.55),rgb(0_0_0/0)_50%)]" />
          <div className="sadrzaj absolute inset-x-0 bottom-10 text-center">
            <p className="mx-auto max-w-[40ch] text-[clamp(18px,2vw,24px)] font-medium">
              <span className="titl">Kuće i biznisi se dobijaju samo na aukciji.</span>
              <br />
              <span className="titl">Aukcija se zatvara svako veče u {AUKCIJA_SAT}.</span>
            </p>
          </div>
        </div>

        <div className="sadrzaj mt-20 grid gap-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div>
            <h2 className="plakat naslov-manji otkrij-tekst">Kuće</h2>
            <p className="mt-4 max-w-[52ch] text-[16px] text-sivo">Svaka kuća dodaje mesta u garaži na tvojih 10. Plaća se dnevno, najviše 14 dana unapred. Kuća koja se ne plati vraća se državi i ide na aukciju.</p>
            <table className="mt-8 w-full text-left text-[15px]">
              <thead className="text-[13.5px] text-sivo-2">
                <tr className="border-b border-white/12">
                  <th className="py-3 font-medium">Kuća</th>
                  <th className="py-3 font-medium">Garaža</th>
                  <th className="py-3 text-right font-medium">Dnevno</th>
                </tr>
              </thead>
              <tbody>
                {KUCE.map(k => (
                  <tr key={k.naziv} className="border-b border-white/[.08]">
                    <td className="py-3.5 pr-4 font-medium">{k.naziv}</td>
                    <td className="py-3.5 pr-4">
                      <span className="flex items-center gap-3">
                        <span className="hidden gap-[3px] sm:flex" aria-hidden="true">
                          {Array.from({ length: 15 }, (_, i) => (
                            <span key={i} className={`h-3.5 w-2 rounded-[2px] ${i < k.garaza ? 'bg-flamingo' : 'bg-white/10'}`} />
                          ))}
                        </span>
                        <span className="tabular-nums text-sivo">+{k.garaza}</span>
                      </span>
                    </td>
                    <td className="py-3.5 text-right tabular-nums">{novac(k.dnevno)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h2 className="plakat naslov-manji otkrij-tekst">Biznisi</h2>
            <p className="mt-4 max-w-[52ch] text-[16px] text-sivo">Vlasnik zarađuje od svake kupovine. Robu za markete, pumpe i oružarnice dovoze kamiondžije, a biznis se plaća 10.000$ dnevno.</p>
            <ul className="mt-8 flex flex-wrap gap-2">
              {BIZNISI.map(b => (
                <li key={b} className="rounded-full bg-white/[.07] px-4 py-2 text-[14.5px]">{b}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ================= JOŠ U GRADU ================= */}
      <section className="sadrzaj pb-24 md:pb-36">
        <h2 className="plakat naslov-sekcije otkrij-tekst">Još u gradu</h2>
        <ul className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {JOS.map(j => (
            <li key={j.naslov} className="border-t border-white/15 pt-6">
              <SistemIkona ime={j.ikona} className="size-7 text-flamingo-2" />
              <h3 className="mt-4 text-[20px] font-semibold">{j.naslov}</h3>
              <p className="mt-2 text-[15.5px] text-sivo">{j.tekst}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ================= PRIJAVE I NOVOSTI (svetlo) ================= */}
      <section className="svetlo py-24 md:py-32">
        <div className="sadrzaj grid grid-cols-1 gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h2 className="plakat naslov-manji">Grad traži ljude</h2>
            <p className="mt-4 max-w-[48ch] text-[16.5px] text-mastilo/70">Prijaviš se Discordom, popuniš formular i odluku dobiješ u poruci. Status uvek vidiš na sajtu.</p>
            <ul className="mt-8 border-t border-mastilo/15">
              {otvorene.map(p => (
                <li key={p.id}>
                  <Link href={`/prijave/${p.id}`} className="group flex items-center gap-4 border-b border-mastilo/15 py-4">
                    <span className="min-w-0">
                      <span className="block text-[17px] font-semibold">{p.naziv}</span>
                      <span className="block truncate text-[14.5px] text-mastilo/65">{p.kratko}</span>
                    </span>
                    <ArrowUpRight className="ml-auto size-5 shrink-0 text-mastilo/40 transition-[color,transform] group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-flamingo-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-end justify-between gap-4">
              <h2 className="plakat naslov-manji">Novosti</h2>
              <Link href="/novosti" className="text-[15px] font-medium text-mastilo/70 underline-offset-4 hover:text-mastilo hover:underline">Sve novosti</Link>
            </div>
            {novosti.length ? (
              <ul className="mt-8 border-t border-mastilo/15">
                {novosti.map(n => {
                  const k = kategorijaNovosti(n.kategorija);
                  return (
                    <li key={n.id}>
                      <Link href={`/novosti/${n.id}`} className="group block border-b border-mastilo/15 py-5">
                        <p className="flex items-center gap-2 text-[13.5px] text-mastilo/60">
                          <span className="size-2 rounded-full" style={{ background: k.boja }} />{k.naziv}, {datum(n.napravljena)}
                        </p>
                        <h3 className="mt-1.5 text-[19px] font-semibold group-hover:text-flamingo-3">{n.naslov}</h3>
                        <p className="mt-1 line-clamp-2 text-[15px] text-mastilo/70">{n.kratko}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="mt-8 border-t border-mastilo/15 pt-6">
                <p className="max-w-[44ch] text-[16px] text-mastilo/70">Update-i, eventi i obaveštenja izlaze prvo na Discordu. Uđi da ti ništa ne promakne.</p>
                <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-discord mt-6"><DiscordIkona /> Pridruži se Discordu</a>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= KRAJ: odjavna scena ================= */}
      <section id="ulaz" className="relative isolate scroll-mt-20 overflow-hidden bg-black py-28 md:py-40">
        <Image src="/img/poslovi/taksista.webp" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-60" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,#000_0%,rgb(0_0_0/.35)_45%,rgb(0_0_0/.55)_75%,#000_100%)]" />
        <div className="sadrzaj text-center">
          <h2 className="plakat text-[clamp(64px,12vw,176px)] otkrij-tekst">Vidimo se u gradu</h2>
          <p className="mx-auto mt-6 max-w-[46ch] text-[17px] text-white/85">
            Treba ti originalna GTA V i besplatan FiveM. Ako dugme ne radi, otvori FiveM, pritisni F8 i nalepi komandu.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a href={connect} className="dugme dugme-glavno"><Play className="size-[18px] fill-current" /> Uđi u grad</a>
            <Link href="/vodic" className="dugme dugme-obicno">Vodič za nove igrače</Link>
          </div>
          <div className="mt-6 flex justify-center"><KopirajKomandu server={SITE.server} /></div>
        </div>
      </section>
    </>
  );
}
