import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

// ============================================================
//  SESIJA: potpisan kolačić (JWT). Bez SESSION_SECRET-a niko ne
//  može da napravi lažnu sesiju - za razliku od starog sajta gde
//  je ime stajalo u linku.
// ============================================================

export type Korisnik = { id: string; ime: string; korisnicko: string; avatar: string | null };

const COOKIE = 'fl_sesija';
const TRAJANJE = 60 * 60 * 24 * 30; // 30 dana

function kljuc() {
  const s = process.env.SESSION_SECRET || '';
  if (s.length < 32) throw new Error('SESSION_SECRET mora imati bar 32 znaka (Vercel -> Environment Variables)');
  return new TextEncoder().encode(s);
}

export function sigurnoKolacic() {
  return (process.env.SITE_URL || '').startsWith('https://');
}

export async function napraviSesiju(k: Korisnik) {
  const jwt = await new SignJWT({ ime: k.ime, korisnicko: k.korisnicko, avatar: k.avatar })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(k.id)
    .setIssuedAt()
    .setExpirationTime(`${TRAJANJE}s`)
    .sign(kljuc());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true, secure: sigurnoKolacic(), sameSite: 'lax', path: '/', maxAge: TRAJANJE,
  });
}

export async function trenutniKorisnik(): Promise<Korisnik | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, kljuc(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      ime: String(payload.ime || 'Igrač'),
      korisnicko: String(payload.korisnicko || ''),
      avatar: payload.avatar ? String(payload.avatar) : null,
    };
  } catch {
    return null;
  }
}

export async function obrisiSesiju() {
  (await cookies()).delete(COOKIE);
}
