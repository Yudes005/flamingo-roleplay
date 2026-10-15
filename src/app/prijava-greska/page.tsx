import type { Metadata } from 'next';
import Link from 'next/link';
import { DiscordIkona } from '@/components/ikone';

export const metadata: Metadata = { title: 'Prijava nije uspela', robots: { index: false } };

// Poruke za igrača + šta vlasnik sajta treba da popravi
const PORUKE: Record<string, { igrac: string; vlasnik?: string }> = {
  istekla: { igrac: 'Prijava je trajala predugo ili je završena u drugom browseru. Probaj ponovo, u istom prozoru.' },
  otkazano: { igrac: 'Prijava je otkazana na Discordu. Klikni ponovo i izaberi Authorize.' },
  'client-id': { igrac: 'Prijava preko Discorda još nije podešena.', vlasnik: 'U Vercelu fali DISCORD_CLIENT_ID (Settings, pa Environment Variables). Posle dodavanja uradi Redeploy.' },
  'client-secret': { igrac: 'Prijava preko Discorda još nije podešena.', vlasnik: 'DISCORD_CLIENT_SECRET fali ili je pogrešan. Kopiraj ga iz Discord Developer Portala (OAuth2, pa Reset Secret), upiši u Vercel i uradi Redeploy.' },
  sesija: { igrac: 'Prijava preko Discorda još nije podešena.', vlasnik: 'SESSION_SECRET fali ili je kraći od 32 znaka. Upiši dugačak nasumičan tekst u Vercel i uradi Redeploy.' },
  redirect: { igrac: 'Discord nije prihvatio prijavu.', vlasnik: 'Redirect URL u Discord Developer Portalu (OAuth2, pa Redirects) mora biti tačno SITE_URL + /api/auth/discord. Proveri i SITE_URL u Vercelu.' },
  discord: { igrac: 'Discord nije potvrdio prijavu. Probaj ponovo, a ako se ponavlja, javi staffu.' },
};

export default async function PrijavaGreska({ searchParams }: { searchParams: Promise<{ razlog?: string }> }) {
  const { razlog } = await searchParams;
  const p = PORUKE[razlog || ''] || PORUKE.discord;
  const sajt = (process.env.SITE_URL || 'https://flamingo-roleplay.vercel.app').replace(/\/+$/, '');
  return (
    <div className="sadrzaj grid min-h-[86vh] place-items-center pb-16 pt-[110px]">
      <div className="max-w-lg text-center">
        <h1 className="plakat text-[clamp(56px,9vw,96px)]">Prijava nije uspela</h1>
        <p className="mx-auto mt-5 max-w-[44ch] text-[17px] text-sivo">{p.igrac}</p>
        {p.vlasnik && (
          <div className="mt-8 rounded-2xl border border-zlato/30 bg-zlato/[.07] p-5 text-left text-[15px]">
            <p className="font-semibold text-zlato">Za vlasnika sajta</p>
            <p className="mt-1.5 text-tekst/85">{p.vlasnik}</p>
            {razlog === 'redirect' && <p className="mt-3 break-all rounded-lg bg-black/40 px-3 py-2 text-[14px]">{sajt}/api/auth/discord</p>}
            <Link href="/provera" className="mt-3 inline-block text-[14.5px] font-medium text-zlato underline underline-offset-4">Proveri sva podešavanja</Link>
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/api/auth/discord" className="dugme dugme-discord"><DiscordIkona /> Probaj ponovo</a>
          <Link href="/" className="dugme dugme-obicno">Nazad na početnu</Link>
        </div>
      </div>
    </div>
  );
}
