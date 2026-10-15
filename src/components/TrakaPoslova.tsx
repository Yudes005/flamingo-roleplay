'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Vodoravna traka poslova sa dugmićima levo/desno (na telefonu se samo prevlači)
export function TrakaPoslova({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ivice, setIvice] = useState({ levo: false, desno: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const proveri = () => setIvice({ levo: el.scrollLeft > 8, desno: el.scrollLeft + el.clientWidth < el.scrollWidth - 8 });
    proveri();
    el.addEventListener('scroll', proveri, { passive: true });
    window.addEventListener('resize', proveri);
    return () => { el.removeEventListener('scroll', proveri); window.removeEventListener('resize', proveri); };
  }, []);

  const pomeri = (smer: number) => ref.current?.scrollBy({ left: smer * Math.min(800, ref.current.clientWidth * 0.8), behavior: 'smooth' });

  return (
    <div>
      <div className="sadrzaj flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-xl">
          <h2 className="text-[clamp(28px,4vw,44px)] font-bold">Posao od prvog dana</h2>
          <p className="mt-4 text-[17px] text-sivo">Osam legalnih poslova, svaki sa nivoima, opremom i svojom pijacom gde prodaješ ono što zaradiš.</p>
        </div>
        <div className="hidden gap-2 md:flex">
          <button type="button" onClick={() => pomeri(-1)} disabled={!ivice.levo} aria-label="Prethodni poslovi"
            className="grid size-11 place-items-center rounded-full border border-white/15 transition-colors hover:bg-white/10 disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => pomeri(1)} disabled={!ivice.desno} aria-label="Sledeći poslovi"
            className="grid size-11 place-items-center rounded-full border border-white/15 transition-colors hover:bg-white/10 disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div ref={ref} className="traka-skrol mt-10 overflow-x-auto pb-4">{children}</div>
    </div>
  );
}
