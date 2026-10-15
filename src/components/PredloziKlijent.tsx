'use client';
import { useActionState, useOptimistic, useTransition } from 'react';
import { ChevronUp, Loader2 } from 'lucide-react';
import { glasajPredlog, posaljiPredlog, type StanjePredloga } from '@/lib/akcije';

export function GlasPredloga({ id, glasova, moj, prijavljen }: { id: number; glasova: number; moj: boolean; prijavljen: boolean }) {
  const [stanje, postavi] = useOptimistic({ glasova, moj }, (s, _: null) => ({ glasova: s.glasova + (s.moj ? -1 : 1), moj: !s.moj }));
  const [, start] = useTransition();
  const klik = () => {
    if (!prijavljen) { window.location.href = '/api/auth/discord?nazad=/predlozi'; return; }
    start(async () => { postavi(null); await glasajPredlog(id); });
  };
  return (
    <button type="button" onClick={klik} aria-pressed={stanje.moj} aria-label={`${stanje.moj ? 'Povuci glas' : 'Glasaj za predlog'}, ${stanje.glasova} glasova`}
      className={`flex h-[72px] w-16 flex-col items-center justify-center rounded-2xl border text-[17px] font-semibold tabular-nums transition-colors ${stanje.moj
        ? 'border-flamingo bg-flamingo text-white'
        : 'border-white/15 hover:border-white/40'}`}>
      <ChevronUp className="size-5" strokeWidth={2.5} />
      {stanje.glasova}
    </button>
  );
}

export function PredlogForma({ kategorije }: { kategorije: string[] }) {
  const [stanje, posalji, salje] = useActionState<StanjePredloga, FormData>(posaljiPredlog, {});
  const g = stanje.polja || {};
  const v = stanje.vrednosti || {};
  if (stanje.ok) {
    return (
      <div className="mt-5 rounded-xl bg-zelena/10 px-4 py-3 text-[15px] text-zelena" role="status">
        Predlog je poslat i vidi se u listi. Tvoj glas je već uračunat.
        <button type="button" onClick={() => window.location.reload()} className="mt-2 block font-semibold underline underline-offset-4">Pošalji još jedan</button>
      </div>
    );
  }
  return (
    <form action={posalji} className="mt-5 space-y-4" noValidate>
      <div>
        <label htmlFor="pr-naslov" className="text-[14px] text-sivo">Naslov</label>
        <input id="pr-naslov" name="naslov" maxLength={100} defaultValue={v.naslov} placeholder="npr. Posao poštara" className="polje mt-1.5" aria-invalid={!!g.naslov} />
        {g.naslov && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.naslov}</p>}
      </div>
      <div>
        <label htmlFor="pr-kat" className="text-[14px] text-sivo">Kategorija</label>
        <select id="pr-kat" name="kategorija" defaultValue={v.kategorija || ''} className="polje mt-1.5" aria-invalid={!!g.kategorija}>
          <option value="" disabled>Izaberi...</option>
          {kategorije.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        {g.kategorija && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.kategorija}</p>}
      </div>
      <div>
        <label htmlFor="pr-tekst" className="text-[14px] text-sivo">Opis</label>
        <textarea id="pr-tekst" name="tekst" rows={5} maxLength={3000} defaultValue={v.tekst} placeholder="Šta bi se dodalo ili promenilo i zašto bi to bilo dobro za grad?" className="polje mt-1.5 resize-y" aria-invalid={!!g.tekst} />
        {g.tekst && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.tekst}</p>}
      </div>
      {stanje.greska && <p className="text-[14px] text-[#ff8a8e]" role="alert">{stanje.greska}</p>}
      <button type="submit" disabled={salje} className="dugme dugme-glavno w-full">
        {salje && <Loader2 className="size-4 animate-spin" />} Pošalji predlog
      </button>
    </form>
  );
}
