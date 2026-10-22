const { getActiveRide, saveActiveRide, clearActiveRide } = require('./_store');

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

  const { requestId } = data;
  let current = getActiveRide();

  if (!current || current.id !== requestId) {
    current = {
      id: requestId || ('REQ-' + Date.now().toString(36).toUpperCase()),
      rider_name: 'Verified Commuter',
      status: 'ride_started',
      fare: 110
    };
  }

  current.status = 'ride_completed';
  current.completedAt = new Date().toISOString();
  current.completed_at = current.completedAt;

  saveActiveRide(current);

  // Clear from active store after short delay
  setTimeout(() => {
    clearActiveRide();
  }, 3000);

  return res.status(200).json({ success: true, request: current });
};
