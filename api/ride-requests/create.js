const { saveActiveRide } = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }
  data = data || {};

  const activeRideRequest = {
    ...data,
    id: data.id || ('REQ-' + Date.now().toString(36).toUpperCase()),
    status: 'searching',
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  saveActiveRide(activeRideRequest);

  return res.status(200).json({ success: true, request: activeRideRequest });
};
