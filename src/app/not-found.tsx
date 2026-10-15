import Link from 'next/link';

export default function NijePronadjeno() {
  return (
    <div className="sadrzaj grid min-h-[70vh] place-items-center pt-[100px] text-center">
      <div>
        <p className="font-display text-[96px] font-extrabold leading-none text-flamingo">404</p>
        <h1 className="mt-4 text-[28px] font-bold">Ova ulica ne postoji</h1>
        <p className="mt-3 text-sivo">Možda je link star ili pogrešno prepisan.</p>
        <Link href="/" className="dugme dugme-glavno mt-8">Nazad u grad</Link>
      </div>
    </div>
  );
}
