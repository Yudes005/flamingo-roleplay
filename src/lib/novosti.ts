import 'server-only';
import { db, imaBazu, type NovostRed } from './db';

// Sve funkcije vraćaju prazno ako baza nije podešena, da sajt radi i bez nje.

export async function poslednjeNovosti(n = 3): Promise<NovostRed[]> {
  if (!imaBazu()) return [];
  try {
    const sql = await db();
    return await sql<NovostRed[]>`SELECT * FROM novosti WHERE objavljena ORDER BY napravljena DESC LIMIT ${n}`;
  } catch {
    return [];
  }
}

export async function sveNovosti(kategorija?: string): Promise<NovostRed[] | null> {
  if (!imaBazu()) return null;
  try {
    const sql = await db();
    const k = kategorija || '';
    return await sql<NovostRed[]>`
      SELECT * FROM novosti WHERE objavljena AND (${k} = '' OR kategorija = ${k})
      ORDER BY napravljena DESC LIMIT 100`;
  } catch {
    return null;
  }
}

export async function jednaNovost(id: number): Promise<NovostRed | null> {
  if (!imaBazu() || !Number.isInteger(id) || id <= 0) return null;
  try {
    const sql = await db();
    const [n] = await sql<NovostRed[]>`SELECT * FROM novosti WHERE id = ${id}`;
    return n || null;
  } catch {
    return null;
  }
}
