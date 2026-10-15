import Image from 'next/image';
import Link from 'next/link';

export function Logo({ mali = false }: { mali?: boolean }) {
  return (
    <Link href="/" className="group inline-flex shrink-0 items-center gap-3 rounded-lg" aria-label="Flamingo Roleplay - početna">
      <Image src="/img/logo-mark.png" alt="" width={184} height={335} priority
        className={`${mali ? 'h-9' : 'h-10'} w-auto transition-transform duration-500 group-hover:-rotate-6`} />
      <span className="leading-none">
        <span className="block text-[19px] font-black uppercase tracking-[.02em]">Flamingo</span>
        <span className="mt-1 block text-[10px] font-extrabold uppercase tracking-[.34em] text-flamingo-2">Roleplay</span>
      </span>
    </Link>
  );
}
