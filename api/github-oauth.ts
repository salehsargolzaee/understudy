/**
 * The only server-side code in this repository.
 *
 * Exchanges a GitHub OAuth `code` for a user access token. github.com's token
 * endpoint sends no CORS headers, so the browser cannot call it — this
 * function proxies that one request and nothing else. It holds the client
 * secret (env only, never bundled), stores nothing, and logs nothing.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST only." });
    return;
  }
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.status(503).json({ error: "GitHub sign-in is not configured on this deployment." });
    return;
  }
  const code = typeof req.body?.code === "string" ? req.body.code : "";
  if (!code) {
    res.status(400).json({ error: "Missing `code`." });
    return;
  }
  try {
    const gh = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const data: any = await gh.json();
    if (data.error || !data.access_token) {
      res.status(400).json({ error: data.error_description || data.error || "GitHub returned no token." });
      return;
    }
    res.status(200).json({ access_token: data.access_token, scope: data.scope ?? "" });
  } catch (err: any) {
    res.status(502).json({ error: `Could not reach GitHub: ${err?.message ?? err}` });
  }
}
