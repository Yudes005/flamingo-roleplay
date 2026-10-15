'use client';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { Polje } from '@/config/prijave';
import { posaljiPrijavu, type StanjeForme } from '@/lib/akcije';

function Brojac({ duzina, min, max }: { duzina: number; min?: number; max?: number }) {
  const malo = min && duzina < min;
  return (
    <span className={`text-[12.5px] tabular-nums ${malo ? 'text-mastilo/55' : 'text-[#0f8a72]'}`}>
      {duzina}{max ? ` / ${max}` : ''}{malo ? ` (još ${min - duzina})` : ''}
    </span>
  );
}

export function PrijavaForma({ vrstaId, polja, ime }: { vrstaId: string; polja: Polje[]; ime: string }) {
  const akcija = posaljiPrijavu.bind(null, vrstaId);
  const [stanje, posalji, salje] = useActionState<StanjeForme, FormData>(akcija, {});
  const [duzine, setDuzine] = useState<Record<string, number>>({});
  // greška polja nestaje čim igrač počne da ga ispravlja
  const [ispravljeno, setIspravljeno] = useState<Record<string, boolean>>({});
  useEffect(() => setIspravljeno({}), [stanje]);
  // posle svake provere forma se iscrta iznova sa onim što je igrač upisao (i padajuće liste)
  const verzija = useMemo(() => Math.random().toString(36), [stanje]);
  const ispravi = (id: string) => setIspravljeno(x => (x[id] ? x : { ...x, [id]: true }));

  const greske = stanje.polja || {};
  const vrednosti = stanje.vrednosti || {};
  let broj = 0;

  return (
    <form key={verzija} action={posalji} noValidate className="mt-8">
      <ol className="space-y-7">
        {polja.map(p => {
          const g = ispravljeno[p.id] ? undefined : greske[p.id];
          const idG = `${p.id}-greska`;
          if (p.tip === 'potvrda') {
            return (
              <li key={p.id} className="list-none">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] border-dashed border-mastilo/25 p-4">
                  <input type="checkbox" name={p.id} onChange={() => ispravi(p.id)} className="mt-1 size-5 shrink-0 accent-[#f23c77]" aria-invalid={!!g} aria-describedby={g ? idG : undefined} defaultChecked={!!vrednosti[p.id]} />
                  <span className="text-[15.5px]">{p.pitanje}</span>
                </label>
                {g && <p id={idG} className="mt-1.5 text-[14px] font-medium text-[#c4283a]">{g}</p>}
              </li>
            );
          }
          broj += 1;
          const obavezno = 'obavezno' in p && p.obavezno;
          return (
            <li key={p.id} className="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2">
              <span className="pt-0.5 font-display text-[15px] font-bold text-mastilo/45 tabular-nums">{broj}.</span>
              <div>
                <label htmlFor={p.id} className="block text-[16px] font-semibold leading-snug">
                  {p.pitanje}{!obavezno && <span className="font-normal text-mastilo/55"> (nije obavezno)</span>}
                </label>
                {p.pomoc && <p className="mt-1 text-[14px] text-mastilo/65">{p.pomoc}</p>}
                <div className="mt-2.5">
                  {p.tip === 'opis' ? (
                    <>
                      <textarea id={p.id} name={p.id} rows={4} maxLength={p.max} defaultValue={vrednosti[p.id]}
                        onChange={e => { ispravi(p.id); setDuzine(d => ({ ...d, [p.id]: e.target.value.trim().length })); }}
                        className="papir-polje resize-y" aria-invalid={!!g} aria-describedby={g ? idG : undefined} />
                      <div className="mt-1 flex justify-end"><Brojac duzina={duzine[p.id] ?? (vrednosti[p.id] || '').trim().length} min={p.min} max={p.max} /></div>
                    </>
                  ) : p.tip === 'izbor' ? (
                    <select id={p.id} name={p.id} defaultValue={vrednosti[p.id] || ''} onChange={() => ispravi(p.id)} className="papir-polje" aria-invalid={!!g} aria-describedby={g ? idG : undefined}>
                      <option value="" disabled>Izaberi...</option>
                      {p.opcije.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input id={p.id} name={p.id} type={p.tip === 'broj' ? 'number' : 'text'} inputMode={p.tip === 'broj' ? 'numeric' : undefined}
                      min={p.tip === 'broj' ? p.min : undefined} max={p.tip === 'broj' ? p.max : undefined}
                      maxLength={p.tip === 'tekst' ? p.max : undefined} defaultValue={vrednosti[p.id]} onChange={() => ispravi(p.id)}
                      className={`papir-polje ${p.tip === 'broj' ? 'max-w-[140px]' : ''}`} aria-invalid={!!g} aria-describedby={g ? idG : undefined} />
                  )}
                </div>
                {g && <p id={idG} className="mt-1.5 text-[14px] font-medium text-[#c4283a]">{g}</p>}
              </div>
            </li>
          );
        })}
      </ol>

      {stanje.greska && (
        <p className="mt-8 rounded-lg bg-[#c4283a]/10 px-4 py-3 text-[15px] font-medium text-[#a11f2f]" role="alert">{stanje.greska}</p>
      )}

      <div className="mt-10 flex flex-col-reverse gap-6 border-t-2 border-mastilo/80 pt-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12.5px] text-mastilo/65">Potpis podnosioca</p>
          <p className="mt-1 border-b border-mastilo/40 pb-1 pr-10 font-display text-[18px] font-semibold">{ime}</p>
        </div>
        <button type="submit" disabled={salje} className="dugme dugme-glavno">
          {salje ? <><Loader2 className="size-4 animate-spin" /> Šaljem...</> : 'Pošalji prijavu'}
        </button>
      </div>
    </form>
  );
}
