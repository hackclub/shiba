export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const slackId = String(req.query.slackId || '').trim();
  if (!slackId) {
    return res.status(400).json({ message: 'Missing slackId' });
  }

  if (!/^[A-Za-z0-9_-]{1,50}$/.test(slackId)) {
    return res.status(400).json({ message: 'That is a funny looking slack id' });
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
    const names = projects.map((p) => p?.name).filter(Boolean);
    const projectsWithTime = projects.map((p) => ({
      name: p?.name,
      time: Math.round((p?.total_seconds || 0) / 60) // Convert seconds to minutes
    })).filter((p) => p.name);
    // Return minimal payload for client
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
    return res.status(200).json({ projects: names, projectsWithTime });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('hackatimeProjects proxy error:', e);
    return res.status(500).json({ message: 'Failed to fetch projects' });
  }
}


