const { getActiveRide, saveActiveRide, clearActiveRide } = require('./_store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Fetch currently active ride request
  if (req.method === 'GET') {
    let active = getActiveRide();
    if (!active) {
      try {
        const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/rides?status=eq.active&vehicle_number=ilike.REQ-%25&order=created_at.desc&limit=1`, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        });
        if (resp.ok) {
          const rows = await resp.json();
          if (rows && rows.length > 0) {
            const row = rows[0];
            let meta = {};
            try { meta = JSON.parse(row.notes || '{}'); } catch (e) {}
            active = {
              id: row.vehicle_number,
              rider_id: meta.riderId || row.driver_id,
              rider_name: meta.riderName || (row.driver_name ? row.driver_name.replace(' (Rider Request)', '') : 'Passenger'),
              rider_phone: meta.riderPhone || '+91 98480 23145',
              rider_avatar: meta.riderAvatar || row.avatar,
              rider_role: meta.riderRole || row.driver_role || 'Daily Commuter',
              pickup: row.pickup,
              drop_location: row.drop_location,
              drop: row.drop_location,
              seats: row.seats_available || 1,
              fare: row.per_seat_price || 108,
              distance: meta.distance || 84,
              pin: meta.pin || '4821',
              vehicle_type: meta.vehicleType || row.vehicle_type || 'any',
              is_flexible_vehicle: Boolean(meta.isFlexible),
              payment_method: meta.paymentMethod || 'Direct UPI',
              status: 'searching',
              created_at: row.created_at
            };
            saveActiveRide(active);
          }
        }
      } catch (err) {}
    }
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
        vehicle: driver.vehicle || 'Verified Commuter Vehicle (TS 08 AB 1234)',
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
