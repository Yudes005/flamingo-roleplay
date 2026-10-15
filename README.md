# Flamingo Roleplay - sajt (v3)

Next.js sajt za Vercel, u filmskom stilu: naslovna sa brojem igrača uživo, vodič za nove
igrače, pravila sa tabelom kazni, novosti, predlozi sa glasanjem, tim sa Discorda,
prijave i reportovi sa pravim Discord loginom i staff panel.

## Strane
| Adresa | Šta je |
|---|---|
| `/` | Naslovna: poslovi, organizacije, bande, eventi, kuće i biznisi, prijave, novosti |
| `/vodic` | Kako da uđeš, tasteri, česta pitanja |
| `/pravila` | Pravila sa pretragom, tabela kazni, istorija izmena |
| `/novosti` | Update-i, eventi i obaveštenja (piše ih staff u panelu) |
| `/prijave` | Staff, organizacije, bande, kreatori, reportovi, žalbe, bagovi |
| `/predlozi` | Igrači predlažu i glasaju, staff odgovara |
| `/tim` | Staff sa Discorda, kao odjavna špica |
| `/moje-prijave` | Igrač vidi svoje prijave i ishod (pečat) |
| `/panel` | Staff panel: prijave i reportovi, novosti, predlozi |
| `/provera` | Šta je podešeno u Vercelu, a šta fali (bez prikaza tajni) |

## Postavljanje (jednom)
1. **Vercel -> Storage -> Create Database -> Neon** -> poveži sa projektom. Tabele se prave same.
2. **Vercel -> Settings -> Environment Variables**: popuni sve iz `.env.example`.
3. **Deployments -> ... -> Redeploy**.
4. Otvori `/provera` i popravi sve što je crveno.

Discord:
- **Developer Portal -> OAuth2 -> Redirects**: `https://flamingo-roleplay.vercel.app/api/auth/discord`
  (kad pređeš na domen, dodaj i `https://tvoj-domen/api/auth/discord` i promeni `SITE_URL`).
- Bot treba dozvolu **Manage Roles**, njegova uloga mora biti **iznad** uloga koje dodeljuje,
  i mora da vidi kanale za prijave, reportove i novosti.
- **Server Members Intent** mora biti uključen (za stranu Tim).

## Gde šta menjaš
| Šta | Fajl |
|---|---|
| Linkovi, IP servera, opis, meni | `src/config/site.ts` |
| Poslovi, organizacije, bande, eventi, kuće, tasteri, česta pitanja | `src/config/grad.ts` |
| Vrste prijava i reportova, pitanja, uslovi, otvoreno/zatvoreno | `src/config/prijave.ts` |
| Pravila, tabela kazni, istorija izmena | `src/config/pravila.ts` |
| Kategorije novosti i predloga | `src/config/zajednica.ts` |
| Slike | `public/img/` |
| Boje, fontovi, animacije | `src/app/globals.css` |

## Kako rade prijave i reportovi
1. Igrač se prijavi Discordom (sesija je potpisan kolačić, ne može da se lažira).
2. Popuni formular -> bot javi u kanal (prijave u `DISCORD_PRIJAVE_KANAL_ID`, reportovi u `DISCORD_REPORT_KANAL_ID`).
3. **Report na staff** ne ide u kanal: dobijaju ga vlasnici u DM, a u panelu ga vide samo vlasnici i uloge za odluku.
4. Staff u `/panel` preuzima ("Preuzmi ja"), glasa i piše interne komentare.
5. Uloga za odluku prihvata/odbija (kod reportova: rešava/odbacuje) -> igrač dobija DM,
   a kod prihvatanja i Discord ulogu (ako je podešena).
6. Igrač ishod vidi u `/moje-prijave` (pečat ODOBRENO, REŠENO, ODBIJENO...).

## Novosti
Staff sa ulogom za odluku piše novosti u `/panel/novosti`. Tekst podržava pasuse (prazan red),
liste (`- `), podnaslove (`## `), **podebljano** i linkove. Štiklirano "Objavi i na Discordu" šalje
novost u `DISCORD_NOVOSTI_KANAL_ID`.

## Lokalno (nije obavezno)
```
npm install
cp .env.example .env.local   # popuni
npm run dev
```
