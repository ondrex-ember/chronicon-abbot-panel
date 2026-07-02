import { createHmac } from "crypto";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['x-admin-token'];
  if (!token) return res.status(200).json({ valid: false });

  const secret = process.env.ADMIN_PASSWORD + '_abbot';
  const SESSION_TTL = 8 * 60 * 60 * 1000; // 8h

  try {
    const [ts, sig] = token.split('.');
    if (!ts || !sig) return res.status(200).json({ valid: false });

    // Ověř timestamp — max 8h staré
    const age = Date.now() - parseInt(ts, 10);
    if (isNaN(age) || age > SESSION_TTL || age < 0) return res.status(200).json({ valid: false });

    // Ověř HMAC podpis
    const expected = createHmac('sha256', secret).update(ts).digest('hex');
    const valid = sig === expected;

    return res.status(200).json({ valid });
  } catch {
    return res.status(200).json({ valid: false });
  }
}
