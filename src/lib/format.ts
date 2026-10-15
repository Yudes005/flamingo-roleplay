export function datum(d: Date | string | null | undefined) {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Belgrade' });
}

export function datumVreme(d: Date | string | null | undefined) {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.toLocaleString('sr-Latn-RS', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Belgrade' });
}

export function relativno(d: Date | string) {
  const x = typeof d === 'string' ? new Date(d) : d;
  const s = Math.floor((Date.now() - x.getTime()) / 1000);
  if (s < 60) return 'upravo';
  const m = Math.floor(s / 60);
  if (m < 60) return `pre ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `pre ${h} h`;
  const dana = Math.floor(h / 24);
  return dana === 1 ? 'juče' : `pre ${dana} dana`;
}
