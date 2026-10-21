const { getActiveRide, saveActiveRide, clearActiveRide } = require('./ride-requests/store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Fetch currently active ride request
  if (req.method === 'GET') {
    const active = getActiveRide();
    return res.status(200).json({ success: true, activeRequest: active });
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    const action = data.action || (req.query && req.query.action) || 'create';

    // 1. Create Ride Request
    if (action === 'create' || (!action && data.fromText)) {
      const activeRideRequest = {
        ...data,
        id: data.id || ('REQ-' + Date.now().toString(36).toUpperCase()),
        status: 'searching',
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      saveActiveRide(activeRideRequest);
      return res.status(200).json({ success: true, request: activeRideRequest });
    }

    // 2. Accept Ride Request (Atomic lock for first responding driver)
    if (action === 'accept') {
      const active = getActiveRide();
      const requestId = data.requestId || (active ? active.id : null);
      const driver = data.driver || {};

      if (!active) {
        return res.status(404).json({ success: false, error: 'No active ride request found or already accepted.' });
      }

      if (active.id !== requestId && requestId !== active.id) {
        return res.status(409).json({ success: false, error: 'Request ID mismatch or ride expired.' });
      }

      if (active.status !== 'searching') {
        return res.status(409).json({ success: false, error: 'Ride request was already accepted by another driver.' });
      }

      active.status = 'driver_accepted';
      active.driverAssigned = {
        id: driver.id || 'DRV-' + Date.now().toString(36),
        name: driver.name || 'Verified Highway Driver',
        phone: driver.phone || '+91 94942 85249',
        avatar: driver.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        vehicle: driver.vehicle || 'Hero Splendor Plus (TS 08 EK 4321)',
        vehicleType: driver.vehicleType || 'bike',
        rating: driver.rating || 4.9,
        totalRides: driver.totalRides || 86,
        isVerified: true
      };
      active.acceptedAt = new Date().toISOString();

      saveActiveRide(active);
      return res.status(200).json({ success: true, request: active });
    }

    // 3. Start Ride
    if (action === 'start') {
      const active = getActiveRide();
      const pin = data.pin;

      if (!active) {
        return res.status(404).json({ success: false, error: 'No active ride found to start.' });
      }

      if (active.pin && pin && String(active.pin).trim() !== String(pin).trim()) {
        return res.status(400).json({ success: false, error: 'Invalid 4-digit Boarding PIN.' });
      }

      active.status = 'in_transit';
      active.startedAt = new Date().toISOString();
      saveActiveRide(active);
      return res.status(200).json({ success: true, request: active });
    }

    // 4. Complete Ride
    if (action === 'complete') {
      const active = getActiveRide();
      if (!active) {
        return res.status(404).json({ success: false, error: 'No active ride found to complete.' });
      }

      active.status = 'completed';
      active.completedAt = new Date().toISOString();
      clearActiveRide();
      return res.status(200).json({ success: true, request: active });
    }

    // 5. Cancel Ride
    if (action === 'cancel') {
      const active = getActiveRide();
      if (active) {
        active.status = 'cancelled';
      }
      clearActiveRide();
      return res.status(200).json({ success: true, cancelled: true });
    }

    return res.status(400).json({ success: false, error: 'Unknown action specified' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
