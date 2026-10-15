import Link from 'next/link';
import { SITE } from '@/config/site';
import { Logo } from './Logo';
import { DiscordIkona, TikTokIkona } from './ikone';
import { KopirajKomandu } from './KopirajKomandu';

export function Podnozje() {
  return (
    <footer className="mt-24 border-t border-white/[.07] bg-noc-2/50">
      <div className="sadrzaj grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo mali />
          <p className="mt-4 text-[15px] text-sivo">{SITE.opis}</p>
          <div className="mt-5"><KopirajKomandu server={SITE.server} /></div>
        </div>
        <div>
          <h2 className="font-sans text-[14px] font-semibold tracking-normal text-sivo">Grad</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><Link className="hover:text-flamingo-2" href="/pravila">Pravila</Link></li>
            <li><Link className="hover:text-flamingo-2" href="/prijave">Prijave za staff i lidere</Link></li>
            <li><Link className="hover:text-flamingo-2" href="/tim">Tim</Link></li>
            <li><Link className="hover:text-flamingo-2" href="/#ulaz">Kako da uđeš</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-sans text-[14px] font-semibold tracking-normal text-sivo">Zajednica</h2>
          <ul className="mt-3 space-y-2 text-[15px]">
            <li><a className="inline-flex items-center gap-2 hover:text-flamingo-2" href={SITE.discord} target="_blank" rel="noopener"><DiscordIkona className="size-4" /> Discord</a></li>
            <li><a className="inline-flex items-center gap-2 hover:text-flamingo-2" href={SITE.tiktok} target="_blank" rel="noopener"><TikTokIkona className="size-4" /> TikTok</a></li>
          </ul>
        </div>
      </div>
      <div className="sadrzaj flex flex-col gap-2 border-t border-white/[.06] py-6 text-[13px] text-sivo-2 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} {SITE.ime}</p>
        <p>Nismo povezani sa Rockstar Games ni Take-Two Interactive.</p>
      </div>
    </footer>
  );
}
