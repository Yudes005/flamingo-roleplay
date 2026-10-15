import { Fragment } from 'react';

// Jednostavan i bezbedan prikaz teksta iz novosti i predloga (bez HTML-a):
//  - prazan red = novi pasus
//  - red koji počinje sa "- " = stavka liste
//  - red koji počinje sa "## " = podnaslov
//  - **ovako** = podebljano, a linkovi (https://...) postaju klikabilni

function linija(t: string, kljuc: string) {
  const delovi = t.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s)]+)/g);
  return delovi.map((d, i) => {
    if (d.startsWith('**') && d.endsWith('**') && d.length > 4) return <strong key={`${kljuc}-${i}`}>{d.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(d)) return <a key={`${kljuc}-${i}`} href={d} target="_blank" rel="noopener nofollow">{d.replace(/^https?:\/\//, '')}</a>;
    return <Fragment key={`${kljuc}-${i}`}>{d}</Fragment>;
  });
}

export function Tekst({ tekst, className = '' }: { tekst: string; className?: string }) {
  const blokovi = tekst.replace(/\r/g, '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  return (
    <div className={`clanak ${className}`}>
      {blokovi.map((b, i) => {
        const redovi = b.split('\n');
        if (redovi.every(r => r.trim().startsWith('- '))) {
          return <ul key={i}>{redovi.map((r, j) => <li key={j}>{linija(r.trim().slice(2), `${i}-${j}`)}</li>)}</ul>;
        }
        if (redovi.length === 1 && b.startsWith('## ')) return <h3 key={i}>{linija(b.slice(3), String(i))}</h3>;
        return (
          <p key={i}>
            {redovi.map((r, j) => <Fragment key={j}>{j > 0 && <br />}{linija(r, `${i}-${j}`)}</Fragment>)}
          </p>
        );
      })}
    </div>
  );
}
