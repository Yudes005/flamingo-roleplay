import type { Metadata } from 'next';
import Link from 'next/link';
import { IZMENE, KAZNE, PRAVILA, PRAVILA_IZMENA } from '@/config/pravila';
import { PravilaPretraga } from '@/components/PravilaPretraga';
import { ZaglavljeStrane } from '@/components/ZaglavljeStrane';

export const metadata: Metadata = { title: 'Pravila', description: 'Pravila servera Flamingo Roleplay i tabela kazni.' };

export default function Pravila() {
  return (
    <>
      <ZaglavljeStrane naslov="Pravila grada" slika="/img/hero.webp" pozicija="66% 45%">
        Kratko i jasno. Svako pravilo ima broj, pa u reportu ili žalbi napišeš npr. „pravilo 2.1”.
        <span className="mt-3 block text-[14.5px] text-white/60">Poslednja izmena: {PRAVILA_IZMENA}</span>
      </ZaglavljeStrane>

      <section className="svetlo py-16 md:py-24">
        <div className="sadrzaj">
          <PravilaPretraga poglavlja={PRAVILA} />
        </div>
      </section>

      <section id="kazne" className="sadrzaj scroll-mt-24 py-20 md:py-28">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <h2 className="plakat naslov-sekcije">Tabela kazni</h2>
          <p className="uvod text-sivo md:justify-self-end">Staff bira kaznu prema prekršaju i ranijim kaznama. Za teže slučajeve kazna može biti i veća. Na svaku kaznu možeš da se <Link href="/prijave/zalba" className="text-flamingo-2 underline underline-offset-4">žališ jednom</Link>.</p>
        </div>
        <div className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="text-[13.5px] text-sivo-2">
              <tr className="border-b border-white/15">
                <th className="py-3 pr-4 font-medium">Prekršaj</th>
                <th className="py-3 pr-4 font-medium">Prvi put</th>
                <th className="py-3 pr-4 font-medium">Drugi put</th>
                <th className="py-3 font-medium">Treći put</th>
              </tr>
            </thead>
            <tbody>
              {KAZNE.map(k => (
                <tr key={k.prekrsaj} className="border-b border-white/[.08]">
                  <td className="py-4 pr-4">
                    <span className="font-semibold">{k.prekrsaj}</span>
                    <span className="ml-2 text-[13px] text-sivo-2 tabular-nums">{k.pravilo}</span>
                  </td>
                  <td className="py-4 pr-4 text-tekst/90">{k.prvi}</td>
                  <td className="py-4 pr-4 text-tekst/90">{k.drugi || <span className="text-sivo-2">-</span>}</td>
                  <td className="py-4 text-tekst/90">{k.treci || <span className="text-sivo-2">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-24 text-[22px] font-semibold">Istorija izmena</h2>
        <ul className="mt-5 border-t border-white/12">
          {IZMENE.map(i => (
            <li key={i.datum + i.tekst} className="grid gap-1 border-b border-white/12 py-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-6">
              <span className="text-[14.5px] text-sivo tabular-nums">{i.datum}</span>
              <span className="text-[15.5px]">{i.tekst}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
