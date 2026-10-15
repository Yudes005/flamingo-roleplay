import Image from 'next/image';
import Link from 'next/link';

export function Logo({ mali = false }: { mali?: boolean }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3 rounded-lg" aria-label="Flamingo Roleplay - početna">
      <span className={`grid place-items-center rounded-[10px] bg-flamingo ${mali ? 'size-9' : 'size-10'} transition-transform group-hover:-rotate-6`}>
        <Image src="/img/logo-mark.png" alt="" width={184} height={335} className={mali ? 'h-6 w-auto' : 'h-7 w-auto'} priority />
      </span>
      <span className="leading-none">
        <span className="block font-display text-[17px] font-bold tracking-tight">Flamingo</span>
        <span className="mt-1 block text-[12px] text-sivo">Roleplay</span>
      </span>
    </Link>
  );
}
