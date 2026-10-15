import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { AUTHORIZE_URL, avatarUrl, korisnikIzTokena, zameniKod } from '@/lib/discord';
import { napraviSesiju, sigurnoKolacic } from '@/lib/session';

// ============================================================
//  Login preko Discorda. Ista adresa kao na starom sajtu
//  (/api/auth/discord), pa Redirect URL u Developer Portalu
//  ne mora da se menja.
// ============================================================

const STATE_COOKIE = 'fl_oauth';

function baseUrl(req: NextRequest) {
  return (process.env.SITE_URL || req.nextUrl.origin).replace(/\/+$/, '');
}

function sigurnaPutanja(p: string | null) {
  return p && p.startsWith('/') && !p.startsWith('//') ? p : '/';
}

export async function GET(req: NextRequest) {
  const base = baseUrl(req);
  const redirectUri = `${base}/api/auth/discord`;
  const code = req.nextUrl.searchParams.get('code');
  const jar = await cookies();

  if (!code) {
    // 1) idemo na Discord - "state" štiti od podmetnutog logina
    const state = crypto.randomUUID();
    const nazad = sigurnaPutanja(req.nextUrl.searchParams.get('nazad'));
    jar.set(STATE_COOKIE, JSON.stringify({ state, nazad }), {
      httpOnly: true, secure: sigurnoKolacic(), sameSite: 'lax', path: '/', maxAge: 600,
    });
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', process.env.DISCORD_CLIENT_ID || '');
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

  if (!sacuvano.state || sacuvano.state !== req.nextUrl.searchParams.get('state')) {
    return NextResponse.redirect(`${base}/prijava-greska?razlog=istekla`);
  }

  try {
    const token = await zameniKod(code, redirectUri);
    const u = await korisnikIzTokena(token);
    await napraviSesiju({
      id: u.id,
      ime: u.global_name || u.username,
      korisnicko: u.username,
      avatar: avatarUrl(u),
    });
    return NextResponse.redirect(`${base}${sigurnaPutanja(sacuvano.nazad || '/')}`);
  } catch {
    return NextResponse.redirect(`${base}/prijava-greska?razlog=discord`);
  }
}
