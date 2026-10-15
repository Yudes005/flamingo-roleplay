import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { nadjiPrijavu } from '@/config/prijave';
import { staffKorisnik } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { db, type PrijavaRed } from '@/lib/db';
import { clanServera, nalogStarDana } from '@/lib/discord';
import { datum, datumVreme } from '@/lib/format';
import { BezPristupa } from '@/components/BezPristupa';
import { DokumentZaglavlje } from '@/components/Dokument';
import { Pecat } from '@/components/Pecat';
import { Avatar, Glasanje, KomentarForma, OdlukaForma } from '@/components/PanelKlijent';

export const metadata: Metadata = { title: 'Prijava', robots: { index: false } };

type Glas = { glasao_id: string; glasao_ime: string; glas: number };
type Komentar = { id: number; autor_ime: string; autor_avatar: string | null; tekst: string; napravljen: Date };

export default async function PanelPrijava({ params }: { params: Promise<{ id: string }> }) {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const sql = await db();
  const [p] = await sql<PrijavaRed[]>`SELECT * FROM prijave WHERE id = ${id}`;
  if (!p) notFound();

  const [glasovi, komentari, ranije, clan] = await Promise.all([
    sql<Glas[]>`SELECT glasao_id, glasao_ime, glas FROM prijave_glasovi WHERE prijava_id = ${id} ORDER BY glasao_ime`,
    sql<Komentar[]>`SELECT id, autor_ime, autor_avatar, tekst, napravljen FROM prijave_komentari WHERE prijava_id = ${id} ORDER BY napravljen`,
    sql<{ id: number; vrsta: string; status: string; napravljena: Date }[]>`
      SELECT id, vrsta, status, napravljena FROM prijave WHERE korisnik_id = ${p.korisnik_id} AND id <> ${id} ORDER BY napravljena DESC LIMIT 10`,
    clanServera(p.korisnik_id),
  ]);

  const vrsta = nadjiPrijavu(p.vrsta);
  const moj = glasovi.find(g => g.glasao_id === staff.korisnik.id)?.glas || 0;
  let broj = 0;

  return (
    <div className="sadrzaj pb-10 pt-[100px] md:pt-[110px]">
      <Link href="/panel" className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[15px] text-sivo hover:text-tekst">
        <ChevronLeft className="size-4" /> Sve prijave
      </Link>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="papir px-5 py-8 sm:px-10 sm:py-11">
          {p.status !== 'na_cekanju' && (
            <div className="pointer-events-none absolute right-6 top-36 sm:right-12"><Pecat status={p.status} kad={p.odluceno} velicina="veliki" /></div>
          )}
          <DokumentZaglavlje pozicija={vrsta?.naziv || p.vrsta} broj={p.id} ime={p.korisnik_ime} avatar={p.korisnik_avatar} kad={p.napravljena} />
          <ol className="mt-8 space-y-7">
            {(vrsta?.polja || []).map(polje => {
              const v = p.odgovori[polje.id];
              if (polje.tip === 'potvrda') {
                return <li key={polje.id} className="list-none text-[14.5px] text-mastilo/70">{v ? 'Potvrdio: ' : 'NIJE potvrdio: '}{polje.pitanje}</li>;
              }
              broj += 1;
              return (
                <li key={polje.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2">
                  <span className="pt-0.5 font-display text-[15px] font-bold text-mastilo/45 tabular-nums">{broj}.</span>
                  <div>
                    <p className="text-[15px] font-semibold text-mastilo/75">{polje.pitanje}</p>
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[16.5px] leading-relaxed">
                      {v === '' || v === undefined ? <span className="text-mastilo/45">Bez odgovora</span> : String(v)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {p.status !== 'na_cekanju' && (
            <div className="mt-10 border-t-2 border-mastilo/80 pt-5 text-[15px]">
              <p><b>{p.status === 'prihvacena' ? 'Prihvatio' : 'Odbio'}:</b> {p.odlucio_ime}, {datumVreme(p.odluceno)}</p>
              {p.razlog && <p className="mt-1"><b>Poruka igraču:</b> {p.razlog}</p>}
              <ul className="mt-3 space-y-1 text-[14.5px]">
                {p.uloga_dodeljena === true && <li className="text-[#0f8a72]">Discord uloga je dodeljena automatski.</li>}
                {p.uloga_dodeljena === false && <li className="text-[#a11f2f]">Discord uloga NIJE dodeljena (proveri dozvole bota). Dodaj je ručno.</li>}
                {p.dm_poslat === true && <li className="text-[#0f8a72]">Igrač je dobio poruku na Discordu.</li>}
                {p.dm_poslat === false && <li className="text-[#a11f2f]">Poruka na Discordu nije stigla (zatvoreni DM-ovi). Igrač odluku vidi na sajtu.</li>}
              </ul>
            </div>
          )}
        </article>

        <aside className="space-y-5 lg:sticky lg:top-[90px] lg:self-start">
          <section className="povrsina p-5">
            <h2 className="font-sans text-[15px] font-semibold tracking-normal text-sivo">Podnosilac</h2>
            <div className="mt-3 flex items-center gap-3">
              <Avatar src={p.korisnik_avatar} velicina={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.korisnik_ime}</p>
                <p className="text-[13.5px] text-sivo">ID {p.korisnik_id}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-[14.5px]">
              <div className="flex justify-between gap-4"><dt className="text-sivo">Discord nalog</dt><dd>star {nalogStarDana(p.korisnik_id)} dana</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-sivo">Na serveru od</dt><dd>{clan ? datum(clan.joined_at) : 'nije na serveru'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-sivo">Ranije prijave</dt><dd>{ranije.length}</dd></div>
            </dl>
            {ranije.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-white/[.07] pt-3 text-[14px]">
                {ranije.map(r => (
                  <li key={r.id}><Link href={`/panel/${r.id}`} className="text-sivo hover:text-tekst">#{r.id} {nadjiPrijavu(r.vrsta)?.naziv || r.vrsta}, {r.status === 'na_cekanju' ? 'čeka' : r.status === 'prihvacena' ? 'prihvaćena' : 'odbijena'}</Link></li>
                ))}
              </ul>
            )}
          </section>

          <section className="povrsina p-5">
            <h2 className="mb-3 font-sans text-[15px] font-semibold tracking-normal text-sivo">Glasanje staffa</h2>
            <Glasanje prijavaId={p.id} moj={moj}
              za={glasovi.filter(g => g.glas === 1).map(g => g.glasao_ime)}
              protiv={glasovi.filter(g => g.glas === -1).map(g => g.glasao_ime)} />
          </section>

          {p.status === 'na_cekanju' && staff.nivo === 'odluka' && (
            <section className="povrsina p-5">
              <h2 className="mb-3 font-sans text-[15px] font-semibold tracking-normal text-sivo">Odluka</h2>
              <OdlukaForma prijavaId={p.id} imaUlogu={!!vrsta?.ulogaPriPrihvatanju} />
            </section>
          )}

          <section className="povrsina p-5">
            <h2 className="font-sans text-[15px] font-semibold tracking-normal text-sivo">Komentari staffa <span className="tabular-nums">{komentari.length}</span></h2>
            {komentari.length > 0 && (
              <ul className="mt-4 space-y-4">
                {komentari.map(k => (
                  <li key={k.id} className="flex gap-3">
                    <Avatar src={k.autor_avatar} velicina={28} />
                    <div className="min-w-0">
                      <p className="text-[13.5px]"><b className="font-semibold">{k.autor_ime}</b> <span className="text-sivo-2">{datumVreme(k.napravljen)}</span></p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] text-tekst/90">{k.tekst}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <KomentarForma prijavaId={p.id} />
          </section>
        </aside>
      </div>
    </div>
  );
}
