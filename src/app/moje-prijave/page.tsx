import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { trenutniKorisnik } from '@/lib/session';
import { db, imaBazu, type PrijavaRed } from '@/lib/db';
import { nadjiPrijavu, odlukeZa } from '@/config/prijave';
import { datum } from '@/lib/format';
import { Pecat } from '@/components/Pecat';

export const metadata: Metadata = { title: 'Moje prijave', robots: { index: false } };

export default async function MojePrijave({ searchParams }: { searchParams: Promise<{ poslata?: string }> }) {
  const novaId = Number((await searchParams).poslata) || 0;
  const korisnik = await trenutniKorisnik();
  if (!korisnik) redirect('/api/auth/discord?nazad=/moje-prijave');

  let prijave: PrijavaRed[] = [];
  let greska = !imaBazu();
  if (!greska) {
    try {
      const sql = await db();
      prijave = await sql<PrijavaRed[]>`SELECT * FROM prijave WHERE korisnik_id = ${korisnik.id} ORDER BY napravljena DESC LIMIT 60`;
    } catch { greska = true; }
  }
  const nova = prijave.find(p => p.id === novaId);

  return (
    <div className="sadrzaj pb-24 pt-[130px] md:pt-[160px]">
      <header>
        <h1 className="plakat naslov-strane">Moje prijave</h1>
        <p className="uvod mt-5 text-sivo">Sve što si poslao i šta je staff odlučio.</p>
      </header>

      {nova && (
        <div className="pojava mt-10 max-w-2xl rounded-2xl border border-zelena/30 bg-zelena/10 px-5 py-4" role="status">
          <p className="font-semibold text-zelena">{nadjiPrijavu(nova.vrsta)?.grupa === 'report' ? 'Report je poslat' : 'Prijava je poslata'}</p>
          <p className="mt-1 text-[15.5px] text-tekst/85">Staff će je pročitati. Ishod dobijaš u poruci na Discordu, a status je uvek ovde.</p>
        </div>
      )}

      {greska ? (
        <p className="povrsina mt-12 max-w-xl p-6 text-sivo">Prijave trenutno ne mogu da se učitaju. Probaj ponovo za par minuta.</p>
      ) : prijave.length === 0 ? (
        <div className="povrsina mt-12 max-w-xl p-8">
          <h2 className="text-[20px] font-semibold">Još nisi poslao nijednu prijavu</h2>
          <p className="mt-2 text-[15.5px] text-sivo">Grad traži admine, supportere, ljude za organizacije i vođe bandi.</p>
          <Link href="/prijave" className="dugme dugme-glavno mt-6">Pogledaj prijave</Link>
        </div>
      ) : (
        <ul className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          {prijave.map(p => {
            const vrsta = nadjiPrijavu(p.vrsta);
            const t = odlukeZa(vrsta);
            const report = vrsta?.grupa === 'report';
            return (
              <li key={p.id} className="papir relative overflow-hidden px-6 py-6 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-mastilo/65">{report ? 'Predmet' : 'Prijava'} br. {String(p.id).padStart(4, '0')}, {datum(p.napravljena)}</p>
                    <h2 className="plakat mt-1.5 text-[24px]">{vrsta?.naziv || p.vrsta}</h2>
                  </div>
                  <div className="shrink-0 pt-1">
                    {p.id === novaId && p.status === 'na_cekanju'
                      ? <Pecat status="primljeno" kad={p.napravljena} udari />
                      : <Pecat status={p.status} kad={p.odluceno} da={t.pecatDa} ne={t.pecatNe} />}
                  </div>
                </div>
                <p className="mt-4 text-[15.5px] text-mastilo/80">
                  {p.status === 'na_cekanju' && (p.preuzeo_ime ? `${p.preuzeo_ime} iz staffa radi na ovome.` : 'Staff još nije stigao do ovoga. Ishod dobijaš u poruci na Discordu.')}
                  {p.status === 'prihvacena' && (report ? 'Staff je pregledao i rešio. Hvala.' : 'Čestitamo! Staff će ti se javiti sa sledećim koracima.')}
                  {p.status === 'odbijena' && vrsta && vrsta.ponovoPosleDana > 0 && `Novu možeš da pošalješ ${vrsta.ponovoPosleDana} dana posle odluke.`}
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
