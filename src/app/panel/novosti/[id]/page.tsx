import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { DISCORD } from '@/config/site';
import { KATEGORIJE_NOVOSTI } from '@/config/zajednica';
import { staffKorisnik } from '@/lib/dozvole';
import { trenutniKorisnik } from '@/lib/session';
import { db, imaBazu, type NovostRed } from '@/lib/db';
import { BezPristupa } from '@/components/BezPristupa';
import { NovostForma } from '@/components/PanelNovostiKlijent';

export const metadata: Metadata = { title: 'Novost - panel', robots: { index: false } };

export default async function UrediNovost({ params }: { params: Promise<{ id: string }> }) {
  const staff = await staffKorisnik();
  if (!staff) return <BezPristupa prijavljen={!!(await trenutniKorisnik())} />;
  if (staff.nivo !== 'odluka') return <BezPristupa prijavljen poruka="Novosti pišu vlasnici i head staff." />;
  if (!imaBazu()) return <BezPristupa prijavljen poruka="Baza nije povezana." />;

  const p = (await params).id;
  let novost: NovostRed | null = null;
  if (p !== 'nova') {
    const id = Number(p);
    if (!Number.isInteger(id) || id <= 0) notFound();
    const sql = await db();
    [novost] = await sql<NovostRed[]>`SELECT * FROM novosti WHERE id = ${id}`;
    if (!novost) notFound();
  }

  return (
    <div className="sadrzaj pb-24 pt-[100px] md:pt-[110px]">
      <Link href="/panel/novosti" className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[15px] text-sivo hover:text-tekst">
        <ChevronLeft className="size-4" /> Sve novosti
      </Link>
      <h1 className="plakat mt-4 text-[clamp(48px,6vw,76px)]">{novost ? 'Izmeni novost' : 'Nova novost'}</h1>
      <NovostForma
        id={novost?.id ?? null}
        kategorije={KATEGORIJE_NOVOSTI.map(k => ({ id: k.id, naziv: k.naziv }))}
        imaKanal={!!DISCORD.novostiKanalId}
        pocetno={novost ? { naslov: novost.naslov, kategorija: novost.kategorija, kratko: novost.kratko, tekst: novost.tekst, slika: novost.slika || '', objavljena: novost.objavljena } : undefined}
      />
    </div>
  );
}
