import Link from 'next/link';
import { DiscordIkona } from './ikone';

export function BezPristupa({ prijavljen, poruka }: { prijavljen: boolean; poruka?: string }) {
  return (
    <div className="sadrzaj grid min-h-[80vh] place-items-center pt-[100px]">
      <div className="povrsina max-w-md p-8 text-center md:p-10">
        <h1 className="plakat text-[56px]">Staff panel</h1>
        <p className="mt-3 text-sivo">
          {poruka || (prijavljen ? 'Tvoj Discord nalog nema staff ulogu potrebnu za panel.' : 'Prijavi se preko Discorda da bi otvorio panel.')}
        </p>
        {prijavljen
          ? <Link href="/" className="dugme dugme-obicno mt-7">Nazad na početnu</Link>
          : <a href="/api/auth/discord?nazad=/panel" className="dugme dugme-discord mt-7"><DiscordIkona /> Prijavi se</a>}
      </div>
    </div>
  );
}
