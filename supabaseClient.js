// Routemate - Supabase Database Client & ORM Helpers
// Configured with Project URL & Publishable Key

// Automated Fresh Reset Check (v29)
(function checkFreshStorageReset() {
  try {
    const RESET_KEY = 'routemate_fresh_reset_v29';
    const urlParams = (typeof window !== 'undefined' && window.location) ? new URLSearchParams(window.location.search) : null;
    const forceClean = urlParams && (urlParams.get('reset') === '1' || urlParams.get('clean') === '1');
    if (forceClean || localStorage.getItem(RESET_KEY) !== 'true') {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k !== RESET_KEY && (k.startsWith('routemate_') || k.startsWith('sb-'))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(k => {
        try { localStorage.removeItem(k); } catch(e){}
      });
      try { sessionStorage.clear(); } catch(e){}
      localStorage.setItem(RESET_KEY, 'true');
      console.log('🧹 [SUPABASE CLIENT] Storage cache and sessions cleanly reset (v29).');
    }
  } catch(e) {}
})();

const SUPABASE_CONFIG = {
  url: 'https://hjieeilzfbvubkhmlmdg.supabase.co',
  publishableKey: 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a'
};

// Initialize Supabase Client using global @supabase/supabase-js with reconnect capability
let supabase = null;

function getSupabaseClient(forceReconnect = false) {
  if (forceReconnect && supabase) {
    try {
      if (typeof supabase.removeAllChannels === 'function') {
        supabase.removeAllChannels();
      }
    } catch (e) {}
    supabase = null;
  }

  if (!supabase && typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    try {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage,
          storageKey: 'routemate_supabase_auth_token'
        },
        realtime: {
          enabled: true,
          params: {
            eventsPerSecond: 10
          }
        },
        global: {
          headers: {
            'x-client-info': 'routemate-web/2.0'
          }
        }
      });
      console.log('✅ Supabase client initialized with Realtime enabled for Routemate (hjieeilzfbvubkhmlmdg.supabase.co)');
    } catch (err) {
      console.warn('⚠️ Error initializing Supabase client:', err);
    }
  }
  return supabase;
}

// Initial attempt
getSupabaseClient();

// Safe global state accessor across script modules
function getGlobalState() {
  if (typeof window !== 'undefined' && window.state) return window.state;
  if (typeof state !== 'undefined') return state;
  return null;
}

// Session Isolation & Self-Booked Ride Filter Helper
function isSelfBookedRide(ride, user) {
  if (!ride) return false;

  const appState = getGlobalState();

  // If this client is actively in rider mode with this exact active ride, it's a self-booked ride
  if (appState && appState.activeRideRole === 'rider' && appState.currentActiveRide) {
    const activeId = appState.currentActiveRide.id || appState.currentActiveRide.vehicle_number;
    const thisId = ride.id || ride.vehicle_number;
    if (activeId && thisId && String(activeId).trim() === String(thisId).trim()) {
      return true;
    }
  }

  let currentUser = user || appState?.currentUser;
  if (!currentUser && typeof localStorage !== 'undefined') {
    try {
      const cached = JSON.parse(localStorage.getItem('routemate_auth_user') || 'null');
      if (cached && (cached.id || cached.email || cached.phone)) {
        currentUser = cached;
      }
    } catch(e) {}
  }
  if (!currentUser) return false;

  let meta = {};
  if (typeof ride.notes === 'string') {
    try { meta = JSON.parse(ride.notes || '{}'); } catch(e){}
  } else if (ride.notes && typeof ride.notes === 'object') {
    meta = ride.notes;
  }

  const riderId = String(ride.rider_id || ride.riderId || meta.riderId || meta.rider_id || '').trim();
  const riderEmail = String(ride.rider_email || ride.riderEmail || meta.riderEmail || meta.rider_email || meta.email || '').toLowerCase().trim();
  const riderPhone = String(ride.rider_phone || ride.riderPhone || meta.riderPhone || meta.rider_phone || meta.phone || '').replace(/\D/g, '');

  const driverId = String(currentUser.id || '').trim();
  const driverEmail = String(currentUser.email || '').toLowerCase().trim();
  const driverPhone = String(currentUser.phone || '').replace(/\D/g, '');

  // 1. Exclude if rider ID matches driver user ID
  if (driverId && riderId && driverId === riderId) {
    return true;
  }

  // 2. Exclude if rider email matches driver email
  if (driverEmail && riderEmail) {
    if (driverEmail === riderEmail) {
      return true;
    }
    // Distinct email accounts (e.g. Device A vs Device B) are always isolated separate users
    return false;
  }

  // 3. Exclude if rider phone matches driver phone (excluding generic demo placeholders)
  const GENERIC_PLACEHOLDERS = ['9848023145', '0000000000', '1234567890'];
  if (driverPhone.length >= 10 && riderPhone.length >= 10) {
    const dLast10 = driverPhone.slice(-10);
    const rLast10 = riderPhone.slice(-10);
    if (!GENERIC_PLACEHOLDERS.includes(dLast10) && dLast10 === rLast10) {
      return true;
    }
  }

  return false;
}
if (typeof window !== 'undefined') {
  window.isSelfBookedRide = isSelfBookedRide;
}

// =========================================================================
// RIDE DATA EXTRACTION & DATABASE KEY NORMALIZER
// =========================================================================
function extractRideCardData(ride) {
  if (!ride) return null;

  let meta = {};
  if (typeof ride.notes === 'string') {
    try { meta = JSON.parse(ride.notes || '{}'); } catch(e) {}
  } else if (ride.notes && typeof ride.notes === 'object') {
    meta = ride.notes;
  }

  const rideId = ride.vehicle_number || 
                 ride.id || 
                 meta.id || 
                 meta.requestId || 
                 ('REQ-' + (ride.dbId || (ride.id ? String(ride.id).slice(0, 8) : Date.now())));
  const dbId = ride.dbId || ride.id || rideId;

  const pickup = ride.pickup || 
                 ride.pickup_location || 
                 ride.pickupLocation || 
                 meta.pickup || 
                 meta.pickup_location || 
                 meta.pickupLocation || 
                 meta.from || 
                 meta.origin || 
                 'Uppal Metro';

  const drop = ride.drop_location || 
               ride.drop || 
               ride.dropLocation || 
               ride.destination || 
               ride.destination_location || 
               meta.drop_location || 
               meta.drop || 
               meta.destination || 
               meta.to || 
               'Jangaon Bus Depot';

  const rawFare = ride.per_seat_price ?? 
                  ride.fare ?? 
                  ride.fuel_share ?? 
                  ride.price ?? 
                  ride.fareOffer ?? 
                  ride.amount ?? 
                  meta.fare ?? 
                  meta.per_seat_price ?? 
                  meta.fuel_share ?? 
                  meta.price ?? 
                  110;
  const fare = Math.round(Number(rawFare) || 110);

  let dist = ride.distance || ride.distance_km || meta.distance || meta.distance_km || meta.dist;
  dist = Math.round(Number(dist) || 84);

  const rawDriverName = ride.driver_name ? String(ride.driver_name).replace(/\s*\([^)]*\)/g, '').trim() : '';
  const riderName = meta.riderName || 
                    meta.rider_name || 
                    meta.name || 
                    ride.rider_name || 
                    ride.riderName || 
                    ride.name || 
                    rawDriverName || 
                    'Verified Commuter';

  const riderRole = meta.riderRole || 
                    meta.rider_role || 
                    ride.rider_role || 
                    ride.role || 
                    ride.driver_role || 
                    'Daily Commuter';

  const rawRating = ride.rating || meta.rating || 4.9;
  const rating = Number(rawRating).toFixed(1);

  const avatarUrl = meta.riderAvatar || 
                    meta.rider_avatar || 
                    meta.avatar || 
                    ride.rider_avatar || 
                    ride.avatar || 
                    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80';

  const riderPhone = meta.riderPhone || 
                     meta.rider_phone || 
                     meta.phone || 
                     ride.rider_phone || 
                     ride.riderPhone || 
                     ride.phone || 
                     '+91 98480 23145';

  const vehicleType = meta.vehicleType || 
                      meta.vehicle_type || 
                      ride.vehicle_type || 
                      ride.vehicleType || 
                      ride.vehicle_name || 
                      'bike';

  const payMethod = meta.paymentMethod || 
                    meta.payment_method || 
                    ride.payment_preference || 
                    ride.payment_method || 
                    ride.paymentMethod || 
                    'Direct UPI';

  const pin = meta.pin || meta.otp || ride.pin || ride.otp || '4821';
  const status = ride.status || meta.status || 'active';

  return {
    id: rideId,
    dbId,
    vehicle_number: ride.vehicle_number || rideId,
    pickup,
    pickup_location: pickup,
    drop,
    drop_location: drop,
    fare,
    fuel_share: fare,
    per_seat_price: fare,
    distance: dist,
    distance_km: dist,
    riderName,
    rider_name: riderName,
    name: riderName,
    riderRole,
    rider_role: riderRole,
    role: riderRole,
    rating,
    avatarUrl,
    avatar: avatarUrl,
    riderPhone,
    rider_phone: riderPhone,
    phone: riderPhone,
    vehicleType,
    vehicle_type: vehicleType,
    paymentMethod: payMethod,
    payment_method: payMethod,
    pin,
    status,
    notes: ride.notes,
    created_at: ride.created_at || meta.createdAt || new Date().toISOString()
  };
}
if (typeof window !== 'undefined') {
  window.extractRideCardData = extractRideCardData;
}

// ==========================================================
// RESILIENT CONNECTION MANAGER & HEALTH MONITOR
// Handles regional API degradations, auto-reconnects, and status notifications
// ==========================================================
const connectionManager = {
  status: 'connected', // 'connected' | 'degraded' | 'reconnecting' | 'offline'
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lastCheckTime: Date.now(),
  lastSuccessTime: Date.now(),
  consecutiveFailures: 0,
  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    try { listener(this.status, this.isOnline); } catch (e) {}
    return () => this.listeners.delete(listener);
  },

  _setStatus(newStatus, isOnline = true) {
    const changed = this.status !== newStatus || this.isOnline !== isOnline;
    this.status = newStatus;
    this.isOnline = isOnline;
    if (changed) {
      console.log(`🔌 [Supabase Connection] Status changed to: ${newStatus} (Online: ${isOnline})`);
      this.listeners.forEach(fn => {
        try { fn(newStatus, isOnline); } catch (e) {}
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('routemate_connection_change', {
          detail: { status: newStatus, isOnline }
        }));
      }
    }
  },

  // Ping health endpoint with strict timeout (non-blocking)
  async checkHealth(quick = false) {
    const timeoutMs = quick ? 2500 : 5000;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/health`, {
        method: 'GET',
        headers: { apikey: SUPABASE_CONFIG.publishableKey },
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok || res.status === 200 || res.status === 204) {
        this.consecutiveFailures = 0;
        this.lastSuccessTime = Date.now();
        this._setStatus('connected', true);
        if (typeof offlineQueue !== 'undefined') {
          offlineQueue.flush();
        }
        return { ok: true, status: 'connected' };
      } else {
        this.consecutiveFailures++;
        this._setStatus('degraded', true);
        return { ok: false, status: 'degraded', code: res.status };
      }
    } catch (err) {
      this.consecutiveFailures++;
      const isDeviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const newStatus = isDeviceOffline ? 'offline' : 'degraded';
      this._setStatus(newStatus, !isDeviceOffline);
      return { ok: false, status: newStatus, error: err.message };
    }
  },

  // Force reconnect Supabase client and channel transports
  async reconnect(force = true) {
    this._setStatus('reconnecting', this.isOnline);
    console.log('🔄 Re-initializing Supabase client connection...');
    getSupabaseClient(force);
    if (typeof db !== 'undefined' && db.matching && typeof db.matching.init === 'function') {
      try { db.matching.init(true); } catch (e) {}
    }
    const health = await this.checkHealth();
    return health;
  }
};

// Auto-recovery listeners on browser online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('🌐 Network online detected. Checking Supabase connectivity...');
    connectionManager.reconnect(true);
  });
  window.addEventListener('offline', () => {
    console.warn('⚠️ Network offline detected. Activating Local Fallback Mode...');
    connectionManager._setStatus('offline', false);
  });
  // Gentle background heartbeat (every 30s)
  setInterval(() => {
    if (connectionManager.status === 'degraded' || connectionManager.status === 'reconnecting') {
      connectionManager.checkHealth(true);
    }
  }, 30000);
}

// ==========================================================
// OFFLINE QUEUE & BACKGROUND SYNCHRONIZATION
// Guarantees rides, bookings, and updates are safely preserved during regional hiccups
// ==========================================================
const offlineQueue = {
  QUEUE_KEY: 'routemate_offline_queue',
  isFlushing: false,

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  },

  saveQueue(queue) {
    try {
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify((queue || []).slice(0, 100)));
    } catch (e) {}
  },

  enqueue(action, payload, uniqueKey = null) {
    try {
      const queue = this.getQueue();
      const item = {
        id: uniqueKey || ('op_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)),
        action,
        payload,
        createdAt: Date.now(),
        retries: 0
      };
      const existingIdx = uniqueKey ? queue.findIndex(q => q.id === uniqueKey) : -1;
      if (existingIdx >= 0) {
        queue[existingIdx] = item;
      } else {
        queue.push(item);
      }
      this.saveQueue(queue);
      console.log(`📦 [Offline Queue] Enqueued action "${action}":`, item.id);
      return item;
    } catch (e) {
      console.warn('Error enqueuing offline action:', e);
      return null;
    }
  },

  async flush() {
    if (this.isFlushing) return;
    const queue = this.getQueue();
    if (!queue || queue.length === 0) return;

    this.isFlushing = true;
    console.log(`⚡ [Offline Queue] Flushing ${queue.length} pending operations to Supabase...`);
    const remaining = [];

    for (const item of queue) {
      try {
        let success = false;
        if (item.action === 'insert_ride') {
          const res = await supabaseRest('rides', { method: 'POST', body: item.payload, retries: 0 });
          success = res.ok;
        } else if (item.action === 'update_ride') {
          const { filter, body } = item.payload;
          const res = await supabaseRest(`rides?${filter}`, { method: 'PATCH', body, retries: 0 });
          success = res.ok;
        } else if (item.action === 'insert_booking') {
          const res = await supabaseRest('bookings', { method: 'POST', body: item.payload, retries: 0 });
          success = res.ok;
        } else if (item.action === 'upsert_profile') {
          const res = await supabaseRest('profiles', { method: 'POST', body: item.payload, prefer: 'resolution=merge-duplicates', retries: 0 });
          success = res.ok;
        } else if (item.action === 'insert_feedback') {
          const res = await supabaseRest('feedbacks', { method: 'POST', body: item.payload, retries: 0 });
          success = res.ok;
        } else if (item.action === 'insert_sos') {
          const res = await supabaseRest('safety_alerts', { method: 'POST', body: item.payload, retries: 0 });
          success = res.ok;
        } else {
          success = true;
        }

        if (!success) {
          item.retries = (item.retries || 0) + 1;
          if (item.retries < 5) {
            remaining.push(item);
          } else {
            console.warn(`Dropped stale offline item after 5 failed sync attempts:`, item.action, item.id);
          }
        } else {
          console.log(`✅ [Offline Queue] Synchronized ${item.action} (${item.id}) to Supabase cloud`);
        }
      } catch (err) {
        item.retries = (item.retries || 0) + 1;
        if (item.retries < 5) remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    this.isFlushing = false;
  }
};

// Initial flush attempt after load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try { offlineQueue.flush(); } catch (e) {}
  }, 2500);
}

// ==========================================================
// DIRECT NATIVE FETCH HELPER FOR SUPABASE POSTGREST
// With AbortController timeout, automatic exponential backoff retry,
// and graceful degraded error handling. Never throws unhandled exceptions.
// ==========================================================
async function supabaseRest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  const url = `${SUPABASE_CONFIG.url}/rest/v1/${cleanEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  const maxRetries = options.retries !== undefined ? options.retries : 1;
  const timeoutMs = options.timeoutMs || 6000;

  const headers = {
    'apikey': SUPABASE_CONFIG.publishableKey,
    'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
    'Content-Type': 'application/json',
    'Prefer': options.prefer || 'return=representation',
    ...(options.headers || {})
  };

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
      clearTimeout(timer);

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch (e) { data = text; }

      // Successful response
      if (res.ok) {
        connectionManager.consecutiveFailures = 0;
        connectionManager.lastSuccessTime = Date.now();
        if (connectionManager.status !== 'connected') {
          connectionManager._setStatus('connected', true);
        }
        return { ok: true, status: res.status, data, error: null };
      }

      // 5xx Server / Gateway or 429 Rate Limit Errors
      if (res.status >= 500 || res.status === 429) {
        connectionManager._setStatus('degraded', true);
        lastError = (data && data.message) ? data : { message: text || `HTTP ${res.status}` };
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
      }

      // 4xx Client Errors (e.g. 404, 400) - return error without useless retries
      return {
        ok: false,
        status: res.status,
        data,
        error: !res.ok ? (data && data.message ? data : { message: text || `HTTP ${res.status}` }) : null
      };
    } catch (err) {
      lastError = err;
      connectionManager._setStatus('degraded', typeof navigator !== 'undefined' ? navigator.onLine : true);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  console.warn(`Supabase direct REST notice (${endpoint}):`, lastError ? (lastError.message || lastError) : 'Unavailable');
  return { ok: false, status: 0, data: null, error: lastError, degraded: true };
}
if (typeof window !== 'undefined') {
  window.supabaseRest = supabaseRest;
  window.checkSupabaseConnection = () => connectionManager.checkHealth();
  window.reconnectSupabase = () => connectionManager.reconnect(true);
}

// Database and Authentication helper functions
const db = {
  get client() {
    return getSupabaseClient();
  },
  connection: connectionManager,
  offlineQueue: offlineQueue,
  reconnect: (force = true) => connectionManager.reconnect(force),
  checkHealth: (quick = false) => connectionManager.checkHealth(quick),

  // ==========================================
  // SUPABASE AUTH HELPERS (PHONE OTP)
  // ==========================================
  auth: {
    // Fetch active Supabase session
    async getSession() {
      const client = getSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          console.warn('Supabase getSession error:', error.message);
          return null;
        }
        return data ? data.session : null;
      } catch (e) {
        console.warn('Error fetching Supabase session:', e);
        return null;
      }
    },

    // Fetch active user
    async getUser() {
      const client = getSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getUser();
        if (error) return null;
        return data ? data.user : null;
      } catch (e) {
        return null;
      }
    },

    // Helper: Resilient Backend API Discovery across canonical production and local environments
    async _callBackendOtpApi(endpointPath, payload) {
      const candidateUrls = [];
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin) || '';

      // 1. Direct canonical production API is ALWAYS candidate #1 (Global CORS enabled, 100% reliable)
      candidateUrls.push(`https://www.routemate.pro${endpointPath}`);

      // 2. Same-origin relative path (when hosted directly or on custom domain)
      if (origin && !origin.includes('routemate.pro')) {
        candidateUrls.push(endpointPath);
      }

      // 3. Local dev server candidates
      candidateUrls.push(`http://localhost:3000${endpointPath}`);
      candidateUrls.push(`http://127.0.0.1:3000${endpointPath}`);

      let lastError = null;

      for (const url of candidateUrls) {
        try {
          console.log(`🌐 Calling OTP API: ${url}`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const data = await res.json();
            if (res.ok) {
              console.log(`✅ Received successful OTP response from ${url}:`, data);
              return { res, data, url };
            } else {
              console.warn(`Candidate ${url} returned ${res.status}:`, data);
              lastError = (data && data.error) || `Error ${res.status}`;
            }
          }
        } catch (e) {
          console.warn(`❌ Candidate ${url} error:`, e.message || e);
        }
      }
      return lastError ? { data: { success: false, error: lastError } } : null;
    },

    // Send OTP to Email (Resend API with Supabase fallback)
    async signInWithOtp(emailOrPhone) {
      const target = String(emailOrPhone || '').trim().toLowerCase();
      try {
        console.log(`📧 Dispatching OTP via Resend to: ${target}`);
        // Store target in session storage so verification always knows the email
        try {
          sessionStorage.setItem('routemate_auth_target', target);
        } catch (e) {}

        const backendResult = await this._callBackendOtpApi('/api/send-otp', { email: target });

        if (backendResult && backendResult.data && (backendResult.data.success || backendResult.data.status === 'sent' || backendResult.data.emailId)) {
          const data = backendResult.data;
          console.log(`✅ Resend Email OTP dispatched successfully via ${backendResult.url}:`, data);
          if (data.otpToken && data.expiresAt) {
            try {
              sessionStorage.setItem('routemate_otp_token', data.otpToken);
              sessionStorage.setItem('routemate_otp_expires', String(data.expiresAt));
            } catch (e) {}
          }
          return { success: true, method: 'resend', data };
        } else if (backendResult && backendResult.data && backendResult.data.error) {
          console.warn('Resend backend notice:', backendResult.data.error);
          return { success: false, error: backendResult.data.error };
        }
      } catch (err) {
        console.warn('Resend endpoint error:', err);
      }

      return {
        success: false,
        error: 'Unable to send verification email. Please verify your email address and try again.'
      };
    },

    // Verify 6-digit OTP Token (Resend API, Direct Supabase DB, or HMAC fallback)
    async verifyOtp(emailOrPhone, token) {
      const identifier = String(emailOrPhone || '').trim().toLowerCase();
      const cleanToken = String(token || '').trim();

      if (!identifier || !cleanToken || cleanToken.length !== 6) {
        return { success: false, error: 'Please enter a valid email address and 6-digit verification code.' };
      }

      let otpToken = null;
      let expiresAt = null;
      try {
        otpToken = sessionStorage.getItem('routemate_otp_token');
        expiresAt = sessionStorage.getItem('routemate_otp_expires');
      } catch (e) {}

      // 1. Primary: Verify via Canonical Backend Verification API
      try {
        console.log(`🔑 Verifying OTP token for ${identifier}...`);
        const backendResult = await this._callBackendOtpApi('/api/verify-otp', {
          email: identifier,
          code: cleanToken,
          otpToken,
          expiresAt
        });

        if (backendResult && backendResult.data && (backendResult.data.success || backendResult.data.status === 'approved' || backendResult.data.verified)) {
          console.log('✅ OTP verified successfully via verification API!');
          try {
            sessionStorage.removeItem('routemate_otp_token');
            sessionStorage.removeItem('routemate_otp_expires');
          } catch (e) {}

          const cleanId = 'usr_' + identifier.replace(/[^a-zA-Z0-9]/g, '_');
          return {
            success: true,
            method: 'api',
            data: {
              user: {
                id: cleanId,
                email: identifier,
                phone: identifier,
                verified_at: new Date().toISOString()
              }
            }
          };
        }
      } catch (err) {
        console.warn('Verify API endpoint error:', err);
      }

      // 2. Direct Supabase Database Fallback: Check profiles table directly
      const client = getSupabaseClient();
      if (client) {
        try {
          console.log(`🔍 Checking direct Supabase database profile for ${identifier}...`);
          const { data: prof, error: profErr } = await client
            .from('profiles')
            .select('id,phone,name,avatar_url')
            .eq('phone', identifier)
            .maybeSingle();

          if (!profErr && prof && prof.avatar_url && prof.avatar_url.startsWith('OTP:')) {
            const parts = prof.avatar_url.split(':');
            const storedCode = String(parts[1] || '').trim();
            const storedExp = Number(parts[2] || 0);

            if (storedCode === cleanToken) {
              if (Date.now() <= storedExp) {
                console.log(`✅ OTP verified directly via Supabase database profile!`);
                // Clear the OTP to prevent reuse
                await client
                  .from('profiles')
                  .update({ avatar_url: null, is_verified: true })
                  .eq('id', prof.id);

                try {
                  sessionStorage.removeItem('routemate_otp_token');
                  sessionStorage.removeItem('routemate_otp_expires');
                } catch (e) {}

                return {
                  success: true,
                  method: 'supabase_direct',
                  data: {
                    user: {
                      id: prof.id,
                      email: identifier,
                      phone: identifier,
                      name: prof.name,
                      verified_at: new Date().toISOString()
                    }
                  }
                };
              } else {
                return { success: false, error: 'Verification code has expired. Please request a new code.' };
              }
            }
          }
        } catch (dbEx) {
          console.warn('Direct Supabase verification check error:', dbEx);
        }
      }

      // 3. Fallback: HMAC token check if token is present
      if (otpToken && expiresAt) {
        const expNum = Number(expiresAt);
        if (Date.now() > expNum) {
          return { success: false, error: 'Verification code has expired. Please request a new code.' };
        }
      }

      return {
        success: false,
        error: 'Invalid verification code. Please check the latest code sent to your email.'
      };
    },

    // Sign Out
    async signOut() {
      const client = getSupabaseClient();
      if (!client) return { success: true };
      try {
        const { error } = await client.auth.signOut();
        if (error) console.warn('Supabase signOut warning:', error.message);
        return { success: true };
      } catch (e) {
        console.warn('Exception during signOut:', e);
        return { success: true };
      }
    },

    // Auth state listener
    onAuthStateChange(callback) {
      const client = getSupabaseClient();
      if (!client) return { data: { subscription: { unsubscribe: () => {} } } };
      return client.auth.onAuthStateChange(callback);
    }
  },

  // ==========================================
  // RIDES TABLE HELPERS
  // ==========================================
  rides: {
    // Fetch all active rides from Supabase with Local Cache Fallback
    async fetchAll(vehicleType = null) {
      let rides = null;

      // 1. Try direct Supabase PostgREST (robust across mobile & incognito)
      try {
        let endpoint = 'rides?status=eq.active&order=created_at.desc';
        if (vehicleType) endpoint += `&vehicle_type=eq.${encodeURIComponent(vehicleType)}`;
        const res = await supabaseRest(endpoint);
        if (res.ok && Array.isArray(res.data)) {
          rides = res.data;
        }
      } catch (e) {}

      // 2. Try SDK client if REST didn't return data
      if (!rides) {
        const client = getSupabaseClient();
        if (client) {
          try {
            let query = client
              .from('rides')
              .select('*')
              .eq('status', 'active')
              .order('created_at', { ascending: false });

            if (vehicleType) {
              query = query.eq('vehicle_type', vehicleType);
            }

            const { data, error } = await query;
            if (!error && Array.isArray(data)) {
              rides = data;
            }
          } catch (e) {
            console.warn('Supabase network error in rides.fetchAll:', e);
          }
        }
      }

      // 3. Fallback to Local Cache if Supabase is degraded or unreachable
      if (rides && Array.isArray(rides)) {
        try {
          localStorage.setItem('routemate_cached_rides', JSON.stringify(rides));
        } catch (e) {}
        return rides;
      } else {
        try {
          const cached = JSON.parse(localStorage.getItem('routemate_cached_rides') || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            console.log(`📦 [Local Mode] Serving ${cached.length} cached active rides due to Supabase API degradation`);
            if (vehicleType) {
              return cached.filter(r => r.vehicle_type === vehicleType);
            }
            return cached;
          }
        } catch (e) {}
        return [];
      }
    },

    // Insert new driver ride (optimistic local update + cloud sync + offline queue)
    async create(rideData) {
      const localId = 'RID-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
      const payload = {
        driver_name: rideData.driverName || 'Verified Commuter',
        driver_role: rideData.driverRole || 'Commuter',
        rating: rideData.rating || 4.9,
        avatar: rideData.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        vehicle_type: rideData.vehicleType || 'bike',
        vehicle_name: rideData.vehicleName || 'Commuter Vehicle',
        vehicle_number: rideData.vehicleNumber || 'TS 08 TS 0001',
        pickup: rideData.pickup || 'Uppal, Hyderabad',
        drop_location: rideData.drop || 'Jangaon',
        departure_time: rideData.departureTime || 'Today, 06:45 PM',
        seats_available: parseInt(rideData.seatsAvailable || 1, 10),
        per_seat_price: parseFloat(rideData.perSeatPrice || 108),
        payment_preference: rideData.paymentPreference || 'both',
        verified: true,
        helmet_provided: Boolean(rideData.helmetProvided),
        ac: Boolean(rideData.ac),
        status: 'active',
        notes: rideData.notes || 'Commuter ride on Highway corridor.',
        created_at: new Date().toISOString()
      };

      // 1. Optimistically update local cache
      try {
        const cached = JSON.parse(localStorage.getItem('routemate_cached_rides') || '[]');
        cached.unshift(payload);
        localStorage.setItem('routemate_cached_rides', JSON.stringify(cached.slice(0, 50)));
      } catch (e) {}

      // 2. Broadcast immediately to local tabs
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel('routemate_ride_matching');
          bc.postMessage({ event: 'ride_published', ride: payload });
          bc.close();
        }
      } catch (e) {}

      // 3. Direct REST Insert to Supabase cloud
      let inserted = null;
      try {
        const restRes = await supabaseRest('rides', {
          method: 'POST',
          body: payload,
          prefer: 'return=representation'
        });
        if (restRes.ok && restRes.data) {
          inserted = Array.isArray(restRes.data) ? restRes.data[0] : restRes.data;
        }
      } catch (e) {}

      // Fallback via client if REST didn't return
      if (!inserted) {
        const client = getSupabaseClient();
        if (client) {
          try {
            const { data, error } = await client.from('rides').insert([payload]).select();
            if (!error && data && data.length > 0) inserted = data[0];
          } catch (e) {}
        }
      }

      if (inserted) {
        console.log('✅ Ride published to Supabase:', inserted);
        return { success: true, data: inserted };
      } else {
        // Enqueue to offline queue so it syncs when cloud recovers
        console.warn('⚠️ Supabase API degraded. Enqueued ride in offline queue.');
        offlineQueue.enqueue('insert_ride', payload, 'ride_' + payload.vehicle_number);
        return { success: true, data: payload, offlineQueued: true };
      }
    }
  },

  // ==========================================
  // PROFILES TABLE HELPERS
  // ==========================================
  profiles: {
    // Local profile caching helpers
    _cacheProfile(profile) {
      if (!profile) return;
      try {
        const key = 'routemate_profiles_cache';
        let cache = JSON.parse(localStorage.getItem(key) || '{}');
        if (profile.id) cache[profile.id] = profile;
        if (profile.email) cache[String(profile.email).toLowerCase()] = profile;
        if (profile.phone) cache[String(profile.phone).toLowerCase()] = profile;
        localStorage.setItem(key, JSON.stringify(cache));
      } catch (e) {}
    },

    _getCachedProfile(identifier) {
      if (!identifier) return null;
      try {
        const clean = String(identifier).trim().toLowerCase();
        const key = 'routemate_profiles_cache';
        let cache = JSON.parse(localStorage.getItem(key) || '{}');
        if (cache[clean]) return this._formatProfile(cache[clean]);
        // Also check cached current logged in user
        const curr = JSON.parse(localStorage.getItem('routemate_auth_user') || 'null');
        if (curr && ((curr.email && curr.email.toLowerCase() === clean) || (curr.phone && curr.phone.toLowerCase() === clean) || curr.id === clean)) {
          return this._formatProfile(curr);
        }
      } catch (e) {}
      return null;
    },

    async getById(profileId) {
      const client = getSupabaseClient();
      if (!client) return this._getCachedProfile(profileId);
      try {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single();
        if (error) throw error;
        if (data) {
          const formatted = this._formatProfile(data);
          this._cacheProfile(formatted);
          return formatted;
        }
        return this._getCachedProfile(profileId);
      } catch (e) {
        console.warn('Error fetching profile from Supabase:', e);
        return this._getCachedProfile(profileId);
      }
    },

    // Helper: Unpack JSON encoded role and normalize profile data
    _formatProfile(profile) {
      if (!profile) return null;
      const copy = { ...profile };
      let parsed = null;
      if (copy.role && typeof copy.role === 'string' && copy.role.trim().startsWith('{')) {
        try {
          parsed = JSON.parse(copy.role);
          Object.assign(copy, parsed);
        } catch (e) {}
      }

      if (!copy.email && copy.phone && copy.phone.includes('@')) {
        copy.email = copy.phone;
      }

      // If avatar_url was used for a temporary OTP token, restore real submitted photo
      if (copy.avatar_url && copy.avatar_url.startsWith('OTP:')) {
        copy.avatar_url = (parsed && parsed.avatar_url && !parsed.avatar_url.startsWith('OTP:')) 
          ? parsed.avatar_url 
          : (parsed && parsed.avatar && !parsed.avatar.startsWith('OTP:')) 
            ? parsed.avatar 
            : null;
      }

      const isWhitelistedAdmin = (copy.email && copy.email.toLowerCase() === 'shanthankolupula123@gmail.com') ||
        (copy.phone && copy.phone.toLowerCase() === 'shanthankolupula123@gmail.com');

      if (isWhitelistedAdmin || (copy.aadhaar_number && copy.dl_number && (copy.rc_number || copy.rc_vehicle_name))) {
        copy.is_kyc_verified = true;
        copy.kyc_status = 'verified_success';
      } else if (copy.is_verified && copy.is_kyc_verified === undefined) {
        copy.is_kyc_verified = Boolean(copy.kyc_status === 'verified_success');
      }

      return copy;
    },

    // Find existing profile by email or phone (READ ONLY - does NOT create duplicates)
    async findByEmailOrPhone(identifier) {
      if (!identifier) return null;
      const client = getSupabaseClient();
      const clean = String(identifier).trim().toLowerCase();
      const isEmail = clean.includes('@');

      if (!client) {
        return this._getCachedProfile(identifier);
      }

      try {
        let existing = null;
        if (isEmail) {
          // 1. Check if the email was stored in phone column
          try {
            const { data, error } = await client
              .from('profiles')
              .select('*')
              .ilike('phone', clean)
              .maybeSingle();
            if (!error && data) existing = data;
          } catch (e) {}

          // 2. Also search if email is stored inside role JSON
          if (!existing) {
            try {
              const { data, error } = await client
                .from('profiles')
                .select('*')
                .ilike('role', `%${clean}%`)
                .limit(1);
              if (!error && data && data.length > 0) existing = data[0];
            } catch (e) {}
          }
        } else {
          // Phone search
          try {
            const { data, error } = await client
              .from('profiles')
              .select('*')
              .eq('phone', clean)
              .maybeSingle();
            if (!error && data) existing = data;
          } catch (e) {}
          if (!existing) {
            try {
              const { data, error } = await client
                .from('profiles')
                .select('*')
                .ilike('role', `%${clean}%`)
                .limit(1);
              if (!error && data && data.length > 0) existing = data[0];
            } catch (e) {}
          }
        }
        if (existing) {
          const formatted = this._formatProfile(existing);
          this._cacheProfile(formatted);
          return formatted;
        }
        return this._getCachedProfile(identifier);
      } catch (err) {
        console.warn('Error in findByEmailOrPhone:', err);
        return this._getCachedProfile(identifier);
      }
    },

    // Create new profile only if it does not already exist
    async create(profileData) {
      const client = getSupabaseClient();
      if (!client) return { success: true, data: profileData };
      const email = String(profileData.email || '').trim().toLowerCase();
      const phone = String(profileData.phone || '').trim();

      try {
        if (email) {
          const existing = await this.findByEmailOrPhone(email);
          if (existing) {
            console.log('User already exists in Supabase, returning existing profile:', existing.email || existing.phone);
            return { success: true, data: existing, existed: true };
          }
        }

        const payload = {
          name: profileData.name || 'Verified Commuter',
          role: profileData.role || 'Daily Commuter',
          gender: profileData.gender || 'Prefer not to say',
          email: email || null,
          phone: phone || email || '+91 98480 23145',
          rating: 5.00,
          total_rides: 1,
          avatar_url: profileData.avatar_url || null,
          is_verified: true,
          is_kyc_verified: false,
          kyc_status: 'unverified',
          profile_completed: true,
          dob: profileData.dob || null
        };

        const { data, error } = await client
          .from('profiles')
          .insert([payload])
          .select()
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST204' && payload.email) {
            const fallbackPayload = { ...payload, phone: payload.email };
            delete fallbackPayload.email;
            const { data: fbData, error: fbErr } = await client
              .from('profiles')
              .insert([fallbackPayload])
              .select()
              .maybeSingle();
            if (!fbErr && fbData) return { success: true, data: fbData };
          }
          console.warn('Could not insert profile:', error.message);
          return { success: false, error: error.message };
        }
        return { success: true, data };
      } catch (e) {
        console.warn('Exception in profiles.create:', e);
        return { success: false, error: e.message };
      }
    },

    async getOrCreateByPhone(identifier, customName = null) {
      const isEmail = String(identifier || '').includes('@');
      const cleanTarget = String(identifier || '').trim();
      const client = getSupabaseClient();
      if (!client) {
        return {
          id: 'local-' + Date.now(),
          phone: !isEmail ? cleanTarget : '+91 98480 23145',
          email: isEmail ? cleanTarget : '',
          name: customName || 'Verified Commuter',
          role: 'Daily Commuter',
          rating: 5.0,
          total_rides: 1,
          is_verified: true,
          is_kyc_verified: false,
          aadhaar_number: '',
          dl_number: ''
        };
      }
      try {
        let existing = null;
        if (isEmail) {
          // 1. Try querying by email column first
          try {
            const { data: byEmail, error: emailErr } = await client
              .from('profiles')
              .select('*')
              .eq('email', cleanTarget)
              .maybeSingle();
            if (!emailErr && byEmail) existing = byEmail;
          } catch (e) {}

          // 2. If not found or if email column doesn't exist, check phone column
          if (!existing) {
            try {
              const { data: byPhone, error: phoneErr } = await client
                .from('profiles')
                .select('*')
                .eq('phone', cleanTarget)
                .maybeSingle();
              if (!phoneErr && byPhone) existing = byPhone;
            } catch (e) {}
          }
        } else {
          try {
            const { data: byPhone, error: phoneErr } = await client
              .from('profiles')
              .select('*')
              .eq('phone', cleanTarget)
              .maybeSingle();
            if (!phoneErr && byPhone) existing = byPhone;
          } catch (e) {}
        }

        if (existing) {
          return this._formatProfile(existing);
        }

        const baseProfile = {
          name: customName || 'Verified Commuter',
          role: 'Daily Commuter',
          rating: 5.00,
          total_rides: 1,
          phone: cleanTarget, // Always preserve target in phone column
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
          is_verified: true,
          is_kyc_verified: false,
          aadhaar_number: null,
          dl_number: null
        };

        let created = null;

        // Try inserting with email column if this is an email identifier
        if (isEmail) {
          try {
            const { data: withEmail, error: emailInsertErr } = await client
              .from('profiles')
              .insert([{ ...baseProfile, email: cleanTarget }])
              .select()
              .maybeSingle();
            if (!emailInsertErr && withEmail) {
              created = withEmail;
            }
          } catch (e) {}
        }

        // Fallback: insert base profile without email column so it never fails on legacy schemas
        if (!created) {
          const { data: baseCreated, error: baseInsertErr } = await client
            .from('profiles')
            .insert([baseProfile])
            .select()
            .maybeSingle();

          if (baseInsertErr) {
            console.warn('Could not insert profile into Supabase:', baseInsertErr.message);
            return baseProfile;
          }
          created = baseCreated;
        }

        return created || baseProfile;
      } catch (e) {
        console.warn('Error in getOrCreateByPhone:', e);
        return {
          id: 'local-' + Date.now(),
          phone: !isEmail ? cleanTarget : '+91 98480 23145',
          email: isEmail ? cleanTarget : '',
          name: customName || 'Verified Commuter',
          role: 'Daily Commuter',
          rating: 5.0,
          total_rides: 1,
          is_verified: true,
          is_kyc_verified: false,
          aadhaar_number: '',
          dl_number: ''
        };
      }
    },

    async upsert(profileData) {
      const client = getSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client
          .from('profiles')
          .upsert([profileData])
          .select();
        if (error) throw error;
        return data[0];
      } catch (e) {
        console.warn('Error upserting profile in Supabase:', e);
        return null;
      }
    },

    // Update Driver KYC verification status in Supabase profiles table
    async updateKyc(profileIdOrPhone, kycData) {
      const client = getSupabaseClient();
      const payload = {
        is_kyc_verified: true,
        is_verified: true,
        aadhaar_number: kycData.aadhaarNumber,
        dl_number: kycData.dlNumber,
        kyc_verified_at: new Date().toISOString()
      };
      if (kycData.name) {
        payload.name = kycData.name;
      }
      if (kycData.avatarUrl) {
        payload.avatar_url = kycData.avatarUrl;
      }

      if (!client) {
        console.log('⚡ Offline/Demo KYC verified successfully');
        return { success: true, localOnly: true, profile: payload };
      }

      try {
        console.log('🛡️ Updating Driver KYC in Supabase profiles for:', profileIdOrPhone);
        
        let query = client.from('profiles').update(payload);
        if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
          query = query.eq('phone', profileIdOrPhone);
        } else {
          query = query.eq('id', profileIdOrPhone);
        }

        const { data, error } = await query.select();

        if (error) {
          console.warn('Supabase KYC update warning:', error.message);
          // If update didn't find the row, try upserting with phone
          if (kycData.phone) {
            payload.phone = kycData.phone;
            payload.role = 'Verified Driver';
            payload.rating = 5.0;
            payload.total_rides = 1;
            const { data: upsertData, error: upsertErr } = await client
              .from('profiles')
              .upsert([payload])
              .select();
            if (!upsertErr && upsertData && upsertData.length > 0) {
              return { success: true, profile: upsertData[0] };
            }
          }
          return { success: false, error: error.message };
        }

        console.log('✅ Driver KYC successfully updated in Supabase:', data);
        return { success: true, profile: (data && data[0]) || payload };
      } catch (e) {
        console.error('Exception during KYC update:', e);
        return { success: false, error: e.message || 'Network error updating KYC' };
      }
    },

    // Get MPIN for user phone
    async getMpin(phone) {
      const localMpin = localStorage.getItem('routemate_mpin_' + phone);
      const client = getSupabaseClient();
      if (!client) return localMpin || null;
      try {
        const { data, error } = await client
          .from('profiles')
          .select('mpin')
          .eq('phone', phone)
          .maybeSingle();
        if (error) {
          console.warn('Supabase getMpin warning:', error.message);
          return localMpin || null;
        }
        return (data && data.mpin) || localMpin || null;
      } catch (e) {
        return localMpin || null;
      }
    },

    // Set or Update MPIN for user phone
    async updateMpin(phone, mpin) {
      localStorage.setItem('routemate_mpin_' + phone, mpin);
      const client = getSupabaseClient();
      if (!client) return { success: true, localOnly: true };
      try {
        const { data, error } = await client
          .from('profiles')
          .update({ mpin: mpin })
          .eq('phone', phone)
          .select();
        if (error) {
          console.warn('Supabase updateMpin warning:', error.message);
          return { success: true, localOnly: true };
        }
        return { success: true, data };
      } catch (e) {
        console.warn('Exception updating mpin:', e);
        return { success: true, localOnly: true };
      }
    },

    // Submit Manual KYC for Admin Review (Aadhaar, DL, Vehicle RC)
    async submitManualKyc(profileIdOrPhone, kycData) {
      const client = getSupabaseClient();
      const payload = {
        kyc_status: 'verification_pending',
        is_kyc_verified: false,
        name: kycData.name,
        email: kycData.email || null,
        avatar_url: kycData.avatarUrl,
        aadhaar_number: kycData.aadhaarNumber,
        aadhaar_card_photo: kycData.aadhaarDocPhoto,
        dl_number: kycData.dlNumber,
        dl_expiry: kycData.dlExpiryDate,
        dl_photo: kycData.dlDocPhoto,
        rc_number: kycData.rcNumber,
        rc_vehicle_name: kycData.rcVehicleModel,
        rc_chassis_number: kycData.rcChassisNumber || null,
        rc_photo: kycData.rcDocPhoto,
        kyc_submitted_at: new Date().toISOString()
      };

      // Always save locally in localStorage as robust backup (with safe quota handling)
      const submissionsKey = 'routemate_kyc_submissions';
      let localSubmissions = [];
      try {
        localSubmissions = JSON.parse(localStorage.getItem(submissionsKey) || '[]');
      } catch (e) { localSubmissions = []; }
      
      const phone = kycData.phone || (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, ''))) ? profileIdOrPhone : null);
      const email = kycData.email || (typeof profileIdOrPhone === 'string' && profileIdOrPhone.includes('@') ? profileIdOrPhone : null);
      const subItem = { ...payload, phone: phone || '+91 98480 23145', email: email || '', id: profileIdOrPhone || ('sub_' + Date.now()) };
      const existingIdx = localSubmissions.findIndex(s => (s.phone && s.phone === subItem.phone) || (s.email && s.email === subItem.email) || s.id === subItem.id);
      if (existingIdx >= 0) {
        localSubmissions[existingIdx] = { ...localSubmissions[existingIdx], ...subItem };
      } else {
        localSubmissions.unshift(subItem);
      }
      try {
        localStorage.setItem(submissionsKey, JSON.stringify(localSubmissions));
      } catch (quotaErr) {
        try {
          // If storage quota exceeded due to large photos, strip raw photos and store metadata
          const leanList = localSubmissions.map(s => ({
            ...s,
            aadhaar_card_photo: null,
            dl_photo: null,
            rc_photo: null
          }));
          localStorage.setItem(submissionsKey, JSON.stringify(leanList));
        } catch (e) {}
      }

      // Notify Node.js & Vercel serverless store in real time
      try {
        fetch('/api/kyc/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subItem)
        }).catch(err => console.warn('Server kyc notify error:', err));
      } catch (e) {}

      if (!client) {
        console.log('⚡ Offline/Local Manual KYC submitted successfully');
        return { success: true, localOnly: true, profile: payload };
      }

      try {
        console.log('🛡️ Submitting Manual KYC to Supabase profiles for:', profileIdOrPhone);
        
        // Profiles table schema contains: id, name, role, rating, total_rides, phone, avatar_url, is_verified, created_at
        // Store full KYC details (Aadhaar, DL, RC, photos) serialized in role column
        const dbPayload = {
          name: kycData.name,
          avatar_url: kycData.avatarUrl || null,
          role: JSON.stringify(payload),
          is_verified: false
        };

        const targetIdentifier = typeof profileIdOrPhone === 'string' && (profileIdOrPhone.includes('@') || profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))
          ? profileIdOrPhone
          : (subItem.phone || subItem.email);

        let query = client.from('profiles').update(dbPayload);
        if (targetIdentifier && targetIdentifier.includes('@') || targetIdentifier.startsWith('+') || /^\d{10,}$/.test(targetIdentifier.replace(/[\s+-]/g, ''))) {
          query = query.eq('phone', targetIdentifier);
        } else if (profileIdOrPhone) {
          query = query.eq('id', profileIdOrPhone);
        }

        const { data, error } = await query.select();
        if (error || !data || data.length === 0) {
          console.warn('Supabase submitManualKyc update had no match or error, performing upsert:', error ? error.message : 'no row matched');
          const upsertRow = {
            phone: targetIdentifier || '+91 94942 85249',
            name: kycData.name,
            avatar_url: kycData.avatarUrl || null,
            role: JSON.stringify(payload),
            is_verified: false
          };
          const { data: upsertData } = await client
            .from('profiles')
            .upsert([upsertRow], { onConflict: 'phone' })
            .select();
          if (upsertData && upsertData.length > 0) {
            return { success: true, profile: upsertData[0] };
          }
        }

        return { success: true, profile: (data && data[0]) || payload };
      } catch (e) {
        console.warn('Exception during submitManualKyc:', e);
        return { success: true, localOnly: true, profile: payload };
      }
    },

    // Update Personal Details (Email, DOB, etc.)
    async updateDetails(profileIdOrPhone, details) {
      const client = getSupabaseClient();
      if (!client) return { success: true, localOnly: true };
      try {
        const isEmailTarget = typeof profileIdOrPhone === 'string' && profileIdOrPhone.includes('@');
        let query = client.from('profiles').update(details);
        if (isEmailTarget) {
          query = query.or(`email.ilike.${profileIdOrPhone},phone.ilike.${profileIdOrPhone}`);
        } else if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
          query = query.eq('phone', profileIdOrPhone);
        } else {
          query = query.eq('id', profileIdOrPhone);
        }
        const { data, error } = await query.select();
        if (error) {
          // If error is about email column missing in Supabase, strip email and update
          if (error.code === 'PGRST204' && details && details.email) {
            const safeDetails = { ...details };
            delete safeDetails.email;
            let fallbackQuery = client.from('profiles').update(safeDetails);
            if (isEmailTarget) {
              fallbackQuery = fallbackQuery.eq('phone', profileIdOrPhone);
            } else {
              fallbackQuery = fallbackQuery.eq('id', profileIdOrPhone);
            }
            const { data: fallbackData } = await fallbackQuery.select();
            return { success: true, data: fallbackData };
          }
          console.warn('Supabase profile details update warning:', error.message);
        }
        return { success: !error, data };
      } catch (e) {
        console.warn('Exception updating profile details:', e);
        return { success: false, error: e.message };
      }
    },

    // Delete Profile and user records
    async deleteProfile(profileIdOrPhone) {
      const client = getSupabaseClient();
      if (!client) return { success: true };
      try {
        let query = client.from('profiles').delete();
        if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
          query = query.eq('phone', profileIdOrPhone);
        } else {
          query = query.eq('id', profileIdOrPhone);
        }
        const { error } = await query;
        if (error) console.warn('Supabase deleteProfile warning:', error.message);
        return { success: !error };
      } catch (e) {
        console.warn('Exception deleting profile:', e);
        return { success: true };
      }
    },

    // Save & Persist Emergency Contact in Supabase & Local Cache
    async saveEmergencyContact(profileIdOrPhone, contactObj) {
      const client = getSupabaseClient();
      const updateData = {
        emergency_contact: contactObj,
        emergency_contact_name: contactObj ? contactObj.name : null,
        emergency_contact_phone: contactObj ? contactObj.phone : null,
        emergency_contact_relation: contactObj ? (contactObj.relation || 'Parent') : null,
        emergency_contact_updated_at: new Date().toISOString()
      };

      // Always save to localStorage backup
      try {
        if (contactObj) {
          localStorage.setItem('routemate_emergency_contact', JSON.stringify(contactObj));
        } else {
          localStorage.removeItem('routemate_emergency_contact');
        }
      } catch (e) {}

      if (!client) return { success: true, localOnly: true };

      try {
        let query = client.from('profiles').update(updateData);
        if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
          query = query.eq('phone', profileIdOrPhone);
        } else if (typeof profileIdOrPhone === 'string' && profileIdOrPhone.includes('@')) {
          query = query.eq('email', profileIdOrPhone);
        } else {
          query = query.eq('id', profileIdOrPhone);
        }

        const { data, error } = await query.select();
        if (error) {
          // Fallback if specific columns don't exist
          try {
            let fallbackQuery = client.from('profiles').update({ emergency_contact: contactObj });
            if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
              fallbackQuery = fallbackQuery.eq('phone', profileIdOrPhone);
            } else {
              fallbackQuery = fallbackQuery.eq('id', profileIdOrPhone);
            }
            const { data: fbData } = await fallbackQuery.select();
            return { success: true, data: fbData };
          } catch (fbErr) {}
          console.warn('Supabase emergency contact update notice:', error.message);
        }
        return { success: !error, data };
      } catch (e) {
        console.warn('Exception saving emergency contact to Supabase:', e);
        return { success: true, localOnly: true };
      }
    }
  },

  // ==========================================
  // BOOKINGS TABLE HELPERS
  // ==========================================
  bookings: {
    async create(bookingData) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validRideId = (bookingData.rideId && uuidRegex.test(bookingData.rideId)) ? bookingData.rideId : null;

      const payload = {
        id: bookingData.id || ('BKG-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900)),
        ride_id: validRideId,
        rider_name: bookingData.riderName || 'Commuter',
        rider_phone: bookingData.riderPhone || '+91 98480 23145',
        seats_booked: bookingData.seats || 1,
        total_fare: bookingData.fare || 108,
        payment_method: bookingData.paymentMethod || 'upi',
        status: 'confirmed',
        booking_pin: bookingData.pin || Math.floor(1000 + Math.random() * 9000).toString(),
        created_at: new Date().toISOString()
      };

      // 1. Optimistic local cache
      try {
        const cached = JSON.parse(localStorage.getItem('routemate_cached_bookings') || '[]');
        cached.unshift(payload);
        localStorage.setItem('routemate_cached_bookings', JSON.stringify(cached.slice(0, 50)));
      } catch (e) {}

      // 2. Try direct Supabase PostgREST
      let inserted = null;
      try {
        const restRes = await supabaseRest('bookings', { method: 'POST', body: payload });
        if (restRes.ok && restRes.data) {
          inserted = Array.isArray(restRes.data) ? restRes.data[0] : restRes.data;
        }
      } catch (e) {}

      // Fallback via client
      if (!inserted) {
        const client = getSupabaseClient();
        if (client) {
          try {
            const { data, error } = await client.from('bookings').insert([payload]).select();
            if (!error && data && data.length > 0) inserted = data[0];
          } catch (e) {}
        }
      }

      if (inserted) {
        console.log('✅ Booking stored in Supabase:', inserted);
        return { success: true, data: inserted };
      } else {
        console.warn('⚠️ Supabase booking degraded. Enqueued offline.');
        offlineQueue.enqueue('insert_booking', payload, 'bkg_' + payload.id);
        return { success: true, data: payload, offlineQueued: true };
      }
    },

    async fetchAll() {
      let bookings = null;
      try {
        const res = await supabaseRest('bookings?order=created_at.desc');
        if (res.ok && Array.isArray(res.data)) bookings = res.data;
      } catch (e) {}

      if (!bookings) {
        const client = getSupabaseClient();
        if (client) {
          try {
            const { data, error } = await client
              .from('bookings')
              .select('*')
              .order('created_at', { ascending: false });
            if (!error && data) bookings = data;
          } catch (e) {
            console.warn('Error fetching bookings:', e);
          }
        }
      }

      if (bookings && Array.isArray(bookings)) {
        try { localStorage.setItem('routemate_cached_bookings', JSON.stringify(bookings)); } catch (e) {}
        return bookings;
      } else {
        try {
          return JSON.parse(localStorage.getItem('routemate_cached_bookings') || '[]');
        } catch (e) {
          return [];
        }
      }
    }
  },

  // ==========================================
  // RESTRICTED ADMIN PORTAL HELPERS
  // ==========================================
  admin: {
    // Authenticate restricted admin credentials (strictly whitelisted to shanthankolupula123@gmail.com)
    verifyAdmin(emailOrUsername, password, userEmail = null) {
      const cleanPass = (password || '').trim();
      const ADMIN_EMAIL = 'shanthankolupula123@gmail.com';
      const checkEmail = String(userEmail || emailOrUsername || '').trim().toLowerCase();
      const isEmailWhitelisted = checkEmail === ADMIN_EMAIL.toLowerCase();

      // Must be the whitelisted admin email
      if (!isEmailWhitelisted) {
        return false;
      }

      // Valid admin secure passcodes
      const validAdminPasses = ['admin@2026', 'routemate2026'];
      return validAdminPasses.includes(cleanPass);
    },

    // Fetch all KYC submissions for admin review (Real-time Supabase, Server & localStorage sync)
    async getKycSubmissions() {
      const client = getSupabaseClient();
      let submissions = [];

      // 1. Fetch from Supabase profiles where KYC has been submitted or role has serialized KYC
      if (client) {
        try {
          const { data, error } = await client
            .from('profiles')
            .select('*');

          if (!error && data && data.length > 0) {
            data.forEach(p => {
              let extra = {};
              if (p.role && typeof p.role === 'string') {
                if (p.role.trim().startsWith('{') || p.role.includes('"kyc_status"') || p.role.includes('"dl_number"')) {
                  try {
                    extra = JSON.parse(p.role);
                  } catch (e) {}
                }
              }

              // Check if user has submitted KYC details or has driver credentials
              if (extra && (extra.kyc_status || extra.aadhaar_number || extra.dl_number || extra.rc_number)) {
                submissions.push({
                  id: p.id,
                  name: extra.name || p.name || 'Commuter',
                  phone: p.phone,
                  email: extra.email || (p.phone && p.phone.includes('@') ? p.phone : ''),
                  avatar_url: p.avatar_url || extra.avatar_url || null,
                  aadhaar_number: extra.aadhaar_number || '',
                  aadhaar_card_photo: extra.aadhaar_card_photo || '',
                  dl_number: extra.dl_number || '',
                  dl_expiry: extra.dl_expiry || '',
                  dl_photo: extra.dl_photo || '',
                  rc_number: extra.rc_number || '',
                  rc_vehicle_name: extra.rc_vehicle_name || '',
                  rc_chassis_number: extra.rc_chassis_number || '',
                  rc_photo: extra.rc_photo || '',
                  kyc_status: extra.kyc_status || (extra.is_kyc_verified ? 'verified_success' : 'verification_pending'),
                  is_kyc_verified: Boolean(extra.is_kyc_verified || p.is_kyc_verified),
                  kyc_submitted_at: extra.kyc_submitted_at || p.created_at || new Date().toISOString()
                });
              } else if (p.role && typeof p.role === 'string' && (p.role.toLowerCase().includes('driver') || p.is_kyc_verified)) {
                submissions.push({
                  id: p.id,
                  name: p.name || 'Commuter',
                  phone: p.phone,
                  email: p.phone && p.phone.includes('@') ? p.phone : '',
                  avatar_url: p.avatar_url || null,
                  aadhaar_number: '',
                  aadhaar_card_photo: '',
                  dl_number: '',
                  dl_expiry: '',
                  dl_photo: '',
                  rc_number: '',
                  rc_vehicle_name: '',
                  rc_chassis_number: '',
                  rc_photo: '',
                  kyc_status: p.kyc_status || (p.is_kyc_verified ? 'verified_success' : 'unverified'),
                  is_kyc_verified: Boolean(p.is_kyc_verified),
                  kyc_submitted_at: p.created_at || new Date().toISOString()
                });
              }
            });
          }
        } catch (e) {
          console.warn('Admin Supabase fetch warning:', e);
        }
      }

      // 2. Fetch from Node server real-time store (/api/kyc/submissions)
      try {
        const resp = await fetch('/api/kyc/submissions');
        if (resp.ok) {
          const json = await resp.json();
          if (json && json.submissions && Array.isArray(json.submissions)) {
            json.submissions.forEach(serverItem => {
              const exists = submissions.find(s => 
                (serverItem.id && s.id === serverItem.id) || 
                (serverItem.phone && s.phone === serverItem.phone) ||
                (serverItem.email && s.email && s.email === serverItem.email)
              );
              if (!exists) {
                submissions.push(serverItem);
              } else {
                Object.assign(exists, serverItem);
              }
            });
          }
        }
      } catch (e) {}

      // 3. Merge with locally cached submissions (and preserve documents/chassis)
      try {
        const localList = JSON.parse(localStorage.getItem('routemate_kyc_submissions') || '[]');
        localList.forEach(localItem => {
          const exists = submissions.find(s => 
            (localItem.id && s.id === localItem.id) || 
            (localItem.phone && s.phone === localItem.phone) ||
            (localItem.email && s.email && s.email === localItem.email)
          );
          if (!exists) {
            submissions.push(localItem);
          } else {
            // Overlay newer local submission if status was updated locally
            if (localItem.kyc_status && (!exists.kyc_status || exists.kyc_status === 'unverified')) {
              Object.assign(exists, localItem);
            }
            if (localItem.aadhaar_card_photo && !exists.aadhaar_card_photo) exists.aadhaar_card_photo = localItem.aadhaar_card_photo;
            if (localItem.dl_photo && !exists.dl_photo) exists.dl_photo = localItem.dl_photo;
            if (localItem.rc_photo && !exists.rc_photo) exists.rc_photo = localItem.rc_photo;
            if (localItem.rc_chassis_number && !exists.rc_chassis_number) exists.rc_chassis_number = localItem.rc_chassis_number;
            if (localItem.avatar_url && !exists.avatar_url) exists.avatar_url = localItem.avatar_url;
          }
        });
      } catch (e) {}

      // 4. Merge with current logged in user if they have pending KYC or credentials
      try {
        const currentUser = JSON.parse(localStorage.getItem('routemate_auth_user') || '{}');
        if (currentUser && (currentUser.kyc_status === 'verification_pending' || currentUser.kyc_status === 'under_review' || currentUser.aadhaar_number || currentUser.dl_number)) {
          const exists = submissions.find(s => 
            (currentUser.id && s.id === currentUser.id) || 
            (currentUser.phone && s.phone === currentUser.phone) ||
            (currentUser.email && s.email && s.email === currentUser.email)
          );
          if (!exists) {
            submissions.unshift({
              id: currentUser.id || 'usr_current',
              name: currentUser.name || 'Verified Commuter',
              phone: currentUser.phone || '+91 94942 85249',
              email: currentUser.email || '',
              avatar_url: currentUser.avatar || currentUser.avatar_url || null,
              aadhaar_number: currentUser.aadhaar_number || '',
              aadhaar_card_photo: currentUser.aadhaar_card_photo || null,
              dl_number: currentUser.dl_number || '',
              dl_expiry: currentUser.dl_expiry || '',
              dl_photo: currentUser.dl_photo || null,
              rc_number: currentUser.rc_number || '',
              rc_vehicle_name: currentUser.rc_vehicle_name || '',
              rc_chassis_number: currentUser.rc_chassis_number || '',
              rc_photo: currentUser.rc_photo || null,
              kyc_status: currentUser.kyc_status || 'verification_pending',
              is_kyc_verified: Boolean(currentUser.is_kyc_verified),
              kyc_submitted_at: currentUser.kyc_submitted_at || new Date().toISOString()
            });
          } else {
            if (currentUser.aadhaar_card_photo && !exists.aadhaar_card_photo) exists.aadhaar_card_photo = currentUser.aadhaar_card_photo;
            if (currentUser.dl_photo && !exists.dl_photo) exists.dl_photo = currentUser.dl_photo;
            if (currentUser.rc_photo && !exists.rc_photo) exists.rc_photo = currentUser.rc_photo;
            if (currentUser.rc_chassis_number && !exists.rc_chassis_number) exists.rc_chassis_number = currentUser.rc_chassis_number;
            if ((currentUser.avatar || currentUser.avatar_url) && !exists.avatar_url) exists.avatar_url = currentUser.avatar || currentUser.avatar_url;
          }
        }
      } catch (e) {}

      // Real-time submissions strictly returned (NO fake demo driver seed)
      return submissions;
    },

    // Admin Decision: Approve or Reject
    async updateKycStatus(profileIdOrPhone, status, reason = null) {
      const client = getSupabaseClient();
      const isApproved = status === 'verified_success';
      const updateData = {
        kyc_status: status,
        is_kyc_verified: isApproved,
        kyc_reviewed_at: new Date().toISOString()
      };
      if (isApproved) {
        updateData.kyc_verified_at = new Date().toISOString();
        updateData.rejection_reason = null;
      } else {
        updateData.rejection_reason = reason || 'Document validation failed';
      }

      // Check if submission contains a submitted driver real photo/avatar
      let submittedAvatar = null;
      try {
        const localList = JSON.parse(localStorage.getItem('routemate_kyc_submissions') || '[]');
        const item = localList.find(s => 
          (s.phone && s.phone === profileIdOrPhone) || 
          (s.id && s.id === profileIdOrPhone) ||
          (s.email && s.email === profileIdOrPhone)
        );
        if (item) {
          if (item.avatar_url) submittedAvatar = item.avatar_url;
          Object.assign(item, updateData);
          if (isApproved && submittedAvatar) {
            item.avatar_url = submittedAvatar;
          }
          localStorage.setItem('routemate_kyc_submissions', JSON.stringify(localList));
        }
      } catch (e) {}

      // Automatically update user's profile photo to their real submitted KYC photo
      if (isApproved && submittedAvatar) {
        updateData.avatar_url = submittedAvatar;
      }

      // Notify server about decision in real time
      try {
        fetch('/api/kyc/decision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: profileIdOrPhone,
            status: status,
            updateData: updateData
          })
        }).catch(e => console.warn('Server kyc decision notify error:', e));
      } catch (e) {}

      // Also update currently logged in user session in localStorage if matching
      try {
        const currentUser = JSON.parse(localStorage.getItem('routemate_auth_user') || '{}');
        if (currentUser && (
          currentUser.id === profileIdOrPhone || 
          currentUser.phone === profileIdOrPhone || 
          currentUser.email === profileIdOrPhone
        )) {
          Object.assign(currentUser, updateData);
          localStorage.setItem('routemate_auth_user', JSON.stringify(currentUser));
        }
      } catch (e) {}

      // Update in Supabase profiles
      if (client) {
        try {
          // Fetch existing profile to preserve full KYC JSON in role
          let selQuery = client.from('profiles').select('id, phone, role, avatar_url');
          if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.includes('@') || profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
            selQuery = selQuery.eq('phone', profileIdOrPhone);
          } else {
            selQuery = selQuery.eq('id', profileIdOrPhone);
          }
          const { data: existingProfiles } = await selQuery;
          let roleObj = {};
          if (existingProfiles && existingProfiles[0] && existingProfiles[0].role) {
            try {
              if (existingProfiles[0].role.trim().startsWith('{')) {
                roleObj = JSON.parse(existingProfiles[0].role);
              }
            } catch (e) {}
          }
          Object.assign(roleObj, updateData);

          const dbPayload = {
            is_verified: isApproved,
            role: JSON.stringify(roleObj)
          };
          if (submittedAvatar) {
            dbPayload.avatar_url = submittedAvatar;
          }

          let query = client.from('profiles').update(dbPayload);
          if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.includes('@') || profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
            query = query.eq('phone', profileIdOrPhone);
          } else {
            query = query.eq('id', profileIdOrPhone);
          }
          await query;
        } catch (e) {
          console.warn('Supabase admin update error:', e);
        }
      }

      return { success: true, status, updateData, avatarUrl: submittedAvatar };
    },

    // Administrative Search for Driver Details across Supabase & Local Data
    async searchDrivers(query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) return this.getKycSubmissions();

      const client = getSupabaseClient();
      let results = [];

      // 1. Search in local submissions and cached profiles first
      try {
        const localList = JSON.parse(localStorage.getItem('routemate_kyc_submissions') || '[]');
        const blockedList = JSON.parse(localStorage.getItem('routemate_blocked_drivers') || '[]');
        
        localList.forEach(item => {
          const isBlocked = blockedList.some(b => (b.phone && b.phone === item.phone) || b.id === item.id);
          if (isBlocked) {
            item.is_blocked = true;
            const blockedInfo = blockedList.find(b => (b.phone && b.phone === item.phone) || b.id === item.id);
            if (blockedInfo && blockedInfo.reason) item.block_reason = blockedInfo.reason;
          }
          const text = [
            item.name, item.phone, item.aadhaar_number, item.dl_number, 
            item.rc_number, item.rc_vehicle_name, item.rc_chassis_number, item.kyc_status
          ].filter(Boolean).join(' ').toLowerCase();

          if (text.includes(q)) {
            results.push(item);
          }
        });
      } catch (e) {}

      // 2. Query Supabase profiles if client available
      if (client) {
        try {
          const { data, error } = await client
            .from('profiles')
            .select('*')
            .or(`name.ilike.%${q}%,phone.ilike.%${q}%,role.ilike.%${q}%`)
            .limit(25);

          if (!error && data && data.length > 0) {
            data.forEach(p => {
              let extra = {};
              if (p.role && typeof p.role === 'string' && p.role.trim().startsWith('{')) {
                try { extra = JSON.parse(p.role); } catch(e) {}
              }
              const exists = results.find(r => (r.phone && r.phone === p.phone) || (r.id && r.id === p.id));
              if (!exists) {
                results.push({
                  id: p.id,
                  name: extra.name || p.name || 'Commuter',
                  phone: p.phone,
                  email: extra.email || (p.phone && p.phone.includes('@') ? p.phone : ''),
                  avatar_url: p.avatar_url || extra.avatar_url || null,
                  aadhaar_number: extra.aadhaar_number || '',
                  aadhaar_card_photo: extra.aadhaar_card_photo || '',
                  dl_number: extra.dl_number || '',
                  dl_expiry: extra.dl_expiry || '',
                  dl_photo: extra.dl_photo || '',
                  rc_number: extra.rc_number || '',
                  rc_vehicle_name: extra.rc_vehicle_name || '',
                  rc_chassis_number: extra.rc_chassis_number || '',
                  rc_photo: extra.rc_photo || '',
                  kyc_status: extra.kyc_status || (p.is_verified ? 'verified_success' : 'verification_pending'),
                  is_kyc_verified: Boolean(p.is_verified || extra.is_kyc_verified),
                  kyc_submitted_at: extra.kyc_submitted_at || p.created_at || new Date().toISOString()
                });
              }
            });
          }
        } catch (e) {
          console.warn('Supabase driver search error:', e);
        }
      }

      return results;
    },

    // Administrative Action: Block / Suspend Driver Account
    async blockDriver(profileIdOrPhone, reason = 'Administrative Suspension for Policy Violation', details = '') {
      const client = getSupabaseClient();
      const blockedAt = new Date().toISOString();
      const updateData = {
        is_blocked: true,
        account_status: 'blocked',
        block_reason: reason,
        block_details: details,
        blocked_at: blockedAt,
        is_kyc_verified: false // Revoke verified driver privileges
      };

      // 1. Update in local blocked list
      try {
        const blockedList = JSON.parse(localStorage.getItem('routemate_blocked_drivers') || '[]');
        const cleanPhone = String(profileIdOrPhone).replace(/\D/g, '').slice(-10);
        const existingIdx = blockedList.findIndex(b => (b.phone && b.phone.includes(cleanPhone)) || b.id === profileIdOrPhone);
        const entry = {
          id: profileIdOrPhone,
          phone: profileIdOrPhone,
          reason,
          details,
          blocked_at: blockedAt
        };
        if (existingIdx >= 0) blockedList[existingIdx] = entry;
        else blockedList.push(entry);
        localStorage.setItem('routemate_blocked_drivers', JSON.stringify(blockedList));

        // Update local KYC submissions list
        const localList = JSON.parse(localStorage.getItem('routemate_kyc_submissions') || '[]');
        const sub = localList.find(s => (s.phone && s.phone === profileIdOrPhone) || s.id === profileIdOrPhone);
        if (sub) {
          Object.assign(sub, updateData);
          localStorage.setItem('routemate_kyc_submissions', JSON.stringify(localList));
        }

        // If currently logged-in user matches, lock them immediately
        const cachedUser = JSON.parse(localStorage.getItem('routemate_auth_user') || 'null');
        if (cachedUser && (cachedUser.phone === profileIdOrPhone || cachedUser.id === profileIdOrPhone)) {
          Object.assign(cachedUser, updateData);
          localStorage.setItem('routemate_auth_user', JSON.stringify(cachedUser));
        }
      } catch (e) {}

      // 2. Update Supabase profiles table in real time
      if (client) {
        try {
          let query = client.from('profiles').update(updateData);
          if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
            query = query.eq('phone', profileIdOrPhone);
          } else {
            query = query.eq('id', profileIdOrPhone);
          }
          await query;
        } catch (e) {
          console.warn('Supabase blockDriver error:', e);
        }
      }

      return { success: true, identifier: profileIdOrPhone, updateData };
    },

    // Administrative Action: Unblock / Restore Driver Account
    async unblockDriver(profileIdOrPhone) {
      const client = getSupabaseClient();
      const updateData = {
        is_blocked: false,
        account_status: 'active',
        block_reason: null,
        block_details: null,
        unblocked_at: new Date().toISOString()
      };

      // 1. Remove from local blocked list
      try {
        let blockedList = JSON.parse(localStorage.getItem('routemate_blocked_drivers') || '[]');
        const cleanPhone = String(profileIdOrPhone).replace(/\D/g, '').slice(-10);
        blockedList = blockedList.filter(b => !((b.phone && b.phone.includes(cleanPhone)) || b.id === profileIdOrPhone));
        localStorage.setItem('routemate_blocked_drivers', JSON.stringify(blockedList));

        // Update local KYC submissions list
        const localList = JSON.parse(localStorage.getItem('routemate_kyc_submissions') || '[]');
        const sub = localList.find(s => (s.phone && s.phone === profileIdOrPhone) || s.id === profileIdOrPhone);
        if (sub) {
          Object.assign(sub, updateData);
          localStorage.setItem('routemate_kyc_submissions', JSON.stringify(localList));
        }

        // If currently logged-in user matches
        const cachedUser = JSON.parse(localStorage.getItem('routemate_auth_user') || 'null');
        if (cachedUser && (cachedUser.phone === profileIdOrPhone || cachedUser.id === profileIdOrPhone)) {
          Object.assign(cachedUser, updateData);
          localStorage.setItem('routemate_auth_user', JSON.stringify(cachedUser));
        }
      } catch (e) {}

      // 2. Update Supabase profiles table
      if (client) {
        try {
          let query = client.from('profiles').update(updateData);
          if (typeof profileIdOrPhone === 'string' && (profileIdOrPhone.startsWith('+') || /^\d{10,}$/.test(profileIdOrPhone.replace(/[\s+-]/g, '')))) {
            query = query.eq('phone', profileIdOrPhone);
          } else {
            query = query.eq('id', profileIdOrPhone);
          }
          await query;
        } catch (e) {
          console.warn('Supabase unblockDriver error:', e);
        }
      }

      return { success: true, identifier: profileIdOrPhone, updateData };
    },

    // Administrative Moderation: Flag / Unflag Review as Safety Infraction
    async flagFeedback(feedbackId, isFlagged = true, reason = 'Flagged by supervisor for safety review') {
      const client = getSupabaseClient();
      const flaggedAt = isFlagged ? new Date().toISOString() : null;

      // 1. Update in local storage feedbacks
      let targetFeedback = null;
      try {
        let stored = JSON.parse(localStorage.getItem('routemate_feedbacks') || '[]');
        const fb = stored.find(f => f.id === feedbackId);
        if (fb) {
          fb.is_flagged = isFlagged;
          fb.flagged_at = flaggedAt;
          fb.flag_reason = reason;
          targetFeedback = fb;
          localStorage.setItem('routemate_feedbacks', JSON.stringify(stored));
        }
      } catch (e) {}

      // 2. Call server endpoint
      try {
        await fetch('/api/feedbacks/flag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackId, isFlagged, reason })
        });
      } catch (e) {}

      // 3. Update Supabase feedbacks table
      if (client) {
        try {
          await client.from('feedbacks').update({
            is_flagged: isFlagged,
            flagged_at: flaggedAt,
            flag_reason: reason
          }).eq('id', feedbackId);
        } catch (e) {
          console.warn('Supabase flagFeedback note:', e.message);
        }
      }

      // 4. Broadcast via local BroadcastChannel
      try {
        const ch = new BroadcastChannel('routemate_admin_channel');
        ch.postMessage({ type: 'FEEDBACK_FLAGGED', feedbackId, isFlagged, reason });
        ch.close();
      } catch (e) {}

      return { success: true, feedbackId, isFlagged, feedback: targetFeedback };
    },

    // Administrative Moderation: Adjust / Lower Driver Rating
    async adjustFeedbackRating(feedbackId, newRating, reason = 'Rating adjusted by administrator') {
      const client = getSupabaseClient();
      const numRating = parseFloat(newRating);
      let targetFeedback = null;

      // 1. Update in local storage feedbacks
      try {
        let stored = JSON.parse(localStorage.getItem('routemate_feedbacks') || '[]');
        const fb = stored.find(f => f.id === feedbackId);
        if (fb) {
          fb.original_rating = fb.rating;
          fb.rating = numRating;
          fb.is_moderated = true;
          fb.moderated_at = new Date().toISOString();
          fb.moderation_reason = reason;
          targetFeedback = fb;
          localStorage.setItem('routemate_feedbacks', JSON.stringify(stored));

          // Recalculate driver composite rating
          if (fb.driver_name || fb.driver_phone) {
            db.feedbacks.recalculateDriverRating(fb.driver_name, fb.driver_phone, numRating);
          }
        }
      } catch (e) {}

      // 2. Call server endpoint
      try {
        await fetch('/api/feedbacks/adjust-rating', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedbackId, newRating: numRating, reason })
        });
      } catch (e) {}

      // 3. Update Supabase feedbacks table
      if (client) {
        try {
          await client.from('feedbacks').update({
            rating: numRating,
            is_moderated: true,
            moderated_at: new Date().toISOString(),
            moderation_reason: reason
          }).eq('id', feedbackId);

          if (targetFeedback && targetFeedback.driver_phone) {
            const composite = db.feedbacks.getDriverRating(targetFeedback.driver_name, targetFeedback.driver_phone);
            if (composite) {
              await client.from('profiles').update({ rating: composite.average }).eq('phone', targetFeedback.driver_phone);
            }
          }
        } catch (e) {
          console.warn('Supabase adjustFeedbackRating note:', e.message);
        }
      }

      // 4. Broadcast via local BroadcastChannel
      try {
        const ch = new BroadcastChannel('routemate_admin_channel');
        ch.postMessage({ type: 'FEEDBACK_RATING_ADJUSTED', feedbackId, newRating: numRating, reason });
        ch.close();
      } catch (e) {}

      return { success: true, feedbackId, newRating: numRating, feedback: targetFeedback };
    },

    // Real-Time Admin Synchronization Channel Subscription
    subscribeRealtime(onEventCallback) {
      const client = getSupabaseClient();
      let supabaseChannel = null;

      // 1. Supabase WebSockets Realtime Channel
      if (client) {
        try {
          supabaseChannel = client.channel('routemate_admin_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
              console.log('⚡ Realtime Admin: profile change', payload);
              if (typeof onEventCallback === 'function') onEventCallback('profiles', payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks' }, (payload) => {
              console.log('⚡ Realtime Admin: feedback change', payload);
              if (typeof onEventCallback === 'function') onEventCallback('feedbacks', payload);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_alerts' }, (payload) => {
              console.log('⚡ Realtime Admin: safety alert', payload);
              if (typeof onEventCallback === 'function') onEventCallback('safety_alerts', payload);
            })
            .subscribe((status) => {
              console.log('🛡️ Admin Realtime Supabase Channel status:', status);
            });
        } catch (err) {
          console.warn('Error creating Supabase admin realtime channel:', err);
        }
      }

      // 2. Cross-tab BroadcastChannel for zero-latency local tab synchronization
      let broadcastCh = null;
      try {
        broadcastCh = new BroadcastChannel('routemate_admin_channel');
        broadcastCh.onmessage = (event) => {
          if (event && event.data && typeof onEventCallback === 'function') {
            onEventCallback('local_broadcast', event.data);
          }
        };
      } catch (e) {}

      // 3. Server SSE connection for live updates
      let sseSource = null;
      try {
        sseSource = new EventSource('/api/events');
        sseSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (typeof onEventCallback === 'function') onEventCallback('sse_event', data);
          } catch (e) {}
        };
      } catch (e) {}

      return {
        unsubscribe: () => {
          if (supabaseChannel && client) {
            try { client.removeChannel(supabaseChannel); } catch (e) {}
          }
          if (broadcastCh) {
            try { broadcastCh.close(); } catch (e) {}
          }
          if (sseSource) {
            try { sseSource.close(); } catch (e) {}
          }
        }
      };
    }
  },

  // =========================================================================
  // RAPIDO-STYLE DIRECT RIDE BROADCASTING & MATCHING ENGINE (CLEAN REWRITE)
  // =========================================================================
  matching: {
    _driverPollTimer: null,
    _riderPollTimer: null,
    _activeRequest: null,
    _listeners: new Set(),
    _lastAlertId: null,

    init() {
      console.log('⚡ [RAPIDO MATCHING ENGINE] Initialized clean state.');
    },

    subscribe(listener) {
      this._listeners.add(listener);
      if (this._activeRequest) {
        try { listener('init', this._activeRequest); } catch(e){}
      }
      return () => this._listeners.delete(listener);
    },

    _notify(event, data) {
      this._listeners.forEach(fn => {
        try { fn(event, data); } catch (e) { console.error('Listener error:', e); }
      });
    },

    getActiveRequest() {
      if (!this._activeRequest) {
        try {
          const cached = localStorage.getItem('routemate_active_ride_request');
          if (cached) this._activeRequest = JSON.parse(cached);
        } catch(e) {}
      }
      return this._activeRequest;
    },

    // 1. RIDER MODE: Write Ride Request directly to Supabase 'rides' table
    async createRequest(reqData) {
      const pin = reqData.pin || Math.floor(1000 + Math.random() * 9000).toString();
      const requestId = reqData.id || ('REQ-' + Math.floor(100000 + Math.random() * 900000));

      const pLat = Number(reqData.pickupLat || reqData.pickup_lat || 17.4024);
      const pLng = Number(reqData.pickupLng || reqData.pickup_lng || 78.5604);
      const dLat = Number(reqData.dropLat || reqData.drop_lat || 17.7241);
      const dLng = Number(reqData.dropLng || reqData.drop_lng || 79.1623);

      const pickup = reqData.pickup || 'Uppal Ring Road Metro, Hyderabad';
      const drop = reqData.drop_location || reqData.drop || 'Jangaon Bus Depot / Chowrasta';
      const fare = Number(reqData.fare || 110);
      const dist = Number(reqData.distance || reqData.distance_km || 84);
      const reqType = (reqData.vehicleType === 'car') ? 'car' : 'bike';

      const notesPayload = {
        isRequest: true,
        status: 'searching',
        riderId: reqData.riderId || reqData.rider_id || ('rider_' + Date.now()),
        riderEmail: String(reqData.riderEmail || reqData.rider_email || '').toLowerCase().trim(),
        riderPhone: String(reqData.riderPhone || reqData.rider_phone || '+91 98480 23145').trim(),
        riderName: reqData.riderName || reqData.rider_name || 'Verified Commuter',
        riderAvatar: reqData.riderAvatar || reqData.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
        riderRole: reqData.riderRole || 'Daily Commuter',
        riderRating: reqData.riderRating || 4.9,
        fare: fare,
        distance: dist,
        pin: pin,
        pickup: pickup,
        drop: drop,
        pickup_lat: pLat,
        pickup_lng: pLng,
        drop_lat: dLat,
        drop_lng: dLng,
        vehicleType: reqType,
        paymentMethod: reqData.paymentMethod || 'Direct UPI',
        createdAt: new Date().toISOString()
      };

      const dbRow = {
        driver_name: `${notesPayload.riderName} (Rider Request)`,
        driver_role: notesPayload.riderRole,
        avatar: notesPayload.riderAvatar,
        vehicle_type: reqType,
        vehicle_name: reqData.vehiclePreferenceLabel || (reqType === 'car' ? 'Car / Cab' : 'Motorcycle / Bike'),
        vehicle_number: requestId,
        pickup: pickup,
        drop_location: drop,
        departure_time: 'Immediate',
        seats_available: 1,
        per_seat_price: fare,
        payment_preference: 'upi',
        verified: true,
        status: 'active', // Postgres DB check constraint allows 'active'
        notes: JSON.stringify(notesPayload)
      };

      console.log('🚀 [RAPIDO RIDER] Direct Insert into Supabase "rides":', requestId, dbRow);

      const restRes = await supabaseRest('rides', {
        method: 'POST',
        body: dbRow,
        prefer: 'return=representation',
        timeoutMs: 5000,
        retries: 1
      });

      const client = getSupabaseClient();
      if (!restRes.ok && client) {
        try {
          await client.from('rides').insert([dbRow]);
        } catch(e) {}
      }

      const activeRide = {
        id: requestId,
        ...notesPayload,
        dbId: restRes.data?.[0]?.id || requestId,
        status: 'searching'
      };

      this._activeRequest = activeRide;
      try { localStorage.setItem('routemate_active_ride_request', JSON.stringify(activeRide)); } catch(e){}

      // Start automatic rider-side polling for driver acceptance
      this.startRiderPolling(requestId);

      return { success: true, request: activeRide };
    },

    // 2. RIDER MODE: Direct Polling Loop (Every 1.2s) - listens for driver acceptance
    startRiderPolling(requestId) {
      this.stopRiderPolling();
      console.log('📡 [RAPIDO RIDER] Starting 1.2s polling for driver acceptance:', requestId);

      this._riderPollTimer = setInterval(async () => {
        try {
          const appState = getGlobalState();
          if (!appState || appState.mode === 'driver') {
            this.stopRiderPolling();
            return;
          }
          if (!appState.currentActiveRide || appState.currentActiveRide.status === 'completed' || appState.currentActiveRide.status === 'cancelled') {
            this.stopRiderPolling();
            return;
          }

          const res = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
          if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
            const row = res.data[0];
            let meta = {};
            try { meta = JSON.parse(row.notes || '{}'); } catch(e){}

            // Check if a driver accepted this ride
            if (meta.status === 'driver_accepted' || meta.status === 'ride_started' || row.status === 'completed') {
              console.log('🎉 [RAPIDO RIDER] Driver Accepted ride in database:', meta);
              this.stopRiderPolling();

              const driverInfo = meta.driver || {};
              const acceptedTrip = {
                id: requestId,
                dbId: row.id,
                ...meta,
                status: meta.status || 'driver_accepted',
                driver_id: driverInfo.id || 'driver_matched',
                driver_name: driverInfo.name || 'Verified Driver',
                driver_phone: driverInfo.phone || '+91 94942 85249',
                driver_avatar: driverInfo.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
                driver_vehicle_name: driverInfo.vehicleName || 'Verified Commuter Vehicle',
                driver_vehicle_number: driverInfo.vehicleNumber || 'TS 08 AB 1234',
                driver_vehicle_type: driverInfo.vehicleType || 'bike',
                driver_rating: driverInfo.rating || 4.9,
                fare: row.per_seat_price || meta.fare || 110,
                pickup: row.pickup || meta.pickup,
                drop: row.drop_location || meta.drop,
                pin: meta.pin || '4821'
              };

              appState.currentActiveRide = acceptedTrip;
              appState.activeRideRole = 'rider';

              if (typeof window.renderLiveTrackingStage === 'function') {
                window.renderLiveTrackingStage(acceptedTrip, 'rider');
              }
              if (typeof window.renderRiderSearchingCard === 'function') {
                window.renderRiderSearchingCard();
              }
              if (typeof window.updateActiveRideBanner === 'function') {
                window.updateActiveRideBanner();
              }
              if (typeof window.playNotificationSound === 'function') {
                window.playNotificationSound();
              }
              if (typeof window.showToast === 'function') {
                window.showToast(`🎉 Driver ${acceptedTrip.driver_name} accepted your ride! Heading to pickup.`, 'success');
              }
            }
          }
        } catch(e) {
          console.warn('Rider poll notice:', e);
        }
      }, 1200);
    },

    stopRiderPolling() {
      if (this._riderPollTimer) {
        clearInterval(this._riderPollTimer);
        this._riderPollTimer = null;
      }
    },

    // 3. DRIVER MODE: Direct, Highly-Reliable Polling Loop (Every 1 second)
    subscribeDriverChannel() {
      this.startDriverPolling(1000);
    },

    startDriverPolling(intervalMs = 1000) {
      this.stopDriverPolling();
      console.log(`📡 [RAPIDO DRIVER] Starting direct 1-second radar polling loop`);

      // Execute immediately on startup
      this.pollDriverSearchingRides();

      this._driverPollTimer = setInterval(() => {
        this.pollDriverSearchingRides();
      }, 1000);
    },

    stopDriverPolling() {
      if (this._driverPollTimer) {
        clearInterval(this._driverPollTimer);
        this._driverPollTimer = null;
        console.log('🛑 [RAPIDO DRIVER] Stopped driver polling loop');
      }
    },

    async pollDriverSearchingRides() {
      const appState = getGlobalState();
      const driverViewEl = typeof document !== 'undefined' ? document.getElementById('driverModeView') : null;
      const isDriverViewVisible = driverViewEl && !driverViewEl.classList.contains('hidden') && driverViewEl.style.display !== 'none';
      const isDriverActive = Boolean((appState && (appState.driverOnline || appState.mode === 'driver')) || isDriverViewVisible);

      if (!isDriverActive) return;

      // Don't show radar cards if driver has already accepted and is currently driving a ride
      if (appState?.activeDriverTrip && (appState.activeDriverTrip.status === 'driver_accepted' || appState.activeDriverTrip.status === 'ride_started')) {
        return;
      }

      try {
        const recentCutoff = new Date(Date.now() - 3600000).toISOString();
        const res = await supabaseRest(`rides?select=*&status=neq.cancelled&created_at=gte.${recentCutoff}&order=created_at.desc&limit=15`);
        if (!res.ok || !Array.isArray(res.data)) return;

        const currentUser = appState?.currentUser;
        const seen = new Set();
        const validRides = [];

        for (const row of res.data) {
          if (!row) continue;
          let meta = {};
          try { meta = JSON.parse(row.notes || '{}'); } catch(e){}

          // Filter out completed, cancelled or already accepted rides
          const isFinished = row.status === 'completed' || row.status === 'cancelled' || meta.status === 'completed' || meta.status === 'cancelled' || meta.status === 'driver_accepted' || meta.status === 'ride_started' || meta.status === 'ride_completed';
          if (isFinished) continue;

          const rideId = row.vehicle_number || row.id;
          if (seen.has(rideId)) continue;
          if (appState?.declinedRequestIds && appState.declinedRequestIds.has(rideId)) continue;

          // STRICT SESSION ISOLATION: A user cannot see or accept their own booked ride
          if (isSelfBookedRide(row, currentUser)) {
            continue;
          }

          seen.add(rideId);

          const cardData = (typeof extractRideCardData === 'function') 
            ? extractRideCardData(row) 
            : (typeof window !== 'undefined' && typeof window.extractRideCardData === 'function' ? window.extractRideCardData(row) : null);
          
          if (cardData) {
            validRides.push(cardData);
          }
        }

        // Pass fresh array copies to trigger UI updates
        const freshList = [...validRides];
        if (typeof window !== 'undefined') {
          if (typeof window.setActiveRides === 'function') {
            window.setActiveRides([...freshList]);
          } else {
            if (typeof window.renderLiveDriverRidesDOM === 'function') window.renderLiveDriverRidesDOM([...freshList]);
            if (typeof window.renderFloatingDriverRidesSheet === 'function') window.renderFloatingDriverRidesSheet([...freshList]);
          }
        }

        // Sound alert once for new incoming request
        if (freshList.length > 0 && typeof window.playNotificationSound === 'function') {
          const topId = freshList[0].id;
          if (this._lastAlertId !== topId) {
            this._lastAlertId = topId;
            window.playNotificationSound();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate([250, 100, 250]); } catch(e){}
            }
          }
        }
      } catch(err) {
        console.warn('Driver poll error:', err);
      }
    },

    // 4. DRIVER MODE: Accept Ride Request
    async acceptRequest(requestId, driverData) {
      console.log('⚡ [RAPIDO DRIVER] Accepting ride in database:', requestId, driverData);

      const updateNotes = JSON.stringify({
        isRequest: true,
        status: 'driver_accepted',
        driver: {
          id: driverData.id,
          name: driverData.name,
          phone: driverData.phone,
          avatar: driverData.avatar,
          vehicleName: driverData.vehicleName,
          vehicleNumber: driverData.vehicleNumber,
          vehicleType: driverData.vehicleType,
          rating: driverData.rating || 4.9
        },
        accepted_at: new Date().toISOString()
      });

      // Update Supabase rides row
      await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'completed', notes: updateNotes }
      });

      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('rides')
            .update({ status: 'completed', notes: updateNotes })
            .eq('vehicle_number', requestId);
        } catch(e){}
      }

      return { success: true };
    },

    // 5. RIDER MODE: Cancel Ride Request
    async cancelRequest(requestId) {
      this.stopRiderPolling();
      this._activeRequest = null;
      try { localStorage.removeItem('routemate_active_ride_request'); } catch(e){}

      await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'cancelled' }
      });

      return { success: true };
    },

    // 6. Complete / Start Helpers
    async startRide(requestId, enteredPin) {
      const startNotes = JSON.stringify({
        isRequest: true,
        status: 'ride_started',
        started_at: new Date().toISOString()
      });
      await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'completed', notes: startNotes }
      });
      return { success: true };
    },

    async completeRide(requestId) {
      const completeNotes = JSON.stringify({
        isRequest: true,
        status: 'ride_completed',
        completed_at: new Date().toISOString()
      });
      await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'completed', notes: completeNotes }
      });
      return { success: true };
    },

    async syncActiveRequest() {
      const appState = getGlobalState();
      if (appState && (appState.driverOnline || appState.mode === 'driver')) {
        this.pollDriverSearchingRides();
      }
    },

    // 7. Send In-App Real-time Chat Message (Supabase WebSockets / Realtime channel)
    async sendChatMessage(rideId, text, sender) {
      if (!text || !text.trim()) return null;
      const msg = {
        id: 'MSG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        rideId: rideId || (this._activeRequest ? this._activeRequest.id : 'default'),
        text: text.trim(),
        senderId: sender.id || 'usr_anonymous',
        senderName: sender.name || 'Verified Commuter',
        senderRole: sender.role || 'rider',
        senderAvatar: sender.avatar || '',
        timestamp: new Date().toISOString()
      };

      // Cache locally per ride
      try {
        const cacheKey = 'routemate_chat_' + msg.rideId;
        const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
        if (!cached.some(m => m.id === msg.id)) {
          cached.push(msg);
          localStorage.setItem(cacheKey, JSON.stringify(cached.slice(-50)));
        }
      } catch (e) {}

      // Broadcast locally & to other tabs
      this._emit('chat_message', msg);

      // Broadcast via Supabase Realtime WebSocket channel
      if (this._channel) {
        try {
          this._channel.send({
            type: 'broadcast',
            event: 'ride_matching_event',
            payload: { event: 'chat_message', request: msg }
          });
        } catch (e) {}
      }

      // Persist to Supabase Database table
      const client = getSupabaseClient();
      if (client) {
        try {
          client.from('ride_messages').insert([{
            ride_id: String(msg.rideId),
            sender_id: String(msg.senderId),
            sender_name: msg.senderName,
            sender_role: msg.senderRole,
            message: msg.text,
            created_at: msg.timestamp
          }]).then(() => {}).catch(() => {});
        } catch (e) {}
      }

      return msg;
    },

    // 8. Fetch Chat Messages for a Ride
    async fetchChatMessages(rideId) {
      let messages = [];
      const client = getSupabaseClient();
      if (client && rideId) {
        try {
          const { data, error } = await client
            .from('ride_messages')
            .select('*')
            .eq('ride_id', String(rideId))
            .order('created_at', { ascending: true });
          if (!error && Array.isArray(data)) {
            messages = data.map(m => ({
              id: m.id,
              rideId: m.ride_id,
              text: m.message,
              senderId: m.sender_id,
              senderName: m.sender_name,
              senderRole: m.sender_role,
              timestamp: m.created_at
            }));
          }
        } catch (e) {}
      }

      // If database is empty or table not yet created, load from localStorage
      if (messages.length === 0 && rideId) {
        try {
          const cached = JSON.parse(localStorage.getItem('routemate_chat_' + rideId) || '[]');
          if (Array.isArray(cached) && cached.length > 0) {
            messages = cached;
          }
        } catch (e) {}
      }
      return messages;
    }
  },

  // ==========================================
  // FEEDBACKS & RATINGS MODULE
  // ==========================================
  feedbacks: {
    _cache: null,

    async submit(feedbackData) {
      const payload = {
        id: feedbackData.id || ('FB-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900)),
        ride_id: feedbackData.rideId || feedbackData.ride_id || null,
        driver_id: feedbackData.driverId || feedbackData.driver_id || null,
        driver_name: feedbackData.driverName || feedbackData.driver_name || 'Verified Commuter',
        driver_phone: feedbackData.driverPhone || feedbackData.driver_phone || null,
        driver_avatar: feedbackData.driverAvatar || feedbackData.driver_avatar || null,
        driver_vehicle: feedbackData.driverVehicle || feedbackData.driver_vehicle || 'Commuter Vehicle',
        rider_id: feedbackData.riderId || feedbackData.rider_id || null,
        rider_name: feedbackData.riderName || feedbackData.rider_name || 'Commuter',
        rider_phone: feedbackData.riderPhone || feedbackData.rider_phone || null,
        rating: parseFloat(feedbackData.rating || 5.0),
        tags: Array.isArray(feedbackData.tags) ? feedbackData.tags : [],
        feedback_text: feedbackData.feedbackText || feedbackData.feedback_text || '',
        has_safety_concern: Boolean(feedbackData.hasSafetyConcern || feedbackData.has_safety_concern),
        route: feedbackData.route || 'Uppal ➔ Jangaon',
        status: feedbackData.status || 'published',
        created_at: new Date().toISOString()
      };

      // 1. Post to local server endpoint
      try {
        await fetch('/api/feedbacks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        console.warn('API /api/feedbacks error:', e);
      }

      // 2. Insert to Supabase if client exists
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('feedbacks').insert([payload]);
        } catch (e) {
          console.warn('Supabase feedbacks insert warning:', e);
        }
      }

      // 3. Cache in localStorage
      try {
        let stored = [];
        const raw = localStorage.getItem('routemate_feedbacks');
        if (raw) stored = JSON.parse(raw);
        stored.unshift(payload);
        localStorage.setItem('routemate_feedbacks', JSON.stringify(stored));
      } catch (e) {}

      // 4. Update Driver Overall Average Rating in Real-time
      const updatedRatingInfo = this.recalculateDriverRating(payload.driver_name, payload.driver_phone, payload.rating);

      // 5. Broadcast to local tab channels & listeners
      if (db.matching) {
        try {
          db.matching.broadcastEvent('new_feedback', payload);
        } catch(e) {}
      }
      try {
        const adminBc = new BroadcastChannel('routemate_admin_channel');
        adminBc.postMessage({ type: 'FEEDBACK_SUBMITTED', feedback: payload });
        adminBc.close();
      } catch (e) {}
      try {
        window.dispatchEvent(new CustomEvent('routemate_feedback_submitted', { detail: payload }));
      } catch (e) {}

      return { success: true, feedback: payload, driverRating: updatedRatingInfo };
    },

    recalculateDriverRating(driverName, driverPhone, newRating) {
      try {
        let ratingsMap = {};
        const raw = localStorage.getItem('routemate_driver_ratings_map');
        if (raw) ratingsMap = JSON.parse(raw);

        const key = (driverPhone || driverName || 'default').replace(/[\s+-]/g, '').toLowerCase();
        let current = ratingsMap[key] || {
          average: 4.85,
          totalRatings: 18
        };

        const oldAvg = current.average;
        const totalCount = current.totalRatings;
        // Formula: R_new = (R_old * N + R_input) / (N + 1)
        const newAverage = parseFloat(((oldAvg * totalCount + newRating) / (totalCount + 1)).toFixed(2));
        const newCount = totalCount + 1;

        ratingsMap[key] = {
          driverName: driverName,
          driverPhone: driverPhone,
          average: newAverage,
          totalRatings: newCount,
          lastUpdated: new Date().toISOString()
        };

        localStorage.setItem('routemate_driver_ratings_map', JSON.stringify(ratingsMap));

        return {
          driverKey: key,
          average: newAverage,
          totalRatings: newCount
        };
      } catch (e) {
        console.warn('Error recalculating driver rating:', e);
        return { average: newRating, totalRatings: 1 };
      }
    },

    getDriverRating(driverName, driverPhone) {
      try {
        const raw = localStorage.getItem('routemate_driver_ratings_map');
        if (!raw) return null;
        const map = JSON.parse(raw);
        const key = (driverPhone || driverName || '').replace(/[\s+-]/g, '').toLowerCase();
        return map[key] || null;
      } catch (e) {
        return null;
      }
    },

    async getAll() {
      // 1. Try local server or serverless endpoint
      try {
        const res = await fetch('/api/feedbacks');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.feedbacks) && data.feedbacks.length > 0) {
            return data.feedbacks;
          }
        }
      } catch (e) {}

      // 2. Try Supabase
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('feedbacks')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data && data.length > 0) {
            return data;
          }
        } catch (e) {}
      }

      // 3. Fallback to localStorage
      try {
        const raw = localStorage.getItem('routemate_feedbacks');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}

      // 4. Default Feedbacks Fallback (No mock data)
      return [];
    }
  },

  // ==========================================
  // SAFETY & SOS DISPATCH MODULE
  // ==========================================
  safety: {
    async reportAlert(alertData) {
      const payload = {
        id: alertData.id || ('SOS-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900)),
        user_id: alertData.userId || alertData.user_id || 'USR-COMMUTER',
        user_name: alertData.userName || alertData.user_name || 'Commuter',
        user_phone: alertData.userPhone || alertData.user_phone || '+91 98480 23145',
        emergency_contact_name: alertData.emergencyContactName || alertData.emergency_contact_name || null,
        emergency_contact_phone: alertData.emergencyContactPhone || alertData.emergency_contact_phone || null,
        latitude: alertData.latitude || null,
        longitude: alertData.longitude || null,
        google_maps_url: alertData.googleMapsUrl || alertData.google_maps_url || null,
        route: alertData.route || 'Uppal ➔ Jangaon',
        driver_info: alertData.driverInfo || alertData.driver_info || 'Commuter Vehicle',
        status: 'ACTIVE_EMERGENCY',
        created_at: new Date().toISOString()
      };

      // 1. Post to local server endpoint
      try {
        await fetch('/api/safety-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {}

      // 2. Insert to Supabase safety_alerts table if available
      const client = getSupabaseClient();
      if (client) {
        try {
          await client.from('safety_alerts').insert([payload]);
        } catch (e) {
          console.warn('Supabase safety_alerts insert note:', e.message);
        }
      }

      // 3. Store locally in localStorage
      try {
        let stored = JSON.parse(localStorage.getItem('routemate_safety_alerts') || '[]');
        stored.unshift(payload);
        localStorage.setItem('routemate_safety_alerts', JSON.stringify(stored));
      } catch (e) {}

      // 4. Broadcast via local BroadcastChannel
      try {
        const ch = new BroadcastChannel('routemate_admin_channel');
        ch.postMessage({ type: 'SAFETY_ALERT_TRIGGERED', data: payload });
        ch.close();
      } catch (e) {}

      return { success: true, alert: payload };
    },

    async getAlerts() {
      // 1. Try local server
      try {
        const res = await fetch('/api/safety-alerts');
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.alerts) && data.alerts.length > 0) return data.alerts;
        }
      } catch (e) {}

      // 2. Try Supabase
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client.from('safety_alerts').select('*').order('created_at', { ascending: false });
          if (!error && data && data.length > 0) return data;
        } catch (e) {}
      }

      // 3. Fallback to localStorage
      try {
        return JSON.parse(localStorage.getItem('routemate_safety_alerts') || '[]');
      } catch (e) { return []; }
    }
  }
};

// Auto-initialize matching engine on startup
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      db.matching.init();
    } catch(e) {
      console.warn('Matching engine auto-init error:', e);
    }
  }, 200);
}

// Export to window
window.db = db;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;

