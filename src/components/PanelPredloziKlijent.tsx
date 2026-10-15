'use client';
import { useActionState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { obrisiPredlog, odgovoriPredlog, type StanjeOdgovora } from '@/lib/akcije';

export function OdgovorPredlogu({ id, status, odgovor, statusi }: { id: number; status: string; odgovor: string; statusi: { id: string; naziv: string }[] }) {
  const akcija = odgovoriPredlog.bind(null, id);
  const [stanje, posalji, salje] = useActionState<StanjeOdgovora, FormData>(akcija, {});
  const [brise, start] = useTransition();
  return (
    <form action={posalji} className="space-y-3">
      <select name="status" defaultValue={status} className="polje" aria-label="Status predloga">
        {statusi.map(s => <option key={s.id} value={s.id}>{s.naziv}</option>)}
      </select>
      <textarea name="odgovor" rows={2} maxLength={1500} defaultValue={odgovor} placeholder="Odgovor igraču (vidi se javno)" className="polje resize-y text-[14.5px]" aria-label="Odgovor" />
      {stanje.greska && <p className="text-[13.5px] text-[#ff8a8e]">{stanje.greska}</p>}
      {stanje.ok && <p className="text-[13.5px] text-zelena" role="status">Sačuvano. Igrač dobija poruku na Discordu kad status nije „Novo”.</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={salje} className="dugme dugme-glavno dugme-malo flex-1">
          {salje && <Loader2 className="size-4 animate-spin" />} Sačuvaj
        </button>
        <button type="button" disabled={brise} aria-label="Obriši predlog"
          onClick={() => { if (confirm('Da obrišem ovaj predlog?')) start(async () => { await obrisiPredlog(id); }); }}
          className="dugme dugme-obicno dugme-malo !px-3 text-[#ff8a8e]">
          {brise ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
    </form>
  );
}
