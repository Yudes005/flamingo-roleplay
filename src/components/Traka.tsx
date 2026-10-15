'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// Vodoravna filmska traka sa dugmićima levo/desno (na telefonu se prevlači prstom)
export function Traka({ zaglavlje, children, oznaka }: { zaglavlje: React.ReactNode; children: React.ReactNode; oznaka: string }) {
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

  const pomeri = (smer: number) => ref.current?.scrollBy({ left: smer * Math.min(900, ref.current.clientWidth * 0.8), behavior: 'smooth' });
  const dugme = 'grid size-12 place-items-center rounded-full border border-white/20 transition-colors hover:border-white hover:bg-white hover:text-mastilo disabled:pointer-events-none disabled:opacity-25';

  return (
    <div>
      <div className="sadrzaj flex flex-wrap items-end justify-between gap-6">
        {zaglavlje}
        <div className="hidden gap-2 md:flex">
          <button type="button" onClick={() => pomeri(-1)} disabled={!ivice.levo} aria-label={`${oznaka}: nazad`} className={dugme}>
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => pomeri(1)} disabled={!ivice.desno} aria-label={`${oznaka}: napred`} className={dugme}>
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <div ref={ref} className="traka-skrol mt-10 overflow-x-auto overscroll-x-contain pb-2">{children}</div>
    </div>
  );
}
