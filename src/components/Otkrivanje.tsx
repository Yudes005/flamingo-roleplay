'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Filmsko otkrivanje: svaki element sa klasom .otkrij ili .otkrij-tekst
// dobije .vidljivo kad uđe u ekran (jednom). Radi i posle promene strane.
// Posmatra se RODITELJ elementa, jer Chrome ne računa element koji je
// sakriven clip-path-om kao vidljiv.
export function Otkrivanje() {
  const put = usePathname();
  useEffect(() => {
    const elementi = Array.from(document.querySelectorAll<HTMLElement>('.otkrij:not(.vidljivo), .otkrij-tekst:not(.vidljivo)'));
    if (!('IntersectionObserver' in window)) {
      elementi.forEach(e => e.classList.add('vidljivo'));
      return;
    }
    const deca = new Map<Element, HTMLElement[]>();
    for (const e of elementi) {
      const r = e.parentElement || e;
      deca.set(r, [...(deca.get(r) || []), e]);
    }
    const io = new IntersectionObserver(unosi => {
      for (const u of unosi) {
        if (!u.isIntersecting) continue;
        (deca.get(u.target) || []).forEach(e => e.classList.add('vidljivo'));
        io.unobserve(u.target);
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    deca.forEach((_, r) => io.observe(r));
    return () => io.disconnect();
  }, [put]);
  return null;
}
