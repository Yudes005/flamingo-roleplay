import type { Metadata } from 'next';
import { PRAVILA, PRAVILA_IZMENA } from '@/config/pravila';
import { PravilaPretraga } from '@/components/PravilaPretraga';

export const metadata: Metadata = { title: 'Pravila', description: 'Pravila servera Flamingo Roleplay.' };

export default function Pravila() {
  return (
    <div className="sadrzaj pb-10 pt-[120px] md:pt-[140px]">
      <header className="max-w-2xl">
        <h1 className="text-[clamp(34px,5vw,56px)] font-bold">Pravila grada</h1>
        <p className="mt-4 text-[17px] text-sivo">
          Kratko i jasno. Svako pravilo ima broj, pa u reportu ili žalbi možeš da napišeš npr. „pravilo 3.1”.
        </p>
        <p className="mt-3 text-[14px] text-sivo-2">Poslednja izmena: {PRAVILA_IZMENA}</p>
      </header>
      <PravilaPretraga poglavlja={PRAVILA} />
    </div>
  );
}
