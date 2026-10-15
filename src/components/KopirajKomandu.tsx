'use client';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

export function KopirajKomandu({ server, svetlo = false }: { server: string; svetlo?: boolean }) {
  const [kopirano, setKopirano] = useState(false);
  const komanda = `connect ${server}`;
  async function kopiraj() {
    try {
      await navigator.clipboard.writeText(komanda);
    } catch {
      const t = document.createElement('textarea');
      t.value = komanda; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setKopirano(true);
    setTimeout(() => setKopirano(false), 1800);
  }
  return (
    <button
      type="button"
      onClick={kopiraj}
      className={`group inline-flex max-w-full items-center gap-3 rounded-xl border py-2 pl-4 pr-2 text-left text-[14px] transition-colors ${svetlo
        ? 'border-white/15 bg-noc hover:border-white/30'
        : 'border-white/15 bg-black/40 backdrop-blur-md hover:border-white/30'}`}
      aria-label={`Kopiraj komandu ${komanda}`}
    >
      <span className={`truncate font-bold tabular-nums text-tekst/90`}>{komanda}</span>
      <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-extrabold uppercase tracking-[.04em] transition-colors ${kopirano
        ? 'bg-zelena/15 text-zelena'
        : 'bg-white/[.07] text-sivo group-hover:text-tekst'}`}>
        {kopirano ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {kopirano ? 'Kopirano' : 'Kopiraj'}
      </span>
    </button>
  );
}
