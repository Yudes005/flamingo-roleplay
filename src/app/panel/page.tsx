import type { Metadata } from 'next';
import Link from 'next/link';
import { GRUPE, PRIJAVE, nadjiPrijavu, odlukeZa, type Grupa } from '@/config/prijave';
import { staffKorisnik, vidiVrstu } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { db, imaBazu, type PrijavaRed } from '@/lib/db';
import { relativno } from '@/lib/format';
import { BezPristupa } from '@/components/BezPristupa';
import { Avatar } from '@/components/PanelKlijent';
import { PanelZaglavlje } from '@/components/PanelMeni';

export const metadata: Metadata = { title: 'Staff panel', robots: { index: false } };

const STATUSI = [
  { id: 'na_cekanju', tekst: 'Čekaju' },
  { id: 'moje', tekst: 'Moje' },
  { id: 'prihvacena', tekst: 'Prihvaćene i rešene' },
  { id: 'odbijena', tekst: 'Odbijene i odbačene' },
  { id: 'sve', tekst: 'Sve' },
] as const;

type Red = PrijavaRed & { za: number; protiv: number; komentara: number };

export default async function Panel({ searchParams }: { searchParams: Promise<{ status?: string; grupa?: string }> }) {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;
  if (!imaBazu()) return <BezPristupa prijavljen poruka="Baza nije povezana. Dodaj Neon bazu u Vercelu (Storage) i uradi Redeploy." />;

  const sp = await searchParams;
  const status = STATUSI.some(s => s.id === sp.status) ? sp.status! : 'na_cekanju';
  const grupa = GRUPE.some(g => g.id === sp.grupa) ? (sp.grupa as Grupa) : '';
  const vidljive = PRIJAVE.filter(p => vidiVrstu(staff.nivo, p) && (!grupa || p.grupa === grupa)).map(p => p.id);
  const sveVidljive = PRIJAVE.filter(p => vidiVrstu(staff.nivo, p)).map(p => p.id);
  const ja = staff.korisnik.id;

  const sql = await db();
  const [redovi, brojevi] = await Promise.all([
    sql<Red[]>`
      SELECT p.*,
        COALESCE((SELECT count(*) FROM prijave_glasovi g WHERE g.prijava_id = p.id AND g.glas = 1), 0)::int AS za,
        COALESCE((SELECT count(*) FROM prijave_glasovi g WHERE g.prijava_id = p.id AND g.glas = -1), 0)::int AS protiv,
        COALESCE((SELECT count(*) FROM prijave_komentari k WHERE k.prijava_id = p.id), 0)::int AS komentara
      FROM prijave p
      WHERE p.vrsta = ANY(${vidljive})
        AND (${status} = 'sve'
          OR (${status} = 'moje' AND p.preuzeo_id = ${ja} AND p.status = 'na_cekanju')
          OR p.status = ${status})
      ORDER BY p.napravljena ${status === 'na_cekanju' || status === 'moje' ? sql`ASC` : sql`DESC`}
      LIMIT 200`,
    sql<{ status: string; grupa_vrsta: string; n: number; moje: number }[]>`
      SELECT status, vrsta AS grupa_vrsta, count(*)::int AS n,
        count(*) FILTER (WHERE preuzeo_id = ${ja})::int AS moje
      FROM prijave WHERE vrsta = ANY(${sveVidljive}) GROUP BY status, vrsta`,
  ]);

  const uGrupi = (v: string) => !grupa || nadjiPrijavu(v)?.grupa === grupa;
  const broj = (s: string) => brojevi.filter(b => uGrupi(b.grupa_vrsta)).reduce((a, b) => a + (
    s === 'sve' ? b.n : s === 'moje' ? (b.status === 'na_cekanju' ? b.moje : 0) : b.status === s ? b.n : 0), 0);
  const cekaGrupa = (g: string) => brojevi.filter(b => b.status === 'na_cekanju' && (!g || nadjiPrijavu(b.grupa_vrsta)?.grupa === g)).reduce((a, b) => a + b.n, 0);

  const link = (o: { status?: string; grupa?: string }) => {
    const q = new URLSearchParams();
    const st = o.status ?? status; const gr = o.grupa ?? grupa;
    if (st !== 'na_cekanju') q.set('status', st);
    if (gr) q.set('grupa', gr);
    const s = q.toString();
    return `/panel${s ? `?${s}` : ''}`;
  };

  return (
    <div className="sadrzaj pb-24 pt-[120px] md:pt-[140px]">
      <PanelZaglavlje aktivno="prijave" nivo={staff.nivo === 'odluka' ? 'odluka' : 'citanje'} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {[{ id: '', naziv: 'Sve' }, ...GRUPE].map(g => (
          <Link key={g.id || 'sve'} href={link({ grupa: g.id })} aria-current={grupa === g.id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14.5px] font-medium transition-colors ${grupa === g.id ? 'bg-white text-mastilo' : 'bg-white/[.06] text-sivo hover:text-tekst'}`}>
            {g.naziv}
            {cekaGrupa(g.id) > 0 && <span className={`rounded-full px-1.5 text-[12.5px] tabular-nums ${grupa === g.id ? 'bg-flamingo text-white' : 'bg-flamingo/20 text-flamingo-2'}`}>{cekaGrupa(g.id)}</span>}
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-1">
        {STATUSI.map(s => (
          <Link key={s.id} href={link({ status: s.id })} aria-current={status === s.id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[14px] transition-colors ${status === s.id ? 'border-flamingo text-tekst' : 'border-transparent text-sivo hover:text-tekst'}`}>
            {s.tekst} <span className="tabular-nums text-sivo-2">{broj(s.id)}</span>
          </Link>
        ))}
      </div>

      {redovi.length === 0 ? (
        <div className="povrsina mt-8 p-10 text-center text-sivo">
          {status === 'na_cekanju' ? 'Ništa ne čeka. Sve je rešeno.' : status === 'moje' ? 'Nisi preuzeo nijednu otvorenu prijavu.' : 'Nema ničega za ovaj filter.'}
        </div>
      ) : (
        <div className="povrsina mt-8 overflow-hidden">
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-white/[.07] text-[13.5px] text-sivo md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Podnosilac</th>
                <th className="px-5 py-3 font-medium">Vrsta</th>
                <th className="px-5 py-3 font-medium">Poslato</th>
                <th className="px-5 py-3 font-medium">Glasovi</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {redovi.map(r => {
                const v = nadjiPrijavu(r.vrsta);
                const t = odlukeZa(v);
                return (
                  <tr key={r.id} className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-4 hover:bg-white/[.03] md:table-row md:p-0">
                    <td className="md:px-5 md:py-4">
                      <Link href={`/panel/${r.id}`} className="flex items-center gap-3 font-medium after:absolute after:inset-0">
                        <Avatar src={r.korisnik_avatar} />
                        <span className="min-w-0 truncate">{r.korisnik_ime}</span>
                        <span className="text-[13px] text-sivo-2 tabular-nums">#{r.id}</span>
                      </Link>
                    </td>
                    <td className="text-sivo md:px-5 md:py-4 md:text-tekst">
                      {v?.naziv || r.vrsta}
                      {typeof r.odgovori.organizacija === 'string' && <span className="text-sivo">, {r.odgovori.organizacija}</span>}
                    </td>
                    <td className="text-[14px] text-sivo md:px-5 md:py-4">{relativno(r.napravljena)}{r.komentara > 0 && `, ${r.komentara} kom.`}</td>
                    <td className="text-[14px] tabular-nums md:px-5 md:py-4">
                      <span className="text-zelena">+{r.za}</span> <span className="text-[#ff8a8e]">−{r.protiv}</span>
                    </td>
                    <td className="col-span-2 md:px-5 md:py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[13px] font-medium ${r.status === 'na_cekanju' ? 'bg-zlato/15 text-zlato' : r.status === 'prihvacena' ? 'bg-zelena/15 text-zelena' : 'bg-crvena/15 text-[#ff8a8e]'}`}>
                        {r.status === 'na_cekanju' ? (r.preuzeo_ime ? `Radi ${r.preuzeo_ime}` : 'Čeka') : r.status === 'prihvacena' ? t.da : t.ne}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
