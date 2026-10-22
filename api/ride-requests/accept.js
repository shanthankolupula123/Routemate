const { getActiveRide, saveActiveRide } = require('./_store');

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

  const { requestId, driver } = data;
  let current = getActiveRide();

  if (!current || current.id !== requestId) {
    current = {
      id: requestId || ('REQ-' + Date.now().toString(36).toUpperCase()),
      rider_name: 'Verified Commuter',
      pickup: 'Uppal Ring Road Metro',
      drop_location: 'Jangaon Bus Depot',
      fare: 110,
      seats: 1,
      pin: '4821',
      status: 'searching',
      createdAt: new Date().toISOString()
    };
  }

  if (current.status !== 'searching' && current.status !== 'driver_accepted') {
    return res.status(409).json({
      success: false,
      alreadyAccepted: true,
      error: 'Ride was already accepted by another driver.',
      assignedDriver: current.driver
    });
  }

  current.status = 'driver_accepted';
  current.driver = driver;
  current.driver_id = driver?.id;
  current.driver_name = driver?.name;
  current.driver_phone = driver?.phone;
  current.driver_avatar = driver?.avatar;
  current.driver_vehicle_name = driver?.vehicleName;
  current.driver_vehicle_number = driver?.vehicleNumber;
  current.driver_vehicle_type = driver?.vehicleType;
  current.acceptedAt = new Date().toISOString();
  current.accepted_at = current.acceptedAt;

  saveActiveRide(current);

  return res.status(200).json({ success: true, request: current });
};
