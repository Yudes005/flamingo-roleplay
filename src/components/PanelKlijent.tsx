'use client';
import Image from 'next/image';
import { useActionState, useState, useTransition } from 'react';
import { Loader2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { glasaj, komentarisi, odluci, type StanjeKomentara, type StanjeOdluke } from '@/lib/akcije';

export function Glasanje({ prijavaId, moj, za, protiv }: {
  prijavaId: number; moj: number; za: string[]; protiv: string[];
}) {
  const [radi, start] = useTransition();
  const klik = (g: 1 | -1) => start(async () => { await glasaj(prijavaId, moj === g ? 0 : g); });
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => klik(1)} disabled={radi} aria-pressed={moj === 1}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[15px] font-semibold transition-colors ${moj === 1 ? 'border-palma bg-palma/15 text-palma' : 'border-white/12 hover:border-white/25'}`}>
          <ThumbsUp className="size-4" /> Za <span className="tabular-nums">{za.length}</span>
        </button>
        <button type="button" onClick={() => klik(-1)} disabled={radi} aria-pressed={moj === -1}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-[15px] font-semibold transition-colors ${moj === -1 ? 'border-crvena bg-crvena/15 text-[#ff8a8e]' : 'border-white/12 hover:border-white/25'}`}>
          <ThumbsDown className="size-4" /> Protiv <span className="tabular-nums">{protiv.length}</span>
        </button>
      </div>
      {(za.length > 0 || protiv.length > 0) && (
        <div className="mt-3 space-y-1 text-[13.5px] text-sivo">
          {za.length > 0 && <p><span className="text-palma">Za:</span> {za.join(', ')}</p>}
          {protiv.length > 0 && <p><span className="text-[#ff8a8e]">Protiv:</span> {protiv.join(', ')}</p>}
        </div>
      )}
    </div>
  );
}

export function KomentarForma({ prijavaId }: { prijavaId: number }) {
  const akcija = komentarisi.bind(null, prijavaId);
  const [stanje, posalji, salje] = useActionState<StanjeKomentara, FormData>(akcija, {});
  const [kljuc, setKljuc] = useState(0);
  return (
    <form action={async fd => { await posalji(fd); setKljuc(k => k + 1); }} className="mt-4">
      <label htmlFor="komentar" className="sr-only">Interni komentar</label>
      <textarea key={kljuc} id="komentar" name="tekst" rows={3} maxLength={2000} placeholder="Napiši komentar za ostale iz staffa (igrač ga ne vidi)"
        className="polje resize-y text-[15px]" />
      {stanje.greska && <p className="mt-1.5 text-[14px] text-[#ff8a8e]">{stanje.greska}</p>}
      <button type="submit" disabled={salje} className="dugme dugme-obicno mt-2 !min-h-10 text-[14.5px]">
        {salje && <Loader2 className="size-4 animate-spin" />} Dodaj komentar
      </button>
    </form>
  );
}

export function OdlukaForma({ prijavaId, imaUlogu }: { prijavaId: number; imaUlogu: boolean }) {
  const akcija = odluci.bind(null, prijavaId);
  const [stanje, posalji, salje] = useActionState<StanjeOdluke, FormData>(akcija, {});
  const [izbor, setIzbor] = useState<'prihvacena' | 'odbijena' | ''>('');

  if (stanje.ok) {
    return <p className="rounded-xl bg-palma/10 px-4 py-3 text-[15px] text-palma" role="status">Odluka je sačuvana. {stanje.poruka}</p>;
  }

  return (
    <form action={posalji} className="space-y-4">
      <fieldset>
        <legend className="sr-only">Odluka</legend>
        <div className="grid grid-cols-2 gap-2">
          {([['prihvacena', 'Prihvati'], ['odbijena', 'Odbij']] as const).map(([v, t]) => (
            <label key={v} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-[15px] font-semibold transition-colors ${izbor === v ? (v === 'prihvacena' ? 'border-palma bg-palma/15 text-palma' : 'border-crvena bg-crvena/15 text-[#ff8a8e]') : 'border-white/12 hover:border-white/25'}`}>
              <input type="radio" name="odluka" value={v} className="sr-only" checked={izbor === v} onChange={() => setIzbor(v)} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="razlog" className="text-[14px] text-sivo">
          {izbor === 'odbijena' ? 'Razlog odbijanja (igrač ga dobija u poruci)' : 'Poruka igraču (nije obavezno)'}
        </label>
        <textarea id="razlog" name="razlog" rows={3} maxLength={1000} className="polje mt-1.5 resize-y text-[15px]" />
      </div>
      <label className="flex items-center gap-2.5 text-[14.5px]">
        <input type="checkbox" name="javi" defaultChecked className="size-4 accent-[#f23c77]" />
        Pošalji igraču poruku na Discordu
      </label>
      {imaUlogu && izbor === 'prihvacena' && (
        <p className="text-[13.5px] text-sivo">Bot će igraču automatski dati Discord ulogu za ovu poziciju.</p>
      )}
      {stanje.greska && <p className="text-[14px] text-[#ff8a8e]" role="alert">{stanje.greska}</p>}
      <button type="submit" disabled={salje || !izbor} className={`dugme w-full ${izbor === 'odbijena' ? 'bg-crvena text-white hover:bg-[#f05a5f]' : 'dugme-glavno'}`}>
        {salje && <Loader2 className="size-4 animate-spin" />}
        {izbor === 'odbijena' ? 'Odbij prijavu' : izbor === 'prihvacena' ? 'Prihvati prijavu' : 'Izaberi odluku'}
      </button>
    </form>
  );
}

export function Avatar({ src, velicina = 32 }: { src: string | null; velicina?: number }) {
  if (!src) return <span className="inline-block rounded-full bg-noc-4" style={{ width: velicina, height: velicina }} />;
  return <Image src={src} alt="" unoptimized width={velicina} height={velicina} className="shrink-0 rounded-full" style={{ width: velicina, height: velicina }} />;
}
