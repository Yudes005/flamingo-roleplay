import Link from 'next/link';
import { SITE } from '@/config/site';
import { Logo } from './Logo';
import { DiscordIkona, TikTokIkona } from './ikone';
import { KopirajKomandu } from './KopirajKomandu';

const KOLONE = [
  { naslov: 'Grad', linkovi: [
    { href: '/vodic', tekst: 'Vodič za nove igrače' },
    { href: '/pravila', tekst: 'Pravila' },
    { href: '/novosti', tekst: 'Novosti' },
    { href: '/tim', tekst: 'Tim' },
  ] },
  { naslov: 'Prijave', linkovi: [
    { href: '/prijave', tekst: 'Staff i organizacije' },
    { href: '/prijave/report', tekst: 'Report igrača' },
    { href: '/prijave/zalba', tekst: 'Žalba na kaznu' },
    { href: '/predlozi', tekst: 'Predlozi' },
  ] },
];

export function Podnozje() {
  return (
    <footer className="border-t border-white/[.07] bg-black">
      <div className="sadrzaj grid gap-12 py-16 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="max-w-sm">
          <Logo mali />
          <p className="mt-5 text-[15px] text-sivo">{SITE.opis}</p>
          <div className="mt-6"><KopirajKomandu server={SITE.server} /></div>
        </div>
        {KOLONE.map(k => (
          <div key={k.naslov}>
            <h2 className="text-[14px] font-semibold text-sivo-2">{k.naslov}</h2>
            <ul className="mt-4 space-y-2.5 text-[15px]">
              {k.linkovi.map(l => <li key={l.href}><Link className="transition-colors hover:text-flamingo-2" href={l.href}>{l.tekst}</Link></li>)}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="text-[14px] font-semibold text-sivo-2">Zajednica</h2>
          <ul className="mt-4 space-y-2.5 text-[15px]">
            <li><a className="inline-flex items-center gap-2 transition-colors hover:text-flamingo-2" href={SITE.discord} target="_blank" rel="noopener"><DiscordIkona className="size-4" /> Discord</a></li>
            <li><a className="inline-flex items-center gap-2 transition-colors hover:text-flamingo-2" href={SITE.tiktok} target="_blank" rel="noopener"><TikTokIkona className="size-4" /> TikTok</a></li>
          </ul>
        </div>
      </div>
      <div className="sadrzaj flex flex-col gap-2 border-t border-white/[.07] py-6 text-[13px] text-sivo-2 md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} {SITE.ime}</p>
        <p>Nismo povezani sa Rockstar Games ni Take-Two Interactive.</p>
      </div>
    </footer>
  );
}
