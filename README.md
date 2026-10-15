# Flamingo Roleplay - sajt (v2)

Next.js sajt za Vercel: naslovna sa brojem igrača uživo, pravila, tim sa Discorda,
prijave (admin, supporter, lider, žalba) sa pravim Discord loginom i staff panel.

## Postavljanje (jednom)

### 1. Kod na GitHub
Obriši sve stare fajlove iz repozitorijuma (`index.html`, `forum.html`, `hero.jpg`, `api/`)
i ubaci sadržaj ovog foldera. Commit + push.

### 2. Vercel podešavanja
- **Settings -> Build and Deployment -> Framework Preset: Next.js**
  (stari sajt je bio običan HTML, pa je možda stajalo "Other").
- **Storage -> Create Database -> Neon (Postgres)** -> poveži sa projektom.
  Vercel sam doda `DATABASE_URL`. Tabele se prave same.
- **Settings -> Environment Variables**: popuni sve iz `.env.example`.
  `DISCORD_CLIENT_ID` i `DISCORD_CLIENT_SECRET` već postoje od starog sajta.
- Posle izmene promenljivih: **Deployments -> ... -> Redeploy**.

### 3. Discord
- **Developer Portal -> OAuth2 -> Redirects**: mora da postoji
  `https://flamingo-roleplay.vercel.app/api/auth/discord` (isti kao na starom sajtu).
  Ako kupiš domen, dodaj i `https://tvoj-domen/api/auth/discord` i promeni `SITE_URL`.
- Bot (isti kao flamingo_invitebot) treba dozvolu **Manage Roles**, a njegova uloga mora
  biti **iznad** uloga koje dodeljuje (Server Settings -> Roles, prevuci je gore).
- **Server Members Intent** mora biti uključen (već je, zbog invite bota).

## Gde šta menjaš
| Šta | Fajl |
|---|---|
| Linkovi (Discord, TikTok), IP servera, opis | `src/config/site.ts` |
| Vrste prijava, pitanja, uslovi, otvoreno/zatvoreno | `src/config/prijave.ts` |
| Pravila | `src/config/pravila.ts` |
| Poslovi i "Grad posle posla" na naslovnoj | `src/app/page.tsx` (vrh fajla) |
| Slike | `public/img/` |
| Boje i fontovi | `src/app/globals.css` |

## Kako rade prijave
1. Igrač se prijavi Discordom (sesija je potpisan kolačić, ne može da se lažira).
2. Popuni formular -> bot javi u `DISCORD_PRIJAVE_KANAL_ID`.
3. Staff u `/panel` čita, glasa (za/protiv), piše interne komentare.
4. Uloga iz `PANEL_ODLUKA_ROLE_IDS` prihvata/odbija sa razlogom -> igrač dobija DM,
   a kod prihvatanja bot mu da Discord ulogu (ako je podešena).
5. Igrač status vidi u `/moje-prijave` (pečat ODOBRENO / ODBIJENO).

Jedna prijava po poziciji dok čeka odluku; posle odbijanja pauza (`ponovoPosleDana`).

## Lokalno (nije obavezno)
```
npm install
cp .env.example .env.local   # popuni
npm run dev
```
