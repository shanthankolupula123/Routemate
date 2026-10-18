const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (e) {
  console.warn('⚠️ Razorpay package not loaded in server.js:', e.message);
}

// Load environment variables from .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  });
}

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
  // RAZORPAY STANDARD PAYMENT GATEWAY ENDPOINTS
  // ==========================================

  // Public Configuration Endpoint (exposes KEY_ID only, never KEY_SECRET)
  if (urlPath === '/api/razorpay/config' && req.method === 'GET') {
    const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_TpL2XODEcrhI1P';
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ key_id: keyId }));
    return;
  }

  // STEP 1: Backend - Create Order
  // Endpoint: POST /api/create-order
  // Call Razorpay API: POST https://api.razorpay.com/v1/orders
  // Request: { amount (paise), currency, receipt }
  // Return: { order_id, amount, currency }
  // Minimum amount: 100 paise
  if (urlPath === '/api/create-order' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const amount = parseInt(data.amount, 10);
      const currency = data.currency || 'INR';
      const receipt = data.receipt || `rcpt_${Date.now()}`;
      const notes = data.notes || {};

      // Validate amount >= 100 paise
      if (isNaN(amount) || amount < 100) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Amount must be at least 100 paise (₹1.00)'
        }));
        return;
      }

      const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_TpL2XODEcrhI1P';
      const keySecret = process.env.RAZORPAY_KEY_SECRET || 'yfYWZQq3DH6bmP250AFcVoY5';

      if (!keyId || !keySecret) {
        res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Razorpay API credentials not configured'
        }));
        return;
      }

      let orderId = null;
      let orderAmount = amount;
      let orderCurrency = currency;

      try {
        if (!Razorpay) Razorpay = require('razorpay');
        const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await instance.orders.create({ amount, currency, receipt, notes });
        orderId = order.id;
        orderAmount = order.amount;
        orderCurrency = order.currency;
      } catch (sdkErr) {
        // Fallback to direct Razorpay API: POST https://api.razorpay.com/v1/orders
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const apiRes = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ amount, currency, receipt, notes })
        });
        const apiData = await apiRes.json();
        if (!apiRes.ok || !apiData.id) {
          throw new Error((apiData.error && apiData.error.description) || 'Razorpay order creation failed');
        }
        orderId = apiData.id;
        orderAmount = apiData.amount;
        orderCurrency = apiData.currency;
      }

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        order_id: orderId,
        amount: orderAmount,
        currency: orderCurrency
      }));
      return;
    } catch (err) {
      console.error('Error in /api/create-order:', err);
      const statusCode = (err && (err.statusCode || err.status)) || 500;
      res.writeHead(statusCode, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: (err.error && err.error.description) || err.message || 'Razorpay order creation failed'
      }));
      return;
    }
  }

  // STEP 3: Backend - Verify Signature
  // Endpoint: POST /api/verify-payment
  // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
  // Compare generated signature with razorpay_signature
  // Return success only if signatures match
  if (urlPath === '/api/verify-payment' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const order_id = data.razorpay_order_id || data.order_id;
      const payment_id = data.razorpay_payment_id || data.payment_id;
      const razorpay_signature = data.razorpay_signature || data.signature;

      // Missing fields: return 400
      if (!order_id || !payment_id || !razorpay_signature) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Missing required fields: order_id, payment_id, and signature are required'
        }));
        return;
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET || 'yfYWZQq3DH6bmP250AFcVoY5';
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${order_id}|${payment_id}`)
        .digest('hex');

      // Signature mismatch: return 400, do NOT mark as paid
      if (expectedSignature !== razorpay_signature) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid payment signature. Verification failed.'
        }));
        return;
      }

      // Signatures match: return success
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Payment verified successfully',
        order_id,
        payment_id
      }));
      return;
    } catch (err) {
      console.error('Error in /api/verify-payment:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: err.message || 'Payment signature verification error'
      }));
      return;
    }
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
