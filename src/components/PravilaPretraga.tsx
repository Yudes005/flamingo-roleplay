'use client';
import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Poglavlje } from '@/config/pravila';

function normalizuj(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj');
}

export function PravilaPretraga({ poglavlja }: { poglavlja: Poglavlje[] }) {
  const [upit, setUpit] = useState('');
  const q = normalizuj(upit.trim());

  const filtrirano = useMemo(() => poglavlja.map((p, i) => ({
    ...p,
    broj: i + 1,
    pravila: p.pravila.map((r, j) => ({ ...r, broj: `${i + 1}.${j + 1}` }))
      .filter(r => !q || normalizuj(`${r.naslov} ${r.tekst} ${p.naslov}`).includes(q)),
  })).filter(p => p.pravila.length > 0), [poglavlja, q]);

  const ukupno = filtrirano.reduce((s, p) => s + p.pravila.length, 0);

  return (
    <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
      <aside className="lg:sticky lg:top-[100px] lg:self-start">
        <label className="relative block">
          <span className="sr-only">Pretraži pravila</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-sivo" />
          <input value={upit} onChange={e => setUpit(e.target.value)} placeholder="Pretraži pravila"
            className="polje !rounded-xl !py-3 !pl-10 !pr-10" />
          {upit && (
            <button type="button" onClick={() => setUpit('')} aria-label="Obriši pretragu" className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-sivo hover:text-tekst">
              <X className="size-4" />
            </button>
          )}
        </label>
        <nav className="mt-6 hidden lg:block" aria-label="Poglavlja">
          <ol className="space-y-1">
            {poglavlja.map((p, i) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className="flex gap-3 rounded-lg px-3 py-2 text-[15px] text-sivo transition-colors hover:bg-white/[.05] hover:text-tekst">
                  <span className="w-4 text-right font-semibold text-flamingo-2 tabular-nums">{i + 1}</span>{p.naslov}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </aside>

      <div>
        {q && (
          <p className="mb-6 text-[15px] text-sivo" role="status">
            {ukupno ? `Pronađeno: ${ukupno}` : 'Nema pravila koja sadrže taj tekst. Probaj drugu reč.'}
          </p>
        )}
        <div className="space-y-14">
          {filtrirano.map(p => (
            <section key={p.id} id={p.id} className="scroll-mt-[100px]">
              <h2 className="flex items-baseline gap-4 text-[clamp(24px,3vw,32px)] font-bold">
                <span className="text-flamingo tabular-nums">{p.broj}</span>{p.naslov}
              </h2>
              {p.uvod && !q && <p className="mt-3 max-w-2xl text-[16.5px] text-sivo">{p.uvod}</p>}
              <ol className="mt-6 divide-y divide-white/[.07] border-y border-white/[.07]">
                {p.pravila.map(r => (
                  <li key={r.broj} id={`pravilo-${r.broj}`} className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-2 py-5 md:grid-cols-[64px_minmax(0,1fr)]">
                    <span className="text-[16px] font-semibold leading-[1.6] text-flamingo-2 tabular-nums">{r.broj}</span>
                    <div>
                      <h3 className="font-sans text-[17px] font-semibold leading-[1.5] tracking-normal">{r.naslov}</h3>
                      <p className="mt-1.5 max-w-[68ch] text-[16px] text-sivo">{r.tekst}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
