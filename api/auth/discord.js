export default async function handler(req, res) {
  const { code } = req.query;

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

  const REDIRECT_URI = "https://flamingo-roleplay.vercel.app/api/auth/discord";

  // Ako nema code-a, šaljemo korisnika na Discord login
  if (!code) {
    const discordUrl =
      "https://discord.com/oauth2/authorize" +
      `?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      "&response_type=code" +
      "&scope=identify%20email";

    return res.redirect(302, discordUrl);
  }

  try {
    // Menjamo Discord code za access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code: code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(400).json({
        error: "Discord token error",
        details: tokenData,
      });
    }

    // Uzimamo podatke o Discord korisniku
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const user = await userResponse.json();

    if (!userResponse.ok) {
      return res.status(400).json({
        error: "Discord user error",
        details: user,
      });
    }

    // Za sada samo testiramo da Discord login radi
    return res.send(`
      <!DOCTYPE html>
      <html lang="sr">
      <head>
        <meta charset="UTF-8">
        <title>Flamingo Roleplay</title>
        <style>
          body {
            background:#070707;
            color:white;
            font-family:Arial,sans-serif;
            display:flex;
            align-items:center;
            justify-content:center;
            min-height:100vh;
            text-align:center;
          }
          .box {
            padding:40px;
            border:1px solid #333;
            border-radius:20px;
          }
          h1 { color:#FF4FA3; }
        </style>
      </head>
      <body>
        <div class="box">
          <h1>Uspešno povezan Discord!</h1>
          <p>Dobrodošao, <strong>${user.global_name || user.username}</strong>!</p>
          <p>Discord ID: ${user.id}</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
}
