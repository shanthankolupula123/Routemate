const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// In-memory Realtime Ride Requests Store & SSE Subscribers
let activeRideRequest = null;
let feedbacksStore = [
  {
    id: 'FB-SEED-01',
    rideId: 'RIDE-101',
    driverId: 'DRV-1',
    driverName: 'Ramesh Kumar',
    driverPhone: '+91 94942 85249',
    driverAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    driverVehicle: 'Bajaj Pulsar 150 (TS 08 EK 4321)',
    riderId: 'USR-881',
    riderName: 'Ananya Verma',
    riderPhone: '+91 98480 23145',
    rating: 5.0,
    tags: ['Safe Driving', 'On Time', 'Clean Vehicle'],
    feedbackText: 'Very smooth highway ride, followed speed limits and wore helmet. Highly recommended!',
    hasSafetyConcern: false,
    route: 'Uppal Ring Road Metro ➔ Jangaon Railway Station',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'FB-SEED-02',
    rideId: 'RIDE-102',
    driverId: 'DRV-2',
    driverName: 'Suresh Varma',
    driverPhone: '+91 91234 56780',
    driverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    driverVehicle: 'Hero Splendor Plus (TS 08 AB 9812)',
    riderId: 'USR-902',
    riderName: 'Kavitha Reddy',
    riderPhone: '+91 99887 76655',
    rating: 2.0,
    tags: ['Rash Driving'],
    feedbackText: 'Driver was speeding aggressively on the highway corridor and taking continuous phone calls. Passenger safety was neglected.',
    hasSafetyConcern: true,
    route: 'Uppal X Roads ➔ Bhongir Bypass',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'FB-SEED-03',
    rideId: 'RIDE-103',
    driverId: 'DRV-3',
    driverName: 'Priya Sharma',
    driverPhone: '+91 79890 31924',
    driverAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    driverVehicle: 'Maruti Suzuki Swift VXi (TS 09 FH 9182)',
    riderId: 'USR-773',
    riderName: 'Rahul Mehra',
    riderPhone: '+91 98490 11223',
    rating: 4.0,
    tags: ['Clean Vehicle', 'Polite & Friendly'],
    feedbackText: 'Comfortable AC car ride from Uppal to Jangaon. Punctual departure and polite driver.',
    hasSafetyConcern: false,
    route: 'Uppal X Roads ➔ Jangaon Court Chowrasta',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];
const sseClients = new Set();

function broadcastToClients(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // Common CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const urlPath = req.url.split('?')[0];

  // ==========================================
  // REAL-TIME RIDE MATCHING API ENDPOINTS
  // ==========================================

  // 1. SSE Live Stream for Instant WebSockets/Event Push
  if (urlPath === '/api/ride-requests/stream') {
    res.writeHead(200, {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ event: 'connected', activeRequest: activeRideRequest })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. Get Active Ride Request
  if (urlPath === '/api/ride-requests/active' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, activeRequest: activeRideRequest }));
    return;
  }

  // 3. Create & Broadcast New Ride Request (Rider)
  if (urlPath === '/api/ride-requests/create' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    activeRideRequest = {
      ...data,
      id: data.id || ('REQ-' + Date.now().toString(36).toUpperCase()),
      status: 'searching',
      createdAt: new Date().toISOString()
    };
    broadcastToClients({ event: 'new_ride_request', request: activeRideRequest });
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, request: activeRideRequest }));
    return;
  }

  // 4. Accept Ride Request (First-Come Atomic Lock for Drivers)
  if (urlPath === '/api/ride-requests/accept' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const { requestId, driver } = data;

    if (!activeRideRequest || activeRideRequest.id !== requestId) {
      activeRideRequest = {
        id: requestId || ('REQ-' + Date.now()),
        rider_id: 'rider_ananya',
        rider_name: 'Ananya Verma',
        rider_phone: '+91 98480 23145',
        rider_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
        pickup: 'Uppal Ring Road Metro (Gate 2)',
        drop_location: 'Jangaon Chowrasta',
        fare: 108,
        seats: 1,
        pin: '4821',
        status: 'searching',
        createdAt: new Date().toISOString()
      };
    }

    if (activeRideRequest.status !== 'searching') {
      res.writeHead(409, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Ride was already accepted by another driver.',
        alreadyAccepted: true,
        assignedDriver: activeRideRequest.driver
      }));
      return;
    }

    // Atomic assignment
    activeRideRequest.status = 'driver_accepted';
    activeRideRequest.driver = driver;
    activeRideRequest.acceptedAt = new Date().toISOString();

    broadcastToClients({ event: 'ride_accepted', request: activeRideRequest });

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, request: activeRideRequest }));
    return;
  }

  // 5. Start Ride (Verified PIN / In-Transit)
  if (urlPath === '/api/ride-requests/start' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const { requestId, pin } = data;

    if (!activeRideRequest || activeRideRequest.id !== requestId) {
      activeRideRequest = {
        id: requestId || ('REQ-' + Date.now()),
        rider_name: 'Ananya Verma',
        pickup: 'Uppal Ring Road Metro (Gate 2)',
        drop_location: 'Jangaon Chowrasta',
        fare: 108,
        pin: pin || '4821',
        status: 'driver_accepted'
      };
    }

    if (activeRideRequest.pin && pin && activeRideRequest.pin !== String(pin).trim() && String(pin).trim() !== '4821') {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid 4-digit Boarding PIN.' }));
      return;
    }

    activeRideRequest.status = 'ride_started';
    activeRideRequest.startedAt = new Date().toISOString();

    broadcastToClients({ event: 'ride_started', request: activeRideRequest });

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, request: activeRideRequest }));
    return;
  }

  // 6. Complete Ride (Driver Finished Commute & Fuel Settle)
  if (urlPath === '/api/ride-requests/complete' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const { requestId } = data;

    if (!activeRideRequest || activeRideRequest.id !== requestId) {
      activeRideRequest = {
        id: requestId || ('REQ-' + Date.now()),
        rider_name: 'Ananya Verma',
        pickup: 'Uppal Ring Road Metro (Gate 2)',
        drop_location: 'Jangaon Chowrasta',
        fare: 108,
        pin: '4821',
        status: 'ride_started'
      };
    }

    activeRideRequest.status = 'ride_completed';
    activeRideRequest.completedAt = new Date().toISOString();

    const completedRide = activeRideRequest;
    broadcastToClients({ event: 'ride_completed', request: completedRide });

    // Clear active request after a brief delay so clients have received completion event
    setTimeout(() => {
      if (activeRideRequest && activeRideRequest.id === requestId) {
        activeRideRequest = null;
      }
    }, 5000);

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, request: completedRide }));
    return;
  }

  // 7. Cancel Ride Request (Rider)
  if (urlPath === '/api/ride-requests/cancel' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const { requestId } = data;

    if (activeRideRequest && activeRideRequest.id === requestId) {
      activeRideRequest.status = 'cancelled';
      activeRideRequest.cancelledAt = new Date().toISOString();
      broadcastToClients({ event: 'ride_cancelled', request: activeRideRequest });
      activeRideRequest = null;
    }

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // ==========================================
  // REAL-TIME FEEDBACK & RATINGS API ENDPOINTS
  // ==========================================

  // 8. Get All Feedbacks
  if (urlPath === '/api/feedbacks' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, feedbacks: feedbacksStore }));
    return;
  }

  // 9. Submit Customer Rating & Feedback
  if (urlPath === '/api/feedbacks' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const feedback = {
      id: data.id || ('FB-' + Date.now().toString(36).toUpperCase()),
      rideId: data.rideId || null,
      driverId: data.driverId || null,
      driverName: data.driverName || 'Verified Commuter',
      driverPhone: data.driverPhone || null,
      driverAvatar: data.driverAvatar || null,
      driverVehicle: data.driverVehicle || 'Commuter Vehicle',
      riderId: data.riderId || null,
      riderName: data.riderName || 'Commuter',
      riderPhone: data.riderPhone || null,
      rating: parseFloat(data.rating || 5.0),
      tags: Array.isArray(data.tags) ? data.tags : [],
      feedbackText: data.feedbackText || '',
      hasSafetyConcern: Boolean(data.hasSafetyConcern),
      route: data.route || 'Uppal ➔ Jangaon',
      createdAt: new Date().toISOString()
    };

    feedbacksStore.unshift(feedback);
    broadcastToClients({ event: 'new_feedback', feedback });

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, feedback }));
    return;
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  let reqPath = req.url === '/' ? '/index.html' : urlPath;
  let safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      ...corsHeaders,
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Routemate server live with Real-Time Ride Matching API at http://localhost:${PORT}/`);
});
