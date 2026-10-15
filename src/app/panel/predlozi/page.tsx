import type { Metadata } from 'next';
import Link from 'next/link';
import { STATUSI_PREDLOGA, statusPredloga } from '@/config/zajednica';
import { staffKorisnik } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { imaBazu } from '@/lib/db';
import { listaPredloga } from '@/lib/predlozi';
import { relativno } from '@/lib/format';
import { BezPristupa } from '@/components/BezPristupa';
import { PanelZaglavlje } from '@/components/PanelMeni';
import { Avatar } from '@/components/PanelKlijent';
import { OdgovorPredlogu } from '@/components/PanelPredloziKlijent';

export const metadata: Metadata = { title: 'Predlozi - panel', robots: { index: false } };

export default async function PanelPredlozi({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;
  if (!imaBazu()) return <BezPristupa prijavljen poruka="Baza nije povezana." />;
  const odluka = staff.nivo === 'odluka';
  const sp = await searchParams;
  const status = STATUSI_PREDLOGA.some(s => s.id === sp.status) ? sp.status! : 'novo';
  const predlozi = (await listaPredloga({ sort: 'top', status })) || [];

  return (
    <div className="sadrzaj pb-24 pt-[120px] md:pt-[140px]">
      <PanelZaglavlje aktivno="predlozi" nivo={odluka ? 'odluka' : 'citanje'} />
      <nav className="mt-6 flex flex-wrap gap-1" aria-label="Status">
        {STATUSI_PREDLOGA.map(s => (
          <Link key={s.id} href={`/panel/predlozi?status=${s.id}`} aria-current={status === s.id ? 'page' : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-[14px] transition-colors ${status === s.id ? 'border-flamingo text-tekst' : 'border-transparent text-sivo hover:text-tekst'}`}>{s.naziv}</Link>
        ))}
      </nav>

      {predlozi.length === 0 ? (
        <div className="povrsina mt-8 p-10 text-center text-sivo">Nema predloga sa statusom „{statusPredloga(status).naziv}”.</div>
      ) : (
        <ul className="mt-8 space-y-4">
          {predlozi.map(p => (
            <li key={p.id} className="povrsina grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-sivo">
                  <span className="rounded-full bg-flamingo/15 px-2.5 py-0.5 font-semibold text-flamingo-2 tabular-nums">{p.glasova} glasova</span>
                  {p.kategorija}
                  <span className="inline-flex items-center gap-1.5"><Avatar src={p.korisnik_avatar} velicina={18} /> {p.korisnik_ime}, {relativno(p.napravljen)}</span>
                </p>
                <h2 className="mt-2 text-[18px] font-semibold">{p.naslov}</h2>
                <p className="mt-1.5 whitespace-pre-line break-words text-[15px] text-sivo">{p.tekst}</p>
              </div>
              {odluka ? (
                <OdgovorPredlogu id={p.id} status={p.status} odgovor={p.odgovor || ''} statusi={STATUSI_PREDLOGA.map(s => ({ id: s.id, naziv: s.naziv }))} />
              ) : (
                <p className="text-[14px] text-sivo">Status menja head staff.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
