import Link from 'next/link';

export default async function PrijavaGreska({ searchParams }: { searchParams: Promise<{ razlog?: string }> }) {
  const { razlog } = await searchParams;
  const poruka = razlog === 'istekla'
    ? 'Prijava je trajala predugo ili je otvorena u drugom prozoru. Probaj ponovo.'
    : 'Discord nije potvrdio prijavu. Probaj ponovo, a ako se ponavlja, javi staffu.';
  return (
    <div className="sadrzaj grid min-h-[70vh] place-items-center pt-[100px]">
      <div className="povrsina max-w-md p-8 text-center">
        <h1 className="text-[28px] font-bold">Prijava nije uspela</h1>
        <p className="mt-3 text-sivo">{poruka}</p>
        <a href="/api/auth/discord" className="dugme dugme-discord mt-6">Probaj ponovo</a>
        <p className="mt-4"><Link href="/" className="text-[15px] text-sivo hover:text-tekst">Nazad na početnu</Link></p>
      </div>
    </div>
  );
}
