import { createHmac } from "crypto";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) return res.status(500).json({ error: 'ADMIN_PASSWORD not configured.' });
  if (!password || password !== expected) return res.status(401).json({ error: 'Nesprávné heslo.' });

  // Token = HMAC-SHA256(password + timestamp) — žádný server state
  const ts = Date.now().toString();
  const secret = process.env.ADMIN_PASSWORD + '_abbot';
  const token = ts + '.' + createHmac('sha256', secret).update(ts).digest('hex');

  return res.status(200).json({ success: true, token });
}
