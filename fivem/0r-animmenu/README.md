# 0r-animmenu – Flamingo redizajn (NUI)

Ovde je samo novi `html/` folder. Lua (`client/`, `shared/`, `fxmanifest.lua`) ostaje ista.

## Instalacija
1. U resursu `0r-animmenu` obriši stari `html/` folder.
2. Ubaci ovaj `html/` folder na njegovo mesto.
3. `refresh` + `ensure 0r-animmenu` (ili restart servera).

## Šta je novo
- Panel na sredini ekrana, ravan tamni izgled bez sjaja i gradijenata
- Kategorije kao tabovi gore, sa brojem animacija
- Mreža / lista (izbor se pamti)
- Pretraga bez obzira na kvačice (č, ć, š...), **Enter** pokreće prvi rezultat, **Ctrl+F** ili **/** fokusira pretragu
- Zvezdica = omiljeni
- **Desni klik** na animaciju: pokreni, omiljeni, kopiraj komandu, dodeli brzom slotu
- **Brzi slotovi 1–7** (`LSHIFT` + broj): prevuci karticu na slot ili koristi desni klik; desni klik na slot ga prazni
- Bez Tailwind CDN-a i jQuery-ja; kartice se učitavaju postepeno dok skroluješ
