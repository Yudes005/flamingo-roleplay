import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { kategorijaNovosti } from '@/config/zajednica';
import { jednaNovost, poslednjeNovosti } from '@/lib/novosti';
import { trenutniKorisnik } from '@/lib/session';
import { nivoStaffa } from '@/lib/dozvole';
import { datum } from '@/lib/format';
import { Tekst } from '@/components/Tekst';
import { Avatar } from '@/components/PanelKlijent';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const n = await jednaNovost(Number((await params).id));
  if (!n) return { title: 'Novost' };
  return { title: n.naslov, description: n.kratko, openGraph: { title: n.naslov, description: n.kratko, images: [n.slika || '/img/hero.webp'] } };
}

export default async function Novost({ params }: Props) {
  const n = await jednaNovost(Number((await params).id));
  if (!n) notFound();
  if (!n.objavljena) {
    // nacrt vidi samo staff
    const k = await trenutniKorisnik();
    if (!k || (await nivoStaffa(k.id).catch(() => 'nema')) === 'nema') notFound();
  }
  const kat = kategorijaNovosti(n.kategorija);
  const jos = (await poslednjeNovosti(4)).filter(x => x.id !== n.id).slice(0, 3);

  return (
    <article>
      <header className="zrno relative isolate overflow-hidden bg-black pb-12 pt-[130px] md:pb-16 md:pt-[170px]">
        {n.slika && (
          <>
            <Image src={n.slika} alt="" fill priority sizes="100vw" unoptimized={n.slika.startsWith('http')} className="-z-20 object-cover opacity-50" />
            <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,var(--color-noc),rgb(0_0_0/.3))]" />
          </>
        )}
        <div className="sadrzaj">
          <Link href="/novosti" className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[15px] text-white/70 hover:text-white">
            <ChevronLeft className="size-4" /> Sve novosti
          </Link>
          <p className="mt-6 flex items-center gap-2 text-[14.5px] text-white/75">
            <span className="size-2 rounded-full" style={{ background: kat.boja }} />
            <span className="font-medium text-white">{kat.naziv}</span>
            <span>{datum(n.napravljena)}</span>
            {!n.objavljena && <span className="rounded-full bg-zlato/20 px-2.5 py-0.5 text-[13px] text-zlato">Nacrt</span>}
          </p>
          <h1 className="plakat mt-4 max-w-[18ch] text-[clamp(52px,8vw,112px)]">{n.naslov}</h1>
          <p className="mt-6 max-w-[56ch] text-[clamp(17px,1.5vw,20px)] text-white/85">{n.kratko}</p>
        </div>
      </header>

      <div className="svetlo py-14 md:py-20">
        <div className="sadrzaj">
          <div className="mx-auto max-w-[68ch]">
            <Tekst tekst={n.tekst} className="text-[17.5px] leading-[1.75]" />
            <div className="mt-12 flex items-center gap-3 border-t border-mastilo/15 pt-6 text-[14.5px] text-mastilo/70">
              <Avatar src={n.autor_avatar} velicina={32} />
              <span>Objavio <b className="font-semibold text-mastilo">{n.autor_ime}</b>{n.izmenjena && `, izmenjeno ${datum(n.izmenjena)}`}</span>
            </div>
          </div>
        </div>
      </div>

      {jos.length > 0 && (
        <section className="sadrzaj py-20">
          <h2 className="text-[22px] font-semibold">Još novosti</h2>
          <ul className="mt-6 grid grid-cols-1 border-t border-white/12 md:grid-cols-3">
            {jos.map(x => (
              <li key={x.id} className="border-b border-white/12 md:border-b-0 md:border-r md:last:border-r-0">
                <Link href={`/novosti/${x.id}`} className="group block py-6 md:px-6 md:first:pl-0">
                  <p className="text-[13.5px] text-sivo">{kategorijaNovosti(x.kategorija).naziv}, {datum(x.napravljena)}</p>
                  <h3 className="mt-1.5 text-[18px] font-semibold group-hover:text-flamingo-2">{x.naslov}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
