const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join('/tmp', 'routemate_safety_alerts_store.json');

function getStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function saveStore(list) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const alerts = getStore();
    return res.status(200).json({ success: true, alerts });
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    const alert = {
      id: 'SOS-' + Date.now().toString(36).toUpperCase(),
      userId: data.userId || data.user_id || 'USR-ANON',
      userName: data.userName || data.user_name || 'Commuter',
      userPhone: data.userPhone || data.user_phone || null,
      emergencyContactPhone: data.emergencyContactPhone || data.emergency_contact_phone || null,
      emergencyContactName: data.emergencyContactName || data.emergency_contact_name || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      googleMapsUrl: data.googleMapsUrl || data.google_maps_url || null,
      route: data.route || 'Uppal ➔ Jangaon',
      driverInfo: data.driverInfo || data.driver_info || null,
      status: 'ACTIVE_EMERGENCY',
      timestamp: new Date().toISOString()
    };

    const list = getStore();
    list.unshift(alert);
    saveStore(list);

    return res.status(200).json({ success: true, alert });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
