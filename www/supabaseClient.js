/**
 * Routemate - Supabase Realtime & Auth Client (v36 OTP Verification Flow)
 * Passwordless 6-Digit Email OTP + Google OAuth + Realtime Postgres Changes
 */

(function (window) {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://hjieeilzfbvubkhmlmdg.supabase.co',
    publishableKey: 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a'
  };

  // Lazy-loading client getter
  let supabase = null;
  function getSupabase() {
    if (!supabase && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage
          }
        });
        console.log('✅ [SUPABASE CLIENT] Initialized with Realtime & Passwordless OTP Auth support.');
      } catch (e) {
        console.warn('⚠️ [SUPABASE CLIENT] Init warning:', e);
      }
    }
    return supabase;
  }

  // Pre-initialize
  getSupabase();

  /**
   * Direct fetch helper to Supabase PostgREST
   */
  async function supabaseRest(endpoint, options = {}) {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/${endpoint}`;
    const headers = {
      'apikey': SUPABASE_CONFIG.publishableKey,
      'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (options.prefer) {
      headers['Prefer'] = options.prefer;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 8000);

    try {
      const resp = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
      clearTimeout(timeout);

      const contentType = resp.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await resp.json().catch(() => null);
      } else {
        data = await resp.text().catch(() => null);
      }

      return {
        ok: resp.ok,
        status: resp.status,
        data: data,
        error: resp.ok ? null : data
      };
    } catch (err) {
      clearTimeout(timeout);
      return {
        ok: false,
        status: 0,
        data: null,
        error: err.message
      };
    }
  }

  // =========================================================================
  // SUPABASE PASSWORDLESS OTP AUTHENTICATION MODULE
  // =========================================================================
  const auth = {
    /**
     * Send 6-digit OTP code to user's email inbox
     */
    async sendOtp(email, { name, role, phone } = {}) {
      const client = getSupabase();
      if (!client) throw new Error('Authentication service is initializing. Please try again.');

      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Please enter a valid email address.');
      }

      console.log('📧 [SUPABASE AUTH] Sending 6-digit OTP to:', cleanEmail);
      const { data, error } = await client.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
          data: {
            name: name || cleanEmail.split('@')[0] || 'Verified Commuter',
            role: role || 'rider',
            phone: phone || '',
            avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'
          }
        }
      });

      if (error) {
        console.error('Supabase Send OTP Error:', error);
        throw error;
      }

      return { success: true, email: cleanEmail, data };
    },

    /**
     * Verify 6-digit OTP code entered by the user
     */
    async verifyOtp(email, token, { name, role } = {}) {
      const client = getSupabase();
      if (!client) throw new Error('Authentication service is initializing. Please try again.');

      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanToken = String(token || '').trim();

      if (!cleanToken || cleanToken.length < 6) {
        throw new Error('Please enter the complete 6-digit OTP code.');
      }

      console.log('🔑 [SUPABASE AUTH] Verifying OTP for:', cleanEmail);

      // Attempt 1: Standard email OTP type
      let { data, error } = await client.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email'
      });

      // Attempt 2: Signup OTP type if new user registration
      if (error && !error.message?.includes('expired')) {
        const signupAttempt = await client.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'signup'
        });
        if (!signupAttempt.error) {
          data = signupAttempt.data;
          error = null;
        }
      }

      if (error) {
        console.error('Supabase Verify OTP Error:', error);
        throw error;
      }

      return data;
    },

    /**
     * Google OAuth Login
     */
    async signInWithGoogle() {
      const client = getSupabase();
      if (!client) throw new Error('Authentication service is initializing. Please try again.');

      const redirectUrl = (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('capacitor://'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl
        }
      });

      if (error) throw error;
      return data;
    },

    /**
     * Sign Out
     */
    async signOut() {
      const client = getSupabase();
      if (client) {
        await client.auth.signOut().catch(() => {});
      }
      localStorage.removeItem('routemate_user');
      localStorage.removeItem('routemate_auth_token');
    },

    /**
     * Get Current Active Session
     */
    async getSession() {
      const client = getSupabase();
      if (!client) return null;
      try {
        const { data } = await client.auth.getSession();
        return data?.session || null;
      } catch (e) {
        return null;
      }
    },

    /**
     * Listen to Auth state changes
     */
    onAuthStateChange(callback) {
      const client = getSupabase();
      if (!client) return { data: { subscription: { unsubscribe: () => {} } } };
      return client.auth.onAuthStateChange((event, session) => {
        if (typeof callback === 'function') {
          callback(event, session);
        }
      });
    }
  };

  /**
   * Session Isolation Filter:
   * Prevents a user on Driver Mode from seeing or accepting their own booked ride.
   */
  function isSelfBookedRide(rideRow, currentUser) {
    if (!rideRow || !currentUser) return false;

    let notes = {};
    if (typeof rideRow.notes === 'string') {
      try { notes = JSON.parse(rideRow.notes || '{}'); } catch (e) {}
    } else if (rideRow.notes && typeof rideRow.notes === 'object') {
      notes = rideRow.notes;
    }

    const riderId = String(rideRow.rider_id || notes.riderId || notes.rider_id || '').trim();
    const riderEmail = String(rideRow.rider_email || notes.riderEmail || notes.rider_email || '').toLowerCase().trim();
    const riderPhone = String(rideRow.rider_phone || notes.riderPhone || notes.rider_phone || '').replace(/\D/g, '');

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
      return false; // Distinct emails are guaranteed separate users
    }

    // 3. Exclude if real mobile phone matches
    const GENERIC_PLACEHOLDERS = ['9848023145', '0000000000', '1234567890'];
    if (driverPhone.length >= 10 && riderPhone.length >= 10) {
      const d10 = driverPhone.slice(-10);
      const r10 = riderPhone.slice(-10);
      if (!GENERIC_PLACEHOLDERS.includes(d10) && d10 === r10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Normalizes raw Supabase row into standard Routemate Ride Object
   */
  function normalizeRideData(row) {
    if (!row) return null;

    let notes = {};
    if (typeof row.notes === 'string') {
      try { notes = JSON.parse(row.notes || '{}'); } catch (e) {}
    } else if (row.notes && typeof row.notes === 'object') {
      notes = row.notes;
    }

    const rideId = row.vehicle_number || notes.id || row.id;
    const pickup = row.pickup || notes.pickup || 'Uppal Metro, Hyderabad';
    const drop = row.drop_location || notes.drop || 'Jangaon Bus Depot';
    const fare = Math.round(Number(row.per_seat_price || notes.fare || 110));
    const distance = Math.round(Number(notes.distance || 84));
    const pin = String(notes.pin || '4821');
    const vehicleType = notes.vehicleType || row.vehicle_type || 'bike';
    const status = notes.status || row.status || 'searching';

    const riderName = notes.riderName || (row.driver_name ? String(row.driver_name).replace(/\s*\([^)]*\)/g, '').trim() : 'Verified Commuter');
    const riderAvatar = notes.riderAvatar || row.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80';
    const riderPhone = notes.riderPhone || '+91 98480 23145';
    const riderRating = notes.riderRating || 4.9;

    const pickupLat = notes.pickupLat || notes.pickup_lat || 17.4018;
    const pickupLng = notes.pickupLng || notes.pickup_lng || 78.5602;
    const dropLat = notes.dropLat || notes.drop_lat || 17.7265;
    const dropLng = notes.dropLng || notes.drop_lng || 79.1554;

    return {
      id: rideId,
      dbId: row.id,
      pickup,
      drop,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      fare,
      distance,
      pin,
      vehicleType,
      status,
      riderId: notes.riderId || 'rider_1',
      riderName,
      riderAvatar,
      riderPhone,
      riderRating,
      driver: notes.driver || null,
      createdAt: row.created_at || notes.createdAt || new Date().toISOString()
    };
  }

  // =========================================================================
  // REALTIME MATCHING ENGINE (REALTIME CHANNELS + 1S POLLING FAILSAFE)
  // =========================================================================
  const matching = {
    _riderTimer: null,
    _driverTimer: null,
    _realtimeChannel: null,
    _riderChannel: null,
    _lastAlertRideId: null,

    /**
     * RIDER: Post a new instant ride request to Supabase
     */
    async createRequest(reqData) {
      const pin = reqData.pin || Math.floor(1000 + Math.random() * 9000).toString();
      const requestId = reqData.id || ('REQ-' + Math.floor(100000 + Math.random() * 900000));
      const fare = Math.round(Number(reqData.fare) || 110);
      const dist = Math.round(Number(reqData.distance) || 84);
      const vehicleType = reqData.vehicleType || 'bike';

      const notesPayload = {
        isRequest: true,
        status: 'searching',
        id: requestId,
        riderId: reqData.riderId || ('rider_' + Date.now()),
        riderEmail: String(reqData.riderEmail || '').toLowerCase().trim(),
        riderPhone: reqData.riderPhone || '+91 98480 23145',
        riderName: reqData.riderName || 'Verified Commuter',
        riderAvatar: reqData.riderAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
        riderRating: 4.95,
        fare: fare,
        distance: dist,
        pin: pin,
        pickup: reqData.pickup,
        drop: reqData.drop,
        pickupLat: reqData.pickupLat || 17.4018,
        pickupLng: reqData.pickupLng || 78.5602,
        dropLat: reqData.dropLat || 17.7265,
        dropLng: reqData.dropLng || 79.1554,
        vehicleType: vehicleType,
        createdAt: new Date().toISOString()
      };

      const dbRow = {
        driver_name: `${notesPayload.riderName} (Rider Request)`,
        driver_role: 'Commuter',
        avatar: notesPayload.riderAvatar,
        vehicle_type: vehicleType === 'car' ? 'car' : 'bike',
        vehicle_name: vehicleType === 'car' ? 'Car Seat' : 'Bike Pillion',
        vehicle_number: requestId,
        pickup: reqData.pickup,
        drop_location: reqData.drop,
        departure_time: 'Immediate',
        seats_available: 1,
        per_seat_price: fare,
        payment_preference: 'upi',
        verified: true,
        status: 'active',
        notes: JSON.stringify(notesPayload)
      };

      console.log('🚀 [ROUTEMATE RIDER] Writing to Supabase rides:', requestId);
      const resp = await supabaseRest('rides', {
        method: 'POST',
        body: dbRow,
        prefer: 'return=representation'
      });

      const activeRide = {
        id: requestId,
        ...notesPayload,
        dbId: resp.data?.[0]?.id || requestId
      };

      return {
        success: resp.ok,
        request: activeRide
      };
    },

    /**
     * RIDER: Start Realtime + Polling listener for driver acceptance
     */
    startRiderPolling(requestId, onStatusChange) {
      this.stopRiderPolling();
      console.log('📡 [ROUTEMATE RIDER] Subscribing to ride acceptance:', requestId);

      const client = getSupabase();
      if (client) {
        try {
          this._riderChannel = client
            .channel(`rider-ride-${requestId}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'rides',
                filter: `vehicle_number=eq.${requestId}`
              },
              (payload) => {
                console.log('⚡ [REALTIME RIDER UPDATE RECEIVED]:', payload);
                if (payload.new) {
                  let notes = {};
                  try { notes = JSON.parse(payload.new.notes || '{}'); } catch(e){}
                  if (notes.status === 'driver_accepted' || notes.status === 'ride_started' || payload.new.status === 'completed') {
                    this.stopRiderPolling();
                    if (typeof onStatusChange === 'function') {
                      onStatusChange({
                        status: notes.status || 'driver_accepted',
                        driver: notes.driver,
                        pin: notes.pin,
                        fare: payload.new.per_seat_price || notes.fare,
                        pickup: payload.new.pickup,
                        drop: payload.new.drop_location
                      });
                    }
                  }
                }
              }
            )
            .subscribe();
        } catch(e) {
          console.warn('Realtime rider channel error:', e);
        }
      }

      this._riderTimer = setInterval(async () => {
        try {
          const resp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
          if (resp.ok && Array.isArray(resp.data) && resp.data.length > 0) {
            const row = resp.data[0];
            let notes = {};
            try { notes = JSON.parse(row.notes || '{}'); } catch (e) {}

            if (notes.status === 'driver_accepted' || notes.status === 'ride_started' || row.status === 'completed') {
              console.log('🎉 [ROUTEMATE RIDER] Driver accepted ride via poll:', notes.driver);
              this.stopRiderPolling();
              if (typeof onStatusChange === 'function') {
                onStatusChange({
                  status: notes.status || 'driver_accepted',
                  driver: notes.driver,
                  pin: notes.pin,
                  fare: row.per_seat_price || notes.fare,
                  pickup: row.pickup,
                  drop: row.drop_location
                });
              }
            }
          }
        } catch (e) {
          console.warn('Rider poll notice:', e);
        }
      }, 1000);
    },

    stopRiderPolling() {
      if (this._riderTimer) {
        clearInterval(this._riderTimer);
        this._riderTimer = null;
      }
      const client = getSupabase();
      if (this._riderChannel && client) {
        client.removeChannel(this._riderChannel);
        this._riderChannel = null;
      }
    },

    /**
     * DRIVER: Realtime Channel + 1-second radar polling loop
     */
    startDriverPolling(currentUser, onRidesUpdated) {
      this.stopDriverPolling();
      console.log('📡 [ROUTEMATE DRIVER] Starting Realtime + Radar Polling for user:', currentUser?.name);

      const fetchRides = async () => {
        try {
          const recentCutoff = new Date(Date.now() - 3600000).toISOString();
          const resp = await supabaseRest(`rides?select=*&status=neq.cancelled&created_at=gte.${recentCutoff}&order=created_at.desc&limit=15`);

          if (!resp.ok || !Array.isArray(resp.data)) return;

          const activeSearchingRides = [];
          for (const row of resp.data) {
            if (!row) continue;
            let notes = {};
            try { notes = JSON.parse(row.notes || '{}'); } catch (e) {}

            const isCompleted = row.status === 'completed' || row.status === 'cancelled' ||
                                notes.status === 'driver_accepted' || notes.status === 'ride_started' ||
                                notes.status === 'ride_completed' || notes.status === 'cancelled';
            if (isCompleted) continue;

            // Strict Session Isolation: Exclude own rides
            if (isSelfBookedRide(row, currentUser)) {
              continue;
            }

            const normalized = normalizeRideData(row);
            if (normalized) {
              activeSearchingRides.push(normalized);
            }
          }

          if (typeof onRidesUpdated === 'function') {
            onRidesUpdated(activeSearchingRides);
          }

          // Audio chime on first detection of a new ride
          if (activeSearchingRides.length > 0) {
            const topId = activeSearchingRides[0].id;
            if (this._lastAlertRideId !== topId) {
              this._lastAlertRideId = topId;
              if (typeof window.playNotificationSound === 'function') {
                window.playNotificationSound();
              }
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate([200, 100, 200]); } catch (e) {}
              }
            }
          }
        } catch (err) {
          console.warn('Driver poll error:', err);
        }
      };

      const client = getSupabase();
      if (client) {
        try {
          this._realtimeChannel = client
            .channel('driver-rides-feed')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'rides' },
              (payload) => {
                console.log('⚡ [REALTIME POSTGRES CHANGE DETECTED]:', payload.eventType);
                fetchRides();
              }
            )
            .subscribe((status) => {
              console.log('📡 [REALTIME CHANNEL STATUS]:', status);
            });
        } catch (e) {
          console.warn('Realtime channel error:', e);
        }
      }

      fetchRides();
      this._driverTimer = setInterval(fetchRides, 1000);
    },

    stopDriverPolling() {
      if (this._driverTimer) {
        clearInterval(this._driverTimer);
        this._driverTimer = null;
      }
      const client = getSupabase();
      if (this._realtimeChannel && client) {
        client.removeChannel(this._realtimeChannel);
        this._realtimeChannel = null;
      }
    },

    /**
     * DRIVER: Accept a ride request
     */
    async acceptRequest(requestId, driverUser) {
      console.log('⚡ [ROUTEMATE DRIVER] Accepting ride:', requestId);
      const updateNotes = JSON.stringify({
        isRequest: true,
        status: 'driver_accepted',
        driver: {
          id: driverUser.id,
          name: driverUser.name,
          phone: driverUser.phone,
          avatar: driverUser.avatar_url || driverUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
          vehicleName: driverUser.vehicleName || 'Verified Commuter Vehicle',
          vehicleNumber: driverUser.vehicleNumber || 'TS 08 AB 1234',
          vehicleType: driverUser.vehicleType || 'bike',
          rating: 4.95
        },
        acceptedAt: new Date().toISOString()
      });

      const resp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: {
          status: 'completed',
          notes: updateNotes
        }
      });

      return { success: resp.ok };
    },

    async startRide(requestId) {
      const updateNotes = JSON.stringify({
        status: 'ride_started',
        startedAt: new Date().toISOString()
      });
      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { notes: updateNotes }
      });
    },

    async completeRide(requestId) {
      const updateNotes = JSON.stringify({
        status: 'ride_completed',
        completedAt: new Date().toISOString()
      });
      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'completed', notes: updateNotes }
      });
    },

    async cancelRequest(requestId) {
      this.stopRiderPolling();
      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'cancelled' }
      });
    }
  };

  // Export clean global database object
  window.db = {
    getSupabase,
    auth,
    supabaseRest,
    matching,
    isSelfBookedRide,
    normalizeRideData
  };

})(window);
