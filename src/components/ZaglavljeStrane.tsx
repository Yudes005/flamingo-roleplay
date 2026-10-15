import Image from 'next/image';

// Zaglavlje unutrašnjih strana: filmski kadar sa velikim naslovom
export function ZaglavljeStrane({ naslov, slika, pozicija = '50% 50%', children }: {
  naslov: string; slika?: string; pozicija?: string; children?: React.ReactNode;
}) {
  return (
    <header className="zrno relative isolate overflow-hidden bg-black pb-14 pt-[150px] md:pb-20 md:pt-[200px]">
      {slika && (
        <>
          <div className="ken-burns absolute inset-0 -z-20">
            <Image src={slika} alt="" fill priority sizes="100vw" className="object-cover opacity-55" style={{ objectPosition: pozicija }} />
          </div>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,var(--color-noc)_0%,rgb(20_16_18/.55)_45%,rgb(0_0_0/.6)_100%)]" />
        </>
      )}
      <div className="sadrzaj">
        <h1 className="plakat naslov-strane -mt-[.16em] overflow-hidden pb-[.04em] pt-[.16em]"><span className="uzlet [animation-delay:.1s]">{naslov}</span></h1>
        {children && <div className="uvod pojava mt-6 text-white/85 [animation-delay:.35s]">{children}</div>}
      </div>
    </header>
  );
}
