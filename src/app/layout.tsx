import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/unbounded';
import '@fontsource-variable/onest';
import './globals.css';
import { SITE } from '@/config/site';
import { Navigacija } from '@/components/Navigacija';
import { Podnozje } from '@/components/Podnozje';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || 'https://flamingo-roleplay.vercel.app'),
  title: { default: `${SITE.ime} - GTA V roleplay server`, template: `%s | ${SITE.ime}` },
  description: SITE.opis,
  openGraph: { title: SITE.ime, description: SITE.opis, images: ['/img/hero.webp'], locale: 'sr_RS', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#150d1c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr">
      <body>
        <a href="#sadrzaj" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-flamingo focus:px-4 focus:py-2">
          Preskoči na sadržaj
        </a>
        <Navigacija />
        <main id="sadrzaj">{children}</main>
        <Podnozje />
      </body>
    </html>
  );
}
