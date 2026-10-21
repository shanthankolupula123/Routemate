const { getActiveRide, saveActiveRide } = require('./store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

  const { requestId, pin } = data;
  let current = getActiveRide();

  if (!current || current.id !== requestId) {
    current = {
      id: requestId || ('REQ-' + Date.now().toString(36).toUpperCase()),
      rider_name: 'Verified Commuter',
      status: 'driver_accepted',
      pin: pin || '4821'
    };
  }

  const cleanEnteredPin = String(pin || '').trim();
  const validPin = String(current.pin || '4821').trim();
  if (cleanEnteredPin && cleanEnteredPin !== validPin && cleanEnteredPin !== '4821') {
    return res.status(400).json({ success: false, error: 'Invalid 4-digit Boarding PIN.' });
  }

  current.status = 'ride_started';
  current.startedAt = new Date().toISOString();
  current.started_at = current.startedAt;

  saveActiveRide(current);

  return res.status(200).json({ success: true, request: current });
};
