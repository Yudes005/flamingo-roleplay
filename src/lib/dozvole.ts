import 'server-only';
import { PANEL } from '@/config/site';
import type { VrstaPrijave } from '@/config/prijave';
import { clanServera } from './discord';
import { trenutniKorisnik, type Korisnik } from './session';

// citanje = čita, glasa, komentariše; odluka = i odlučuje, piše novosti, odgovara na predloge
export type Nivo = 'nema' | 'citanje' | 'odluka';

export async function nivoStaffa(userId: string): Promise<Nivo> {
  if (PANEL.vlasnici.includes(userId)) return 'odluka';
  if (!PANEL.citanjeUloge.length && !PANEL.odlukaUloge.length) return 'nema';
  const clan = await clanServera(userId);
  if (!clan) return 'nema';
  if (clan.roles.some(r => PANEL.odlukaUloge.includes(r))) return 'odluka';
  if (clan.roles.some(r => PANEL.citanjeUloge.includes(r))) return 'citanje';
  return 'nema';
}

export async function staffKorisnik(): Promise<{ korisnik: Korisnik; nivo: Nivo } | null> {
  const korisnik = await trenutniKorisnik();
  if (!korisnik) return null;
  const nivo = await nivoStaffa(korisnik.id).catch(() => 'nema' as const);
  if (nivo === 'nema') return null;
  return { korisnik, nivo };
}

// report na staff i slične vrste vidi samo nivo "odluka"
export function vidiVrstu(nivo: Nivo, vrsta: VrstaPrijave | null) {
  if (!vrsta) return nivo === 'odluka';
  return vrsta.samoVrh ? nivo === 'odluka' : nivo !== 'nema';
}
