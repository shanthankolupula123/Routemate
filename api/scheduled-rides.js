const fs = require('fs');
const path = require('path');
const os = require('os');

// Load environment variables locally if present
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  } catch (e) {}
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';

const RIDES_STORE_PATH = path.join(os.tmpdir(), 'routemate_scheduled_rides_store.json');
const BOOKINGS_STORE_PATH = path.join(os.tmpdir(), 'routemate_scheduled_bookings_store.json');

let inMemoryRides = null;
let inMemoryBookings = null;

function getLocalRides() {
  if (inMemoryRides) return inMemoryRides;
  try {
    if (fs.existsSync(RIDES_STORE_PATH)) {
      const content = fs.readFileSync(RIDES_STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data)) {
        inMemoryRides = data;
        return data;
      }
    }
  } catch (e) {}
  inMemoryRides = [];
  return inMemoryRides;
}

function saveLocalRides(list) {
  inMemoryRides = list || [];
  try {
    fs.writeFileSync(RIDES_STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

function getLocalBookings() {
  if (inMemoryBookings) return inMemoryBookings;
  try {
    if (fs.existsSync(BOOKINGS_STORE_PATH)) {
      const content = fs.readFileSync(BOOKINGS_STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data)) {
        inMemoryBookings = data;
        return data;
      }
    }
  } catch (e) {}
  inMemoryBookings = [];
  return inMemoryBookings;
}

function saveLocalBookings(list) {
  inMemoryBookings = list || [];
  try {
    fs.writeFileSync(BOOKINGS_STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const driverId = url.searchParams.get('driver_id');
  const commuterId = url.searchParams.get('commuter_id');
  const all = url.searchParams.get('all') === 'true';

  // -------------------------------------------------------------------------
  // GET: Fetch Scheduled Rides & Bookings
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    let rides = [];
    let bookings = [];

    // Attempt to query Supabase REST
    try {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_rides?select=*&order=scheduled_datetime.asc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        signal: AbortSignal.timeout(1500)
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) rides = data;
      }
    } catch (e) {}

    // Merge or fallback to local file store
    const localRides = getLocalRides();
    if (rides.length === 0) {
      rides = localRides;
    } else {
      // Merge unique by ID
      const seen = new Set(rides.map(r => String(r.id)));
      localRides.forEach(lr => {
        if (!seen.has(String(lr.id))) {
          rides.push(lr);
        }
      });
    }

    // Try fetching bookings
    try {
      const respB = await fetch(`${SUPABASE_URL}/rest/v1/scheduled_ride_bookings?select=*&order=created_at.desc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        },
        signal: AbortSignal.timeout(1500)
      });
      if (respB.ok) {
        const dataB = await respB.json();
        if (Array.isArray(dataB)) bookings = dataB;
      }
    } catch (e) {}

    const localBookings = getLocalBookings();
    if (bookings.length === 0) {
      bookings = localBookings;
    } else {
      const seenB = new Set(bookings.map(b => String(b.id)));
      localBookings.forEach(lb => {
        if (!seenB.has(String(lb.id))) {
          bookings.push(lb);
        }
      });
    }

    // Attach bookings to corresponding rides
    rides.forEach(ride => {
      ride.bookings = bookings.filter(b => String(b.scheduled_ride_id) === String(ride.id) && b.status !== 'cancelled');
    });

    // Filter by query parameters
    let filteredRides = rides;
    if (driverId) {
      filteredRides = rides.filter(r => String(r.driver_id) === String(driverId));
    } else if (commuterId) {
      const userBookings = bookings.filter(b => String(b.commuter_id) === String(commuterId));
      const bookedRideIds = new Set(userBookings.map(b => String(b.scheduled_ride_id)));
      filteredRides = rides.filter(r => bookedRideIds.has(String(r.id)));
    } else if (!all) {
      // Default: only published upcoming rides with available seats or published status
      const nowIso = new Date().toISOString();
      filteredRides = rides.filter(r => {
        if (r.status !== 'published') return false;
        if (r.available_seats <= 0) return false;
        return true;
      });
    }

    return res.status(200).json({
      success: true,
      rides: filteredRides,
      bookings: commuterId ? bookings.filter(b => String(b.commuter_id) === String(commuterId)) : bookings
    });
  }

  // -------------------------------------------------------------------------
  // POST: Publish, Book, Start, or Cancel Scheduled Ride
  // -------------------------------------------------------------------------
  if (req.method === 'POST') {
    let body = {};
    try {
      body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
    } catch (e) {
      body = {};
    }

    const action = body.action || 'publish';

    // 1. ACTION: PUBLISH SCHEDULED RIDE
    if (action === 'publish') {
      const {
        driverId,
        driverName,
        driverPhone,
        driverAvatar,
        driverRating,
        driverUpi,
        vehicleType,
        vehicleName,
        vehicleNumber,
        pickup,
        drop,
        pickupLat,
        pickupLng,
        dropLat,
        dropLng,
        distanceKm,
        departureDate,
        departureTime,
        scheduledDatetime,
        totalSeats,
        perSeatFare,
        notes
      } = body;

      if (!driverId || !pickup || !drop || !departureDate || !departureTime) {
        return res.status(400).json({ success: false, error: 'Missing required trip scheduling parameters.' });
      }

      const seats = Math.max(1, parseInt(totalSeats || 1, 10));
      const newRideId = 'sched_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

      const rideRecord = {
        id: newRideId,
        driver_id: String(driverId),
        driver_name: String(driverName || 'Verified Driver'),
        driver_phone: String(driverPhone || ''),
        driver_avatar: String(driverAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'),
        driver_rating: parseFloat(driverRating || 5.0),
        driver_upi: String(driverUpi || ''),
        vehicle_type: String(vehicleType || 'bike').toLowerCase(),
        vehicle_name: String(vehicleName || 'Verified Vehicle'),
        vehicle_number: String(vehicleNumber || ''),
        pickup: String(pickup),
        drop_location: String(drop),
        pickup_lat: pickupLat || 17.4018,
        pickup_lng: pickupLng || 78.5602,
        drop_lat: dropLat || 17.7265,
        drop_lng: dropLng || 79.1554,
        distance_km: distanceKm || 84,
        scheduled_datetime: scheduledDatetime || new Date(`${departureDate}T${departureTime}:00`).toISOString(),
        departure_date: String(departureDate),
        departure_time: String(departureTime),
        total_seats: seats,
        available_seats: seats,
        per_seat_fare: Number(perSeatFare || 0),
        status: 'published',
        notes: String(notes || ''),
        created_at: new Date().toISOString(),
        bookings: []
      };

      // Try inserting into Supabase
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/scheduled_rides`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(rideRecord),
          signal: AbortSignal.timeout(1500)
        });
      } catch (e) {}

      // Save to local file store
      const localRides = getLocalRides();
      localRides.unshift(rideRecord);
      saveLocalRides(localRides);

      return res.status(200).json({
        success: true,
        message: 'Trip scheduled successfully!',
        ride: rideRecord
      });
    }

    // 2. ACTION: BOOK SEATS ON SCHEDULED RIDE
    if (action === 'book') {
      const {
        rideId,
        commuterId,
        commuterName,
        commuterPhone,
        commuterAvatar,
        seatsBooked,
        totalFare
      } = body;

      if (!rideId || !commuterId) {
        return res.status(400).json({ success: false, error: 'Missing rideId or commuterId.' });
      }

      const seatsToBook = Math.max(1, parseInt(seatsBooked || 1, 10));
      const localRides = getLocalRides();
      const targetRide = localRides.find(r => String(r.id) === String(rideId));

      if (targetRide) {
        if (targetRide.status !== 'published') {
          return res.status(400).json({ success: false, error: 'This scheduled trip is no longer open for booking.' });
        }
        if (targetRide.available_seats < seatsToBook) {
          return res.status(400).json({ success: false, error: `Only ${targetRide.available_seats} seats remain available.` });
        }
        targetRide.available_seats = Math.max(0, targetRide.available_seats - seatsToBook);
        saveLocalRides(localRides);
      }

      const bookingRecord = {
        id: 'book_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        scheduled_ride_id: String(rideId),
        commuter_id: String(commuterId),
        commuter_name: String(commuterName || 'Commuter Passenger'),
        commuter_phone: String(commuterPhone || ''),
        commuter_avatar: String(commuterAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80'),
        seats_booked: seatsToBook,
        total_fare: Number(totalFare || 0),
        pickup: targetRide?.pickup || '',
        drop_location: targetRide?.drop_location || '',
        status: 'confirmed',
        created_at: new Date().toISOString()
      };

      // Try inserting into Supabase
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/scheduled_ride_bookings`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingRecord),
          signal: AbortSignal.timeout(1500)
        });
      } catch (e) {}

      const localBookings = getLocalBookings();
      localBookings.unshift(bookingRecord);
      saveLocalBookings(localBookings);

      return res.status(200).json({
        success: true,
        message: 'Seats booked successfully!',
        booking: bookingRecord,
        ride: targetRide
      });
    }

    // 3. ACTION: START SCHEDULED RIDE (TRANSITION TO LIVE DUTY)
    if (action === 'start') {
      const { rideId } = body;
      const localRides = getLocalRides();
      const targetRide = localRides.find(r => String(r.id) === String(rideId));
      if (targetRide) {
        targetRide.status = 'active';
        saveLocalRides(localRides);
      }

      try {
        await fetch(`${SUPABASE_URL}/rest/v1/scheduled_rides?id=eq.${encodeURIComponent(rideId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: 'active' }),
          signal: AbortSignal.timeout(1500)
        });
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: 'Scheduled ride is now active!',
        ride: targetRide
      });
    }

    // 4. ACTION: CANCEL TRIP OR BOOKING
    if (action === 'cancel') {
      const { rideId, bookingId, reason } = body;
      const cancellationReason = String(reason || '').trim();

      if (bookingId) {
        // Commuter cancelling their seat booking
        const localBookings = getLocalBookings();
        const b = localBookings.find(x => String(x.id) === String(bookingId));
        if (b) {
          b.status = 'cancelled';
          b.cancelled_at = new Date().toISOString();
          if (cancellationReason) b.cancellation_reason = cancellationReason;
          saveLocalBookings(localBookings);

          // Return seats to ride
          const localRides = getLocalRides();
          const r = localRides.find(x => String(x.id) === String(b.scheduled_ride_id));
          if (r) {
            r.available_seats = Math.min(r.total_seats, r.available_seats + (b.seats_booked || 1));
            saveLocalRides(localRides);
          }
        }

        // Update in Supabase
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/scheduled_ride_bookings?id=eq.${encodeURIComponent(bookingId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'cancelled',
              notes: cancellationReason ? `Cancelled: ${cancellationReason}` : 'Cancelled by commuter'
            }),
            signal: AbortSignal.timeout(1500)
          });
        } catch (e) {}

        return res.status(200).json({ success: true, message: 'Booking cancelled successfully.' });
      } else if (rideId) {
        // Driver cancelling the entire scheduled trip
        const localRides = getLocalRides();
        const r = localRides.find(x => String(x.id) === String(rideId));
        if (r) {
          r.status = 'cancelled';
          r.cancelled_at = new Date().toISOString();
          if (cancellationReason) r.cancellation_reason = cancellationReason;
          saveLocalRides(localRides);
        }

        // Cancel all bookings on this trip in local store
        const localBookings = getLocalBookings();
        const affectedBookings = [];
        localBookings.forEach(b => {
          if (String(b.scheduled_ride_id) === String(rideId)) {
            b.status = 'cancelled';
            b.cancelled_at = new Date().toISOString();
            if (cancellationReason) b.cancellation_reason = cancellationReason;
            affectedBookings.push(b);
          }
        });
        if (affectedBookings.length > 0) {
          saveLocalBookings(localBookings);
        }

        // Update in Supabase REST: scheduled_rides
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/scheduled_rides?id=eq.${encodeURIComponent(rideId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'cancelled',
              notes: cancellationReason ? `Cancelled by driver: ${cancellationReason}` : 'Cancelled by driver'
            }),
            signal: AbortSignal.timeout(1500)
          });
        } catch (e) {}

        // Update in Supabase REST: scheduled_ride_bookings
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/scheduled_ride_bookings?scheduled_ride_id=eq.${encodeURIComponent(rideId)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              status: 'cancelled',
              notes: cancellationReason ? `Trip cancelled by driver: ${cancellationReason}` : 'Trip cancelled by driver'
            }),
            signal: AbortSignal.timeout(1500)
          });
        } catch (e) {}

        // Send cancellation notifications to booked commuters
        for (const booking of affectedBookings) {
          if (booking.commuter_id) {
            try {
              const notifPayload = {
                user_id: String(booking.commuter_id),
                title: 'Scheduled Ride Cancelled',
                message: `Driver cancelled the scheduled ride on ${r?.departure_date || 'scheduled date'} at ${r?.departure_time || 'time'}.${cancellationReason ? ` Reason: ${cancellationReason}` : ''}`,
                type: 'ride_cancelled',
                read: false,
                created_at: new Date().toISOString()
              };
              await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify(notifPayload),
                signal: AbortSignal.timeout(1500)
              });
            } catch (ne) {}
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Scheduled trip and associated bookings cancelled successfully.',
          cancelledRideId: rideId,
          affectedCommutersCount: affectedBookings.length
        });
      }

      return res.status(400).json({ success: false, error: 'Missing rideId or bookingId to cancel.' });
    }

    return res.status(400).json({ success: false, error: 'Unknown action.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
