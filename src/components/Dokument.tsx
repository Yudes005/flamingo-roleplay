import Image from 'next/image';
import { SITE } from '@/config/site';
import { datum } from '@/lib/format';

// Zaglavlje gradskog dokumenta (prijava) - isto za formular i za pregled u panelu
export function DokumentZaglavlje({ pozicija, broj, ime, korisnicko, avatar, kad }: {
  pozicija: string; broj?: number | null; ime: string; korisnicko?: string; avatar: string | null; kad: Date | string;
}) {
  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[10px] bg-mastilo">
            <Image src="/img/logo-mark.png" alt="" width={184} height={335} className="h-7 w-auto" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold">Gradska uprava</p>
            <p className="text-[13.5px] text-mastilo/70">{SITE.grad}</p>
          </div>
        </div>
        <p className="text-right text-[13.5px] text-mastilo/70">
          Prijava br.<br />
          <span className="font-display text-[17px] font-bold text-mastilo tabular-nums">{broj ? String(broj).padStart(4, '0') : '----'}</span>
        </p>
      </div>
      <div className="mt-8">
        <p className="text-[14px] text-mastilo/70">Prijava za poziciju</p>
        <h1 className="mt-1 font-display text-[clamp(30px,5vw,44px)] font-extrabold leading-none tracking-tight">{pozicija}</h1>
      </div>
      <dl className="mt-7 grid gap-4 border-y-2 border-mastilo/80 py-4 text-[15px] sm:grid-cols-2">
        <div className="flex items-center gap-3">
          {avatar && <Image src={avatar} alt="" unoptimized width={36} height={36} className="size-9 rounded-full" />}
          <div>
            <dt className="text-[12.5px] text-mastilo/65">Podnosilac</dt>
            <dd className="font-semibold">{ime}{korisnicko ? <span className="font-normal text-mastilo/60"> @{korisnicko}</span> : null}</dd>
          </div>
        </div>
        <div className="sm:text-right">
          <dt className="text-[12.5px] text-mastilo/65">Datum</dt>
          <dd className="font-semibold">{datum(kad)}</dd>
        </div>
      </dl>
    </header>
  );
}
