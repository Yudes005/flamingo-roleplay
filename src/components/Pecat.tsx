import { datum } from '@/lib/format';
import type { StatusPrijave } from '@/lib/db';

export function Pecat({ status, kad, udari = false, velicina = 'srednji' }: { status: StatusPrijave | 'primljeno'; kad?: Date | string | null; udari?: boolean; velicina?: 'mali' | 'srednji' | 'veliki' }) {
  const v = { mali: 'text-[15px]', srednji: 'text-[22px]', veliki: 'text-[34px]' }[velicina];
  const m = {
    primljeno: { tekst: 'Primljeno', klasa: 'pecat-plavi' },
    na_cekanju: { tekst: 'U obradi', klasa: 'pecat-plavi' },
    prihvacena: { tekst: 'Odobreno', klasa: 'pecat-zeleni' },
    odbijena: { tekst: 'Odbijeno', klasa: 'pecat-crveni' },
  }[status];
  return (
    <span className={`pecat ${m.klasa} ${v} ${udari ? 'pecat-udari' : ''}`}>
      {m.tekst.toUpperCase()}
      {kad && <small>{datum(kad)}</small>}
    </span>
  );
}
