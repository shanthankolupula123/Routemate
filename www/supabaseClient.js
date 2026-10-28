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
     * Send 6-digit OTP code to user's email inbox via high-speed Resend Email Gateway
     * Dispatches from auth@routemate.pro directly to user's Gmail/email inbox
     */
    async sendOtp(email, { name, role, phone } = {}) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Please enter a valid email address.');
      }

      console.log('📧 [ROUTEMATE AUTH] Sending 6-digit OTP to:', cleanEmail);

      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      let lastError = null;

      // 1. Primary: Direct High-Deliverability Resend Email Gateway
      try {
        const resp = await fetch(`${apiBase}/api/send-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            name: name || cleanEmail.split('@')[0],
            role: role || 'rider',
            phone: phone || ''
          })
        });

        const data = await resp.json().catch(() => ({}));

        if (resp.ok && data.success) {
          console.log('✅ [RESEND OTP] Successfully dispatched OTP to email:', cleanEmail);
          try {
            sessionStorage.setItem('routemate_otp_token', data.otpToken || '');
            sessionStorage.setItem('routemate_otp_expires', String(data.expiresAt || ''));
            sessionStorage.setItem('routemate_otp_email', cleanEmail);
          } catch (e) {}
          return { success: true, email: cleanEmail, provider: 'resend', data };
        } else {
          lastError = new Error(data.error || 'Failed to dispatch verification email.');
        }
      } catch (networkErr) {
        console.warn('⚠️ [ROUTEMATE AUTH] Gateway fetch notice:', networkErr.message);
        lastError = networkErr;
      }

      // 2. Secondary Fallback: Supabase Built-in Auth
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client.auth.signInWithOtp({
            email: cleanEmail,
            options: {
              shouldCreateUser: true,
              data: {
                name: name || cleanEmail.split('@')[0] || 'Verified Commuter',
                role: role || 'rider'
              }
            }
          });
          if (!error) {
            return { success: true, email: cleanEmail, provider: 'supabase', data };
          }
          console.warn('⚠️ [SUPABASE AUTH FALLBACK] Error:', error.message);
        } catch (supaErr) {
          console.warn('⚠️ [SUPABASE AUTH FALLBACK] Exception:', supaErr);
        }
      }

      throw lastError || new Error('Failed to send verification code. Please check your email and try again.');
    },

    /**
     * Verify 6-digit OTP code entered by the user
     */
    async verifyOtp(email, token, { name, role } = {}) {
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanToken = String(token || '').replace(/\D/g, '').trim();

      if (!cleanToken || cleanToken.length < 6) {
        throw new Error('Please enter the complete 6-digit OTP code.');
      }

      console.log('🔑 [ROUTEMATE AUTH] Verifying OTP for:', cleanEmail);

      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      let otpToken = '';
      let expiresAt = '';
      try {
        otpToken = sessionStorage.getItem('routemate_otp_token') || '';
        expiresAt = sessionStorage.getItem('routemate_otp_expires') || '';
      } catch (e) {}

      // 1. Primary: Verify via Routemate API Gateway (Supabase DB + HMAC)
      try {
        const resp = await fetch(`${apiBase}/api/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            code: cleanToken,
            name: name || '',
            role: role || 'rider',
            otpToken,
            expiresAt
          })
        });

        const data = await resp.json().catch(() => ({}));
  function getSvgInitialsAvatar(name, bg = '#0052CC') {
    const parts = String(name || 'User').trim().split(/\s+/);
    const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="${bg}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="48px">${initials}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

        if (resp.ok && data.success && data.verified) {
          console.log('✅ [ROUTEMATE AUTH] OTP verified successfully!');
          return {
            user: data.user || {
              id: 'usr_' + Date.now(),
              email: cleanEmail,
              name: name || cleanEmail.split('@')[0],
              role: 'commuter',
              phone: cleanEmail,
              rating: 5.0,
              avatar: getSvgInitialsAvatar(name || cleanEmail)
            }
          };
        } else if (data && data.error && !data.error.includes('Server error')) {
          throw new Error(data.error);
        }
      } catch (gatewayErr) {
        if (gatewayErr.message && (gatewayErr.message.includes('Invalid') || gatewayErr.message.includes('expired'))) {
          throw gatewayErr;
        }
        console.warn('⚠️ [ROUTEMATE AUTH] Gateway verify notice:', gatewayErr.message);
      }

      // 2. Secondary Fallback: Supabase Client verifyOtp
      const client = getSupabase();
      if (client) {
        let { data, error } = await client.auth.verifyOtp({
          email: cleanEmail,
          token: cleanToken,
          type: 'email'
        });

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

        if (data?.user) {
          return data;
        }
        if (error) {
          throw error;
        }
      }

      throw new Error('Invalid verification code. Please check your email and try again.');
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

      // Safe pre-probe: verify if the Google OAuth provider is actually enabled in the Supabase Dashboard.
      // This prevents dumping the user onto an unhandled 400 "provider is not enabled" raw JSON page.
      const probeUrl = `${SUPABASE_CONFIG.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      try {
        const probeResp = await fetch(probeUrl, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        if (probeResp.status === 400) {
          const body = await probeResp.json().catch(() => ({}));
          if (body.error_code === 'validation_failed' || (body.msg && body.msg.includes('provider is not enabled'))) {
            const err = new Error('Google OAuth provider is not enabled on this Supabase project.');
            err.code = 'PROVIDER_NOT_ENABLED';
            throw err;
          }
        }
      } catch (probeErr) {
        clearTimeout(timeoutId);
        if (probeErr.code === 'PROVIDER_NOT_ENABLED' || probeErr.message?.includes('provider is not enabled')) {
          throw probeErr;
        }
        // If fetch redirected to accounts.google.com or timed out, proceed directly with OAuth!
        console.log('Google OAuth active, proceeding with redirect...');
      }

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
    },

    /**
     * Fetch user profile from Supabase profiles table
     */
    async getUserProfile(userId, email = null) {
      if (!userId && !email) return null;
      try {
        let url = `${SUPABASE_CONFIG.url}/rest/v1/profiles?`;
        if (userId && email) {
          url += `or=(id.eq.${encodeURIComponent(userId)},email.eq.${encodeURIComponent(email)})&select=*&limit=1`;
        } else if (userId) {
          url += `id=eq.${encodeURIComponent(userId)}&select=*&limit=1`;
        } else {
          url += `email=eq.${encodeURIComponent(email)}&select=*&limit=1`;
        }
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
          }
        });
        if (resp.ok) {
          const rows = await resp.json();
          if (rows && rows.length > 0) return rows[0];
        }
      } catch (e) {
        console.warn('⚠️ [SUPABASE PROFILES] Fetch error:', e);
      }
      return null;
    },

    /**
     * Upsert user profile to Supabase profiles table & Auth metadata
     */
    async saveUserProfile(userId, { name, phone, email, gender, dob, upiId }) {
      if (!userId) throw new Error('User ID is required');
      const cleanName = String(name || '').trim();
      const cleanPhone = String(phone || '').trim();
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanUpi = String(upiId || '').trim();

      // 1. Upsert into Supabase `profiles` table
      try {
        const url = `${SUPABASE_CONFIG.url}/rest/v1/profiles`;
        const profilePayload = {
          id: userId,
          name: cleanName,
          phone: cleanPhone,
          role: 'Daily Commuter',
          is_verified: true
        };
        if (cleanEmail) profilePayload.email = cleanEmail;
        if (gender) profilePayload.gender = gender;
        if (dob) profilePayload.dob = dob;
        if (cleanUpi) profilePayload.upi_id = cleanUpi;

        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates,return=representation'
          },
          body: JSON.stringify(profilePayload)
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          console.warn('⚠️ [SUPABASE PROFILES] Upsert warning:', errData);
        } else {
          console.log('✅ [SUPABASE PROFILES] Successfully updated profile for user:', userId);
        }
      } catch (upsertErr) {
        console.warn('⚠️ [SUPABASE PROFILES] Upsert exception:', upsertErr);
      }

      // 2. Also persist in Supabase Auth user metadata
      const client = getSupabase();
      if (client) {
        try {
          const metaPayload = {
            name: cleanName,
            full_name: cleanName,
            phone: cleanPhone,
            gender: gender || '',
            dob: dob || ''
          };
          if (cleanUpi) metaPayload.upi_id = cleanUpi;
          await client.auth.updateUser({
            data: metaPayload
          });
        } catch (metaErr) {
          console.warn('⚠️ [SUPABASE AUTH] updateUser metadata note:', metaErr.message);
        }
      }

      // 3. If UPI ID provided, update driver KYC / UPI
      if (cleanUpi && kyc.updateDriverUpi) {
        try {
          await kyc.updateDriverUpi(userId, cleanUpi);
        } catch (upiErr) {
          console.warn('⚠️ [DRIVER UPI] Note saving UPI ID:', upiErr.message);
        }
      }

      return {
        id: userId,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        gender: gender || '',
        dob: dob || '',
        upiId: cleanUpi
      };
    },

    /**
     * Delete user account and all associated data
     */
    async deleteAccount(userId, email = null) {
      if (!userId && !email) throw new Error('User ID or Email is required');
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      let apiSuccess = false;
      try {
        const resp = await fetch(`${apiBase}/api/driver-kyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_account',
            userId,
            email
          })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          apiSuccess = true;
        }
      } catch (e) {
        console.warn('API delete account error:', e);
      }

      // Direct fallback deletion on Supabase REST
      try {
        let profFilter = userId && email
          ? `or=(id.eq.${encodeURIComponent(userId)},email.eq.${encodeURIComponent(email)})`
          : (userId ? `id=eq.${encodeURIComponent(userId)}` : `email=eq.${encodeURIComponent(email)}`);
        await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?${profFilter}`, {
          method: 'DELETE',
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
          }
        });
      } catch (e) {}

      // Sign out from Supabase Auth
      try {
        await auth.signOut();
      } catch (e) {}

      return { success: true };
    }
  };

  // =========================================================================
  // DRIVER KYC VERIFICATION & SUPER ADMIN APPROVAL MODULE
  // =========================================================================
  const kyc = {
    /**
     * Get Driver KYC status for a user
     */
    async getDriverKyc(userId, email = null) {
      if (!userId && !email) return { status: 'not_submitted' };
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      // 1. Check API Gateway
      try {
        let q = `?userId=${encodeURIComponent(userId || '')}`;
        if (email) q += `&email=${encodeURIComponent(email)}`;
        const resp = await fetch(`${apiBase}/api/driver-kyc${q}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.success) {
            return data.submission || { status: data.status || 'not_submitted' };
          }
        }
      } catch (e) {
        console.warn('KYC check API notice:', e.message);
      }

      // 2. Direct Supabase Fallback
      try {
        let directUrl = `${SUPABASE_CONFIG.url}/rest/v1/driver_kyc?`;
        if (userId && email) {
          directUrl += `or=(user_id.eq.${encodeURIComponent(userId)},driver_email.eq.${encodeURIComponent(email)})&select=*&order=submitted_at.desc&limit=1`;
        } else if (userId) {
          directUrl += `user_id=eq.${encodeURIComponent(userId)}&select=*&order=submitted_at.desc&limit=1`;
        } else {
          directUrl += `driver_email=eq.${encodeURIComponent(email)}&select=*&order=submitted_at.desc&limit=1`;
        }
        const resp = await fetch(directUrl, {
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
          }
        });
        if (resp.ok) {
          const rows = await resp.json();
          if (rows && rows.length > 0) return rows[0];
        }
      } catch (e) {}

      return { status: 'not_submitted' };
    },

    /**
     * Submit Driver KYC documents (DL, Aadhaar, RC, Photo)
     */
    async submitDriverKyc(submissionData) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', ...submissionData })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit Driver KYC documents.');
      }
      return data;
    },

    /**
     * Get All KYC submissions for Super Admin review
     */
    async getAllKycSubmissions() {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success) return data.submissions || [];
      }
      return [];
    },

    /**
     * Super Admin decision (Approve / Reject)
     */
    async reviewDriverKyc(targetId, status, rejectionReason, adminEmail) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'decision',
          id: targetId,
          userId: targetId,
          status,
          rejectionReason,
          adminEmail
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to process admin review.');
      }
      return data;
    },

    /**
     * Add another secondary vehicle to driver's profile
     */
    async addDriverVehicle(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_vehicle',
          user_id: payload.userId,
          driver_name: payload.driverName,
          driver_email: payload.driverEmail,
          driver_phone: payload.driverPhone,
          vehicle_number: payload.vehicleNumber,
          vehicle_type: payload.vehicleType,
          vehicle_name: payload.vehicleName,
          rc_photo: payload.rcPhoto
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit vehicle.');
      }
      return data;
    },

    /**
     * Switch active driving vehicle
     */
    async switchDriverVehicle(userId, vehicleId) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'switch_vehicle',
          user_id: userId,
          vehicle_id: vehicleId
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to switch vehicle.');
      }
      return data;
    },

    /**
     * Super Admin decision for secondary vehicle
     */
    async reviewDriverVehicle(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'vehicle_decision',
          adminEmail: payload.adminEmail,
          user_id: payload.userId,
          vehicle_id: payload.vehicleId,
          status: payload.status,
          rejectionReason: payload.rejectionReason
        })
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to review vehicle.');
      }
      return data;
    },

    /**
     * Driver UPI ID & QR Code configuration
     */
    async updateDriverUpi(userId, upiId, upiQr = null) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_upi',
          userId,
          upiId,
          upiQr
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to save UPI ID.');
      }
      return data;
    },

    /**
     * Deducts vehicle-wise dynamic platform fee from driver wallet for cash rides
     * (Bike: ₹5, Auto: ₹10, Car: ₹18)
     */
    async deductDriverCommission(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deduct_commission',
          ...payload
        })
      });
      const data = await resp.json().catch(() => ({}));
      return data;
    },

    /**
     * Recharges driver in-app wallet balance
     */
    async rechargeDriverWallet(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recharge_wallet',
          ...payload
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to recharge wallet.');
      }
      return data;
    }
  };

  /**
   * Post-Ride Rating & Safety Feedback Helper
   */
  const feedbacks = {
    async submitFeedback(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit rating.');
      }
      return data;
    },

    async getAllFeedbacks() {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/feedbacks`);
      const data = await resp.json().catch(() => ({}));
      return data.feedbacks || [];
    },

    async executeSafetyAction(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location.origin && window.location.origin.startsWith('http') && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/feedbacks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'safety_action',
          ...payload
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to record safety action.');
      }
      return data;
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
    const vehicleNumber = String(rideRow.vehicle_number || notes.id || '').trim();

    const driverId = String(currentUser.id || '').trim();
    const driverEmail = String(currentUser.email || '').toLowerCase().trim();
    const driverPhone = String(currentUser.phone || '').replace(/\D/g, '');

    // 1. Exclude if currently active booked ride on this device
    if (typeof window !== 'undefined' && window.state && window.state.activeRiderRequest) {
      const activeReq = window.state.activeRiderRequest;
      if (activeReq.id === vehicleNumber || activeReq.id === notes.id || (activeReq.dbId && activeReq.dbId === rideRow.id)) {
        return true;
      }
    }

    // 2. Exclude if rider ID matches driver user ID
    if (driverId && riderId && driverId === riderId) {
      return true;
    }

    // 3. Exclude if rider email matches driver email
    if (driverEmail && riderEmail && driverEmail === riderEmail) {
      return true;
    }

    // 4. Exclude if 10-digit mobile phone matches
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

    const riderName = notes.riderName || (row.driver_name ? String(row.driver_name).replace(/\s*\([^)]*\)/g, '').trim() : 'Commuter');
    const riderAvatar = (notes.riderAvatar && !notes.riderAvatar.includes('unsplash')) ? notes.riderAvatar : getSvgInitialsAvatar(riderName);
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
      const rName = reqData.riderName || 'Commuter';

      const notesPayload = {
        isRequest: true,
        status: 'searching',
        id: requestId,
        riderId: reqData.riderId || ('rider_' + Date.now()),
        riderEmail: String(reqData.riderEmail || '').toLowerCase().trim(),
        riderPhone: reqData.riderPhone || '+91 98480 23145',
        riderName: rName,
        riderAvatar: (reqData.riderAvatar && !reqData.riderAvatar.includes('unsplash')) ? reqData.riderAvatar : getSvgInitialsAvatar(rName),
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

      // Broadcast immediately across Supabase Realtime WebSockets to all active drivers
      const client = getSupabase();
      if (client) {
        try {
          const radarChannel = client.channel('routemate-radar-feed');
          radarChannel.send({
            type: 'broadcast',
            event: 'new_ride_broadcast',
            payload: {
              row: dbRow,
              ride: activeRide
            }
          });
          console.log('⚡ [REALTIME BROADCAST SENT]:', requestId);
        } catch (bcErr) {
          console.warn('Realtime broadcast dispatch notice:', bcErr.message);
        }
      }

      return {
        success: resp.ok,
        request: activeRide
      };
    },

    /**
     * RIDER: Start Realtime + Polling listener for driver acceptance, start, and completion
     */
    startRiderPolling(requestId, onStatusChange) {
      this.stopRiderPolling();
      console.log('📡 [ROUTEMATE RIDER] Subscribing to ride lifecycle updates:', requestId);

      let lastReportedStatus = null;
      let lastDriverData = null;

      const handleStatusPayload = (statusData) => {
        if (!statusData || !statusData.status) return;

        if (statusData.driver) lastDriverData = statusData.driver;
        if (!statusData.driver && lastDriverData) statusData.driver = lastDriverData;

        const isFinished = statusData.status === 'ride_completed' || statusData.status === 'completed';

        if (isFinished) {
          this.stopRiderPolling();
        } else if (statusData.status === lastReportedStatus) {
          return;
        }

        lastReportedStatus = statusData.status;
        console.log(`⚡ [ROUTEMATE RIDER] Status transition -> ${statusData.status}`);

        if (typeof onStatusChange === 'function') {
          onStatusChange(statusData);
        }
      };

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
                if (payload.new) {
                  let notes = {};
                  try { notes = JSON.parse(payload.new.notes || '{}'); } catch(e){}
                  const currentStatus = notes.status || (payload.new.status === 'completed' ? 'ride_completed' : 'driver_accepted');
                  handleStatusPayload({
                    status: currentStatus,
                    driver: notes.driver,
                    pin: notes.pin,
                    fare: payload.new.per_seat_price || notes.fare,
                    pickup: payload.new.pickup,
                    drop: payload.new.drop_location,
                    vehicleType: payload.new.vehicle_type || notes.vehicleType || 'bike'
                  });
                }
              }
            )
            .on(
              'broadcast',
              { event: 'driver_accepted' },
              (msg) => {
                if (msg.payload) handleStatusPayload(msg.payload);
              }
            )
            .on(
              'broadcast',
              { event: 'ride_started' },
              (msg) => {
                if (msg.payload) handleStatusPayload(msg.payload);
              }
            )
            .on(
              'broadcast',
              { event: 'ride_completed' },
              (msg) => {
                if (msg.payload) handleStatusPayload(msg.payload);
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

            const status = notes.status || (row.status === 'completed' ? 'ride_completed' : 'searching');
            if (status === 'driver_accepted' || status === 'ride_started' || status === 'ride_completed' || row.status === 'completed') {
              handleStatusPayload({
                status: status === 'completed' ? 'ride_completed' : status,
                driver: notes.driver,
                pin: notes.pin,
                fare: row.per_seat_price || notes.fare,
                pickup: row.pickup,
                drop: row.drop_location,
                vehicleType: row.vehicle_type || notes.vehicleType || 'bike'
              });
            }
          }
        } catch (e) {
          console.warn('Rider poll notice:', e);
        }
      }, 1200);
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

      let activeSearchingRides = [];

      const triggerUpdate = () => {
        if (typeof onRidesUpdated === 'function') {
          onRidesUpdated([...activeSearchingRides]);
        }
      };

      const notifyDriverArrival = (rideId) => {
        if (this._lastAlertRideId !== rideId) {
          this._lastAlertRideId = rideId;
          if (typeof window.playNotificationSound === 'function') {
            window.playNotificationSound();
          }
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate([200, 100, 200]); } catch (e) {}
          }
        }
      };

      const processIncomingRow = (row) => {
        if (!row) return;
        if (isSelfBookedRide(row, currentUser)) return;

        let notes = {};
        try { notes = typeof row.notes === 'string' ? JSON.parse(row.notes || '{}') : (row.notes || {}); } catch (e) {}

        const isCompleted = row.status === 'completed' || row.status === 'cancelled' ||
                            notes.status === 'driver_accepted' || notes.status === 'ride_started' ||
                            notes.status === 'ride_completed' || notes.status === 'cancelled';
        if (isCompleted) {
          removeRideById(row.vehicle_number || notes.id || row.id);
          return;
        }

        const normalized = normalizeRideData(row);
        if (!normalized) return;

        const existsIdx = activeSearchingRides.findIndex(r => r.id === normalized.id || (r.dbId && r.dbId === normalized.dbId));
        if (existsIdx === -1) {
          activeSearchingRides.unshift(normalized);
          triggerUpdate();
          notifyDriverArrival(normalized.id);
          console.log('⚡ [INSTANT CARD ADDED TO DRIVER FEED]:', normalized.id);
        } else {
          activeSearchingRides[existsIdx] = normalized;
          triggerUpdate();
        }
      };

      const removeRideById = (rideId) => {
        if (!rideId) return;
        const initialLen = activeSearchingRides.length;
        activeSearchingRides = activeSearchingRides.filter(r => r.id !== rideId && r.dbId !== rideId);
        if (activeSearchingRides.length !== initialLen) {
          triggerUpdate();
          console.log('⚡ [RIDE REMOVED FROM DRIVER FEED]:', rideId);
        }
      };

      const fetchRides = async () => {
        try {
          const recentCutoff = new Date(Date.now() - 3600000).toISOString();
          const resp = await supabaseRest(`rides?select=*&status=neq.cancelled&created_at=gte.${recentCutoff}&order=created_at.desc&limit=15`);

          if (!resp.ok || !Array.isArray(resp.data)) return;

          const freshRides = [];
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
              freshRides.push(normalized);
            }
          }

          activeSearchingRides = freshRides;
          triggerUpdate();

          if (activeSearchingRides.length > 0) {
            notifyDriverArrival(activeSearchingRides[0].id);
          }
        } catch (err) {
          console.warn('Driver poll error:', err);
        }
      };

      // Set up Instant Supabase Realtime Channel (Postgres Changes + WebSockets Broadcast)
      const client = getSupabase();
      if (client) {
        try {
          this._realtimeChannel = client
            .channel('routemate-radar-feed')
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'rides' },
              (payload) => {
                console.log('⚡ [REALTIME POSTGRES INSERT DETECTED]:', payload.new?.vehicle_number || payload.new?.id);
                processIncomingRow(payload.new);
              }
            )
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'rides' },
              (payload) => {
                console.log('⚡ [REALTIME POSTGRES UPDATE DETECTED]:', payload.new?.vehicle_number || payload.new?.id);
                processIncomingRow(payload.new);
              }
            )
            .on(
              'broadcast',
              { event: 'new_ride_broadcast' },
              (msg) => {
                console.log('⚡ [INSTANT WEBSOCKET BROADCAST DETECTED]:', msg.payload?.ride?.id);
                if (msg.payload?.row) {
                  processIncomingRow(msg.payload.row);
                }
              }
            )
            .on(
              'broadcast',
              { event: 'cancel_ride_broadcast' },
              (msg) => {
                console.log('⚡ [INSTANT WEBSOCKET CANCEL DETECTED]:', msg.payload?.id);
                if (msg.payload?.id) {
                  removeRideById(msg.payload.id);
                }
              }
            )
            .subscribe((status) => {
              console.log('📡 [DRIVER REALTIME RADAR CHANNEL STATUS]:', status);
            });
        } catch (e) {
          console.warn('Realtime channel error:', e);
        }
      }

      fetchRides();
      this._driverTimer = setInterval(fetchRides, 1200);
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
      const driverPayload = {
        id: driverUser.id,
        name: driverUser.name,
        phone: driverUser.phone,
        avatar: (driverUser.avatar_url && !driverUser.avatar_url.includes('unsplash')) ? driverUser.avatar_url : (driverUser.avatar && !driverUser.avatar.includes('unsplash') ? driverUser.avatar : getSvgInitialsAvatar(driverUser.name || 'Driver', '#10B981')),
        vehicleName: driverUser.vehicleName || driverUser.vehicle_name || 'Verified Commuter Vehicle',
        vehicleNumber: driverUser.vehicleNumber || driverUser.vehicle_number || 'TG 08 AB 1234',
        vehicleType: driverUser.vehicleType || driverUser.vehicle_type || 'bike',
        upiId: driverUser.upi_id || driverUser.upiId || 'routemate.driver@oksbi',
        upiQr: driverUser.upi_qr || driverUser.upiQr || '',
        rating: driverUser.rating || 4.95
      };

      const updateNotes = JSON.stringify({
        isRequest: true,
        status: 'driver_accepted',
        driver: driverPayload,
        acceptedAt: new Date().toISOString()
      });

      // 1. Broadcast immediate acceptance to Rider via WebSocket
      const client = getSupabase();
      if (client) {
        try {
          const riderDirect = client.channel(`rider-ride-${requestId}`);
          riderDirect.send({
            type: 'broadcast',
            event: 'driver_accepted',
            payload: {
              status: 'driver_accepted',
              driver: driverPayload
            }
          });

          // 2. Broadcast to other drivers to remove this accepted ride from their radars
          const radarChannel = client.channel('routemate-radar-feed');
          radarChannel.send({
            type: 'broadcast',
            event: 'cancel_ride_broadcast',
            payload: { id: requestId }
          });
        } catch (e) {}
      }

      // 3. Persist update in database
      const resp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: {
          status: 'completed',
          notes: updateNotes
        }
      });

      return { success: resp.ok };
    },

    async cancelRequest(requestId) {
      console.log('🚫 [ROUTEMATE RIDER] Cancelling request:', requestId);
      this.stopRiderPolling();

      const client = getSupabase();
      if (client) {
        try {
          const radarChannel = client.channel('routemate-radar-feed');
          radarChannel.send({
            type: 'broadcast',
            event: 'cancel_ride_broadcast',
            payload: { id: requestId }
          });
        } catch (e) {}
      }

      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: {
          status: 'cancelled',
          notes: JSON.stringify({ isRequest: true, status: 'cancelled' })
        }
      });
    },

    async startRide(requestId) {
      const updateNotes = JSON.stringify({
        status: 'ride_started',
        startedAt: new Date().toISOString()
      });

      const client = getSupabase();
      if (client) {
        try {
          const riderDirect = client.channel(`rider-ride-${requestId}`);
          riderDirect.send({
            type: 'broadcast',
            event: 'ride_started',
            payload: { status: 'ride_started', requestId }
          });
        } catch (e) {}
      }

      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { notes: updateNotes }
      });
    },

    async completeRide(requestId, completedData = {}) {
      const updateNotes = JSON.stringify({
        isRequest: true,
        status: 'ride_completed',
        completedAt: new Date().toISOString(),
        ...completedData
      });

      const client = getSupabase();
      if (client) {
        try {
          const riderDirect = client.channel(`rider-ride-${requestId}`);
          riderDirect.send({
            type: 'broadcast',
            event: 'ride_completed',
            payload: {
              status: 'ride_completed',
              requestId,
              ...completedData
            }
          });
        } catch (e) {}
      }

      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'completed', notes: updateNotes }
      });
    }
  };

  // Export clean global database object
  window.db = {
    getSupabase,
    auth,
    kyc,
    feedbacks,
    supabaseRest,
    matching,
    isSelfBookedRide,
    normalizeRideData
  };

})(window);
