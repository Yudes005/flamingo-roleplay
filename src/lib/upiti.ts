import 'server-only';
import { db, type PrijavaRed } from './db';
import type { VrstaPrijave } from '@/config/prijave';

export type InfoVrste = { naCekanju: number; poslednjaOdlucena?: PrijavaRed };

// za svaku vrstu: koliko čeka i poslednja odlučena (za dugmad na /prijave)
export async function stanjePrijava(korisnikId: string): Promise<Record<string, InfoVrste>> {
  const sql = await db();
  const [cekaju, odlucene] = await Promise.all([
    sql<{ vrsta: string; n: number }[]>`
      SELECT vrsta, count(*)::int AS n FROM prijave WHERE korisnik_id = ${korisnikId} AND status = 'na_cekanju' GROUP BY vrsta`,
    sql<PrijavaRed[]>`
      SELECT DISTINCT ON (vrsta) * FROM prijave WHERE korisnik_id = ${korisnikId} AND status <> 'na_cekanju'
      ORDER BY vrsta, odluceno DESC NULLS LAST`,
  ]);
  const out: Record<string, InfoVrste> = {};
  for (const c of cekaju) out[c.vrsta] = { naCekanju: c.n };
  for (const o of odlucene) out[o.vrsta] = { naCekanju: out[o.vrsta]?.naCekanju || 0, poslednjaOdlucena: o };
  return out;
}

export type Stanje = { tip: 'moze' } | { tip: 'ceka'; n: number } | { tip: 'prihvacena' } | { tip: 'pauza'; dana: number };

export function stanjeZaVrstu(vrsta: VrstaPrijave, info?: InfoVrste): Stanje {
  if (!info) return { tip: 'moze' };
  if (info.naCekanju >= (vrsta.naCekanjuMax || 1)) return { tip: 'ceka', n: info.naCekanju };
  const p = info.poslednjaOdlucena;
  if (vrsta.jednom && p?.status === 'prihvacena') return { tip: 'prihvacena' };
  if (vrsta.ponovoPosleDana > 0 && p?.status === 'odbijena' && p.odluceno) {
    const moze = p.odluceno.getTime() + vrsta.ponovoPosleDana * 86400000;
    if (moze > Date.now()) return { tip: 'pauza', dana: Math.ceil((moze - Date.now()) / 86400000) };
  }
  return { tip: 'moze' };
}
