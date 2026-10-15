import Image from 'next/image';
import Link from 'next/link';

export function Logo({ mali = false }: { mali?: boolean }) {
  return (
    <Link href="/" className="group inline-flex shrink-0 items-center gap-2.5 rounded-lg" aria-label="Flamingo Roleplay - početna">
      <Image src="/img/logo-mark.png" alt="" width={184} height={335} priority
        className={`${mali ? 'h-9' : 'h-10'} w-auto transition-transform duration-500 group-hover:-rotate-6`} />
      <span className="plakat text-[26px] leading-none tracking-[.01em]">
        Flamingo<span className="sr-only"> Roleplay</span>
      </span>
    </Link>
  );
}
