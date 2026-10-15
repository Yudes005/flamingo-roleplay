import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { PRIJAVE } from '@/config/prijave';
import { trenutniKorisnik } from '@/lib/session';
import { poslednjePoVrsti, stanjeZaVrstu } from '@/lib/upiti';
import type { PrijavaRed } from '@/lib/db';
import { DiscordIkona } from '@/components/ikone';

export const metadata: Metadata = { title: 'Prijave', description: 'Prijave za admina, supportera, lidera organizacije i žalbe na kaznu.' };

export default async function Prijave() {
  const korisnik = await trenutniKorisnik();
  let poslednje: Record<string, PrijavaRed> = {};
  if (korisnik) {
    try { poslednje = await poslednjePoVrsti(korisnik.id); } catch { poslednje = {}; }
  }

  return (
    <div className="sadrzaj pb-10 pt-[120px] md:pt-[140px]">
      <header className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="max-w-2xl">
          <h1 className="text-[clamp(34px,5vw,56px)] font-bold">Prijave</h1>
          <p className="mt-4 text-[17px] text-sivo">
            Staff, lideri organizacija i žalbe na kazne. Prijaviš se Discordom, popuniš formular, a odluku dobiješ u poruci na Discordu.
          </p>
        </div>
        {!korisnik && (
          <a href="/api/auth/discord?nazad=/prijave" className="dugme dugme-discord self-start lg:self-end"><DiscordIkona /> Prijavi se preko Discorda</a>
        )}
      </header>

      <ul className="mt-12 divide-y divide-white/[.08] border-y border-white/[.08]">
        {PRIJAVE.map(p => {
          const stanje = stanjeZaVrstu(p.id, poslednje[p.id]);
          return (
            <li key={p.id} className="grid grid-cols-[minmax(0,1fr)] gap-6 py-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_220px] lg:items-center lg:gap-10">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[clamp(22px,2.6vw,28px)] font-bold">{p.naziv}</h2>
                  {p.otvorena
                    ? <span className="rounded-full bg-palma/12 px-3 py-1 text-[13px] font-medium text-palma">Otvoreno</span>
                    : <span className="rounded-full bg-white/[.07] px-3 py-1 text-[13px] font-medium text-sivo">Zatvoreno</span>}
                </div>
                <p className="mt-2 max-w-md text-[16px] text-sivo">{p.kratko}</p>
              </div>
              <ul className="space-y-1.5 text-[15px]">
                {p.uslovi.map(u => (
                  <li key={u} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-palma" />{u}</li>
                ))}
              </ul>
              <div className="lg:text-right">
                {!p.otvorena ? (
                  <p className="text-[15px] text-sivo">Trenutno ne primamo prijave.</p>
                ) : !korisnik ? (
                  <a href={`/api/auth/discord?nazad=/prijave/${p.id}`} className="dugme dugme-obicno w-full lg:w-auto">Prijavi se i popuni</a>
                ) : stanje.tip === 'ceka' ? (
                  <Link href="/moje-prijave" className="dugme dugme-obicno w-full lg:w-auto">Čeka odluku</Link>
                ) : stanje.tip === 'prihvacena' ? (
                  <p className="text-[15px] font-medium text-palma">Tvoja prijava je prihvaćena</p>
                ) : stanje.tip === 'pauza' ? (
                  <p className="text-[15px] text-sivo">Nova prijava za {stanje.dana} {stanje.dana === 1 ? 'dan' : 'dana'}</p>
                ) : (
                  <Link href={`/prijave/${p.id}`} className="dugme dugme-glavno w-full lg:w-auto">Popuni prijavu</Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
