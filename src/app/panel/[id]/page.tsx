import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ExternalLink, Lock } from 'lucide-react';
import { nadjiPrijavu, odlukeZa } from '@/config/prijave';
import { staffKorisnik, vidiVrstu } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { db, imaBazu, type PrijavaRed } from '@/lib/db';
import { clanServera, nalogStarDana } from '@/lib/discord';
import { datum, datumVreme } from '@/lib/format';
import { BezPristupa } from '@/components/BezPristupa';
import { DokumentZaglavlje, podnaslovDokumenta } from '@/components/Dokument';
import { Pecat } from '@/components/Pecat';
import { Avatar, Glasanje, KomentarForma, OdlukaForma, Preuzimanje } from '@/components/PanelKlijent';

export const metadata: Metadata = { title: 'Prijava', robots: { index: false } };

type Glas = { glasao_id: string; glasao_ime: string; glas: number };
type Komentar = { id: number; autor_ime: string; autor_avatar: string | null; tekst: string; napravljen: Date };

export default async function PanelPrijava({ params }: { params: Promise<{ id: string }> }) {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;
  if (!imaBazu()) return <BezPristupa prijavljen poruka="Baza nije povezana." />;

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const sql = await db();
  const [p] = await sql<PrijavaRed[]>`SELECT * FROM prijave WHERE id = ${id}`;
  if (!p) notFound();
  const vrsta = nadjiPrijavu(p.vrsta);
  if (!vidiVrstu(staff.nivo, vrsta)) notFound();

  const [glasovi, komentari, ranije, clan] = await Promise.all([
    sql<Glas[]>`SELECT glasao_id, glasao_ime, glas FROM prijave_glasovi WHERE prijava_id = ${id} ORDER BY glasao_ime`,
    sql<Komentar[]>`SELECT id, autor_ime, autor_avatar, tekst, napravljen FROM prijave_komentari WHERE prijava_id = ${id} ORDER BY napravljen`,
    sql<{ id: number; vrsta: string; status: string; napravljena: Date }[]>`
      SELECT id, vrsta, status, napravljena FROM prijave WHERE korisnik_id = ${p.korisnik_id} AND id <> ${id} ORDER BY napravljena DESC LIMIT 10`,
    clanServera(p.korisnik_id),
  ]);

  const t = odlukeZa(vrsta);
  const dok = podnaslovDokumenta(vrsta?.grupa || 'tim', p.vrsta);
  const moj = glasovi.find(g => g.glasao_id === staff.korisnik.id)?.glas || 0;
  const ranijeVidljive = ranije.filter(r => vidiVrstu(staff.nivo, nadjiPrijavu(r.vrsta)));
  let broj = 0;

  return (
    <div className="sadrzaj pb-24 pt-[100px] md:pt-[110px]">
      <Link href="/panel" className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[15px] text-sivo hover:text-tekst">
        <ChevronLeft className="size-4" /> Sve prijave
      </Link>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="papir px-5 py-8 sm:px-10 sm:py-11">
          {p.status !== 'na_cekanju' && (
            <div className="pointer-events-none absolute right-6 top-40 sm:right-12"><Pecat status={p.status} kad={p.odluceno} velicina="veliki" da={t.pecatDa} ne={t.pecatNe} /></div>
          )}
          <DokumentZaglavlje naslov={vrsta?.naziv || p.vrsta} podnaslov={dok.podnaslov} oznaka={dok.oznaka} broj={p.id} ime={p.korisnik_ime} avatar={p.korisnik_avatar} kad={p.napravljena} />
          <ol className="mt-8 space-y-7">
            {(vrsta?.polja || []).map(polje => {
              const v = p.odgovori[polje.id];
              if (polje.tip === 'potvrda') {
                return <li key={polje.id} className="list-none text-[14.5px] text-mastilo/70">{v ? 'Potvrdio: ' : 'NIJE potvrdio: '}{polje.pitanje}</li>;
              }
              broj += 1;
              const prazno = v === '' || v === undefined;
              return (
                <li key={polje.id} className="grid grid-cols-[30px_minmax(0,1fr)] gap-x-2">
                  <span className="plakat pt-0.5 text-[20px] text-mastilo/40 tabular-nums">{broj}.</span>
                  <div>
                    <p className="text-[15px] font-semibold text-mastilo/75">{polje.pitanje}</p>
                    {prazno ? (
                      <p className="mt-1.5 text-[16.5px] text-mastilo/45">Bez odgovora</p>
                    ) : polje.tip === 'link' ? (
                      <a href={String(v)} target="_blank" rel="noopener nofollow" className="mt-1.5 inline-flex items-center gap-1.5 break-all text-[16.5px] font-medium text-flamingo-3 underline underline-offset-4">
                        {String(v)} <ExternalLink className="size-4 shrink-0" />
                      </a>
                    ) : (
                      <p className="mt-1.5 whitespace-pre-wrap break-words text-[16.5px] leading-relaxed">{String(v)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {p.status !== 'na_cekanju' && (
            <div className="mt-10 border-t-2 border-mastilo/80 pt-5 text-[15px]">
              <p><b>{p.status === 'prihvacena' ? t.da : t.ne}:</b> {p.odlucio_ime}, {datumVreme(p.odluceno)}</p>
              {p.razlog && <p className="mt-1"><b>Poruka igraču:</b> {p.razlog}</p>}
              <ul className="mt-3 space-y-1 text-[14.5px]">
                {p.uloga_dodeljena === true && <li className="text-[#0f8a62]">Discord uloga je dodeljena automatski.</li>}
                {p.uloga_dodeljena === false && <li className="text-[#a11f2f]">Discord uloga NIJE dodeljena (proveri dozvole bota). Dodaj je ručno.</li>}
                {p.dm_poslat === true && <li className="text-[#0f8a62]">Igrač je dobio poruku na Discordu.</li>}
                {p.dm_poslat === false && <li className="text-[#a11f2f]">Poruka na Discordu nije stigla (zatvoreni DM-ovi). Igrač ishod vidi na sajtu.</li>}
              </ul>
            </div>
          )}
        </article>

        <aside className="space-y-5 lg:sticky lg:top-[90px] lg:self-start">
          {vrsta?.samoVrh && (
            <p className="flex gap-3 rounded-2xl border border-zlato/30 bg-zlato/[.07] p-4 text-[14.5px] text-zlato">
              <Lock className="mt-0.5 size-4 shrink-0" /> Poverljivo. Ovo vide samo vlasništvo i head staff.
            </p>
          )}
          <section className="povrsina p-5">
            <h2 className="text-[15px] font-semibold text-sivo">Podnosilac</h2>
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
              <div className="flex justify-between gap-4"><dt className="text-sivo">Ranije prijave</dt><dd>{ranijeVidljive.length}</dd></div>
            </dl>
            {ranijeVidljive.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-white/[.07] pt-3 text-[14px]">
                {ranijeVidljive.map(r => {
                  const rv = nadjiPrijavu(r.vrsta); const rt = odlukeZa(rv);
                  return (
                    <li key={r.id}><Link href={`/panel/${r.id}`} className="text-sivo hover:text-tekst">#{r.id} {rv?.naziv || r.vrsta}, {r.status === 'na_cekanju' ? 'čeka' : r.status === 'prihvacena' ? rt.da.toLowerCase() : rt.ne.toLowerCase()}</Link></li>
                  );
                })}
              </ul>
            )}
          </section>

          {p.status === 'na_cekanju' && (
            <section className="povrsina p-5">
              <h2 className="mb-3 text-[15px] font-semibold text-sivo">Ko radi na ovome</h2>
              <Preuzimanje prijavaId={p.id} preuzeo={p.preuzeo_ime} moje={p.preuzeo_id === staff.korisnik.id} />
            </section>
          )}

          <section className="povrsina p-5">
            <h2 className="mb-3 text-[15px] font-semibold text-sivo">Glasanje staffa</h2>
            <Glasanje prijavaId={p.id} moj={moj}
              za={glasovi.filter(g => g.glas === 1).map(g => g.glasao_ime)}
              protiv={glasovi.filter(g => g.glas === -1).map(g => g.glasao_ime)} />
          </section>

          {p.status === 'na_cekanju' && staff.nivo === 'odluka' && (
            <section className="povrsina p-5">
              <h2 className="mb-3 text-[15px] font-semibold text-sivo">Odluka</h2>
              <OdlukaForma prijavaId={p.id} imaUlogu={!!vrsta?.ulogaPriPrihvatanju} da={t.glagolDa} ne={t.glagolNe} />
            </section>
          )}

          <section className="povrsina p-5">
            <h2 className="text-[15px] font-semibold text-sivo">Komentari staffa <span className="tabular-nums">{komentari.length}</span></h2>
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
