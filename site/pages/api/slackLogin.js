import Airtable from "airtable";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Code is required" });

  try {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_ID || "",
        client_secret: process.env.SLACK_SECRET || "",
        redirect_uri: "https://shiba.hackclub.dev",
      }),
    });

    if (!response.ok) throw new Error("Failed to exchange code for token");

    const json = await response.json();
    const token = json.authed_user.access_token;

    const userResponse = await fetch("https://slack.com/api/users.info", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${token}`,
      },
      body: new URLSearchParams({ user: json.authed_user.id }),
    });

    if (!userResponse.ok)
      return res
        .status(400)
        .json({ error: "Failed to fetch user information" });

    const userJson = await userResponse.json();
    const email = userJson.user?.profile?.email;
    if (!email) return res.status(400).json({ error: "Email not found" });

    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
      process.env.AIRTABLE_BASE_ID,
    );

    const records = await new Promise((resolve, reject) => {
      base("Users")
        .select({ maxRecords: 1, filterByFormula: `{email} = "${email}"` })
        .firstPage((err, records) => (err ? reject(err) : resolve(records)));
    });

    if (records.length === 0) {
      const nh_token = crypto.randomBytes(64).toString("hex");
      const createRecord = await new Promise((resolve, reject) => {
        base("Users").create(
          { Email: email, "slack id": json.authed_user.id, token: nh_token },
          (err, record) => (err ? reject(err) : resolve(record)),
        );
      });
      return res.status(200).json({ ok: true, token: nh_token });
    } else {
      const existingToken = records[0].get("token");
      if (!existingToken)
        return res.status(400).json({ error: "User exists but has no token" });
      return res.status(200).json({ ok: true, token: existingToken });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
