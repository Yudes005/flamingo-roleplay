import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Lock } from 'lucide-react';
import { GRUPE, PRIJAVE } from '@/config/prijave';
import { trenutniKorisnik } from '@/lib/session';
import { stanjePrijava, stanjeZaVrstu, type InfoVrste } from '@/lib/upiti';
import { imaBazu } from '@/lib/db';
import { DiscordIkona } from '@/components/ikone';
import { ZaglavljeStrane } from '@/components/ZaglavljeStrane';

export const metadata: Metadata = { title: 'Prijave', description: 'Prijave za staff, organizacije i bande, reportovi igrača, žalbe na kaznu i prijave bagova.' };

export default async function Prijave() {
  const korisnik = await trenutniKorisnik();
  let info: Record<string, InfoVrste> = {};
  if (korisnik && imaBazu()) {
    try { info = await stanjePrijava(korisnik.id); } catch { info = {}; }
  }

  return (
    <>
      <ZaglavljeStrane naslov="Prijave" slika="/img/hero.webp" pozicija="22% 36%">
        Staff, organizacije, bande, reportovi i žalbe na jednom mestu. Prijaviš se Discordom, popuniš formular, a odluku dobiješ u poruci.
        {!korisnik && (
          <span className="mt-7 block">
            <a href="/api/auth/discord?nazad=/prijave" className="dugme dugme-discord"><DiscordIkona /> Prijavi se preko Discorda</a>
          </span>
        )}
      </ZaglavljeStrane>

      <div className="sadrzaj space-y-24 py-20 md:space-y-32 md:py-28">
        {GRUPE.map(g => (
          <section key={g.id} id={g.id} className="grid grid-cols-1 scroll-mt-24 gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-16">
            <div className="lg:sticky lg:top-[110px] lg:self-start">
              <h2 className="plakat naslov-manji">{g.naziv}</h2>
              <p className="mt-3 text-[16px] text-sivo">{g.opis}</p>
            </div>
            <ul className="border-t border-white/12">
              {PRIJAVE.filter(p => p.grupa === g.id).map(p => {
                const stanje = stanjeZaVrstu(p, info[p.id]);
                return (
                  <li key={p.id} className="grid grid-cols-1 gap-5 border-b border-white/12 py-8 md:grid-cols-[minmax(0,1fr)_200px] md:items-center md:gap-10">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-[24px] font-semibold leading-tight">{p.naziv}</h3>
                        {!p.otvorena && <span className="rounded-full bg-white/[.08] px-3 py-1 text-[13px] font-medium text-sivo">Zatvoreno</span>}
                        {p.samoVrh && <span className="inline-flex items-center gap-1.5 rounded-full bg-zlato/12 px-3 py-1 text-[13px] font-medium text-zlato"><Lock className="size-3.5" /> Samo vlasništvo</span>}
                      </div>
                      <p className="mt-2 max-w-[60ch] text-[16px] text-sivo">{p.kratko}</p>
                      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[14.5px] text-tekst/85">
                        {p.uslovi.map(u => <li key={u} className="flex items-center gap-2"><Check className="size-4 shrink-0 text-zelena" />{u}</li>)}
                      </ul>
                    </div>
                    <div className="md:text-right">
                      {!p.otvorena ? (
                        <p className="text-[15px] text-sivo">Trenutno ne primamo.</p>
                      ) : !korisnik ? (
                        <a href={`/api/auth/discord?nazad=/prijave/${p.id}`} className="dugme dugme-obicno w-full md:w-auto">Prijavi se i popuni</a>
                      ) : stanje.tip === 'ceka' ? (
                        <Link href="/moje-prijave" className="dugme dugme-obicno w-full md:w-auto">Čeka odluku</Link>
                      ) : stanje.tip === 'prihvacena' ? (
                        <p className="text-[15px] font-medium text-zelena">Prihvaćena</p>
                      ) : stanje.tip === 'pauza' ? (
                        <p className="text-[15px] text-sivo">Ponovo za {stanje.dana} {stanje.dana === 1 ? 'dan' : 'dana'}</p>
                      ) : (
                        <Link href={`/prijave/${p.id}`} className="dugme dugme-glavno w-full md:w-auto">Popuni</Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
