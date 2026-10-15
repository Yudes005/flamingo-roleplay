import 'server-only';
import { db, imaBazu, type PredlogRed } from './db';

export type PredlogSaGlasovima = PredlogRed & { glasova: number; moj: boolean };

export async function listaPredloga(o: { sort: 'top' | 'novo'; status: string; korisnikId?: string }): Promise<PredlogSaGlasovima[] | null> {
  if (!imaBazu()) return null;
  try {
    const sql = await db();
    const ja = o.korisnikId || '';
    return await sql<PredlogSaGlasovima[]>`
      SELECT p.*,
        (SELECT count(*) FROM predlozi_glasovi g WHERE g.predlog_id = p.id)::int AS glasova,
        EXISTS (SELECT 1 FROM predlozi_glasovi g WHERE g.predlog_id = p.id AND g.korisnik_id = ${ja}) AS moj
      FROM predlozi p
      WHERE (${o.status} = '' OR p.status = ${o.status})
      ORDER BY ${o.sort === 'top' ? sql`glasova DESC, p.napravljen DESC` : sql`p.napravljen DESC`}
      LIMIT 150`;
  } catch {
    return null;
  }
}
