/**
 * Client-side utility to upload a game zip to the Shiba API.
 * - file: File (required)
 * - name: string (required) used to construct gameId as `${slugified-name}-${YYYYMMDD-HHMMSS}`
 * - token: string (required) UPLOAD_AUTH_TOKEN
 * - apiBase: string (optional) defaults to NEXT_PUBLIC_API_BASE or same-origin
 * Returns: { ok: boolean, gameId?: string, playUrl?: string, error?: string }
 */

//it's ok that this is public, it's for game upload client-side.  (From Thomas)

export async function uploadGame({ file, name, token, apiBase }) {
  if (!file) return { ok: false, error: "Missing file" };
  if (!name) return { ok: false, error: "Missing name" };
  const effectiveToken = token || HARDCODED_UPLOAD_TOKEN;
  if (!effectiveToken) return { ok: false, error: "Missing token" };

  const base = apiBase || process.env.NEXT_PUBLIC_API_BASE || "";
  const slug = slugify(name);
  const dt = new Date();
  const y = String(dt.getFullYear());
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const ss = String(dt.getSeconds()).padStart(2, "0");
  const gameId = `${slug}-${y}${m}${d}-${hh}${mm}${ss}`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("gameId", gameId);
  // Also include token as body param for convenience
  fd.append("token", effectiveToken);

  try {
    const res = await fetch(`${base}/api/uploadGame`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${effectiveToken}`,
      },
      body: fd,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {}
    if (!res.ok) {
      return { ok: false, error: (data && data.error) || text };
    }
    const out = data || {};
    if (!out.playUrl && out.gameId) {
      out.playUrl = `/play/${encodeURIComponent(out.gameId)}/`;
    }
    return { ok: true, gameId: out.gameId, playUrl: out.playUrl };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
