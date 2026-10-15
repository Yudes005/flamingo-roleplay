'use client';
import { useActionState, useState, useTransition } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { obrisiNovost, sacuvajNovost, type StanjeNovosti } from '@/lib/akcije';

type Pocetno = { naslov: string; kategorija: string; kratko: string; tekst: string; slika: string; objavljena: boolean };

export function NovostForma({ id, kategorije, imaKanal, pocetno }: {
  id: number | null; kategorije: { id: string; naziv: string }[]; imaKanal: boolean; pocetno?: Pocetno;
}) {
  const akcija = sacuvajNovost.bind(null, id);
  const [stanje, posalji, salje] = useActionState<StanjeNovosti, FormData>(akcija, {});
  const [kratko, setKratko] = useState(pocetno?.kratko.length || 0);
  const g = stanje.polja || {};

  return (
    <form action={posalji} className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <label htmlFor="n-naslov" className="text-[14px] text-sivo">Naslov</label>
          <input id="n-naslov" name="naslov" maxLength={120} defaultValue={pocetno?.naslov} className="polje mt-1.5 text-[18px] font-semibold" aria-invalid={!!g.naslov} />
          {g.naslov && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.naslov}</p>}
        </div>
        <div>
          <label htmlFor="n-kratko" className="text-[14px] text-sivo">Kratak opis (vidi se u listi i na Discordu)</label>
          <textarea id="n-kratko" name="kratko" rows={2} maxLength={280} defaultValue={pocetno?.kratko} onChange={e => setKratko(e.target.value.length)} className="polje mt-1.5 resize-y" aria-invalid={!!g.kratko} />
          <p className="mt-1 text-right text-[12.5px] text-sivo-2 tabular-nums">{kratko} / 280</p>
          {g.kratko && <p className="text-[13.5px] text-[#ff8a8e]">{g.kratko}</p>}
        </div>
        <div>
          <label htmlFor="n-tekst" className="text-[14px] text-sivo">Tekst</label>
          <textarea id="n-tekst" name="tekst" rows={16} maxLength={12000} defaultValue={pocetno?.tekst} className="polje mt-1.5 resize-y leading-relaxed" aria-invalid={!!g.tekst} />
          {g.tekst && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.tekst}</p>}
          <p className="mt-2 text-[13.5px] text-sivo-2">Prazan red je novi pasus. Red koji počinje sa „- ” je stavka liste, „## ” je podnaslov, a **ovako** je podebljano. Linkovi postaju klikabilni sami.</p>
        </div>
      </div>

      <aside className="space-y-6 lg:sticky lg:top-[100px] lg:self-start">
        <div className="povrsina space-y-5 p-5">
          <div>
            <label htmlFor="n-kat" className="text-[14px] text-sivo">Kategorija</label>
            <select id="n-kat" name="kategorija" defaultValue={pocetno?.kategorija || ''} className="polje mt-1.5" aria-invalid={!!g.kategorija}>
              <option value="" disabled>Izaberi...</option>
              {kategorije.map(k => <option key={k.id} value={k.id}>{k.naziv}</option>)}
            </select>
            {g.kategorija && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.kategorija}</p>}
          </div>
          <div>
            <label htmlFor="n-slika" className="text-[14px] text-sivo">Slika (nije obavezno)</label>
            <input id="n-slika" name="slika" defaultValue={pocetno?.slika} placeholder="https://... ili /img/hero.webp" className="polje mt-1.5" aria-invalid={!!g.slika} />
            {g.slika && <p className="mt-1 text-[13.5px] text-[#ff8a8e]">{g.slika}</p>}
          </div>
          <label className="flex items-center gap-2.5 text-[15px]">
            <input type="checkbox" name="objavljena" defaultChecked={pocetno ? pocetno.objavljena : true} className="size-4 accent-[#ff4d8d]" />
            Objavljeno (skini kvačicu za nacrt)
          </label>
          <label className={`flex items-start gap-2.5 text-[15px] ${imaKanal ? '' : 'opacity-50'}`}>
            <input type="checkbox" name="discord" disabled={!imaKanal} defaultChecked={!id && imaKanal} className="mt-1 size-4 accent-[#ff4d8d]" />
            <span>Objavi i na Discordu{!imaKanal && <span className="block text-[13px] text-sivo-2">Dodaj DISCORD_NOVOSTI_KANAL_ID u Vercel da bi ovo radilo.</span>}</span>
          </label>
        </div>
        {stanje.greska && <p className="text-[14px] text-[#ff8a8e]" role="alert">{stanje.greska}</p>}
        <button type="submit" disabled={salje} className="dugme dugme-glavno w-full">
          {salje && <Loader2 className="size-4 animate-spin" />} {id ? 'Sačuvaj izmene' : 'Objavi novost'}
        </button>
      </aside>
    </form>
  );
}

export function ObrisiDugme({ id }: { id: number }) {
  const [radi, start] = useTransition();
  return (
    <button type="button" disabled={radi} aria-label="Obriši novost"
      onClick={() => { if (confirm('Da obrišem ovu novost? Ovo ne može da se vrati.')) start(async () => { await obrisiNovost(id); }); }}
      className="dugme dugme-obicno dugme-malo !px-3 text-[#ff8a8e]">
      {radi ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
