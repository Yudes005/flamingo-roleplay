import 'server-only';
import { DISCORD } from '@/config/site';

// ============================================================
//  DISCORD: login (OAuth) + bot preko REST-a (DM, uloge, kanal).
//  Bot token je isti onaj koji koristi flamingo_invitebot u gradu.
// ============================================================

const API = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';
export const AUTHORIZE_URL = process.env.DISCORD_AUTHORIZE_URL || 'https://discord.com/oauth2/authorize';

export type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean };
export type Clan = { user: DiscordUser; roles: string[]; joined_at: string; nick?: string | null; avatar?: string | null };

export function avatarUrl(u: { id: string; avatar?: string | null }) {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`;
  const idx = Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

export function nalogStarDana(id: string) {
  const ms = Number((BigInt(id) >> 22n) + 1420070400000n);
  return Math.floor((Date.now() - ms) / 86400000);
}

// ---------------- OAuth ----------------
export async function zameniKod(code: string, redirectUri: string) {
  const r = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID || '',
      client_secret: process.env.DISCORD_CLIENT_SECRET || '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  if (!r.ok) throw Object.assign(new Error(`Discord token ${r.status}`), { status: r.status });
  const d = await r.json();
  return String(d.access_token);
}

export async function korisnikIzTokena(accessToken: string): Promise<DiscordUser> {
  const r = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!r.ok) throw new Error(`Discord korisnik ${r.status}`);
  return r.json();
}

// ---------------- BOT ----------------
type Odgovor<T> = { ok: boolean; status: number; data?: T; poruka?: string };

export async function bot<T = unknown>(method: string, path: string, body?: unknown): Promise<Odgovor<T>> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return { ok: false, status: 0, poruka: 'DISCORD_BOT_TOKEN nije podešen' };
  for (let i = 0; i < 3; i++) {
    let r: Response;
    try {
      r = await fetch(API + path, {
        method,
        headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      return { ok: false, status: 0, poruka: (e as Error).message };
    }
    if (r.status === 429) {
      const d = await r.json().catch(() => ({}));
      await new Promise(res => setTimeout(res, Math.ceil(((d as { retry_after?: number }).retry_after || 1) * 1000)));
      continue;
    }
    const text = await r.text();
    let data: unknown = undefined;
    try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
    if (!r.ok) return { ok: false, status: r.status, poruka: (data as { message?: string })?.message || `HTTP ${r.status}` };
    return { ok: true, status: r.status, data: data as T };
  }
  return { ok: false, status: 429, poruka: 'Discord rate limit' };
}

// član servera (uloge) - kratko keširano da panel ne zove Discord za svaki klik
const clanKes = new Map<string, { t: number; v: Clan | null }>();
export async function clanServera(userId: string): Promise<Clan | null> {
  if (!DISCORD.guildId) return null;
  const k = clanKes.get(userId);
  if (k && Date.now() - k.t < 60_000) return k.v;
  const r = await bot<Clan>('GET', `/guilds/${DISCORD.guildId}/members/${userId}`);
  const v = r.ok && r.data ? r.data : null;
  if (r.ok || r.status === 404) clanKes.set(userId, { t: Date.now(), v });
  return v;
}

let timKes: { t: number; v: Clan[] } | null = null;
export async function sviClanovi(): Promise<Clan[]> {
  if (!DISCORD.guildId) return [];
  if (timKes && Date.now() - timKes.t < 10 * 60_000) return timKes.v;
  const svi: Clan[] = [];
  let after = '0';
  for (let i = 0; i < 20; i++) {
    const r = await bot<Clan[]>('GET', `/guilds/${DISCORD.guildId}/members?limit=1000&after=${after}`);
    if (!r.ok || !r.data) break;
    svi.push(...r.data);
    if (r.data.length < 1000) break;
    after = r.data[r.data.length - 1].user.id;
  }
  if (svi.length) timKes = { t: Date.now(), v: svi };
  return svi;
}

export async function posaljiUKanal(kanalId: string, payload: unknown) {
  if (!kanalId) return { ok: false, status: 0, poruka: 'kanal nije podešen' };
  return bot('POST', `/channels/${kanalId}/messages`, payload);
}

export async function posaljiDM(userId: string, payload: unknown) {
  const ch = await bot<{ id: string }>('POST', '/users/@me/channels', { recipient_id: userId });
  if (!ch.ok || !ch.data) return { ok: false, status: ch.status, poruka: ch.poruka };
  return bot('POST', `/channels/${ch.data.id}/messages`, payload);
}

export async function dodajUlogu(userId: string, roleId: string) {
  if (!DISCORD.guildId) return { ok: false, status: 0, poruka: 'DISCORD_GUILD_ID nije podešen' };
  const r = await bot('PUT', `/guilds/${DISCORD.guildId}/members/${userId}/roles/${roleId}`);
  clanKes.delete(userId);
  return r;
}
