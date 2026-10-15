import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { nadjiPrijavu } from '@/config/prijave';
import { trenutniKorisnik } from '@/lib/session';
import { poslednjePoVrsti, stanjeZaVrstu } from '@/lib/upiti';
import { DokumentZaglavlje } from '@/components/Dokument';
import { PrijavaForma } from '@/components/PrijavaForma';
import { DiscordIkona } from '@/components/ikone';

type Props = { params: Promise<{ vrsta: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = nadjiPrijavu((await params).vrsta);
  return { title: p ? `Prijava: ${p.naziv}` : 'Prijava' };
}

export default async function Formular({ params }: Props) {
  const vrsta = nadjiPrijavu((await params).vrsta);
  if (!vrsta) notFound();
  const korisnik = await trenutniKorisnik();

  let blokirano: string | null = null;
  if (korisnik) {
    try {
      const st = stanjeZaVrstu(vrsta.id, (await poslednjePoVrsti(korisnik.id))[vrsta.id]);
      if (st.tip === 'ceka') blokirano = 'Već imaš prijavu za ovu poziciju koja čeka odluku. Status je u Moje prijave.';
      if (st.tip === 'prihvacena') blokirano = 'Tvoja prijava za ovu poziciju je već prihvaćena.';
      if (st.tip === 'pauza') blokirano = `Prethodna prijava je odbijena. Novu možeš da pošalješ za ${st.dana} ${st.dana === 1 ? 'dan' : 'dana'}.`;
    } catch {
      blokirano = 'Prijave trenutno ne rade (baza nije povezana). Javi staffu na Discordu.';
    }
  }
  if (!vrsta.otvorena) blokirano = 'Prijave za ovu poziciju su trenutno zatvorene.';

  return (
    <div className="sadrzaj pb-10 pt-[100px] md:pt-[120px]">
      <Link href="/prijave" className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[15px] text-sivo hover:text-tekst">
        <ChevronLeft className="size-4" /> Sve prijave
      </Link>

      <div className="mx-auto mt-4 max-w-[760px]">
        {!korisnik ? (
          <div className="povrsina p-8 text-center md:p-12">
            <h1 className="text-[clamp(26px,4vw,36px)] font-bold">Prijava za {vrsta.naziv.toLowerCase()}</h1>
            <p className="mx-auto mt-4 max-w-md text-[16.5px] text-sivo">
              Da bi popunio prijavu, prijavi se preko Discorda. Tako znamo ko je poslao prijavu i možemo da ti javimo odluku.
            </p>
            <a href={`/api/auth/discord?nazad=/prijave/${vrsta.id}`} className="dugme dugme-discord mt-8"><DiscordIkona /> Prijavi se preko Discorda</a>
          </div>
        ) : (
          <article className="papir px-5 py-8 sm:px-10 sm:py-11 md:px-14">
            <DokumentZaglavlje pozicija={vrsta.naziv} ime={korisnik.ime} korisnicko={korisnik.korisnicko} avatar={korisnik.avatar} kad={new Date()} />
            {blokirano ? (
              <div className="py-10 text-center">
                <p className="mx-auto max-w-md text-[16.5px]">{blokirano}</p>
                <Link href="/moje-prijave" className="dugme mt-6 bg-mastilo text-papir hover:bg-mastilo/90">Moje prijave</Link>
              </div>
            ) : (
              <PrijavaForma vrstaId={vrsta.id} polja={vrsta.polja} ime={korisnik.ime} />
            )}
          </article>
        )}
      </div>
    </div>
  );
}
