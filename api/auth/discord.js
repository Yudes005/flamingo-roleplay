export default async function handler(req, res) {
  const { code } = req.query;

  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

  const REDIRECT_URI =
    "https://flamingo-roleplay.vercel.app/api/auth/discord";

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
    const tokenResponse = await fetch(
      "https://discord.com/api/oauth2/token",
      {
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
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      return res.status(400).json({
        error: "Discord token error",
        details: tokenData,
      });
    }

    const userResponse = await fetch(
      "https://discord.com/api/users/@me",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const user = await userResponse.json();

    if (!userResponse.ok) {
      return res.status(400).json({
        error: "Discord user error",
        details: user,
      });
    }

    const displayName = user.global_name || user.username;

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/1.png";

    const forumUrl =
      "https://flamingo-roleplay.vercel.app/forum.html" +
      `?name=${encodeURIComponent(displayName)}` +
      `&avatar=${encodeURIComponent(avatarUrl)}` +
      `&id=${encodeURIComponent(user.id)}`;

    return res.redirect(302, forumUrl);

  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
}
