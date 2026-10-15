'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { nadjiPrijavu, odlukeZa, type Polje } from '@/config/prijave';
import { DISCORD, PANEL, SITE, adresaSajta } from '@/config/site';
import { KATEGORIJE_NOVOSTI, KATEGORIJE_PREDLOGA, PREDLOGA_DNEVNO, STATUSI_PREDLOGA, kategorijaNovosti, statusPredloga } from '@/config/zajednica';
import { db, type PrijavaRed, type PredlogRed } from './db';
import { trenutniKorisnik } from './session';
import { staffKorisnik, vidiVrstu } from './dozvole';
import { dodajUlogu, nalogStarDana, posaljiDM, posaljiUKanal } from './discord';

const PINK = 0xff4d8d;
const ZELENA = 0x34c79a;
const CRVENA = 0xef4b55;
const ZLATO = 0xffb547;

function siteUrl() {
  return adresaSajta();
}

function bazaGreska(e: unknown) {
  const m = (e as Error)?.message || '';
  return m.includes('DATABASE_URL') ? 'Baza nije povezana. Javi staffu na Discordu.' : 'Baza trenutno ne odgovara. Probaj ponovo za minut.';
}

// ============================================================
//  SLANJE PRIJAVE / REPORTA
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
  if (p.tip === 'link') {
    let u: URL | null = null;
    try { u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`); } catch { u = null; }
    if (!u || !u.hostname.includes('.')) return { vrednost: v, greska: 'Upiši pun link, npr. https://youtu.be/...' };
    if (p.max && v.length > p.max) return { vrednost: v, greska: `Link je predugačak (najviše ${p.max} znakova).` };
    return { vrednost: u.toString() };
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
  if (!vrsta.otvorena) return { greska: 'Ova prijava je trenutno zatvorena.' };

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

  let novaId = 0;
  try {
    const sql = await db();
    const max = vrsta.naCekanjuMax || 1;

    const [{ n: naCekanju }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM prijave WHERE korisnik_id = ${korisnik.id} AND vrsta = ${vrsta.id} AND status = 'na_cekanju'`;
    if (naCekanju >= max) {
      return {
        greska: max === 1
          ? `Već imaš ${vrsta.grupa === 'report' ? 'jednu ovakvu prijavu' : 'prijavu za ovu poziciju'} koja čeka odluku.`
          : `Već imaš ${naCekanju} ovakvih prijava koje čekaju. Sačekaj da staff reši bar jednu.`,
        vrednosti,
      };
    }
    const [poslednja] = await sql<PrijavaRed[]>`
      SELECT * FROM prijave WHERE korisnik_id = ${korisnik.id} AND vrsta = ${vrsta.id} AND status <> 'na_cekanju'
      ORDER BY odluceno DESC NULLS LAST LIMIT 1`;
    if (vrsta.jednom && poslednja?.status === 'prihvacena') {
      return { greska: 'Tvoja prijava za ovu poziciju je već prihvaćena.', vrednosti };
    }
    if (vrsta.ponovoPosleDana > 0 && poslednja?.status === 'odbijena' && poslednja.odluceno) {
      const moze = new Date(poslednja.odluceno.getTime() + vrsta.ponovoPosleDana * 86400000);
      if (moze > new Date()) {
        const dana = Math.ceil((moze.getTime() - Date.now()) / 86400000);
        return { greska: `Prethodna prijava je odbijena. Novu možeš da pošalješ za ${dana} ${dana === 1 ? 'dan' : 'dana'}.`, vrednosti };
      }
    }

    const [nova] = await sql<{ id: number }[]>`
      INSERT INTO prijave (vrsta, korisnik_id, korisnik_ime, korisnik_avatar, odgovori)
      VALUES (${vrsta.id}, ${korisnik.id}, ${korisnik.ime}, ${korisnik.avatar}, ${sql.json(odgovori)})
      RETURNING id`;
    novaId = nova.id;
  } catch (e) {
    return { greska: bazaGreska(e), vrednosti };
  }

  // javi staffu na Discordu - greška ovde ne ruši slanje
  const kratkaPolja = vrsta.polja
    .filter(p => p.tip === 'tekst' || p.tip === 'broj' || p.tip === 'izbor' || p.tip === 'link')
    .slice(0, 5)
    .map(p => ({ name: p.pitanje.slice(0, 250), value: String(odgovori[p.id] || '-').slice(0, 1000), inline: p.tip !== 'link' }));
  const embed = {
    color: vrsta.grupa === 'report' ? ZLATO : PINK,
    title: `${vrsta.grupa === 'report' ? 'Novi report' : 'Nova prijava'}: ${vrsta.naziv}`,
    url: `${siteUrl()}/panel/${novaId}`,
    description: `<@${korisnik.id}> je poslao ${vrsta.grupa === 'report' ? 'report' : 'prijavu'}. Discord nalog star ${nalogStarDana(korisnik.id)} dana.`,
    fields: kratkaPolja,
    footer: { text: `#${novaId} - otvori u staff panelu` },
    timestamp: new Date().toISOString(),
  };
  if (vrsta.samoVrh) {
    // report na staff ne ide u zajednički kanal, nego direktno vlasnicima
    await Promise.all(PANEL.vlasnici.map(id => posaljiDM(id, { embeds: [embed] }).catch(() => null)));
  } else {
    const kanal = vrsta.grupa === 'report' ? DISCORD.reportKanalId : DISCORD.prijaveKanalId;
    if (kanal) await posaljiUKanal(kanal, { embeds: [embed], allowed_mentions: { parse: [] } }).catch(() => null);
  }

  revalidatePath('/moje-prijave');
  revalidatePath('/panel');
  redirect(`/moje-prijave?poslata=${novaId}`);
}

// ============================================================
//  STAFF: glas, komentar, preuzimanje, odluka
// ============================================================
async function staffZaPrijavu(prijavaId: number) {
  const staff = await staffKorisnik();
  if (!staff) return null;
  const sql = await db();
  const [p] = await sql<PrijavaRed[]>`SELECT * FROM prijave WHERE id = ${prijavaId}`;
  if (!p || !vidiVrstu(staff.nivo, nadjiPrijavu(p.vrsta))) return null;
  return { staff, sql, p };
}

export async function glasaj(prijavaId: number, glas: 1 | -1 | 0) {
  const x = await staffZaPrijavu(prijavaId);
  if (!x) return { greska: 'Nemaš pristup.' };
  const { staff, sql } = x;
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

export async function preuzmi(prijavaId: number, pusti = false) {
  const x = await staffZaPrijavu(prijavaId);
  if (!x) return { greska: 'Nemaš pristup.' };
  const { staff, sql } = x;
  if (pusti) {
    await sql`UPDATE prijave SET preuzeo_id = NULL, preuzeo_ime = NULL WHERE id = ${prijavaId} AND preuzeo_id = ${staff.korisnik.id}`;
  } else {
    await sql`UPDATE prijave SET preuzeo_id = ${staff.korisnik.id}, preuzeo_ime = ${staff.korisnik.ime} WHERE id = ${prijavaId} AND status = 'na_cekanju'`;
  }
  revalidatePath(`/panel/${prijavaId}`);
  revalidatePath('/panel');
  return { ok: true };
}

export type StanjeKomentara = { greska?: string; ok?: boolean };

export async function komentarisi(prijavaId: number, _prev: StanjeKomentara, form: FormData): Promise<StanjeKomentara> {
  const x = await staffZaPrijavu(prijavaId);
  if (!x) return { greska: 'Nemaš pristup.' };
  const { staff, sql } = x;
  const tekst = String(form.get('tekst') || '').trim();
  if (tekst.length < 2) return { greska: 'Komentar je prazan.' };
  if (tekst.length > 2000) return { greska: 'Komentar je predugačak (najviše 2000 znakova).' };
  await sql`
    INSERT INTO prijave_komentari (prijava_id, autor_id, autor_ime, autor_avatar, tekst)
    VALUES (${prijavaId}, ${staff.korisnik.id}, ${staff.korisnik.ime}, ${staff.korisnik.avatar}, ${tekst})`;
  revalidatePath(`/panel/${prijavaId}`);
  return { ok: true };
}

export type StanjeOdluke = { greska?: string; ok?: boolean; poruka?: string };

export async function odluci(prijavaId: number, _prev: StanjeOdluke, form: FormData): Promise<StanjeOdluke> {
  const x = await staffZaPrijavu(prijavaId);
  if (!x) return { greska: 'Nemaš pristup.' };
  const { staff, sql } = x;
  if (staff.nivo !== 'odluka') return { greska: 'Tvoja uloga može da glasa, ali ne i da odlučuje.' };

  const odluka = String(form.get('odluka') || '');
  if (odluka !== 'prihvacena' && odluka !== 'odbijena') return { greska: 'Izaberi odluku.' };
  const razlog = String(form.get('razlog') || '').trim().slice(0, 1000);
  if (odluka === 'odbijena' && razlog.length < 5) return { greska: 'Napiši razlog (igrač ga dobija u poruci).' };
  const javi = form.get('javi') === 'on';

  const [p] = await sql<PrijavaRed[]>`
    UPDATE prijave SET status = ${odluka}, razlog = ${razlog || null},
      odlucio_id = ${staff.korisnik.id}, odlucio_ime = ${staff.korisnik.ime}, odluceno = now()
    WHERE id = ${prijavaId} AND status = 'na_cekanju'
    RETURNING *`;
  if (!p) return { greska: 'Ova prijava je već rešena.' };

  const vrsta = nadjiPrijavu(p.vrsta);
  const naziv = vrsta?.naziv || p.vrsta;
  const t = odlukeZa(vrsta);
  const poruke: string[] = [];
  const da = odluka === 'prihvacena';

  if (da && vrsta?.ulogaPriPrihvatanju) {
    const r = await dodajUlogu(p.korisnik_id, vrsta.ulogaPriPrihvatanju);
    await sql`UPDATE prijave SET uloga_dodeljena = ${r.ok} WHERE id = ${p.id}`;
    poruke.push(r.ok ? 'Discord uloga je dodeljena.' : `Uloga NIJE dodeljena (${r.poruka}). Dodaj je ručno.`);
  }

  if (javi) {
    const report = vrsta?.grupa === 'report';
    const opis = report
      ? (da ? `Tvoj ${naziv.toLowerCase()} je pregledan i rešen. Hvala što pomažeš da grad bude bolji.` : `Tvoj ${naziv.toLowerCase()} je pregledan i odbačen.`)
      : (da ? `Čestitamo! Tvoja prijava za **${naziv}** na ${SITE.ime} je prihvaćena. Staff će ti se javiti sa sledećim koracima.` : `Tvoja prijava za **${naziv}** na ${SITE.ime} je odbijena.`);
    const r = await posaljiDM(p.korisnik_id, {
      embeds: [{
        color: da ? ZELENA : CRVENA,
        title: `${naziv}: ${(da ? t.da : t.ne).toLowerCase()}`,
        description: opis + (razlog ? `\n\n**Poruka staffa:** ${razlog}` : ''),
        footer: { text: 'Sve tvoje prijave su na sajtu, u delu Moje prijave' },
        url: `${siteUrl()}/moje-prijave`,
      }],
    });
    await sql`UPDATE prijave SET dm_poslat = ${r.ok} WHERE id = ${p.id}`;
    poruke.push(r.ok ? 'Igrač je dobio poruku na Discordu.' : 'Poruka na Discordu NIJE stigla (zatvoreni DM-ovi). Igrač je vidi na sajtu.');
  }

  revalidatePath(`/panel/${p.id}`);
  revalidatePath('/panel');
  revalidatePath('/moje-prijave');
  return { ok: true, poruka: poruke.join(' ') };
}

// ============================================================
//  NOVOSTI (piše staff sa nivoom "odluka")
// ============================================================
export type StanjeNovosti = { greska?: string; polja?: Record<string, string> };

export async function sacuvajNovost(id: number | null, _prev: StanjeNovosti, form: FormData): Promise<StanjeNovosti> {
  const staff = await staffKorisnik();
  if (!staff || staff.nivo !== 'odluka') return { greska: 'Samo head staff može da piše novosti.' };

  const naslov = String(form.get('naslov') || '').trim();
  const kategorija = String(form.get('kategorija') || '');
  const kratko = String(form.get('kratko') || '').trim();
  const tekst = String(form.get('tekst') || '').trim();
  const slika = String(form.get('slika') || '').trim();
  const objavljena = form.get('objavljena') === 'on';
  const discord = form.get('discord') === 'on';

  const polja: Record<string, string> = {};
  if (naslov.length < 4 || naslov.length > 120) polja.naslov = 'Naslov ima 4 do 120 znakova.';
  if (!KATEGORIJE_NOVOSTI.some(k => k.id === kategorija)) polja.kategorija = 'Izaberi kategoriju.';
  if (kratko.length < 10 || kratko.length > 280) polja.kratko = 'Kratak opis ima 10 do 280 znakova.';
  if (tekst.length < 20 || tekst.length > 12000) polja.tekst = 'Tekst ima 20 do 12.000 znakova.';
  if (slika && !/^(https:\/\/|\/img\/)/.test(slika)) polja.slika = 'Slika mora biti https link ili putanja koja počinje sa /img/.';
  if (Object.keys(polja).length) return { greska: 'Proveri označena polja.', polja };

  let novaId = id || 0;
  try {
    const sql = await db();
    if (id) {
      await sql`UPDATE novosti SET naslov = ${naslov}, kategorija = ${kategorija}, kratko = ${kratko}, tekst = ${tekst},
        slika = ${slika || null}, objavljena = ${objavljena}, izmenjena = now() WHERE id = ${id}`;
    } else {
      const [n] = await sql<{ id: number }[]>`
        INSERT INTO novosti (naslov, kategorija, kratko, tekst, slika, autor_id, autor_ime, autor_avatar, objavljena)
        VALUES (${naslov}, ${kategorija}, ${kratko}, ${tekst}, ${slika || null}, ${staff.korisnik.id}, ${staff.korisnik.ime}, ${staff.korisnik.avatar}, ${objavljena})
        RETURNING id`;
      novaId = n.id;
    }
  } catch (e) {
    return { greska: bazaGreska(e) };
  }

  if (discord && objavljena && DISCORD.novostiKanalId) {
    const k = kategorijaNovosti(kategorija);
    const slikaUrl = slika ? (slika.startsWith('/') ? `${siteUrl()}${slika}` : slika) : undefined;
    await posaljiUKanal(DISCORD.novostiKanalId, {
      embeds: [{
        color: parseInt(k.boja.slice(1), 16),
        author: { name: k.naziv },
        title: naslov,
        url: `${siteUrl()}/novosti/${novaId}`,
        description: `${kratko}\n\n[Pročitaj na sajtu](${siteUrl()}/novosti/${novaId})`,
        image: slikaUrl ? { url: slikaUrl } : undefined,
        footer: { text: `${SITE.ime} - ${staff.korisnik.ime}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch(() => null);
  }

  revalidatePath('/novosti');
  revalidatePath(`/novosti/${novaId}`);
  revalidatePath('/');
  redirect('/panel/novosti');
}

export async function obrisiNovost(id: number) {
  const staff = await staffKorisnik();
  if (!staff || staff.nivo !== 'odluka') return { greska: 'Nemaš pristup.' };
  const sql = await db();
  await sql`DELETE FROM novosti WHERE id = ${id}`;
  revalidatePath('/novosti');
  revalidatePath('/panel/novosti');
  revalidatePath('/');
  return { ok: true };
}

// ============================================================
//  PREDLOZI (šalju igrači, glasaju svi prijavljeni, odgovara staff)
// ============================================================
export type StanjePredloga = { greska?: string; ok?: boolean; polja?: Record<string, string>; vrednosti?: Record<string, string> };

export async function posaljiPredlog(_prev: StanjePredloga, form: FormData): Promise<StanjePredloga> {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return { greska: 'Prijavi se preko Discorda da bi poslao predlog.' };

  const naslov = String(form.get('naslov') || '').trim();
  const kategorija = String(form.get('kategorija') || '');
  const tekst = String(form.get('tekst') || '').trim();
  const vrednosti = { naslov, kategorija, tekst };
  const polja: Record<string, string> = {};
  if (naslov.length < 6 || naslov.length > 100) polja.naslov = 'Naslov ima 6 do 100 znakova.';
  if (!KATEGORIJE_PREDLOGA.includes(kategorija)) polja.kategorija = 'Izaberi kategoriju.';
  if (tekst.length < 30 || tekst.length > 3000) polja.tekst = `Opiši predlog u 30 do 3000 znakova (sada ${tekst.length}).`;
  if (Object.keys(polja).length) return { greska: 'Proveri označena polja.', polja, vrednosti };

  try {
    const sql = await db();
    const [{ n }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM predlozi WHERE korisnik_id = ${korisnik.id} AND napravljen > now() - interval '24 hours'`;
    if (n >= PREDLOGA_DNEVNO) return { greska: `Možeš da pošalješ najviše ${PREDLOGA_DNEVNO} predloga dnevno. Probaj sutra.`, vrednosti };
    const [p] = await sql<{ id: number }[]>`
      INSERT INTO predlozi (korisnik_id, korisnik_ime, korisnik_avatar, kategorija, naslov, tekst)
      VALUES (${korisnik.id}, ${korisnik.ime}, ${korisnik.avatar}, ${kategorija}, ${naslov}, ${tekst}) RETURNING id`;
    await sql`INSERT INTO predlozi_glasovi (predlog_id, korisnik_id) VALUES (${p.id}, ${korisnik.id}) ON CONFLICT DO NOTHING`;
  } catch (e) {
    return { greska: bazaGreska(e), vrednosti };
  }
  revalidatePath('/predlozi');
  return { ok: true };
}

export async function glasajPredlog(id: number) {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return { greska: 'Prijavi se da bi glasao.' };
  try {
    const sql = await db();
    const obrisano = await sql`DELETE FROM predlozi_glasovi WHERE predlog_id = ${id} AND korisnik_id = ${korisnik.id} RETURNING predlog_id`;
    if (!obrisano.length) {
      await sql`INSERT INTO predlozi_glasovi (predlog_id, korisnik_id)
        SELECT ${id}, ${korisnik.id} WHERE EXISTS (SELECT 1 FROM predlozi WHERE id = ${id}) ON CONFLICT DO NOTHING`;
    }
  } catch (e) {
    return { greska: bazaGreska(e) };
  }
  revalidatePath('/predlozi');
  return { ok: true };
}

export type StanjeOdgovora = { greska?: string; ok?: boolean };

export async function odgovoriPredlog(id: number, _prev: StanjeOdgovora, form: FormData): Promise<StanjeOdgovora> {
  const staff = await staffKorisnik();
  if (!staff || staff.nivo !== 'odluka') return { greska: 'Samo head staff menja status predloga.' };
  const status = String(form.get('status') || '');
  const odgovor = String(form.get('odgovor') || '').trim().slice(0, 1500);
  if (!STATUSI_PREDLOGA.some(s => s.id === status)) return { greska: 'Izaberi status.' };
  const sql = await db();
  const [p] = await sql<PredlogRed[]>`
    UPDATE predlozi SET status = ${status}, odgovor = ${odgovor || null}, odgovorio_ime = ${odgovor ? staff.korisnik.ime : null}
    WHERE id = ${id} RETURNING *`;
  if (!p) return { greska: 'Predlog ne postoji.' };
  if (status !== 'novo') {
    await posaljiDM(p.korisnik_id, {
      embeds: [{
        color: status === 'odbijeno' ? CRVENA : status === 'uradjeno' || status === 'prihvaceno' ? ZELENA : ZLATO,
        title: `Tvoj predlog: ${statusPredloga(status).naziv.toLowerCase()}`,
        description: `**${p.naslov}**${odgovor ? `\n\n**Odgovor staffa:** ${odgovor}` : ''}`,
        url: `${siteUrl()}/predlozi`,
      }],
    }).catch(() => null);
  }
  revalidatePath('/predlozi');
  revalidatePath('/panel/predlozi');
  return { ok: true };
}

export async function obrisiPredlog(id: number) {
  const staff = await staffKorisnik();
  if (!staff || staff.nivo !== 'odluka') return { greska: 'Nemaš pristup.' };
  const sql = await db();
  await sql`DELETE FROM predlozi WHERE id = ${id}`;
  revalidatePath('/predlozi');
  revalidatePath('/panel/predlozi');
  return { ok: true };
}
