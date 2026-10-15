import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/montserrat';
import './globals.css';
import { SITE, adresaSajta } from '@/config/site';
import { Navigacija } from '@/components/Navigacija';
import { Podnozje } from '@/components/Podnozje';
import { Otkrivanje } from '@/components/Otkrivanje';
import { BezNaPocetnoj } from '@/components/BezNaPocetnoj';

export const metadata: Metadata = {
  metadataBase: new URL(adresaSajta()),
  title: { default: `${SITE.ime} - GTA V roleplay server`, template: `%s | ${SITE.ime}` },
  description: SITE.opis,
  openGraph: { title: SITE.ime, description: SITE.opis, images: ['/img/hero-noc.webp'], locale: 'sr_RS', type: 'website' },
};

export const viewport: Viewport = { themeColor: '#000000' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sr" suppressHydrationWarning>
      <head>
        {/* označi da JS radi - tek tada se slike skrivaju za filmsko otkrivanje */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>
        <a href="#sadrzaj" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-flamingo focus:px-4 focus:py-2">
          Preskoči na sadržaj
        </a>
        <Navigacija />
        <main id="sadrzaj">{children}</main>
        <BezNaPocetnoj><Podnozje /></BezNaPocetnoj>
        <Otkrivanje />
      </body>
    </html>
  );
}
