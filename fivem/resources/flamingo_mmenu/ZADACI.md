# Zadaci (dnevni / nedeljni) - flamingo_mmenu

1. Pokreni `sql/flamingo_tasks.sql`.
2. Sve se podešava u `config_zadaci.lua` (lista zadataka, nagrade, koliko zadataka dnevno/nedeljno).
3. Nagrada je samo novac (`Config.Tasks.MoneyAccount`). Zadaci NE daju XP.

## Radi odmah (ugrađeno)
playtime, drive, walk, swim, cycle, daily_reward

## Hook za poslove (server strana, na mestu gde posao isplati/da item)
```lua
exports['flamingo_mmenu']:AddTaskProgress(source, 'TIP', 1)
```
| Tip          | Resurs               | Kada se poziva                     |
|--------------|----------------------|------------------------------------|
| mining       | flamingo_miner       | svaki iskopan komad rude (količina)|
| woodcutting  | flamingo_drvoseca    | svako posečeno stablo              |
| fishing      | flamingo_ribar       | svaka ulovljena riba               |
| electrician  | flamingo_elektricar  | svaki popravljen kvar              |
| garbage      | flamingo_smecar      | svaka pokupljena kesa              |
| farming      | flamingo_farmer      | ubrani plodovi (količina)          |
| bus          | flamingo_busvozac    | svaka završena stanica             |
| taxi         | flamingo_taxi        | svaka završena vožnja              |
| transport    | flamingo_transport   | svaka završena dostava             |
| market_sell  | *pijace (sve 4)      | prodati komadi                     |
| casino       | flamingo_kazino / flamingo_rulet | svaka odigrana partija |
| payday       | flamingo_payday      | svaka isplaćena plata              |

Kad dodaš liniju u posao -> u `Config.TaskTypes` stavi `enabled = true` za taj tip.

Test (konzola): `zadatakdodaj [id] [tip] [iznos]`  npr. `zadatakdodaj 1 drive 5000`
