import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SITE } from '@/config/site';
import { KATEGORIJE_NOVOSTI, kategorijaNovosti } from '@/config/zajednica';
import { sveNovosti } from '@/lib/novosti';
import { datum } from '@/lib/format';
import { DiscordIkona } from '@/components/ikone';
import { ZaglavljeStrane } from '@/components/ZaglavljeStrane';

export const metadata: Metadata = { title: 'Novosti', description: 'Update-i, eventi i obaveštenja iz Flamingo grada.' };
export const revalidate = 60;

export default async function Novosti({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const kategorija = KATEGORIJE_NOVOSTI.some(x => x.id === k) ? k! : '';
  const novosti = await sveNovosti(kategorija);
  const [prva, ...ostale] = novosti || [];

  return (
    <>
      <ZaglavljeStrane naslov="Novosti" slika="/img/prodavnice.webp" pozicija="70% 50%">
        Update-i, eventi i obaveštenja iz grada. Sve važno izlazi i na Discordu.
      </ZaglavljeStrane>

      <div className="sadrzaj pb-24 pt-10 md:pb-32">
        <nav className="flex flex-wrap gap-2" aria-label="Kategorije">
          {[{ id: '', naziv: 'Sve' }, ...KATEGORIJE_NOVOSTI].map(x => (
            <Link key={x.id || 'sve'} href={x.id ? `/novosti?k=${x.id}` : '/novosti'} aria-current={kategorija === x.id ? 'page' : undefined}
              className={`rounded-full px-4 py-2 text-[14.5px] font-medium transition-colors ${kategorija === x.id ? 'bg-white text-mastilo' : 'bg-white/[.06] text-sivo hover:text-tekst'}`}>
              {x.naziv}
            </Link>
          ))}
        </nav>

        {!novosti || novosti.length === 0 ? (
          <div className="mt-12 max-w-xl">
            <h2 className="text-[22px] font-semibold">{novosti === null ? 'Novosti stižu uskoro' : 'Ovde još nema novosti'}</h2>
            <p className="mt-2 text-[16px] text-sivo">Do tada sve objave prati na Discordu.</p>
            <a href={SITE.discord} target="_blank" rel="noopener" className="dugme dugme-discord mt-6"><DiscordIkona /> Discord</a>
          </div>
        ) : (
          <>
            <Link href={`/novosti/${prva.id}`} className="group mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-end">
              <div className="otkrij relative aspect-[16/9] overflow-hidden rounded-md bg-noc-3">
                <Image src={prva.slika || '/img/hero.webp'} alt="" fill sizes="(max-width:1024px) 100vw, 700px" unoptimized={!!prva.slika?.startsWith('http')}
                  className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-izlaz)] group-hover:scale-[1.04]" />
              </div>
              <div>
                <Oznaka kategorija={prva.kategorija} kad={prva.napravljena} />
                <h2 className="plakat mt-3 text-[clamp(44px,5vw,72px)] transition-colors group-hover:text-flamingo-2">{prva.naslov}</h2>
                <p className="mt-4 text-[17px] text-sivo">{prva.kratko}</p>
              </div>
            </Link>
            {ostale.length > 0 && (
              <ul className="mt-20 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
                {ostale.map(n => (
                  <li key={n.id}>
                    <Link href={`/novosti/${n.id}`} className="group block">
                      <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-noc-3">
                        <Image src={n.slika || '/img/zivot.webp'} alt="" fill sizes="(max-width:640px) 100vw, 400px" unoptimized={!!n.slika?.startsWith('http')}
                          className="object-cover transition-transform duration-[1.2s] ease-[var(--ease-izlaz)] group-hover:scale-[1.05]" />
                      </div>
                      <div className="mt-4"><Oznaka kategorija={n.kategorija} kad={n.napravljena} /></div>
                      <h3 className="mt-2 text-[21px] font-semibold leading-snug group-hover:text-flamingo-2">{n.naslov}</h3>
                      <p className="mt-1.5 line-clamp-3 text-[15.5px] text-sivo">{n.kratko}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Oznaka({ kategorija, kad }: { kategorija: string; kad: Date }) {
  const k = kategorijaNovosti(kategorija);
  return (
    <p className="flex items-center gap-2 text-[14px] text-sivo">
      <span className="size-2 rounded-full" style={{ background: k.boja }} />
      <span className="font-medium text-tekst">{k.naziv}</span>
      <span>{datum(kad)}</span>
    </p>
  );
}
