export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // HMAC token nepotřebuje server-side invalidaci
  // Klient odstraní token ze sessionStorage
  return res.status(200).json({ success: true });
}
