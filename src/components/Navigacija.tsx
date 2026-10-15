import { MENI } from '@/config/site';
import { trenutniKorisnik } from '@/lib/session';
import { nivoStaffa } from '@/lib/dozvole';
import { statusServera } from '@/lib/status';
import { Logo } from './Logo';
import { NavOkvir, NavLinkovi, MobilniMeni, KorisnikMeni } from './NavKlijent';
import { DiscordIkona } from './ikone';

export async function Navigacija() {
  const [korisnik, status] = await Promise.all([trenutniKorisnik(), statusServera()]);
  const staff = korisnik ? (await nivoStaffa(korisnik.id).catch(() => 'nema' as const)) !== 'nema' : false;

  return (
    <NavOkvir>
      <div className="sadrzaj flex h-[72px] items-center gap-4 lg:gap-8">
        <Logo />
        <NavLinkovi linkovi={MENI} />
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-semibold text-sivo xl:inline-flex">
            {status.online ? (
              <><span className="tacka-uzivo" /><span><b className="font-semibold text-tekst tabular-nums">{status.igraca}</b> u gradu</span></>
            ) : (
              <><span className="size-2 rounded-full bg-sivo-2" /><span>Server je ugašen</span></>
            )}
          </span>
          {korisnik ? (
            <KorisnikMeni ime={korisnik.ime} avatar={korisnik.avatar} staff={staff} />
          ) : (
            <a href="/api/auth/discord" className="dugme dugme-glavno dugme-malo hidden md:inline-flex">
              <DiscordIkona className="size-[18px]" /> Prijavi se
            </a>
          )}
          <MobilniMeni linkovi={MENI} prijavljen={!!korisnik} staff={staff} />
        </div>
      </div>
    </NavOkvir>
  );
}
