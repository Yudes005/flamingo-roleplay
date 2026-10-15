import 'server-only';
import postgres from 'postgres';

// ============================================================
//  BAZA (Postgres - npr. Neon preko Vercela). Tabele se prave same.
// ============================================================

let sql: postgres.Sql | null = null;
let spremno: Promise<void> | null = null;

function veza() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL nije podešen (Vercel -> Storage -> Neon)');
  if (!sql) {
    const lokalno = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    sql = postgres(url, { ssl: lokalno ? false : 'require', max: 3, idle_timeout: 20, prepare: false, onnotice: () => {} });
  }
  return sql;
}

async function napraviTabele(s: postgres.Sql) {
  await s`CREATE TABLE IF NOT EXISTS prijave (
    id SERIAL PRIMARY KEY,
    vrsta TEXT NOT NULL,
    korisnik_id TEXT NOT NULL,
    korisnik_ime TEXT NOT NULL,
    korisnik_avatar TEXT,
    odgovori JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'na_cekanju',
    razlog TEXT,
    odlucio_id TEXT,
    odlucio_ime TEXT,
    uloga_dodeljena BOOLEAN,
    napravljena TIMESTAMPTZ NOT NULL DEFAULT now(),
    odluceno TIMESTAMPTZ
  )`;
  await s`ALTER TABLE prijave ADD COLUMN IF NOT EXISTS dm_poslat BOOLEAN`;
  await s`CREATE INDEX IF NOT EXISTS prijave_korisnik ON prijave (korisnik_id)`;
  await s`CREATE INDEX IF NOT EXISTS prijave_status ON prijave (status, napravljena DESC)`;
  await s`CREATE TABLE IF NOT EXISTS prijave_glasovi (
    prijava_id INT NOT NULL REFERENCES prijave(id) ON DELETE CASCADE,
    glasao_id TEXT NOT NULL,
    glasao_ime TEXT NOT NULL,
    glas SMALLINT NOT NULL,
    PRIMARY KEY (prijava_id, glasao_id)
  )`;
  await s`CREATE TABLE IF NOT EXISTS prijave_komentari (
    id SERIAL PRIMARY KEY,
    prijava_id INT NOT NULL REFERENCES prijave(id) ON DELETE CASCADE,
    autor_id TEXT NOT NULL,
    autor_ime TEXT NOT NULL,
    autor_avatar TEXT,
    tekst TEXT NOT NULL,
    napravljen TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
}

export async function db() {
  const s = veza();
  if (!spremno) {
    spremno = napraviTabele(s).catch(async err => {
      // dve instance istovremeno -> jedna dobije "already exists"; probaj još jednom
      await new Promise(r => setTimeout(r, 300));
      return napraviTabele(s).catch(e => { spremno = null; throw e ?? err; });
    });
  }
  await spremno;
  return s;
}

export type StatusPrijave = 'na_cekanju' | 'prihvacena' | 'odbijena';

export type PrijavaRed = {
  id: number;
  vrsta: string;
  korisnik_id: string;
  korisnik_ime: string;
  korisnik_avatar: string | null;
  odgovori: Record<string, string | number | boolean>;
  status: StatusPrijave;
  razlog: string | null;
  odlucio_id: string | null;
  odlucio_ime: string | null;
  uloga_dodeljena: boolean | null;
  dm_poslat: boolean | null;
  napravljena: Date;
  odluceno: Date | null;
};
