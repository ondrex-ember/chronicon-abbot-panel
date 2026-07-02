import { createHmac } from "crypto";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Ověř admin token
  const adminToken = req.headers['x-admin-token'];
  const secret = process.env.ADMIN_PASSWORD + '_abbot';
  const SESSION_TTL = 8 * 60 * 60 * 1000;

  try {
    const [ts, sig] = (adminToken || '').split('.');
    if (!ts || !sig) return res.status(401).json({ error: 'Neautorizováno.' });
    const age = Date.now() - parseInt(ts, 10);
    if (isNaN(age) || age > SESSION_TTL || age < 0) return res.status(401).json({ error: 'Session vypršela.' });
    const expected = createHmac('sha256', secret).update(ts).digest('hex');
    if (sig !== expected) return res.status(401).json({ error: 'Neplatný token.' });
  } catch {
    return res.status(401).json({ error: 'Chyba ověření.' });
  }

  const { content, githubToken } = req.body || {};
  if (!content) return res.status(400).json({ error: 'Chybí obsah (content).' });
  if (!githubToken) return res.status(400).json({ error: 'Chybí GitHub token.' });

  const REPO   = 'ondrex-ember/chronicon';
  const PATH   = 'gm/gm_input.json';
  const BRANCH = 'main';
  const API    = `https://api.github.com/repos/${REPO}/contents/${PATH}`;

  try {
    // Načti aktuální SHA souboru (potřebné pro update)
    const getRes = await fetch(`${API}?ref=${BRANCH}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    });

    let sha = null;
    if (getRes.ok) {
      const getData = await getRes.json();
      sha = getData.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.json();
      return res.status(502).json({ error: `GitHub GET selhal: ${err.message}` });
    }

    // Commit
    const body = {
      message: `gm: update gm_input.json [abbot-panel]`,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    };

    const putRes = await fetch(API, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return res.status(502).json({ error: `GitHub commit selhal: ${err.message}` });
    }

    const putData = await putRes.json();
    return res.status(200).json({
      success: true,
      commit_url: putData.commit?.html_url || null,
      sha: putData.content?.sha || null,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Interní chyba.' });
  }
}
