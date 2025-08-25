export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const slackId = String(req.query.slackId || '').trim();
  const gameId = req.query.gameId ? String(req.query.gameId).trim() : null;
  const token = req.query.token ? String(req.query.token).trim() : null;
  if (!slackId) {
    return res.status(400).json({ message: 'Missing slackId' });
  }
  if (!token) {
    return res.status(400).json({ message: 'Missing token' });
  }
  if (!/^[A-Za-z0-9_-]{1,50}$/.test(slackId)) {
    return res.status(400).json({ message: 'That is a funny looking slack id' });
  }

  let assignedProjectsMap = {};
  let allowedForGame = [];
  try {
    const gamesRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/GetMyGames`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const games = await gamesRes.json();
    if (Array.isArray(games)) {
      for (const rec of games) {
        const val = rec.HackatimeProjects;
        if (typeof val === 'string') {
          val.split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
            assignedProjectsMap[name] = rec.id;
          });
        } else if (Array.isArray(val)) {
          val.map(s => String(s).trim()).filter(Boolean).forEach(name => {
            assignedProjectsMap[name] = rec.id;
          });
        }
        if (gameId && rec.id === gameId) {
          if (typeof val === 'string') {
            allowedForGame = val.split(',').map(s => s.trim()).filter(Boolean);
          } else if (Array.isArray(val)) {
            allowedForGame = val.map(s => String(s).trim()).filter(Boolean);
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to fetch assigned Hackatime projects from GetMyGames:', e);
    assignedProjectsMap = {};
    allowedForGame = [];
  }

  const startDate = '2025-08-18';
  const url = `https://hackatime.hackclub.com/api/v1/users/${encodeURIComponent(slackId)}/stats?features=projects&start_date=${startDate}`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json(json || { message: 'Upstream error' });
    }
    const projects = Array.isArray(json?.data?.projects) ? json.data.projects : [];
    const filtered = projects.filter((p) => {
      if (!p?.name) return false;
      if (!assignedProjectsMap[p.name]) return true;
      if (gameId && allowedForGame.includes(p.name)) return true;
      return false;
    });
    const names = filtered.map((p) => p?.name).filter(Boolean);
    const projectsWithTime = filtered.map((p) => ({
      name: p?.name,
      time: Math.round((p?.total_seconds || 0) / 60)
    })).filter((p) => p.name);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({ projects: names, projectsWithTime });
  } catch (e) {
    console.error('hackatimeProjects proxy error:', e);
    return res.status(500).json({ message: 'Failed to fetch projects' });
  }
}


