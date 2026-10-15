'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { nadjiPrijavu, type Polje } from '@/config/prijave';
import { DISCORD, SITE } from '@/config/site';
import { db, type PrijavaRed } from './db';
import { trenutniKorisnik } from './session';
import { staffKorisnik } from './dozvole';
import { dodajUlogu, nalogStarDana, posaljiDM, posaljiUKanal } from './discord';

const PINK = 0xf23c77;
const ZELENA = 0x2dd4b0;
const CRVENA = 0xe5484d;

function siteUrl() {
  return (process.env.SITE_URL || '').replace(/\/+$/, '');
}

// ============================================================
//  SLANJE PRIJAVE
// ============================================================
export type StanjeForme = {
  ok?: boolean;
  greska?: string;
  polja?: Record<string, string>;
  vrednosti?: Record<string, string>;
  id?: number;
};

function proveriPolje(p: Polje, raw: FormDataEntryValue | null): { vrednost: string | number | boolean; greska?: string } {
  const v = typeof raw === 'string' ? raw.trim() : '';
  if (p.tip === 'potvrda') {
    return raw ? { vrednost: true } : { vrednost: false, greska: 'Ovo moraš da potvrdiš.' };
  }
  const obavezno = 'obavezno' in p && p.obavezno;
  if (!v) return obavezno ? { vrednost: '', greska: 'Ovo polje je obavezno.' } : { vrednost: '' };

  if (p.tip === 'broj') {
    const n = Number(v);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return { vrednost: v, greska: 'Upiši ceo broj.' };
    if (p.min !== undefined && n < p.min) return { vrednost: v, greska: `Najmanje ${p.min}.` };
    if (p.max !== undefined && n > p.max) return { vrednost: v, greska: `Najviše ${p.max}.` };
    return { vrednost: n };
  }
  if (p.tip === 'izbor') {
    return p.opcije.includes(v) ? { vrednost: v } : { vrednost: '', greska: 'Izaberi jednu od ponuđenih opcija.' };
  }
  if (p.min && v.length < p.min) return { vrednost: v, greska: `Napiši bar ${p.min} znakova (sada ${v.length}).` };
  if (p.max && v.length > p.max) return { vrednost: v, greska: `Najviše ${p.max} znakova (sada ${v.length}).` };
  return { vrednost: v };
}

export async function posaljiPrijavu(vrstaId: string, _prev: StanjeForme, form: FormData): Promise<StanjeForme> {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return { greska: 'Sesija je istekla. Prijavi se ponovo preko Discorda.' };

  const vrsta = nadjiPrijavu(vrstaId);
  if (!vrsta) return { greska: 'Ova vrsta prijave ne postoji.' };
  if (!vrsta.otvorena) return { greska: 'Prijave za ovu poziciju su trenutno zatvorene.' };

  const odgovori: Record<string, string | number | boolean> = {};
  const polja: Record<string, string> = {};
  const vrednosti: Record<string, string> = {};
  for (const p of vrsta.polja) {
    const raw = form.get(p.id);
    if (typeof raw === 'string') vrednosti[p.id] = raw;
    const r = proveriPolje(p, raw);
    odgovori[p.id] = r.vrednost;
    if (r.greska) polja[p.id] = r.greska;
  }
  if (Object.keys(polja).length) return { greska: 'Neka polja nisu dobro popunjena.', polja, vrednosti };

  const sql = await db();

  // jedna prijava na čekanju po vrsti, i pauza posle odbijanja
  const [poslednja] = await sql<PrijavaRed[]>`
    SELECT * FROM prijave WHERE korisnik_id = ${korisnik.id} AND vrsta = ${vrsta.id}
    ORDER BY napravljena DESC LIMIT 1`;
  if (poslednja?.status === 'na_cekanju') {
    return { greska: 'Već imaš prijavu za ovu poziciju koja čeka odluku.', vrednosti };
  }
  if (poslednja?.status === 'odbijena' && poslednja.odluceno) {
    const moze = new Date(poslednja.odluceno.getTime() + vrsta.ponovoPosleDana * 86400000);
    if (moze > new Date()) {
      const dana = Math.ceil((moze.getTime() - Date.now()) / 86400000);
      return { greska: `Prethodna prijava je odbijena. Novu možeš da pošalješ za ${dana} ${dana === 1 ? 'dan' : 'dana'}.`, vrednosti };
    }
  }
  if (poslednja?.status === 'prihvacena' && vrsta.id !== 'zalba') {
    return { greska: 'Tvoja prijava za ovu poziciju je već prihvaćena.', vrednosti };
  }

  const [nova] = await sql<{ id: number }[]>`
    INSERT INTO prijave (vrsta, korisnik_id, korisnik_ime, korisnik_avatar, odgovori)
    VALUES (${vrsta.id}, ${korisnik.id}, ${korisnik.ime}, ${korisnik.avatar}, ${sql.json(odgovori)})
    RETURNING id`;

  // javi staffu u Discord kanal (ako je podešen) - greška ovde ne ruši slanje
  if (DISCORD.prijaveKanalId) {
    const godine = odgovori.godine ? `${odgovori.godine} god.` : '-';
    await posaljiUKanal(DISCORD.prijaveKanalId, {
      embeds: [{
        color: PINK,
        title: `Nova prijava: ${vrsta.naziv}`,
        url: `${siteUrl()}/panel/${nova.id}`,
        description: `<@${korisnik.id}> je poslao prijavu.`,
        fields: [
          { name: 'Lik u gradu', value: String(odgovori.ingame || '-'), inline: true },
          { name: 'Godine', value: godine, inline: true },
          { name: 'Discord nalog', value: `star ${nalogStarDana(korisnik.id)} dana`, inline: true },
        ],
        footer: { text: `Prijava #${nova.id} - otvori u panelu` },
        timestamp: new Date().toISOString(),
      }],
      allowed_mentions: { parse: [] },
    }).catch(() => null);
  }

  revalidatePath('/moje-prijave');
  revalidatePath('/panel');
  // igrač odmah vidi svoju prijavu sa pečatom PRIMLJENO
  redirect(`/moje-prijave?poslata=${nova.id}`);
}

// ============================================================
//  STAFF: glas, komentar, odluka
// ============================================================
export async function glasaj(prijavaId: number, glas: 1 | -1 | 0) {
  const staff = await staffKorisnik();
  if (!staff) return { greska: 'Nemaš pristup.' };
  const sql = await db();
  if (glas === 0) {
    await sql`DELETE FROM prijave_glasovi WHERE prijava_id = ${prijavaId} AND glasao_id = ${staff.korisnik.id}`;
  } else {
    await sql`
      INSERT INTO prijave_glasovi (prijava_id, glasao_id, glasao_ime, glas)
      VALUES (${prijavaId}, ${staff.korisnik.id}, ${staff.korisnik.ime}, ${glas})
      ON CONFLICT (prijava_id, glasao_id) DO UPDATE SET glas = EXCLUDED.glas, glasao_ime = EXCLUDED.glasao_ime`;
  }
  revalidatePath(`/panel/${prijavaId}`);
  revalidatePath('/panel');
  return { ok: true };
}

export type StanjeKomentara = { greska?: string; ok?: boolean };

export async function komentarisi(prijavaId: number, _prev: StanjeKomentara, form: FormData): Promise<StanjeKomentara> {
  const staff = await staffKorisnik();
  if (!staff) return { greska: 'Nemaš pristup.' };
  const tekst = String(form.get('tekst') || '').trim();
  if (tekst.length < 2) return { greska: 'Komentar je prazan.' };
  if (tekst.length > 2000) return { greska: 'Komentar je predugačak (najviše 2000 znakova).' };
  const sql = await db();
  await sql`
    INSERT INTO prijave_komentari (prijava_id, autor_id, autor_ime, autor_avatar, tekst)
    VALUES (${prijavaId}, ${staff.korisnik.id}, ${staff.korisnik.ime}, ${staff.korisnik.avatar}, ${tekst})`;
  revalidatePath(`/panel/${prijavaId}`);
  return { ok: true };
}

export type StanjeOdluke = { greska?: string; ok?: boolean; poruka?: string };

export async function odluci(prijavaId: number, _prev: StanjeOdluke, form: FormData): Promise<StanjeOdluke> {
  const staff = await staffKorisnik();
  if (!staff) return { greska: 'Nemaš pristup.' };
  if (staff.nivo !== 'odluka') return { greska: 'Tvoja uloga može da glasa, ali ne i da odlučuje.' };

  const odluka = String(form.get('odluka') || '');
  if (odluka !== 'prihvacena' && odluka !== 'odbijena') return { greska: 'Izaberi: prihvati ili odbij.' };
  const razlog = String(form.get('razlog') || '').trim().slice(0, 1000);
  if (odluka === 'odbijena' && razlog.length < 5) return { greska: 'Napiši razlog odbijanja (igrač ga dobija u poruci).' };
  const javi = form.get('javi') === 'on';

  const sql = await db();
  const [p] = await sql<PrijavaRed[]>`
    UPDATE prijave SET status = ${odluka}, razlog = ${razlog || null},
      odlucio_id = ${staff.korisnik.id}, odlucio_ime = ${staff.korisnik.ime}, odluceno = now()
    WHERE id = ${prijavaId} AND status = 'na_cekanju'
    RETURNING *`;
  if (!p) return { greska: 'Ova prijava je već rešena.' };

  const vrsta = nadjiPrijavu(p.vrsta);
  const naziv = vrsta?.naziv || p.vrsta;
  const poruke: string[] = [];

  if (odluka === 'prihvacena' && vrsta?.ulogaPriPrihvatanju) {
    const r = await dodajUlogu(p.korisnik_id, vrsta.ulogaPriPrihvatanju);
    await sql`UPDATE prijave SET uloga_dodeljena = ${r.ok} WHERE id = ${p.id}`;
    poruke.push(r.ok ? 'Discord uloga je dodeljena.' : `Uloga NIJE dodeljena (${r.poruka}). Dodaj je ručno.`);
  }

  if (javi) {
    const prihvacena = odluka === 'prihvacena';
    const r = await posaljiDM(p.korisnik_id, {
      embeds: [{
        color: prihvacena ? ZELENA : CRVENA,
        title: prihvacena ? `Prijava prihvaćena: ${naziv}` : `Prijava odbijena: ${naziv}`,
        description: (prihvacena
          ? `Čestitamo! Tvoja prijava za **${naziv}** na ${SITE.ime} je prihvaćena. Staff će ti se javiti sa sledećim koracima.`
          : `Tvoja prijava za **${naziv}** na ${SITE.ime} je odbijena.`)
          + (razlog ? `\n\n**Poruka staffa:** ${razlog}` : ''),
        footer: { text: 'Sve tvoje prijave su na sajtu, u delu Moje prijave' },
        url: `${siteUrl()}/moje-prijave`,
      }],
    });
    await sql`UPDATE prijave SET dm_poslat = ${r.ok} WHERE id = ${p.id}`;
    poruke.push(r.ok ? 'Igrač je dobio poruku na Discordu.' : 'Poruka na Discordu NIJE stigla (zatvoreni DM-ovi). Vidi je na sajtu.');
  }

  revalidatePath(`/panel/${p.id}`);
  revalidatePath('/panel');
  revalidatePath('/moje-prijave');
  return { ok: true, poruka: poruke.join(' ') };
}
