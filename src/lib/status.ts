import 'server-only';
import { SITE } from '@/config/site';

// Broj igrača uživo - FiveM server sam daje /dynamic.json na svom portu.
export type StatusServera = { online: boolean; igraca: number; max: number };

export async function statusServera(): Promise<StatusServera> {
  const url = process.env.FIVEM_STATUS_URL || `http://${SITE.server}/dynamic.json`;
  try {
    const r = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(3500) });
    if (!r.ok) throw new Error(String(r.status));
    const d = await r.json();
    return { online: true, igraca: Number(d.clients) || 0, max: Number(d.sv_maxclients) || 0 };
  } catch {
    return { online: false, igraca: 0, max: 0 };
  }
}
