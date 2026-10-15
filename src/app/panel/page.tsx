import type { Metadata } from 'next';
import Link from 'next/link';
import { PRIJAVE, nadjiPrijavu } from '@/config/prijave';
import { staffKorisnik } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { db, type PrijavaRed } from '@/lib/db';
import { relativno } from '@/lib/format';
import { BezPristupa } from '@/components/BezPristupa';
import { Avatar } from '@/components/PanelKlijent';

export const metadata: Metadata = { title: 'Staff panel', robots: { index: false } };

const STATUSI = [
  { id: 'na_cekanju', tekst: 'Čekaju' },
  { id: 'prihvacena', tekst: 'Prihvaćene' },
  { id: 'odbijena', tekst: 'Odbijene' },
  { id: 'sve', tekst: 'Sve' },
] as const;

type Red = PrijavaRed & { za: number; protiv: number; komentara: number };

export default async function Panel({ searchParams }: { searchParams: Promise<{ status?: string; vrsta?: string }> }) {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;

  const sp = await searchParams;
  const status = STATUSI.some(s => s.id === sp.status) ? sp.status! : 'na_cekanju';
  const vrsta = nadjiPrijavu(sp.vrsta || '') ? sp.vrsta! : '';

  const sql = await db();
  const redovi = await sql<Red[]>`
    SELECT p.*,
      COALESCE((SELECT count(*) FROM prijave_glasovi g WHERE g.prijava_id = p.id AND g.glas = 1), 0)::int AS za,
      COALESCE((SELECT count(*) FROM prijave_glasovi g WHERE g.prijava_id = p.id AND g.glas = -1), 0)::int AS protiv,
      COALESCE((SELECT count(*) FROM prijave_komentari k WHERE k.prijava_id = p.id), 0)::int AS komentara
    FROM prijave p
    WHERE (${status} = 'sve' OR p.status = ${status}) AND (${vrsta} = '' OR p.vrsta = ${vrsta})
    ORDER BY p.napravljena ${status === 'na_cekanju' ? sql`ASC` : sql`DESC`}
    LIMIT 200`;
  const brojevi = await sql<{ status: string; n: number }[]>`SELECT status, count(*)::int AS n FROM prijave GROUP BY status`;
  const broj = (s: string) => s === 'sve' ? brojevi.reduce((a, b) => a + b.n, 0) : (brojevi.find(b => b.status === s)?.n || 0);

  const link = (o: { status?: string; vrsta?: string }) => {
    const q = new URLSearchParams();
    const st = o.status ?? status; const vr = o.vrsta ?? vrsta;
    if (st !== 'na_cekanju') q.set('status', st);
    if (vr) q.set('vrsta', vr);
    const s = q.toString();
    return `/panel${s ? `?${s}` : ''}`;
  };

  return (
    <div className="sadrzaj pb-10 pt-[110px] md:pt-[120px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(28px,4vw,40px)] font-bold">Staff panel</h1>
          <p className="mt-2 text-[15.5px] text-sivo">
            {staff.nivo === 'odluka' ? 'Možeš da glasaš, komentarišeš i odlučuješ.' : 'Možeš da čitaš, glasaš i komentarišeš. Odluku donosi head staff.'}
          </p>
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {STATUSI.map(s => (
          <Link key={s.id} href={link({ status: s.id })} aria-current={status === s.id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14.5px] font-medium transition-colors ${status === s.id ? 'border-flamingo bg-flamingo/15 text-tekst' : 'border-white/10 text-sivo hover:text-tekst'}`}>
            {s.tekst} <span className="tabular-nums text-sivo">{broj(s.id)}</span>
          </Link>
        ))}
        <span className="mx-2 hidden h-6 w-px bg-white/10 sm:block" />
        <Link href={link({ vrsta: '' })} className={`rounded-full px-3 py-2 text-[14.5px] ${!vrsta ? 'text-tekst' : 'text-sivo hover:text-tekst'}`}>Sve pozicije</Link>
        {PRIJAVE.map(p => (
          <Link key={p.id} href={link({ vrsta: p.id })} className={`rounded-full px-3 py-2 text-[14.5px] ${vrsta === p.id ? 'bg-white/[.08] text-tekst' : 'text-sivo hover:text-tekst'}`}>{p.naziv}</Link>
        ))}
      </div>

      {redovi.length === 0 ? (
        <div className="povrsina mt-8 p-8 text-center text-sivo">
          {status === 'na_cekanju' ? 'Nema prijava koje čekaju. Sve je rešeno.' : 'Nema prijava za ovaj filter.'}
        </div>
      ) : (
        <div className="povrsina mt-8 overflow-hidden">
          <table className="w-full text-left text-[15px]">
            <thead className="hidden border-b border-white/[.07] text-[13.5px] text-sivo md:table-header-group">
              <tr>
                <th className="px-5 py-3 font-medium">Podnosilac</th>
                <th className="px-5 py-3 font-medium">Pozicija</th>
                <th className="px-5 py-3 font-medium">Poslato</th>
                <th className="px-5 py-3 font-medium">Glasovi</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[.06]">
              {redovi.map(r => (
                <tr key={r.id} className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-5 py-4 hover:bg-white/[.03] md:table-row md:p-0">
                  <td className="md:px-5 md:py-4">
                    <Link href={`/panel/${r.id}`} className="flex items-center gap-3 font-medium after:absolute after:inset-0">
                      <Avatar src={r.korisnik_avatar} />
                      <span className="min-w-0 truncate">{r.korisnik_ime}</span>
                      <span className="text-[13px] text-sivo-2 tabular-nums">#{r.id}</span>
                    </Link>
                  </td>
                  <td className="text-sivo md:px-5 md:py-4 md:text-tekst">{nadjiPrijavu(r.vrsta)?.naziv || r.vrsta}</td>
                  <td className="text-[14px] text-sivo md:px-5 md:py-4">{relativno(r.napravljena)}{r.komentara > 0 && `, ${r.komentara} kom.`}</td>
                  <td className="text-[14px] tabular-nums md:px-5 md:py-4">
                    <span className="text-palma">+{r.za}</span> <span className="text-[#ff8a8e]">−{r.protiv}</span>
                  </td>
                  <td className="col-span-2 md:px-5 md:py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[13px] font-medium ${r.status === 'na_cekanju' ? 'bg-zalazak/15 text-zalazak' : r.status === 'prihvacena' ? 'bg-palma/15 text-palma' : 'bg-crvena/15 text-[#ff8a8e]'}`}>
                      {r.status === 'na_cekanju' ? 'Čeka' : r.status === 'prihvacena' ? 'Prihvaćena' : 'Odbijena'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
