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
      className={`group inline-flex max-w-full items-center gap-3 rounded-[10px] border px-3.5 py-2 text-left text-[14px] transition-colors ${svetlo ? 'border-white/15 bg-black/30 hover:bg-black/45' : 'border-white/12 bg-noc hover:border-white/25'}`}
      aria-label={`Kopiraj komandu ${komanda}`}
    >
      <span className="truncate font-mono text-tekst/90">{komanda}</span>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-sivo group-hover:text-tekst">
        {kopirano ? <Check className="size-4 text-palma" /> : <Copy className="size-4" />}
        <span className="text-[13px]">{kopirano ? 'Kopirano' : 'Kopiraj'}</span>
      </span>
    </button>
  );
}
