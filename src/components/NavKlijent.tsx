'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileText, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { DiscordIkona } from './ikone';

type L = { href: string; tekst: string };

export function NavLinkovi({ linkovi }: { linkovi: L[] }) {
  const put = usePathname();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Glavni meni">
      {linkovi.map(l => {
        const aktivan = put === l.href || put.startsWith(l.href + '/');
        return (
          <Link key={l.href} href={l.href} aria-current={aktivan ? 'page' : undefined}
            className={`rounded-lg px-3.5 py-2 text-[15px] font-medium transition-colors ${aktivan ? 'text-tekst' : 'text-sivo hover:text-tekst'}`}>
            <span className={aktivan ? 'border-b-2 border-flamingo pb-1' : ''}>{l.tekst}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function KorisnikMeni({ ime, avatar, staff }: { ime: string; avatar: string | null; staff: boolean }) {
  const [otvoren, setOtvoren] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!otvoren) return;
    const klik = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOtvoren(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOtvoren(false); };
    document.addEventListener('mousedown', klik); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', klik); document.removeEventListener('keydown', esc); };
  }, [otvoren]);

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button type="button" onClick={() => setOtvoren(o => !o)} aria-expanded={otvoren} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-white/10 py-1 pl-1 pr-3 transition-colors hover:border-white/25">
        {avatar && <Image src={avatar} alt="" unoptimized width={30} height={30} className="size-[30px] rounded-full" />}
        <span className="max-w-[140px] truncate text-[14.5px] font-medium">{ime}</span>
        <ChevronDown className={`size-4 text-sivo transition-transform ${otvoren ? 'rotate-180' : ''}`} />
      </button>
      {otvoren && (
        <div role="menu" className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-white/10 bg-noc-2 p-1.5 shadow-2xl shadow-black/50">
          <Link role="menuitem" href="/moje-prijave" onClick={() => setOtvoren(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14.5px] hover:bg-white/[.06]">
            <FileText className="size-4 text-sivo" /> Moje prijave
          </Link>
          {staff && (
            <Link role="menuitem" href="/panel" onClick={() => setOtvoren(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[14.5px] hover:bg-white/[.06]">
              <LayoutDashboard className="size-4 text-sivo" /> Staff panel
            </Link>
          )}
          <form action="/api/auth/odjava" method="post">
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14.5px] text-sivo hover:bg-white/[.06] hover:text-tekst">
              <LogOut className="size-4" /> Odjavi se
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function MobilniMeni({ linkovi, prijavljen, staff }: { linkovi: L[]; prijavljen: boolean; staff: boolean }) {
  const [otvoren, setOtvoren] = useState(false);
  const [spreman, setSpreman] = useState(false);
  const put = usePathname();
  useEffect(() => setSpreman(true), []);
  useEffect(() => setOtvoren(false), [put]);
  useEffect(() => {
    if (!otvoren) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOtvoren(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [otvoren]);
  useEffect(() => {
    document.body.style.overflow = otvoren ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [otvoren]);

  return (
    <>
      <button type="button" onClick={() => setOtvoren(o => !o)} aria-expanded={otvoren} aria-controls="mobilni-meni"
        className="grid size-11 place-items-center rounded-xl border border-white/12 md:hidden" aria-label={otvoren ? 'Zatvori meni' : 'Otvori meni'}>
        {otvoren ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {otvoren && spreman && createPortal(
        <div id="mobilni-meni" className="fixed inset-x-0 bottom-0 top-[68px] z-40 overflow-y-auto bg-noc px-5 pb-10 pt-6 md:hidden">
          <nav className="flex flex-col" aria-label="Meni">
            {[{ href: '/', tekst: 'Početna' }, ...linkovi].map(l => (
              <Link key={l.href} href={l.href} className={`border-b border-white/[.07] py-4 font-display text-[24px] font-semibold ${put === l.href ? 'text-flamingo-2' : ''}`}>
                {l.tekst}
              </Link>
            ))}
            {prijavljen && (
              <Link href="/moje-prijave" className="border-b border-white/[.07] py-4 font-display text-[24px] font-semibold">Moje prijave</Link>
            )}
            {staff && (
              <Link href="/panel" className="border-b border-white/[.07] py-4 font-display text-[24px] font-semibold">Staff panel</Link>
            )}
          </nav>
          <div className="mt-8">
            {prijavljen ? (
              <form action="/api/auth/odjava" method="post">
                <button type="submit" className="dugme dugme-obicno w-full"><LogOut className="size-4" /> Odjavi se</button>
              </form>
            ) : (
              <a href="/api/auth/discord" className="dugme dugme-discord w-full"><DiscordIkona /> Prijavi se preko Discorda</a>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
