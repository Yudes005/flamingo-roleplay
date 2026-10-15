import type { Metadata } from 'next';
import Link from 'next/link';
import { KATEGORIJE_PREDLOGA, PREDLOGA_DNEVNO, STATUSI_PREDLOGA, statusPredloga } from '@/config/zajednica';
import { trenutniKorisnik } from '@/lib/session';
import { listaPredloga } from '@/lib/predlozi';
import { relativno } from '@/lib/format';
import { DiscordIkona } from '@/components/ikone';
import { ZaglavljeStrane } from '@/components/ZaglavljeStrane';
import { GlasPredloga, PredlogForma } from '@/components/PredloziKlijent';
import { Avatar } from '@/components/PanelKlijent';

export const metadata: Metadata = { title: 'Predlozi', description: 'Predloži šta da se doda u Flamingo grad i glasaj za tuđe predloge.' };

const BOJE: Record<string, string> = {
  novo: 'bg-white/[.08] text-sivo',
  razmatra: 'bg-zlato/15 text-zlato',
  prihvaceno: 'bg-flamingo/15 text-flamingo-2',
  uradjeno: 'bg-zelena/15 text-zelena',
  odbijeno: 'bg-crvena/15 text-[#ff8a8e]',
};

export default async function Predlozi({ searchParams }: { searchParams: Promise<{ sort?: string; status?: string }> }) {
  const sp = await searchParams;
  const sort = sp.sort === 'novo' ? 'novo' : 'top';
  const status = STATUSI_PREDLOGA.some(s => s.id === sp.status) ? sp.status! : '';
  const korisnik = await trenutniKorisnik();
  const predlozi = await listaPredloga({ sort, status, korisnikId: korisnik?.id });

  const link = (o: { sort?: string; status?: string }) => {
    const q = new URLSearchParams();
    const so = o.sort ?? sort; const st = o.status ?? status;
    if (so !== 'top') q.set('sort', so);
    if (st) q.set('status', st);
    const s = q.toString();
    return `/predlozi${s ? `?${s}` : ''}`;
  };

  return (
    <>
      <ZaglavljeStrane naslov="Predlozi" slika="/img/poslovi/elektricar.webp" pozicija="40% 30%">
        Šta fali gradu? Predloži, glasaj za tuđe ideje i prati šta staff odluči. Najpopularniji predlozi prvi dolaze na red.
      </ZaglavljeStrane>

      <div className="sadrzaj grid grid-cols-1 gap-14 pb-24 pt-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16 md:pb-32">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <nav className="flex gap-1 rounded-full bg-white/[.06] p-1" aria-label="Redosled">
              {[['top', 'Najpopularniji'], ['novo', 'Najnoviji']].map(([id, t]) => (
                <Link key={id} href={link({ sort: id })} aria-current={sort === id ? 'page' : undefined}
                  className={`rounded-full px-4 py-1.5 text-[14.5px] font-medium transition-colors ${sort === id ? 'bg-white text-mastilo' : 'text-sivo hover:text-tekst'}`}>{t}</Link>
              ))}
            </nav>
            <nav className="flex flex-wrap gap-1" aria-label="Status">
              {[{ id: '', naziv: 'Svi' }, ...STATUSI_PREDLOGA].map(s => (
                <Link key={s.id || 'svi'} href={link({ status: s.id })} aria-current={status === s.id ? 'page' : undefined}
                  className={`rounded-full border px-3 py-1.5 text-[13.5px] transition-colors ${status === s.id ? 'border-flamingo text-tekst' : 'border-transparent text-sivo hover:text-tekst'}`}>{s.naziv}</Link>
              ))}
            </nav>
          </div>

          {predlozi === null ? (
            <p className="povrsina mt-8 p-8 text-sivo">Predlozi stižu uskoro. Do tada ideje piši na Discordu.</p>
          ) : predlozi.length === 0 ? (
            <p className="povrsina mt-8 p-8 text-sivo">{status ? 'Nema predloga sa ovim statusom.' : 'Još nema predloga. Budi prvi.'}</p>
          ) : (
            <ul className="mt-8 border-t border-white/12">
              {predlozi.map(p => {
                const st = statusPredloga(p.status);
                return (
                  <li key={p.id} className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-5 border-b border-white/12 py-6">
                    <GlasPredloga id={p.id} glasova={p.glasova} moj={p.moj} prijavljen={!!korisnik} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[13.5px]">
                        <span className={`rounded-full px-2.5 py-0.5 font-medium ${BOJE[p.status] || BOJE.novo}`}>{st.naziv}</span>
                        <span className="text-sivo">{p.kategorija}</span>
                      </div>
                      <h2 className="mt-2 text-[19px] font-semibold leading-snug">{p.naslov}</h2>
                      <p className="mt-1.5 whitespace-pre-line break-words text-[15.5px] text-sivo">{p.tekst}</p>
                      <p className="mt-3 flex items-center gap-2 text-[13.5px] text-sivo-2">
                        <Avatar src={p.korisnik_avatar} velicina={20} /> {p.korisnik_ime}, {relativno(p.napravljen)}
                      </p>
                      {p.odgovor && (
                        <div className="mt-4 rounded-xl border-l-2 border-flamingo bg-white/[.04] px-4 py-3">
                          <p className="text-[13px] text-sivo">Odgovor staffa{p.odgovorio_ime ? `, ${p.odgovorio_ime}` : ''}</p>
                          <p className="mt-0.5 text-[15px]">{p.odgovor}</p>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="lg:sticky lg:top-[110px] lg:self-start">
          <div className="povrsina p-6">
            <h2 className="text-[20px] font-semibold">Novi predlog</h2>
            {korisnik ? (
              <>
                <p className="mt-1.5 text-[14.5px] text-sivo">Jedna ideja po predlogu. Najviše {PREDLOGA_DNEVNO} dnevno.</p>
                <PredlogForma kategorije={KATEGORIJE_PREDLOGA} />
              </>
            ) : (
              <>
                <p className="mt-2 text-[15px] text-sivo">Prijavi se preko Discorda da bi slao predloge i glasao.</p>
                <a href="/api/auth/discord?nazad=/predlozi" className="dugme dugme-discord mt-5 w-full"><DiscordIkona /> Prijavi se</a>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
