import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { kategorijaNovosti } from '@/config/zajednica';
import { staffKorisnik } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { db, imaBazu, type NovostRed } from '@/lib/db';
import { datum } from '@/lib/format';
import { BezPristupa } from '@/components/BezPristupa';
import { PanelZaglavlje } from '@/components/PanelMeni';
import { ObrisiDugme } from '@/components/PanelNovostiKlijent';

export const metadata: Metadata = { title: 'Novosti - panel', robots: { index: false } };

export default async function PanelNovosti() {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;
  if (!imaBazu()) return <BezPristupa prijavljen poruka="Baza nije povezana." />;
  const odluka = staff.nivo === 'odluka';

  const sql = await db();
  const novosti = await sql<NovostRed[]>`SELECT * FROM novosti ORDER BY napravljena DESC LIMIT 200`;

  return (
    <div className="sadrzaj pb-24 pt-[120px] md:pt-[140px]">
      <PanelZaglavlje aktivno="novosti" nivo={odluka ? 'odluka' : 'citanje'}>
        {odluka && <Link href="/panel/novosti/nova" className="dugme dugme-glavno"><Plus className="size-4" /> Nova novost</Link>}
      </PanelZaglavlje>
      {!odluka && <p className="mt-6 text-[15px] text-sivo">Novosti pišu vlasnici i head staff. Ti ih vidiš ovde pre nego što izađu.</p>}

      {novosti.length === 0 ? (
        <div className="povrsina mt-8 p-10 text-center text-sivo">Još nema novosti.{odluka && ' Napiši prvu, a možeš i da je odmah pošalješ na Discord.'}</div>
      ) : (
        <ul className="mt-8 divide-y divide-white/[.07] rounded-[18px] border border-white/[.07] bg-noc-2">
          {novosti.map(n => {
            const k = kategorijaNovosti(n.kategorija);
            return (
              <li key={n.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] text-sivo">
                    <span className="size-2 rounded-full" style={{ background: k.boja }} /> {k.naziv}, {datum(n.napravljena)}, {n.autor_ime}
                    {!n.objavljena && <span className="rounded-full bg-zlato/15 px-2 py-0.5 text-[12.5px] text-zlato">Nacrt</span>}
                  </p>
                  <Link href={`/novosti/${n.id}`} className="mt-1 block truncate text-[17px] font-semibold hover:text-flamingo-2">{n.naslov}</Link>
                </div>
                {odluka && (
                  <div className="flex gap-2">
                    <Link href={`/panel/novosti/${n.id}`} className="dugme dugme-obicno dugme-malo">Izmeni</Link>
                    <ObrisiDugme id={n.id} />
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
