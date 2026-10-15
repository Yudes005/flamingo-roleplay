import Image from 'next/image';
import Link from 'next/link';
import { Download, Gamepad2, Play } from 'lucide-react';
import { SITE } from '@/config/site';
import { PRIJAVE } from '@/config/prijave';
import { statusServera } from '@/lib/status';
import { GradskaTabla } from '@/components/GradskaTabla';
import { KopirajKomandu } from '@/components/KopirajKomandu';
import { DiscordIkona } from '@/components/ikone';
import { TrakaPoslova } from '@/components/TrakaPoslova';

export const revalidate = 30;

const POSLOVI = [
  { slika: 'ribar', naziv: 'Ribar', opis: 'Jezero za početak, otvoreno more kad skupiš iskustvo. Od grgeča do morskog psa.' },
  { slika: 'farmer', naziv: 'Farmer', opis: 'Seješ, zalivaš i bereš na njivi i u voćnjaku, a rod prodaješ na pijaci.' },
  { slika: 'drvoseca', naziv: 'Drvoseča', opis: 'Sečeš stabla u šumi i nosiš trupce. Što više sečeš, to veći nivo.' },
  { slika: 'rudar', naziv: 'Rudar', opis: 'Kamenolom pa rudnik. Ugalj, bakar, zlato i, ako imaš sreće, dijamant.' },
  { slika: 'taksista', naziv: 'Taksista', opis: 'Voziš ljude po gradu. VIP vožnje nose najviše.' },
  { slika: 'autobus', naziv: 'Vozač autobusa', opis: 'Gradske i međugradske linije po redu vožnje.' },
  { slika: 'elektricar', naziv: 'Električar', opis: 'Kvarovi po gradu i smene u elektrani.' },
  { slika: 'smetlar', naziv: 'Smetlar', opis: 'Čistiš grad i industrijsku zonu. Sve što pokupiš ide na reciklažu.' },
];

const GRAD = [
  { naziv: 'Battle pass', opis: 'Svake sezone novi nivoi i nagrade, od novca do vozila.' },
  { naziv: 'Invite kutija', opis: 'Dovedi 5 prijatelja na Discord i otvori kutiju u kojoj je i Übermacht Rex10.' },
  { naziv: 'Organizacije', opis: 'Policija, bolnica i mehaničari traže ljude, i u gradu i preko prijava.' },
  { naziv: 'Bande i familije', opis: 'Stablo kriminalca, nivoi bande i pljačke uz pravila koja daju šansu i policiji.' },
  { naziv: 'Kazino', opis: 'Rulet, blackjack i točak sreće za one koji vole rizik.' },
];

export default async function Pocetna() {
  const status = await statusServera();
  const connect = `fivem://connect/${SITE.server}`;
  const otvorene = PRIJAVE.filter(p => p.otvorena && p.id !== 'zalba');

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative isolate min-h-[100svh] overflow-hidden pt-[68px]">
        <Image src="/img/hero.webp" alt="Ljudi iz Flamingo grada na zalasku sunca" fill priority sizes="100vw"
          className="-z-20 object-cover object-[50%_20%]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(21_13_28/.92)_0%,rgb(21_13_28/.55)_42%,rgb(21_13_28/.15)_70%,rgb(21_13_28/.35)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,var(--color-noc)_2%,rgb(21_13_28/0)_45%)]" />

        <div className="sadrzaj grid min-h-[calc(100svh-68px)] grid-cols-[minmax(0,1fr)] items-end gap-12 pb-14 pt-24 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center lg:pb-20">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-display font-extrabold leading-[.86] tracking-[-0.045em]">
              <span className="block text-[min(14.5vw,122px)] lg:text-[min(calc((100vw-470px)/6.1),122px)]">Flamingo</span>
              <span className="mt-2 block text-[min(7vw,52px)] font-semibold tracking-[-0.03em] text-flamingo-2">Roleplay</span>
            </h1>
            <p className="mt-7 max-w-md text-[18px] leading-relaxed text-tekst/85">
              Tvoja priča počinje ovde, u gradu gde svaka odluka menja tvoj život.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={connect} className="dugme dugme-glavno"><Play className="size-[18px] fill-current" /> Uđi u grad</a>
              <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-obicno"><DiscordIkona /> Pridruži se Discordu</a>
            </div>
            <p className="mt-6 max-w-md text-[14px] text-sivo">Dugme ne radi? Otvori FiveM, pritisni F8 i upiši:</p>
            <div className="mt-2 max-w-md"><KopirajKomandu server={SITE.server} svetlo /></div>
          </div>
          <GradskaTabla status={status} />
        </div>
      </section>

      {/* ---------------- KAKO DA UĐEŠ ---------------- */}
      <section id="ulaz" className="sadrzaj scroll-mt-24 py-20 md:py-28">
        <div className="max-w-xl">
          <h2 className="text-[clamp(28px,4vw,44px)] font-bold">Do grada u tri koraka</h2>
          <p className="mt-4 text-[17px] text-sivo">Treba ti originalna GTA V i besplatan FiveM. Ostatak je jedan klik.</p>
        </div>
        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden="true" className="absolute left-0 right-0 top-[22px] hidden border-t-2 border-dashed border-white/12 md:block" />
          {[
            { ikona: Gamepad2, naslov: 'Nabavi GTA V', tekst: 'Originalna igra na Steamu, Epicu ili Rockstar launcheru. Bez nje FiveM ne radi.',
              dugme: <a className="dugme dugme-obicno" href="https://store.steampowered.com/app/271590/Grand_Theft_Auto_V/" target="_blank" rel="noopener">GTA V na Steamu</a> },
            { ikona: Download, naslov: 'Instaliraj FiveM', tekst: 'Besplatan program preko kog se igra na serverima. Instalacija traje par minuta.',
              dugme: <a className="dugme dugme-obicno" href="https://fivem.net/" target="_blank" rel="noopener">Preuzmi FiveM</a> },
            { ikona: Play, naslov: 'Uđi u grad', tekst: 'Klikni dugme ispod. Prvi put praviš lika i kreće tvoja priča u gradu.',
              dugme: <a className="dugme dugme-glavno" href={connect}>Uđi u grad</a> },
          ].map((k, i) => (
            <li key={k.naslov} className="relative">
              <span className="relative z-10 grid size-11 place-items-center rounded-full bg-flamingo font-display text-[17px] font-bold">{i + 1}</span>
              <h3 className="mt-5 text-[21px] font-semibold">{k.naslov}</h3>
              <p className="mt-2 max-w-xs text-[15.5px] text-sivo">{k.tekst}</p>
              <div className="mt-5">{k.dugme}</div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- POSLOVI ---------------- */}
      <section className="py-16 md:py-24">
        <TrakaPoslova>
          <ul className="flex w-max snap-x snap-mandatory gap-5 px-5 md:px-[max(32px,calc((100vw-1200px)/2+32px))]">
            {POSLOVI.map(p => (
              <li key={p.slika} className="w-[78vw] max-w-[380px] shrink-0 snap-start">
                <div className="relative aspect-[1200/484] overflow-hidden rounded-2xl bg-noc-3">
                  <Image src={`/img/poslovi/${p.slika}.webp`} alt="" fill sizes="(max-width:768px) 78vw, 380px" className="object-cover" />
                </div>
                <h3 className="mt-4 font-sans text-[19px] font-semibold tracking-normal">{p.naziv}</h3>
                <p className="mt-1 text-[15px] text-sivo">{p.opis}</p>
              </li>
            ))}
          </ul>
        </TrakaPoslova>
      </section>

      {/* ---------------- GRAD POSLE POSLA ---------------- */}
      <section className="sadrzaj grid grid-cols-[minmax(0,1fr)] items-center gap-12 py-16 md:py-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl lg:aspect-[5/4]">
          <Image src="/img/zivot.webp" alt="Veče na bazenu iznad grada" fill sizes="(max-width:1024px) 100vw, 640px" className="object-cover" />
        </div>
        <div>
          <h2 className="text-[clamp(28px,4vw,44px)] font-bold">Grad posle posla</h2>
          <ul className="mt-8 divide-y divide-white/[.08] border-y border-white/[.08]">
            {GRAD.map(g => (
              <li key={g.naziv} className="grid gap-1 py-4 sm:grid-cols-[170px_1fr] sm:gap-6">
                <span className="font-semibold">{g.naziv}</span>
                <span className="text-[15.5px] text-sivo">{g.opis}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- PRIJAVE ---------------- */}
      <section className="sadrzaj py-16 md:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-noc-2 px-6 py-12 md:px-14 md:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-flamingo/25 blur-3xl" />
          <div className="relative grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <h2 className="text-[clamp(28px,4vw,44px)] font-bold">Grad traži ljude</h2>
              <p className="mt-4 max-w-md text-[17px] text-sivo">
                Prijave za staff i lidere organizacija idu preko sajta. Prijaviš se Discordom, popuniš formular i pratiš status ovde.
              </p>
              <Link href="/prijave" className="dugme dugme-glavno mt-8">Pogledaj prijave</Link>
            </div>
            <ul className="space-y-3">
              {otvorene.map(p => (
                <li key={p.id}>
                  <Link href={`/prijave/${p.id}`} className="flex items-center gap-4 rounded-2xl border border-white/[.08] bg-noc/60 px-5 py-4 transition-colors hover:border-flamingo/60">
                    <span className="min-w-0">
                      <span className="block font-semibold">{p.naziv}</span>
                      <span className="block truncate text-[14.5px] text-sivo">{p.kratko}</span>
                    </span>
                    <span className="ml-auto shrink-0 rounded-full bg-palma/12 px-3 py-1 text-[13px] font-medium text-palma">Otvoreno</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
