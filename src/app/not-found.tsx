import Image from 'next/image';
import Link from 'next/link';

export default function NijePronadjeno() {
  return (
    <div className="zrno relative isolate grid min-h-[100svh] place-items-center overflow-hidden bg-black px-4 text-center">
      <Image src="/img/hero.webp" alt="" fill sizes="100vw" className="-z-20 object-cover opacity-35" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/.2),#000_75%)]" />
      <div>
        <p className="plakat text-[clamp(110px,20vw,230px)] text-flamingo">404</p>
        <h1 className="mt-2 text-[clamp(22px,3vw,30px)] font-semibold">Ova ulica ne postoji</h1>
        <p className="mt-3 text-sivo">Možda je link star ili pogrešno prepisan.</p>
        <Link href="/" className="dugme dugme-glavno mt-8">Nazad u grad</Link>
      </div>
    </div>
  );
}
