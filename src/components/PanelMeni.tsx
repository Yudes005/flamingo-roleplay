import Link from 'next/link';

const TABOVI = [
  { href: '/panel', tekst: 'Prijave i reportovi', id: 'prijave' },
  { href: '/panel/novosti', tekst: 'Novosti', id: 'novosti' },
  { href: '/panel/predlozi', tekst: 'Predlozi', id: 'predlozi' },
] as const;

export function PanelZaglavlje({ aktivno, nivo, children }: { aktivno: (typeof TABOVI)[number]['id']; nivo: 'citanje' | 'odluka'; children?: React.ReactNode }) {
  return (
    <header>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="plakat text-[clamp(34px,4.4vw,58px)]">Staff panel</h1>
          <p className="mt-2 text-[15.5px] text-sivo">
            {nivo === 'odluka' ? 'Možeš da glasaš, komentarišeš, odlučuješ i pišeš novosti.' : 'Možeš da čitaš, glasaš i komentarišeš. Odluke donosi head staff.'}
          </p>
        </div>
        {children}
      </div>
      <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-white/10" aria-label="Delovi panela">
        {TABOVI.map(t => (
          <Link key={t.id} href={t.href} aria-current={aktivno === t.id ? 'page' : undefined}
            className={`relative shrink-0 px-4 py-3 text-[15px] font-medium transition-colors ${aktivno === t.id ? 'text-tekst' : 'text-sivo hover:text-tekst'}`}>
            {t.tekst}
            {aktivno === t.id && <span className="absolute inset-x-3 -bottom-px h-[2px] bg-flamingo" />}
          </Link>
        ))}
      </nav>
    </header>
  );
}
