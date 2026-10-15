import 'server-only';
import postgres from 'postgres';

// ============================================================
//  BAZA (Postgres - npr. Neon preko Vercela). Tabele se prave same.
// ============================================================

let sql: postgres.Sql | null = null;
let spremno: Promise<void> | null = null;

export function imaBazu() {
  return !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function veza() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL nije podešen (Vercel -> Storage -> Neon)');
  if (!sql) {
    const lokalno = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    sql = postgres(url, { ssl: lokalno ? false : 'require', max: 3, idle_timeout: 20, connect_timeout: 8, prepare: false, onnotice: () => {} });
  }
  return sql;
}

async function napraviTabele(s: postgres.Sql) {
  // ---------- prijave i reportovi ----------
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
  await s`ALTER TABLE prijave ADD COLUMN IF NOT EXISTS preuzeo_id TEXT`;
  await s`ALTER TABLE prijave ADD COLUMN IF NOT EXISTS preuzeo_ime TEXT`;
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

  // ---------- novosti ----------
  await s`CREATE TABLE IF NOT EXISTS novosti (
    id SERIAL PRIMARY KEY,
    naslov TEXT NOT NULL,
    kategorija TEXT NOT NULL DEFAULT 'obavestenje',
    kratko TEXT NOT NULL,
    tekst TEXT NOT NULL,
    slika TEXT,
    autor_id TEXT NOT NULL,
    autor_ime TEXT NOT NULL,
    autor_avatar TEXT,
    objavljena BOOLEAN NOT NULL DEFAULT true,
    napravljena TIMESTAMPTZ NOT NULL DEFAULT now(),
    izmenjena TIMESTAMPTZ
  )`;
  await s`CREATE INDEX IF NOT EXISTS novosti_datum ON novosti (objavljena, napravljena DESC)`;

  // ---------- predlozi ----------
  await s`CREATE TABLE IF NOT EXISTS predlozi (
    id SERIAL PRIMARY KEY,
    korisnik_id TEXT NOT NULL,
    korisnik_ime TEXT NOT NULL,
    korisnik_avatar TEXT,
    kategorija TEXT NOT NULL,
    naslov TEXT NOT NULL,
    tekst TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'novo',
    odgovor TEXT,
    odgovorio_ime TEXT,
    napravljen TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await s`CREATE INDEX IF NOT EXISTS predlozi_status ON predlozi (status, napravljen DESC)`;
  await s`CREATE TABLE IF NOT EXISTS predlozi_glasovi (
    predlog_id INT NOT NULL REFERENCES predlozi(id) ON DELETE CASCADE,
    korisnik_id TEXT NOT NULL,
    PRIMARY KEY (predlog_id, korisnik_id)
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
  preuzeo_id: string | null;
  preuzeo_ime: string | null;
  napravljena: Date;
  odluceno: Date | null;
};

export type NovostRed = {
  id: number;
  naslov: string;
  kategorija: string;
  kratko: string;
  tekst: string;
  slika: string | null;
  autor_id: string;
  autor_ime: string;
  autor_avatar: string | null;
  objavljena: boolean;
  napravljena: Date;
  izmenjena: Date | null;
};

export type StatusPredloga = 'novo' | 'razmatra' | 'prihvaceno' | 'uradjeno' | 'odbijeno';

export type PredlogRed = {
  id: number;
  korisnik_id: string;
  korisnik_ime: string;
  korisnik_avatar: string | null;
  kategorija: string;
  naslov: string;
  tekst: string;
  status: StatusPredloga;
  odgovor: string | null;
  odgovorio_ime: string | null;
  napravljen: Date;
};
