import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { AUTHORIZE_URL, avatarUrl, korisnikIzTokena, zameniKod } from '@/lib/discord';
import { napraviSesiju, sigurnoKolacic } from '@/lib/session';

// ============================================================
//  Login preko Discorda. Ista adresa kao na starom sajtu
//  (/api/auth/discord), pa Redirect URL u Developer Portalu
//  ne mora da se menja.
//  Svaka greška vodi na /prijava-greska sa tačnim razlogom,
//  da se odmah vidi šta treba popraviti.
// ============================================================

const STATE_COOKIE = 'fl_oauth';

function baseUrl(req: NextRequest) {
  return (process.env.SITE_URL || req.nextUrl.origin).replace(/\/+$/, '');
}

function sigurnaPutanja(p: string | null) {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

function greska(base: string, razlog: string) {
  return NextResponse.redirect(`${base}/prijava-greska?razlog=${razlog}`);
}

export async function GET(req: NextRequest) {
  const base = baseUrl(req);
  const redirectUri = `${base}/api/auth/discord`;
  const q = req.nextUrl.searchParams;
  const code = q.get('code');
  const jar = await cookies();

  // podešavanja koja moraju da postoje pre nego što uopšte odemo na Discord
  if (!process.env.DISCORD_CLIENT_ID) return greska(base, 'client-id');
  if (!process.env.DISCORD_CLIENT_SECRET) return greska(base, 'client-secret');
  if ((process.env.SESSION_SECRET || '').length < 32) return greska(base, 'sesija');

  // igrač je kliknuo "Cancel" na Discordu
  if (q.get('error')) {
    jar.delete(STATE_COOKIE);
    return greska(base, q.get('error') === 'access_denied' ? 'otkazano' : 'discord');
  }

  if (!code) {
    // 1) idemo na Discord - "state" štiti od podmetnutog logina
    const state = crypto.randomUUID();
    const nazad = sigurnaPutanja(q.get('nazad'));
    jar.set(STATE_COOKIE, JSON.stringify({ state, nazad }), {
      httpOnly: true, secure: sigurnoKolacic(), sameSite: 'lax', path: '/', maxAge: 900,
    });
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID.trim());
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'none');
    return NextResponse.redirect(url.toString());
  }

  // 2) Discord nas vratio sa kodom
  let sacuvano: { state?: string; nazad?: string } = {};
  try { sacuvano = JSON.parse(jar.get(STATE_COOKIE)?.value || '{}'); } catch { sacuvano = {}; }
  jar.delete(STATE_COOKIE);

  if (!sacuvano.state || sacuvano.state !== q.get('state')) return greska(base, 'istekla');

  let token: string;
  try {
    token = await zameniKod(code, redirectUri);
  } catch (e) {
    const s = (e as { status?: number }).status;
    // 401 = pogrešan Client Secret, 400 = Redirect URL se ne poklapa (ili je kod već iskorišćen)
    return greska(base, s === 401 ? 'client-secret' : s === 400 ? 'redirect' : 'discord');
  }
  try {
    const u = await korisnikIzTokena(token);
    await napraviSesiju({
      id: u.id,
      ime: u.global_name || u.username,
      korisnicko: u.username,
      avatar: avatarUrl(u),
    });
  } catch {
    return greska(base, 'discord');
  }
  return NextResponse.redirect(`${base}${sigurnaPutanja(sacuvano.nazad || '/')}`);
}
