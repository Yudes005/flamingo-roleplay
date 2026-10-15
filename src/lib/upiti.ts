import 'server-only';
import { db, type PrijavaRed } from './db';
import { nadjiPrijavu } from '@/config/prijave';

// poslednja prijava korisnika po vrsti (za dugmad na /prijave)
export async function poslednjePoVrsti(korisnikId: string): Promise<Record<string, PrijavaRed>> {
  const sql = await db();
  const redovi = await sql<PrijavaRed[]>`
    SELECT DISTINCT ON (vrsta) * FROM prijave WHERE korisnik_id = ${korisnikId}
    ORDER BY vrsta, napravljena DESC`;
  return Object.fromEntries(redovi.map(r => [r.vrsta, r]));
}

export function stanjeZaVrstu(vrstaId: string, poslednja?: PrijavaRed):
  { tip: 'moze' } | { tip: 'ceka'; id: number } | { tip: 'prihvacena' } | { tip: 'pauza'; dana: number } {
  if (!poslednja) return { tip: 'moze' };
  if (poslednja.status === 'na_cekanju') return { tip: 'ceka', id: poslednja.id };
  if (poslednja.status === 'prihvacena' && vrstaId !== 'zalba') return { tip: 'prihvacena' };
  if (poslednja.status === 'odbijena' && poslednja.odluceno) {
    const vrsta = nadjiPrijavu(vrstaId);
    const moze = poslednja.odluceno.getTime() + (vrsta?.ponovoPosleDana || 0) * 86400000;
    if (moze > Date.now()) return { tip: 'pauza', dana: Math.ceil((moze - Date.now()) / 86400000) };
  }
  return { tip: 'moze' };
}
