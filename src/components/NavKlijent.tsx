'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, FileText, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { DiscordIkona } from './ikone';

type L = { href: string; tekst: string };

// Na naslovnoj je meni providan (sedi u crnoj filmskoj traci), a čim se skroluje dobije pozadinu.
export function NavOkvir({ children }: { children: React.ReactNode }) {
  const put = usePathname();
  const [skrol, setSkrol] = useState(false);
  useEffect(() => {
    const f = () => setSkrol(window.scrollY > 40);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  const providno = put === '/' && !skrol;
  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500 ${providno
      ? 'border-b border-transparent bg-transparent'
      : 'border-b border-white/[.07] bg-noc/85 backdrop-blur-xl supports-[backdrop-filter]:bg-noc/70'}`}>
      {children}
    </header>
  );
}

function aktivan(put: string, href: string) {
  return put === href || put.startsWith(href + '/');
}

export function NavLinkovi({ linkovi }: { linkovi: L[] }) {
  const put = usePathname();
  return (
    <nav className="hidden items-center lg:flex" aria-label="Glavni meni">
      {linkovi.map(l => {
        const a = aktivan(put, l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={a ? 'page' : undefined}
            className={`relative px-3 py-2 text-[15px] font-medium transition-colors ${a ? 'text-tekst' : 'text-sivo hover:text-tekst'}`}>
            {l.tekst}
            <span className={`absolute inset-x-3 -bottom-0.5 h-[2px] origin-left bg-flamingo transition-transform duration-300 ${a ? 'scale-x-100' : 'scale-x-0'}`} />
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
        className="flex items-center gap-2 rounded-full border border-white/12 bg-black/20 py-1 pl-1 pr-3 transition-colors hover:border-white/30">
        {avatar
          ? <Image src={avatar} alt="" unoptimized width={32} height={32} className="size-8 rounded-full" />
          : <span className="size-8 rounded-full bg-noc-3" />}
        <span className="max-w-[140px] truncate text-[14.5px] font-medium">{ime}</span>
        <ChevronDown className={`size-4 text-sivo transition-transform ${otvoren ? 'rotate-180' : ''}`} />
      </button>
      {otvoren && (
        <div role="menu" className="pojava absolute right-0 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-noc-2 p-1.5 shadow-2xl shadow-black/60">
          <Link role="menuitem" href="/moje-prijave" onClick={() => setOtvoren(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] hover:bg-white/[.06]">
            <FileText className="size-4 text-sivo" /> Moje prijave
          </Link>
          {staff && (
            <Link role="menuitem" href="/panel" onClick={() => setOtvoren(false)} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14.5px] hover:bg-white/[.06]">
              <LayoutDashboard className="size-4 text-sivo" /> Staff panel
            </Link>
          )}
          <form action="/api/auth/odjava" method="post">
            <button role="menuitem" type="submit" className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[14.5px] text-sivo hover:bg-white/[.06] hover:text-tekst">
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

  const sve = [{ href: '/', tekst: 'Početna' }, ...linkovi,
    ...(prijavljen ? [{ href: '/moje-prijave', tekst: 'Moje prijave' }] : []),
    ...(staff ? [{ href: '/panel', tekst: 'Staff panel' }] : [])];

  return (
    <>
      <button type="button" onClick={() => setOtvoren(o => !o)} aria-expanded={otvoren} aria-controls="mobilni-meni"
        className="grid size-11 place-items-center rounded-full border border-white/15 bg-black/20 lg:hidden" aria-label={otvoren ? 'Zatvori meni' : 'Otvori meni'}>
        {otvoren ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {otvoren && spreman && createPortal(
        <div id="mobilni-meni" className="fixed inset-0 z-[45] flex flex-col overflow-y-auto bg-noc px-4 pb-10 pt-[88px] sm:px-6 lg:hidden">
          <nav className="flex flex-col" aria-label="Meni">
            {sve.map((l, i) => (
              <Link key={l.href} href={l.href} style={{ animationDelay: `${i * 45}ms` }}
                className={`pojava plakat border-b border-white/[.07] py-3.5 text-[44px] ${put === l.href ? 'text-flamingo' : ''}`}>
                {l.tekst}
              </Link>
            ))}
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
