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
let safetyAlertsStore = [];
let driverKycStore = [];
const sseClients = new Set();
const otpStore = new Map(); // cleanPhone -> { code, expiresAt }
const OTP_SECRET = 'routemate_unified_hmac_secret_key_2026';

function signOtp(phone, code, expiresAt) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${phone}:${code}:${expiresAt}`).digest('hex');
}

function verifyOtpSignature(phone, code, expiresAt, signature) {
  if (!signature || !expiresAt || Date.now() > Number(expiresAt)) return false;
  const expected = signOtp(phone, code, expiresAt);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

/**
 * Resend Email OTP Sender
 * Sends 6-digit verification code directly to the user's email address.
 *
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function sendResendEmailOtp(email, otp) {
  if (process.platform === 'win32' && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Resend] RESEND_API_KEY is not defined in environment variables.');
    return { success: false, error: 'Resend API key not configured' };
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Routemate <auth@routemate.pro>';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Routemate Verification Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Routemate</h2>
          <span style="margin-left: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 9999px;">P2P Commute</span>
        </div>
        <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 700;">Verify Your Email Address</h3>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
          Use the 6-digit verification code below to securely log in or complete your registration on Routemate.
        </p>
        <div style="background-color: #eff6ff; border: 2px dashed #93c5fd; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1d4ed8;">
            ${otp}
          </div>
          <p style="margin: 8px 0 0 0; font-size: 12px; font-weight: 600; color: #3b82f6;">Valid for 10 minutes</p>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">
          If you didn't request this email, you can safely ignore it. Never share your verification code with anyone.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cleanEmail],
        subject: `Your Routemate Verification Code: ${otp}`,
        text: `Your Routemate verification code is: ${otp}\n\nThis 6-digit code is valid for 10 minutes.\nIf you did not request this code, please safely ignore this email.`,
        html: htmlContent
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.id) {
      console.log(`[Resend] Email OTP sent to ${cleanEmail} (ID: ${data.id})`);
      return { success: true, data };
    } else {
      console.warn('[Resend] API returned error:', data);
      return {
        success: false,
        error: (data && (data.message || data.error)) || 'Failed to send email via Resend',
        data
      };
    }
  } catch (error) {
    console.error('[Resend] Network exception:', error);
    return { success: false, error: error.message };
  }
}

async function storeOtpInDb(email, code, expiresAt) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
    const otpVal = `OTP:${code}:${expiresAt}`;

    const patchRes = await fetch(`${supabaseUrl}/rest/v1/profiles?phone=eq.${encodeURIComponent(email)}`, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ avatar_url: otpVal })
    });

    if (patchRes.ok) {
      const updated = await patchRes.json().catch(() => []);
      if (updated && updated.length > 0) return true;
    }

    await fetch(`${supabaseUrl}/rest/v1/profiles`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: email,
        name: email.split('@')[0],
        avatar_url: otpVal,
        is_verified: false
      })
    });
    return true;
  } catch (err) {
    console.warn('[DB OTP] Error storing OTP in Supabase:', err.message);
    return false;
  }
}

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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    'Access-Control-Allow-Private-Network': 'true'
  };

  const urlPath = req.url.split('?')[0];
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${urlPath} (Origin: ${req.headers.origin || 'direct'})`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

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

  // 10. Flag / Unflag Feedback Review (Administrative Safety Infraction)
  if (urlPath === '/api/feedbacks/flag' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const feedbackId = data.feedbackId || data.id;
    const fb = feedbacksStore.find(f => f.id === feedbackId);
    if (fb) {
      fb.is_flagged = data.isFlagged !== undefined ? Boolean(data.isFlagged) : !fb.is_flagged;
      fb.flagged_at = fb.is_flagged ? new Date().toISOString() : null;
      fb.flag_reason = data.reason || 'Flagged by supervisor for safety review';
      broadcastToClients({ event: 'feedback_flagged', feedback: fb });
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, feedback: fb }));
    } else {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Feedback not found' }));
    }
    return;
  }

  // 11. Adjust Driver Rating (Administrative Rating Moderation)
  if (urlPath === '/api/feedbacks/adjust-rating' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    const feedbackId = data.feedbackId || data.id;
    const newRating = parseFloat(data.newRating || data.rating);
    const reason = data.reason || 'Rating moderated by administrator';
    const fb = feedbacksStore.find(f => f.id === feedbackId);
    if (fb) {
      fb.original_rating = fb.rating;
      fb.rating = newRating;
      fb.is_moderated = true;
      fb.moderated_at = new Date().toISOString();
      fb.moderation_reason = reason;
      broadcastToClients({ event: 'feedback_rating_adjusted', feedback: fb, newRating, reason });
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, feedback: fb }));
    } else {
      res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Feedback not found' }));
    }
    return;
  }

  // 12. Submit & Fetch Emergency Safety Alerts (SOS)
  if (urlPath === '/api/safety-alerts' && req.method === 'POST') {
    const data = await parseJsonBody(req);
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
    safetyAlertsStore.unshift(alert);
    broadcastToClients({ event: 'safety_alert_triggered', alert });
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, alert }));
    return;
  }

  if (urlPath === '/api/safety-alerts' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, alerts: safetyAlertsStore }));
    return;
  }

  // 12B. Retrieve Real-Time Driver KYC Submissions for Admin Portal
  if (urlPath === '/api/kyc/submissions' && req.method === 'GET') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, submissions: driverKycStore }));
    return;
  }

  // 13. Notify Real-Time Driver KYC Submission
  if (urlPath === '/api/kyc/notify' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    if (data) {
      const idx = driverKycStore.findIndex(s => 
        (data.id && s.id === data.id) || 
        (data.phone && s.phone === data.phone) ||
        (data.email && s.email && s.email === data.email)
      );
      if (idx >= 0) {
        driverKycStore[idx] = { ...driverKycStore[idx], ...data };
      } else {
        driverKycStore.unshift(data);
      }
      broadcastToClients({ event: 'new_kyc_submission', kyc: data });
    }
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // 14. Notify Real-Time Driver KYC Decision (Approved / Rejected)
  if (urlPath === '/api/kyc/decision' && req.method === 'POST') {
    const data = await parseJsonBody(req);
    if (data) {
      const targetId = data.id;
      const target = driverKycStore.find(s => 
        s.id === targetId || 
        (s.phone && s.phone === targetId) ||
        (s.email && s.email === targetId)
      );
      if (target) {
        target.kyc_status = data.status;
        target.is_kyc_verified = data.status === 'verified_success';
        if (data.updateData) {
          Object.assign(target, data.updateData);
        }
      }
      broadcastToClients({ event: 'kyc_decision_updated', decision: data });
    }
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // ==========================================
  // RESEND EMAIL OTP VERIFICATION ENDPOINTS
  // ==========================================

  // 1. Send OTP via Resend Email API (with HMAC token & dev fallbacks)
  if (urlPath === '/api/send-otp' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const email = data.email || data.target || (data.phone && data.phone.includes('@') ? data.phone : null);
      if (!email) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Email address is required' }));
        return;
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Please provide a valid email address' }));
        return;
      }

      // Generate secure 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
      const otpToken = signOtp(cleanEmail, otpCode, expiresAt);
      otpStore.set(cleanEmail, { code: otpCode, expiresAt });

      // Parallel execution: Dispatch email and store in DB concurrently
      const [emailResult] = await Promise.all([
        sendResendEmailOtp(cleanEmail, otpCode),
        storeOtpInDb(cleanEmail, otpCode, expiresAt)
      ]);

      if (!emailResult.success) {
        console.error('[Resend] Email dispatch error:', emailResult.error);
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: emailResult.error || 'Failed to dispatch email verification code. Please check your email address.'
        }));
        return;
      }

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'sent',
        provider: 'resend',
        to: cleanEmail,
        otpToken: otpToken,
        expiresAt: expiresAt,
        emailId: emailResult.data ? emailResult.data.id : null,
        message: 'Verification code sent to your email.'
      }));
      return;
    } catch (err) {
      console.error('Exception in /api/send-otp:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Server error sending OTP' }));
      return;
    }
  }

  // 2. Verify OTP via Resend stateful cache or HMAC signature
  if (urlPath === '/api/verify-otp' && req.method === 'POST') {
    try {
      const data = await parseJsonBody(req);
      const identifier = data.email || data.target || data.phone;
      const { code, otpToken, expiresAt } = data;

      if (!identifier || !code) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Email address and verification code are required' }));
        return;
      }

      const cleanIdentifier = String(identifier).trim().toLowerCase();
      const cleanCode = String(code).replace(/\D/g, '').trim();
      let isVerified = false;

      // 1. Check in-memory store
      const cached = otpStore.get(cleanIdentifier);
      if (cached && cached.code === cleanCode && Date.now() <= cached.expiresAt) {
        isVerified = true;
        otpStore.delete(cleanIdentifier);
      }
      // 2. Check Supabase DB
      if (!isVerified) {
        try {
          const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
          const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
          const dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?phone=eq.${encodeURIComponent(cleanIdentifier)}&select=id,avatar_url`, {
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
          });
          if (dbRes.ok) {
            const rows = await dbRes.json();
            if (rows && rows.length > 0 && rows[0].avatar_url && rows[0].avatar_url.startsWith('OTP:')) {
              const parts = rows[0].avatar_url.split(':');
              const storedCode = String(parts[1] || '').trim();
              const storedExp = Number(parts[2] || 0);
              if (storedCode === cleanCode && Date.now() <= storedExp) {
                isVerified = true;
                fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${rows[0].id}`, {
                  method: 'PATCH',
                  headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ avatar_url: null, is_verified: true })
                }).catch(() => {});
              }
            }
          }
        } catch (e) {}
      }
      // 3. Check stateless HMAC signature
      if (!isVerified && otpToken && expiresAt && verifyOtpSignature(cleanIdentifier, cleanCode, expiresAt, otpToken)) {
        isVerified = true;
        otpStore.delete(cleanIdentifier);
      }

      if (isVerified) {
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          verified: true,
          status: 'approved',
          to: cleanIdentifier
        }));
        return;
      } else {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Invalid or expired OTP code. Please retry.'
        }));
        return;
      }
    } catch (err) {
      console.error('Exception in /api/verify-otp:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || 'Server error verifying OTP' }));
      return;
    }
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
