import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { trenutniKorisnik } from '@/lib/session';
import { db, type PrijavaRed } from '@/lib/db';
import { nadjiPrijavu } from '@/config/prijave';
import { datum } from '@/lib/format';
import { Pecat } from '@/components/Pecat';

export const metadata: Metadata = { title: 'Moje prijave' };

export default async function MojePrijave({ searchParams }: { searchParams: Promise<{ poslata?: string }> }) {
  const novaId = Number((await searchParams).poslata) || 0;
  const korisnik = await trenutniKorisnik();
  if (!korisnik) redirect('/api/auth/discord?nazad=/moje-prijave');

  let prijave: PrijavaRed[] = [];
  let greska = false;
  try {
    const sql = await db();
    prijave = await sql<PrijavaRed[]>`SELECT * FROM prijave WHERE korisnik_id = ${korisnik.id} ORDER BY napravljena DESC LIMIT 50`;
  } catch { greska = true; }

  return (
    <div className="sadrzaj pb-10 pt-[120px] md:pt-[140px]">
      <header className="max-w-2xl">
        <h1 className="text-[clamp(34px,5vw,56px)] font-bold">Moje prijave</h1>
        <p className="mt-4 text-[17px] text-sivo">Sve što si poslao i šta je staff odlučio.</p>
      </header>

      {novaId > 0 && prijave.some(p => p.id === novaId) && (
        <div className="mt-8 max-w-2xl rounded-2xl border border-palma/30 bg-palma/10 px-5 py-4" role="status">
          <p className="font-semibold text-palma">Prijava je poslata</p>
          <p className="mt-1 text-[15.5px] text-tekst/85">Staff će je pročitati i odlučiti. Odluku dobijaš u poruci na Discordu, a status je uvek ovde.</p>
        </div>
      )}

      {greska ? (
        <p className="povrsina mt-10 max-w-xl p-6 text-sivo">Prijave trenutno ne mogu da se učitaju. Probaj ponovo za par minuta.</p>
      ) : prijave.length === 0 ? (
        <div className="povrsina mt-10 max-w-xl p-8">
          <h2 className="font-sans text-[19px] font-semibold tracking-normal">Još nisi poslao nijednu prijavu</h2>
          <p className="mt-2 text-[15.5px] text-sivo">Grad traži admine, supportere i lidere organizacija.</p>
          <Link href="/prijave" className="dugme dugme-glavno mt-6">Pogledaj prijave</Link>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
          {prijave.map(p => {
            const vrsta = nadjiPrijavu(p.vrsta);
            return (
              <li key={p.id} className="papir relative overflow-hidden px-6 py-6 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-mastilo/65">Prijava br. {String(p.id).padStart(4, '0')}, {datum(p.napravljena)}</p>
                    <h2 className="mt-1 font-display text-[24px] font-bold">{vrsta?.naziv || p.vrsta}</h2>
                  </div>
                  <div className="shrink-0 pt-1">
                    {p.id === novaId && p.status === 'na_cekanju'
                      ? <Pecat status="primljeno" kad={p.napravljena} velicina="srednji" udari />
                      : <Pecat status={p.status} kad={p.odluceno} velicina="srednji" />}
                  </div>
                </div>
                <p className="mt-4 text-[15.5px] text-mastilo/80">
                  {p.status === 'na_cekanju' && 'Staff još čita prijavu. Odluku dobijaš u poruci na Discordu.'}
                  {p.status === 'prihvacena' && 'Čestitamo! Staff će ti se javiti sa sledećim koracima.'}
                  {p.status === 'odbijena' && (vrsta ? `Novu prijavu možeš da pošalješ ${vrsta.ponovoPosleDana} dana posle odluke.` : '')}
                </p>
                {p.razlog && (
                  <div className="mt-4 rounded-lg bg-mastilo/[.06] px-4 py-3">
                    <p className="text-[12.5px] text-mastilo/65">Poruka staffa</p>
                    <p className="mt-0.5 text-[15.5px]">{p.razlog}</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
