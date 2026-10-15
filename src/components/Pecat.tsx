import { datum } from '@/lib/format';
import type { StatusPrijave } from '@/lib/db';

export function Pecat({ status, kad, udari = false, velicina = 'srednji', da = 'Odobreno', ne = 'Odbijeno' }: {
  status: StatusPrijave | 'primljeno'; kad?: Date | string | null; udari?: boolean; velicina?: 'mali' | 'srednji' | 'veliki'; da?: string; ne?: string;
}) {
  const v = { mali: 'text-[16px]', srednji: 'text-[24px]', veliki: 'text-[38px]' }[velicina];
  const m = {
    primljeno: { tekst: 'Primljeno', klasa: 'pecat-plavi' },
    na_cekanju: { tekst: 'U obradi', klasa: 'pecat-plavi' },
    prihvacena: { tekst: da, klasa: 'pecat-zeleni' },
    odbijena: { tekst: ne, klasa: 'pecat-crveni' },
  }[status];
  return (
    <span className={`pecat ${m.klasa} ${v} ${udari ? 'pecat-udari' : ''}`}>
      {m.tekst.toUpperCase()}
      {kad && <small>{datum(kad)}</small>}
    </span>
  );
}
