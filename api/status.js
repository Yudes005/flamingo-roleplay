// Status FiveM servera za sajt (broj igrača online).
// FiveM server vraća javni /dynamic.json preko običnog HTTP-a, pa ga
// čitamo ovde na serveru — browser na HTTPS sajtu to ne bi smeo direktno.
const SERVER = "185.195.237.205:20025";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  try {
    const response = await fetch(`http://${SERVER}/dynamic.json`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      throw new Error(`FiveM server error: ${response.status}`);
    }

    const data = await response.json();

    return res.status(200).json({
      online: true,
      players: Number(data.clients) || 0,
      maxPlayers: Number(data.sv_maxclients) || null,
    });
  } catch (error) {
    return res.status(200).json({
      online: false,
      players: 0,
      maxPlayers: null,
    });
  }
}
