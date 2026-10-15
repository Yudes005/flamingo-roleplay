import Link from 'next/link';
import { trenutniKorisnik } from '@/lib/session';
import { nivoStaffa } from '@/lib/dozvole';
import { statusServera } from '@/lib/status';
import { Logo } from './Logo';
import { NavLinkovi, MobilniMeni, KorisnikMeni } from './NavKlijent';
import { DiscordIkona } from './ikone';

export const LINKOVI = [
  { href: '/pravila', tekst: 'Pravila' },
  { href: '/prijave', tekst: 'Prijave' },
  { href: '/tim', tekst: 'Tim' },
];

export async function Navigacija() {
  const [korisnik, status] = await Promise.all([trenutniKorisnik(), statusServera()]);
  const staff = korisnik ? (await nivoStaffa(korisnik.id)) !== 'nema' : false;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[.07] bg-noc/80 backdrop-blur-xl supports-[backdrop-filter]:bg-noc/65">
      <div className="sadrzaj flex h-[68px] items-center gap-6">
        <Logo />
        <NavLinkovi linkovi={LINKOVI} />
        <div className="ml-auto flex items-center gap-3">
          <Link href="/#ulaz" className="hidden items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-[13.5px] text-sivo transition-colors hover:text-tekst sm:inline-flex">
            {status.online ? (
              <><span className="tacka-uzivo" /><span><b className="font-semibold text-tekst tabular-nums">{status.igraca}</b> u gradu</span></>
            ) : (
              <><span className="size-2 rounded-full bg-sivo-2" /><span>Server ne odgovara</span></>
            )}
          </Link>
          {korisnik ? (
            <KorisnikMeni ime={korisnik.ime} avatar={korisnik.avatar} staff={staff} />
          ) : (
            <a href="/api/auth/discord" className="dugme dugme-discord hidden !min-h-10 !px-4 text-[14.5px] md:inline-flex">
              <DiscordIkona className="size-[18px]" /> Prijavi se
            </a>
          )}
          <MobilniMeni linkovi={LINKOVI} prijavljen={!!korisnik} staff={staff} />
        </div>
      </div>
    </header>
  );
}
