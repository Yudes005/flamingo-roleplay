import Link from 'next/link';

export function BezPristupa({ prijavljen }: { prijavljen: boolean }) {
  return (
    <div className="sadrzaj grid min-h-[70vh] place-items-center pt-[100px]">
      <div className="povrsina max-w-md p-8 text-center">
        <h1 className="text-[26px] font-bold">Staff panel</h1>
        <p className="mt-3 text-sivo">
          {prijavljen ? 'Tvoj Discord nalog nema staff ulogu potrebnu za panel.' : 'Prijavi se preko Discorda da bi otvorio panel.'}
        </p>
        {prijavljen
          ? <Link href="/" className="dugme dugme-obicno mt-6">Nazad na početnu</Link>
          : <a href="/api/auth/discord?nazad=/panel" className="dugme dugme-discord mt-6">Prijavi se</a>}
      </div>
    </div>
  );
}
