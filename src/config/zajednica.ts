// ============================================================
//  NOVOSTI I PREDLOZI - kategorije i statusi
// ============================================================

export const KATEGORIJE_NOVOSTI = [
  { id: 'update', naziv: 'Update', boja: '#ff4d8d' },
  { id: 'event', naziv: 'Event', boja: '#ffb547' },
  { id: 'obavestenje', naziv: 'Obaveštenje', boja: '#7fb2ff' },
] as const;

export function kategorijaNovosti(id: string) {
  return KATEGORIJE_NOVOSTI.find(k => k.id === id) || KATEGORIJE_NOVOSTI[2];
}

export const KATEGORIJE_PREDLOGA = ['Poslovi', 'Organizacije', 'Bande', 'Vozila', 'Imovina i biznisi', 'Eventi', 'Sajt i Discord', 'Nešto drugo'];

export const STATUSI_PREDLOGA = [
  { id: 'novo', naziv: 'Novo', opis: 'Staff ga još nije pogledao.' },
  { id: 'razmatra', naziv: 'Razmatra se', opis: 'Staff razmišlja da li i kako.' },
  { id: 'prihvaceno', naziv: 'Prihvaćeno', opis: 'Biće urađeno.' },
  { id: 'uradjeno', naziv: 'Urađeno', opis: 'Već je u gradu.' },
  { id: 'odbijeno', naziv: 'Odbijeno', opis: 'Neće biti urađeno.' },
] as const;

export function statusPredloga(id: string) {
  return STATUSI_PREDLOGA.find(s => s.id === id) || STATUSI_PREDLOGA[0];
}

// koliko predloga jedan igrač sme da pošalje u 24 sata
export const PREDLOGA_DNEVNO = 3;
