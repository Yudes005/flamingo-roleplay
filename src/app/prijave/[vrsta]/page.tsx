import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Check, ChevronLeft, Lock } from 'lucide-react';
import { nadjiPrijavu } from '@/config/prijave';
import { trenutniKorisnik } from '@/lib/session';
import { stanjePrijava, stanjeZaVrstu } from '@/lib/upiti';
import { imaBazu } from '@/lib/db';
import { DokumentZaglavlje, podnaslovDokumenta } from '@/components/Dokument';
import { PrijavaForma } from '@/components/PrijavaForma';
import { DiscordIkona } from '@/components/ikone';

type Props = { params: Promise<{ vrsta: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = nadjiPrijavu((await params).vrsta);
  return { title: p ? p.naziv : 'Prijava' };
}

export default async function Formular({ params }: Props) {
  const vrsta = nadjiPrijavu((await params).vrsta);
  if (!vrsta) notFound();
  const korisnik = await trenutniKorisnik();
  const report = vrsta.grupa === 'report';

  let blokirano: string | null = null;
  if (korisnik) {
    if (!imaBazu()) {
      blokirano = 'Prijave trenutno ne rade jer baza nije povezana. Javi staffu na Discordu.';
    } else {
      try {
        const st = stanjeZaVrstu(vrsta, (await stanjePrijava(korisnik.id))[vrsta.id]);
        if (st.tip === 'ceka') blokirano = st.n > 1 ? `Već imaš ${st.n} ovakvih prijava koje čekaju odluku.` : 'Već imaš jednu ovakvu prijavu koja čeka odluku. Status je u Moje prijave.';
        if (st.tip === 'prihvacena') blokirano = 'Tvoja prijava za ovu poziciju je već prihvaćena.';
        if (st.tip === 'pauza') blokirano = `Prethodna prijava je odbijena. Novu možeš da pošalješ za ${st.dana} ${st.dana === 1 ? 'dan' : 'dana'}.`;
      } catch {
        blokirano = 'Baza trenutno ne odgovara. Probaj ponovo za minut.';
      }
    }
  }
  if (!vrsta.otvorena) blokirano = 'Ova prijava je trenutno zatvorena.';
  const dok = podnaslovDokumenta(vrsta.grupa, vrsta.id);

  const koraci = report
    ? ['Popuniš i pošalješ.', vrsta.samoVrh ? 'Čita je samo vlasništvo servera.' : 'Staff je preuzima i proverava dokaze.', 'Ishod dobijaš u poruci na Discordu i na sajtu.']
    : ['Popuniš i pošalješ.', 'Staff čita, glasa i odlučuje.', 'Odluku dobijaš u poruci na Discordu, a uz prihvatanje i ulogu.'];

  return (
    <div className="sadrzaj pb-24 pt-[104px] md:pt-[120px]">
      <Link href="/prijave" className="inline-flex items-center gap-1.5 rounded-lg py-2 text-[15px] text-sivo hover:text-tekst">
        <ChevronLeft className="size-4" /> Sve prijave
      </Link>

      <div className="mt-6 grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)] lg:gap-16">
        <div className="min-w-0">
          {!korisnik ? (
            <div className="povrsina p-8 md:p-12">
              <h1 className="plakat text-[clamp(48px,7vw,80px)]">{vrsta.naziv}</h1>
              <p className="mt-4 max-w-[50ch] text-[16.5px] text-sivo">
                Prijavi se preko Discorda da bi popunio formular. Tako znamo ko je poslao i kome da javimo odluku.
              </p>
              <a href={`/api/auth/discord?nazad=/prijave/${vrsta.id}`} className="dugme dugme-discord mt-8"><DiscordIkona /> Prijavi se preko Discorda</a>
            </div>
          ) : (
            <article className="papir px-5 py-8 sm:px-10 sm:py-11 md:px-14">
              <DokumentZaglavlje naslov={vrsta.naziv} podnaslov={dok.podnaslov} oznaka={dok.oznaka} ime={korisnik.ime} korisnicko={korisnik.korisnicko} avatar={korisnik.avatar} kad={new Date()} />
              {blokirano ? (
                <div className="py-12 text-center">
                  <p className="mx-auto max-w-md text-[16.5px]">{blokirano}</p>
                  <Link href="/moje-prijave" className="dugme dugme-tamno mt-6">Moje prijave</Link>
                </div>
              ) : (
                <PrijavaForma vrstaId={vrsta.id} polja={vrsta.polja} ime={korisnik.ime} dugme={report ? 'Pošalji staffu' : 'Pošalji prijavu'} />
              )}
            </article>
          )}
        </div>

        <aside className="space-y-10 lg:sticky lg:top-[110px] lg:self-start">
          {vrsta.samoVrh && (
            <p className="flex gap-3 rounded-2xl border border-zlato/30 bg-zlato/[.07] p-4 text-[15px] text-zlato">
              <Lock className="mt-0.5 size-4 shrink-0" /> Ovaj report vidi samo vlasništvo servera. Staff koga prijavljuješ ga ne vidi.
            </p>
          )}
          <div>
            <h2 className="text-[15px] font-semibold text-sivo-2">Šta treba</h2>
            <ul className="mt-3 space-y-2 text-[15.5px]">
              {vrsta.uslovi.map(u => <li key={u} className="flex gap-2.5"><Check className="mt-1 size-4 shrink-0 text-zelena" />{u}</li>)}
            </ul>
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-sivo-2">Šta se dešava posle</h2>
            <ol className="mt-3 space-y-3 text-[15.5px]">
              {koraci.map((k, i) => (
                <li key={k} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[13px] font-semibold tabular-nums">{i + 1}</span>{k}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
