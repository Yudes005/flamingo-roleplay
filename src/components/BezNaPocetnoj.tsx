'use client';
import { usePathname } from 'next/navigation';

// Naslovna je jedan ekran, pa na njoj nema podnožja
export function BezNaPocetnoj({ children }: { children: React.ReactNode }) {
  return usePathname() === '/' ? null : <>{children}</>;
}
