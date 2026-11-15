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
        const safeStorage = {
          getItem: function (key) {
            try {
              return window.localStorage.getItem(key);
            } catch (e) {
              return null;
            }
          },
          setItem: function (key, value) {
            try {
              window.localStorage.setItem(key, value);
            } catch (e) {}
          },
          removeItem: function (key) {
            try {
              window.localStorage.removeItem(key);
            } catch (e) {}
          }
        };

        supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'routemate_supabase_auth_token',
            storage: safeStorage
          }
        });
        console.log('✅ [SUPABASE CLIENT] Initialized with Persistent Auth & Realtime support.');
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

      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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

      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      let otpToken = '';
      let expiresAt = '';
      try {
        otpToken = sessionStorage.getItem('routemate_otp_token') || '';
        expiresAt = sessionStorage.getItem('routemate_otp_expires') || '';
      } catch (e) {}

      const getSvgInitialsAvatar = (userName, bg = '#0052CC') => {
        const parts = String(userName || 'User').trim().split(/\s+/);
        const initials = (parts.length >= 2 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="${bg}"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="48px">${initials}</text></svg>`;
        return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      };

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
     * Google OAuth Login (In-Page Popup Flow via Google Identity Services)
     * Does NOT redirect away to avoid external callback / localhost errors
     */
    async signInWithGoogle() {
      return new Promise((resolve, reject) => {
        // 1. Modern Google Identity Services tokenClient (Popup window)
        if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
          try {
            const tokenClient = google.accounts.oauth2.initTokenClient({
              client_id: '667321797265-kcrogrinsipuk4n1c96ru71c0pocochm.apps.googleusercontent.com',
              scope: 'email profile openid',
              callback: async (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                  try {
                    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                      headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                    });
                    const profile = await res.json();
                    if (profile && profile.email) {
                      if (typeof window.handleGoogleProfileSuccess === 'function') {
                        await window.handleGoogleProfileSuccess(profile);
                      }
                      return resolve({ user: profile });
                    }
                  } catch (fetchErr) {
                    return reject(fetchErr);
                  }
                }
                reject(new Error('Google sign-in was cancelled.'));
              },
              error_callback: (err) => {
                console.warn('Google tokenClient notice:', err);
                reject(new Error(err.message || 'Google sign-in popup closed.'));
              }
            });
            tokenClient.requestAccessToken({ prompt: 'select_account' });
            return;
          } catch (gisErr) {
            console.warn('Google Identity Services exception:', gisErr);
          }
        }

        // 2. Google One-Tap prompt fallback
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
          google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
              reject(new Error('Google One-Tap is not displayed. Please use Email OTP.'));
            }
          });
          return;
        }

        reject(new Error('Google services initializing. Please use Email OTP.'));
      });
    },

    /**
     * Complete Session & Local Storage Clear on Sign Out
     */
    async signOut() {
      const client = getSupabase();
      if (client?.auth) {
        try {
          await client.auth.signOut();
        } catch (e) {
          console.warn('Supabase client signOut warning:', e);
        }
      }
      try {
        localStorage.clear();
      } catch (e) {
        const keys = [
          'routemate_user',
          'routemate_auth_token',
          'routemate_driver_kyc',
          'routemate_driver_upi',
          'routemate_location_preferences',
          'routemate_user_rides',
          'routemate_activity_cleared_at',
          'routemate_admin_authorized',
          'routemate_active_ride'
        ];
        keys.forEach(k => { try { localStorage.removeItem(k); } catch (_) {} });
      }
      try {
        sessionStorage.clear();
      } catch (e) {}
      if (typeof window !== 'undefined' && window.google?.accounts?.id?.disableAutoSelect) {
        try { window.google.accounts.id.disableAutoSelect(); } catch (e) {}
      }
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
      const cleanEmail = email ? String(email).trim().toLowerCase() : '';
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      const unpackProfile = (row) => {
        if (!row) return null;
        let extra = {};
        try {
          if (row.role && typeof row.role === 'string' && (row.role.trim().startsWith('{') || row.role.includes('{'))) {
            extra = JSON.parse(row.role);
          }
        } catch (e) {}

        const parsedEmail = extra.email || (row.phone && row.phone.includes('@') ? row.phone : cleanEmail);
        const parsedPhone = (extra.phone && !extra.phone.includes('@'))
          ? extra.phone
          : ((row.phone && !row.phone.includes('@')) ? row.phone : '');
        const parsedName = (row.name && row.name !== 'User' && !row.name.includes('@'))
          ? row.name
          : (extra.name && extra.name !== 'User' && !extra.name.includes('@') ? extra.name : (row.name || ''));
        const parsedRole = extra.role || (row.role && !row.role.startsWith('{') ? row.role : 'Daily Commuter');
        const kycStatus = extra.kyc_status || 'not_submitted';
        const walletBal = extra.wallet_balance !== undefined ? Number(extra.wallet_balance) : (row.wallet_balance !== undefined ? Number(row.wallet_balance) : (kycStatus === 'approved' ? 100 : 0));
        const walletTxs = (Array.isArray(extra.wallet_transactions) && extra.wallet_transactions.length > 0)
          ? extra.wallet_transactions
          : (Array.isArray(row.wallet_transactions) ? row.wallet_transactions : []);
        const vehiclesList = (Array.isArray(extra.vehicles) && extra.vehicles.length > 0)
          ? extra.vehicles
          : (Array.isArray(row.vehicles) ? row.vehicles : []);
        const bonusCredited = (extra.welcome_bonus_credited !== undefined)
          ? extra.welcome_bonus_credited
          : (row.welcome_bonus_credited !== undefined ? row.welcome_bonus_credited : (kycStatus === 'approved'));

        const resolvedUpi = row.upi_id || row.vpa || extra.upi_id || extra.vpa || extra.upiId || '';

        return {
          id: row.id,
          name: parsedName,
          phone: parsedPhone,
          email: parsedEmail,
          gender: extra.gender || '',
          dob: extra.dob || '',
          role: parsedRole,
          rating: row.rating || 5.0,
          total_rides: row.total_rides || 0,
          avatar_url: row.avatar_url || null,
          is_verified: Boolean(row.is_verified === true && kycStatus === 'approved'),
          upi_id: resolvedUpi,
          upiId: resolvedUpi,
          vpa: resolvedUpi,
          kyc_status: kycStatus,
          wallet_balance: walletBal,
          wallet_transactions: walletTxs,
          welcome_bonus_credited: bonusCredited,
          vehicles: vehiclesList,
          settings: extra.settings || {},
          _rawMeta: extra
        };
      };

      try {
        let profile = null;
        let candidateRows = [];

        // 1. Query by UUID if valid (auth.uid())
        if (userId && isUUID(userId)) {
          const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`, {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_CONFIG.publishableKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
            }
          });
          if (resp.ok) {
            const rows = await resp.json();
            if (Array.isArray(rows) && rows.length > 0) candidateRows.push(...rows);
          }
        }

        // 2. Query by email across all columns (role JSON and phone column)
        if (cleanEmail) {
          const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?or=(role.ilike.*${encodeURIComponent(cleanEmail)}*,phone.eq.${encodeURIComponent(cleanEmail)})&select=*`, {
            method: 'GET',
            headers: {
              'apikey': SUPABASE_CONFIG.publishableKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
            }
          });
          if (resp.ok) {
            const rows = await resp.json();
            if (Array.isArray(rows) && rows.length > 0) candidateRows.push(...rows);
          }
        }

        // Prioritize the profile row that contains actual stored credentials (valid 10-digit phone and real name)
        if (candidateRows.length > 0) {
          const bestRow = candidateRows.find(r => {
            let extra = {};
            try { extra = JSON.parse(r.role); } catch (e) {}
            const p = (extra.phone && !extra.phone.includes('@')) ? extra.phone : ((r.phone && !r.phone.includes('@')) ? r.phone : '');
            const digits = p.replace(/\D/g, '');
            const hasGoodName = r.name && r.name !== 'User' && !r.name.includes('@');
            return digits.length >= 10 && hasGoodName;
          }) || candidateRows.find(r => {
            let extra = {};
            try { extra = JSON.parse(r.role); } catch (e) {}
            const p = (extra.phone && !extra.phone.includes('@')) ? extra.phone : ((r.phone && !r.phone.includes('@')) ? r.phone : '');
            return p.replace(/\D/g, '').length >= 10;
          }) || candidateRows[0];

          profile = unpackProfile(bestRow);
        }

        // 4. Enrich or Fallback check in driver_kyc (API gateway or table)
        if (cleanEmail || (userId && isUUID(userId))) {
          try {
            const kycResp = await kyc.getDriverKyc(userId, cleanEmail);
            const kSub = kycResp?.submission || kycResp;
            const kStatus = kycResp?.status || kSub?.status;
            if (kStatus && kStatus !== 'not_submitted') {
              if (!profile) {
                profile = {
                  id: kSub?.user_id || userId || kSub?.id,
                  name: kSub?.driver_name || '',
                  phone: kSub?.driver_phone || '',
                  email: kSub?.driver_email || cleanEmail,
                  role: 'Driver / Commuter',
                  rating: 5.0,
                  total_rides: 0,
                  avatar_url: kSub?.driver_photo || null,
                  is_verified: kStatus === 'approved',
                  kyc_status: kStatus,
                  upi_id: kSub?.upi_id || kycResp?.upi?.id || '',
                  wallet_balance: (kycResp?.wallet?.balance !== undefined) ? Number(kycResp.wallet.balance) : ((kSub?.wallet_balance !== undefined) ? Number(kSub.wallet_balance) : (kStatus === 'approved' ? 100 : 0)),
                  wallet_transactions: (Array.isArray(kycResp?.wallet?.transactions) && kycResp.wallet.transactions.length > 0) ? kycResp.wallet.transactions : (Array.isArray(kSub?.wallet_transactions) ? kSub.wallet_transactions : []),
                  vehicles: (Array.isArray(kycResp?.vehicles) && kycResp.vehicles.length > 0) ? kycResp.vehicles : (Array.isArray(kSub?.vehicles) ? kSub.vehicles : []),
                  welcome_bonus_credited: kycResp?.wallet?.welcomeBonusCredited !== undefined ? kycResp.wallet.welcomeBonusCredited : Boolean(kSub?.welcome_bonus_credited),
                  settings: {},
                  _rawMeta: {}
                };
              } else {
                // Enrich existing profile with KYC and wallet records
                if (!profile.kyc_status || profile.kyc_status === 'not_submitted') {
                  profile.kyc_status = kStatus;
                }
                if (kStatus === 'approved') profile.is_verified = true;
                if (!profile.upi_id && (kSub?.upi_id || kycResp?.upi?.id)) {
                  profile.upi_id = kSub?.upi_id || kycResp?.upi?.id;
                }
                const kBal = (kycResp?.wallet?.balance !== undefined) ? Number(kycResp.wallet.balance) : ((kSub?.wallet_balance !== undefined) ? Number(kSub.wallet_balance) : undefined);
                if (profile.wallet_balance === undefined && kBal !== undefined) {
                  profile.wallet_balance = kBal;
                }
                const kTxs = (Array.isArray(kycResp?.wallet?.transactions) && kycResp.wallet.transactions.length > 0) ? kycResp.wallet.transactions : (Array.isArray(kSub?.wallet_transactions) && kSub.wallet_transactions.length > 0 ? kSub.wallet_transactions : null);
                if ((!profile.wallet_transactions || profile.wallet_transactions.length === 0) && kTxs) {
                  profile.wallet_transactions = kTxs;
                }
                const kVehs = (Array.isArray(kycResp?.vehicles) && kycResp.vehicles.length > 0) ? kycResp.vehicles : (Array.isArray(kSub?.vehicles) && kSub.vehicles.length > 0 ? kSub.vehicles : null);
                if ((!profile.vehicles || profile.vehicles.length === 0) && kVehs) {
                  profile.vehicles = kVehs;
                }
              }
            }
          } catch (kycErr) {
            console.warn('KYC check note in getUserProfile:', kycErr.message);
          }
        }

        if (profile) return profile;
      } catch (e) {
        console.warn('⚠️ [SUPABASE PROFILES] Fetch error:', e);
      }
      return null;
    },

    /**
     * Upsert user profile to Supabase profiles table & Auth metadata
     * Merges non-destructively so no wallet balance, KYC status, or settings are ever lost.
     */
    async saveUserProfile(userId, updates = {}) {
      const { name, phone, email, gender, dob, upiId, upi_id, kycStatus, kyc_status, walletBalance, wallet_balance, walletTransactions, wallet_transactions, vehicles, welcomeBonusCredited, welcome_bonus_credited, settings } = updates;
      if (!userId && !email) throw new Error('User ID or Email is required');
      const cleanEmail = String(email || '').trim().toLowerCase();
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      // Check if user already has an existing row in Supabase
      let existingProfile = null;
      try {
        existingProfile = await this.getUserProfile(userId, cleanEmail);
      } catch (e) {}

      const existingMeta = (existingProfile && existingProfile._rawMeta) || {};
      const cleanName = String(name || existingProfile?.name || '').trim();
      const cleanPhone = String(phone || existingProfile?.phone || '').trim();
      const cleanUpi = String(upiId || upi_id || existingProfile?.upi_id || existingMeta.upi_id || '').trim();
      const userGender = gender !== undefined ? gender : (existingProfile?.gender || existingMeta.gender || '');
      const userDob = dob !== undefined ? dob : (existingProfile?.dob || existingMeta.dob || '');
      const finalKycStatus = kycStatus || kyc_status || existingProfile?.kyc_status || existingMeta.kyc_status || 'not_submitted';
      const finalWalletBalance = (walletBalance !== undefined) ? Number(walletBalance) : ((wallet_balance !== undefined) ? Number(wallet_balance) : ((existingProfile?.wallet_balance !== undefined) ? Number(existingProfile.wallet_balance) : (existingMeta.wallet_balance !== undefined ? Number(existingMeta.wallet_balance) : 0)));
      const finalTransactions = (Array.isArray(walletTransactions) && walletTransactions.length > 0) ? walletTransactions : (Array.isArray(wallet_transactions) && wallet_transactions.length > 0 ? wallet_transactions : (Array.isArray(existingProfile?.wallet_transactions) && existingProfile.wallet_transactions.length > 0 ? existingProfile.wallet_transactions : (Array.isArray(existingMeta.wallet_transactions) ? existingMeta.wallet_transactions : [])));
      const finalVehicles = (Array.isArray(vehicles) && vehicles.length > 0) ? vehicles : (Array.isArray(existingProfile?.vehicles) && existingProfile.vehicles.length > 0 ? existingProfile.vehicles : (Array.isArray(existingMeta.vehicles) ? existingMeta.vehicles : []));
      const finalBonusCredited = (welcomeBonusCredited !== undefined) ? welcomeBonusCredited : ((welcome_bonus_credited !== undefined) ? welcome_bonus_credited : (existingProfile?.welcome_bonus_credited !== undefined ? existingProfile.welcome_bonus_credited : Boolean(existingMeta.welcome_bonus_credited)));
      const finalSettings = settings || existingProfile?.settings || existingMeta.settings || {};

      const metaObj = {
        ...existingMeta,
        role: existingMeta.role || existingProfile?.role || 'Daily Commuter',
        email: cleanEmail || existingMeta.email || '',
        phone: cleanPhone || existingMeta.phone || '',
        gender: userGender,
        dob: userDob,
        upi_id: cleanUpi,
        upiId: cleanUpi,
        vpa: cleanUpi,
        kyc_status: finalKycStatus,
        wallet_balance: finalWalletBalance,
        wallet_transactions: finalTransactions,
        vehicles: finalVehicles,
        welcome_bonus_credited: finalBonusCredited,
        settings: finalSettings
      };

      const payload = {
        name: cleanName,
        phone: cleanPhone,
        role: JSON.stringify(metaObj),
        is_verified: finalKycStatus === 'approved'
      };

      let finalId = (existingProfile && existingProfile.id) || (userId && isUUID(userId) ? userId : null);

      // 1. Update existing row or Upsert row in Supabase profiles
      try {
        if (existingProfile && existingProfile.id) {
          const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?id=eq.${encodeURIComponent(existingProfile.id)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_CONFIG.publishableKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify(payload)
          });
          if (resp.ok) {
            console.log('✅ [SUPABASE PROFILES] Successfully updated profile row without overwriting metadata:', existingProfile.id);
          }
        } else {
          const upsertPayload = { ...payload };
          if (finalId) upsertPayload.id = finalId;
          const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_CONFIG.publishableKey,
              'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'resolution=merge-duplicates,return=representation'
            },
            body: JSON.stringify(upsertPayload)
          });
          if (resp.ok) {
            const created = await resp.json().catch(() => []);
            if (created && created[0] && created[0].id) {
              finalId = created[0].id;
              console.log('✅ [SUPABASE PROFILES] Successfully upserted profile row:', finalId);
            }
          }
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
            gender: userGender,
            dob: userDob
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
          await kyc.updateDriverUpi(finalId || userId, cleanUpi);
        } catch (upiErr) {
          console.warn('⚠️ [DRIVER UPI] Note saving UPI ID:', upiErr.message);
        }
      }

      return {
        id: finalId || userId,
        name: cleanName,
        phone: cleanPhone,
        email: cleanEmail,
        gender: userGender,
        dob: userDob,
        upi_id: cleanUpi,
        upiId: cleanUpi,
        vpa: cleanUpi,
        kyc_status: finalKycStatus,
        wallet_balance: finalWalletBalance,
        wallet_transactions: finalTransactions,
        vehicles: finalVehicles,
        welcome_bonus_credited: finalBonusCredited,
        is_verified: payload.is_verified,
        _rawMeta: metaObj
      };
    },

    /**
     * Delete user account, database-level purge (profiles, drivers, vehicles), and clean sign-out
     */
    async deleteAccount(userId, email = null) {
      if (!userId && !email) throw new Error('User ID or Email is required');
      const cleanUserId = userId;
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;

      // 1. Direct Supabase PostgREST table deletions using auth.uid()
      try {
        if (cleanUserId) {
          await supabaseRest(`profiles?id=eq.${encodeURIComponent(cleanUserId)}`, { method: 'DELETE' });
        }
        if (cleanEmail) {
          await supabaseRest(`profiles?role.ilike.*${encodeURIComponent(cleanEmail)}*`, { method: 'DELETE' });
        }
      } catch (profErr) {
        console.warn('profiles delete notice:', profErr.message);
      }

      try {
        if (cleanUserId) {
          await supabaseRest(`drivers?or=(id.eq.${encodeURIComponent(cleanUserId)},user_id.eq.${encodeURIComponent(cleanUserId)})`, { method: 'DELETE' });
        }
        if (cleanEmail) {
          await supabaseRest(`drivers?or=(email.eq.${encodeURIComponent(cleanEmail)},driver_email.eq.${encodeURIComponent(cleanEmail)})`, { method: 'DELETE' });
        }
      } catch (drvErr) {
        console.warn('drivers delete notice:', drvErr.message);
      }

      try {
        if (cleanUserId) {
          await supabaseRest(`vehicles?or=(user_id.eq.${encodeURIComponent(cleanUserId)},driver_id.eq.${encodeURIComponent(cleanUserId)})`, { method: 'DELETE' });
        }
      } catch (vehErr) {
        console.warn('vehicles delete notice:', vehErr.message);
      }

      try {
        if (cleanUserId) {
          await supabaseRest(`driver_kyc?or=(id.eq.${encodeURIComponent(cleanUserId)},user_id.eq.${encodeURIComponent(cleanUserId)})`, { method: 'DELETE' });
        }
        if (cleanEmail) {
          await supabaseRest(`driver_kyc?driver_email.eq.${encodeURIComponent(cleanEmail)}`, { method: 'DELETE' });
        }
      } catch (kycErr) {
        console.warn('driver_kyc delete notice:', kycErr.message);
      }

      try {
        if (cleanUserId) {
          await supabaseRest(`rides?or=(driver_id.eq.${encodeURIComponent(cleanUserId)},rider_id.eq.${encodeURIComponent(cleanUserId)})`, { method: 'DELETE' });
        }
        if (cleanEmail) {
          await supabaseRest(`rides?rider_email.eq.${encodeURIComponent(cleanEmail)}`, { method: 'DELETE' });
        }
      } catch (ridesErr) {
        console.warn('rides delete notice:', ridesErr.message);
      }

      // 2. Serverless API sync & local fallback purge
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      try {
        await fetch(`${apiBase}/api/driver-kyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'delete_account',
            userId: cleanUserId,
            email: cleanEmail
          })
        });
      } catch (e) {
        console.warn('API delete account error:', e);
      }

      // 3. Complete Sign-Out & Session Clear
      await auth.signOut();

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
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
            const sub = data.submission || {};
            const finalStatus = data.status || sub.status || 'not_submitted';
            return {
              status: finalStatus,
              submission: data.submission || null,
              wallet: data.wallet || null,
              vehicles: data.vehicles || [],
              upi: data.upi || null
            };
          }
        }
      } catch (e) {
        console.warn('KYC check API notice:', e.message);
      }

      // 2. Direct Supabase Fallback to profiles table
      try {
        const cleanEmail = email ? String(email).trim().toLowerCase() : '';
        const isAdmin = cleanEmail === 'shanthankolupula123@gmail.com' || (userId && String(userId).toLowerCase() === 'shanthankolupula123@gmail.com');
        let profFilter = userId && email
          ? `or=(id.eq.${encodeURIComponent(userId)},role.ilike.*${encodeURIComponent(email)}*,phone.eq.${encodeURIComponent(email)})`
          : (userId ? `or=(id.eq.${encodeURIComponent(userId)},role.ilike.*${encodeURIComponent(userId)}*)` : `or=(role.ilike.*${encodeURIComponent(email)}*,phone.eq.${encodeURIComponent(email)})`);
        const resp = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/profiles?${profFilter}&select=*&limit=5`, {
          headers: {
            'apikey': SUPABASE_CONFIG.publishableKey,
            'Authorization': `Bearer ${SUPABASE_CONFIG.publishableKey}`
          }
        });
        if (resp.ok) {
          const rows = await resp.json();
          if (Array.isArray(rows) && rows.length > 0) {
            for (const r of rows) {
              let extra = {};
              try { extra = JSON.parse(r.role); } catch (e) {}
              const hasRealSubmission = Boolean(
                (extra.dl_number && extra.dl_number !== 'ADMIN-DL-001') ||
                (extra.vehicle_number && extra.vehicle_number !== 'TS08-RM-0001') ||
                (extra.kyc_status && extra.kyc_status !== 'not_submitted')
              );
              if (hasRealSubmission) {
                const kStatus = extra.kyc_status || 'pending';
                return {
                  status: kStatus,
                  submission: {
                    ...extra,
                    driver_name: extra.driver_name || r.name,
                    driver_phone: r.phone,
                    driver_email: extra.email || cleanEmail,
                    status: kStatus
                  },
                  wallet: {
                    balance: extra.wallet_balance !== undefined ? extra.wallet_balance : (kStatus === 'approved' ? 100 : 0),
                    transactions: extra.wallet_transactions || []
                  },
                  vehicles: extra.vehicles || [],
                  upi: {
                    id: extra.upi_id || '',
                    qr: extra.upi_qr || ''
                  }
                };
              }
            }
          }
        }
      } catch (e) {}

      return { status: 'not_submitted' };
    },

    /**
     * Submit Driver KYC documents (DL, Aadhaar, RC, Photo)
     */
    async submitDriverKyc(submissionData) {
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
    async getAllKycSubmissions(adminEmail = null) {
      const email = adminEmail || 'shanthankolupula123@gmail.com';
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      const emailParam = encodeURIComponent(email);
      const resp = await fetch(`${apiBase}/api/driver-kyc?adminEmail=${emailParam}`, {
        headers: {
          'x-admin-email': email
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.success) return data.submissions || [];
      }
      return [];
    },

    /**
     * Super Admin decision (Approve / Reject)
     * Supports both object payload and positional arguments
     */
    async reviewDriverKyc(targetIdOrPayload, statusArg, rejectionReasonArg, adminEmailArg) {
      let targetId, status, rejectionReason, adminEmail;
      if (targetIdOrPayload && typeof targetIdOrPayload === 'object') {
        targetId = targetIdOrPayload.id || targetIdOrPayload.userId || targetIdOrPayload.user_id;
        status = targetIdOrPayload.status;
        rejectionReason = targetIdOrPayload.rejectionReason || targetIdOrPayload.rejection_reason;
        adminEmail = targetIdOrPayload.adminEmail || targetIdOrPayload.admin_email;
      } else {
        targetId = targetIdOrPayload;
        status = statusArg;
        rejectionReason = rejectionReasonArg;
        adminEmail = adminEmailArg;
      }
      if (!adminEmail) {
        adminEmail = 'shanthankolupula123@gmail.com';
      }

      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({
          action: 'decision',
          id: targetId,
          userId: targetId,
          user_id: targetId,
          status,
          rejectionReason,
          rejection_reason: rejectionReason,
          adminEmail,
          admin_email: adminEmail
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
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
     * Supports both object payload and positional arguments
     */
    async reviewDriverVehicle(payload, vehicleIdArg, statusArg, rejectionReasonArg, adminEmailArg) {
      let userId, vehicleId, status, rejectionReason, adminEmail;
      if (payload && typeof payload === 'object') {
        userId = payload.userId || payload.user_id;
        vehicleId = payload.vehicleId || payload.vehicle_id;
        status = payload.status;
        rejectionReason = payload.rejectionReason || payload.rejection_reason;
        adminEmail = payload.adminEmail || payload.admin_email;
      } else {
        userId = payload;
        vehicleId = vehicleIdArg;
        status = statusArg;
        rejectionReason = rejectionReasonArg;
        adminEmail = adminEmailArg;
      }
      if (!adminEmail) {
        adminEmail = 'shanthankolupula123@gmail.com';
      }

      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/driver-kyc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({
          action: 'vehicle_decision',
          adminEmail,
          admin_email: adminEmail,
          user_id: userId,
          userId: userId,
          vehicle_id: vehicleId,
          vehicleId: vehicleId,
          status,
          rejectionReason,
          rejection_reason: rejectionReason
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
     * Writes directly to both profiles and drivers tables in Supabase against auth.uid(),
     * and synchronizes with API Gateway.
     */
    async updateDriverUpi(userId, upiId, upiQr = null) {
      const cleanUpi = String(upiId || '').trim();
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      // 1. Direct Supabase write to `profiles` table against auth.uid()
      if (userId) {
        try {
          const profResp = await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
          if (profResp.ok && Array.isArray(profResp.data) && profResp.data[0]) {
            const p = profResp.data[0];
            let extra = {};
            try {
              if (p.role && typeof p.role === 'string' && p.role.includes('{')) {
                extra = JSON.parse(p.role);
              }
            } catch (e) {}
            extra.upi_id = cleanUpi;
            extra.vpa = cleanUpi;
            extra.upiId = cleanUpi;
            if (upiQr) extra.upi_qr = upiQr;
            await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
              method: 'PATCH',
              body: { role: JSON.stringify(extra) }
            });
            console.log('✅ [SUPABASE PROFILES] Synchronized UPI ID to profile role:', cleanUpi);
          }
        } catch (profErr) {
          console.warn('profiles table UPI sync notice:', profErr.message);
        }

        // Direct column update on profiles in case upi_id/vpa columns exist
        try {
          await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            body: { upi_id: cleanUpi, vpa: cleanUpi }
          });
        } catch (colErr) {}

        // 2. Direct Supabase write to `drivers` table against auth.uid()
        try {
          const drvPatch = await supabaseRest(`drivers?or=(id.eq.${encodeURIComponent(userId)},user_id.eq.${encodeURIComponent(userId)})`, {
            method: 'PATCH',
            body: {
              upi_id: cleanUpi,
              vpa: cleanUpi,
              updated_at: new Date().toISOString()
            }
          });
          if (!drvPatch.ok || (Array.isArray(drvPatch.data) && drvPatch.data.length === 0)) {
            await supabaseRest('drivers', {
              method: 'POST',
              prefer: 'resolution=merge-duplicates,return=representation',
              body: {
                id: userId,
                user_id: userId,
                upi_id: cleanUpi,
                vpa: cleanUpi,
                updated_at: new Date().toISOString()
              }
            });
          }
          console.log('✅ [SUPABASE DRIVERS] Synchronized UPI ID to drivers table:', cleanUpi);
        } catch (drvErr) {
          console.warn('drivers table UPI sync notice:', drvErr.message);
        }
      }

      // 3. API Gateway sync to driver-kyc store
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      try {
        const resp = await fetch(`${apiBase}/api/driver-kyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update_upi',
            userId,
            upiId: cleanUpi,
            vpa: cleanUpi,
            upiQr
          })
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return data;
        }
      } catch (apiErr) {
        console.warn('API Gateway update_upi notice:', apiErr.message);
      }

      return { success: true, upiId: cleanUpi, vpa: cleanUpi };
    },

    /**
     * Calculates distance & fare-slab based dynamic commission:
     * - Short (< ₹50 / <= 5km): Micro-commission (Bike: ₹2, Auto: ₹3, Car: ₹3)
     * - Medium (₹50 - ₹150): Scaled moderate commission
     * - Long (> ₹150 / Inter-city): Capped at standard (Bike: ₹5, Auto: ₹10, Car: ₹18)
     */
    calculateDynamicCommission({ fare, distance, vehicleType }) {
      const numFare = Math.max(0, Number(fare) || 0);
      const numDist = Math.max(0, Number(distance) || 0);
      const vType = String(vehicleType || 'bike').toLowerCase();

      let category = 'bike';
      if (vType.includes('car')) category = 'car';
      else if (vType.includes('auto')) category = 'auto';

      if (numFare < 50 || (numDist > 0 && numDist <= 5 && numFare < 75)) {
        const commission = category === 'bike' ? 2 : 3;
        return {
          commission,
          slab: 'short',
          category,
          label: 'Micro-Fee (Short Ride)'
        };
      } else if (numFare <= 150) {
        let commission = 3;
        if (category === 'bike') {
          commission = numFare <= 100 ? 3 : 4;
        } else if (category === 'auto') {
          commission = numFare <= 100 ? 6 : 8;
        } else {
          commission = numFare <= 100 ? 8 : 12;
        }
        return {
          commission,
          slab: 'medium',
          category,
          label: 'Scaled Fee (Medium Ride)'
        };
      } else {
        const commission = category === 'bike' ? 5 : (category === 'auto' ? 10 : 18);
        return {
          commission,
          slab: 'long',
          category,
          label: 'Standard Cap (Long Ride)'
        };
      }
    },

    /**
     * Deducts distance & fare-slab dynamic platform fee from driver wallet upon verified ride completion
     */
    async deductDriverCommission(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
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
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/feedbacks`);
      const data = await resp.json().catch(() => ({}));
      const rawList = data.feedbacks || [];
      // Strictly exclude any demo/mock test feedback so only real passenger reviews appear
      return rawList.filter(f => !f.id?.startsWith('FB-TEST') && f.driverId !== 'drv_sample_1' && f.driverId !== 'drv_sample_2');
    },

    async executeSafetyAction(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      const adminEmail = payload.adminEmail || payload.admin_email || 'shanthankolupula123@gmail.com';

      const resp = await fetch(`${apiBase}/api/feedbacks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail
        },
        body: JSON.stringify({
          action: 'safety_action',
          adminEmail,
          admin_email: adminEmail,
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
    const riderRating = (notes.riderRating !== undefined && notes.riderRating !== null) ? Number(notes.riderRating).toFixed(1) : (notes.rating ? Number(notes.rating).toFixed(1) : '5.0');

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

  // -------------------------------------------------------------------------
  // USER PROFILE RECENT RIDES ACTIVITY SYNC HELPER
  // -------------------------------------------------------------------------
  async function appendProfileRecentRide(userId, rideItem) {
    if (!userId || !rideItem) return;
    try {
      const resp = await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
      if (resp.ok && Array.isArray(resp.data) && resp.data[0]) {
        const p = resp.data[0];
        let extra = {};
        try { extra = JSON.parse(p.role || '{}'); } catch(e){}
        const existingList = Array.isArray(extra.recent_rides) ? extra.recent_rides : [];
        const deduped = [rideItem, ...existingList.filter(r => r.id !== rideItem.id)].slice(0, 30);
        extra.recent_rides = deduped;
        await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          body: { role: JSON.stringify(extra) }
        });
        console.log('✅ [SUPABASE PROFILES] Appended completed ride activity for user:', userId);
      }
    } catch (err) {
      console.warn('appendProfileRecentRide notice:', err);
    }
  }

  /**
   * Calculates Haversine distance in kilometers between two GPS coordinates
   */
  function calculateProximityKm(lat1, lon1, lat2, lon2) {
    if (lat1 === null || lat1 === undefined || lon1 === null || lon1 === undefined ||
        lat2 === null || lat2 === undefined || lon2 === null || lon2 === undefined) {
      return null;
    }
    const nLat1 = Number(lat1), nLon1 = Number(lon1);
    const nLat2 = Number(lat2), nLon2 = Number(lon2);
    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

    const R = 6371; // Earth radius in km
    const dLat = (nLat2 - nLat1) * Math.PI / 180;
    const dLon = (nLon2 - nLon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(nLat1 * Math.PI / 180) * Math.cos(nLat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10;
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
        riderRating: (reqData.riderRating !== undefined && reqData.riderRating !== null) ? Number(reqData.riderRating) : (reqData.rating ? Number(reqData.rating) : 5.0),
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
     * DRIVER: Realtime Channel + 1-second radar polling loop with Geo-Radius Proximity Filtering
     */
    startDriverPolling(currentUser, onRidesUpdated, options = {}) {
      this.stopDriverPolling();
      console.log('📡 [ROUTEMATE DRIVER] Starting Realtime + Radar Polling for user:', currentUser?.name);

      let activeSearchingRides = [];
      const maxRadiusKm = Number(options?.maxRadiusKm || 15);

      const getDriverLocation = () => {
        if (typeof options?.getDriverGPS === 'function') {
          return options.getDriverGPS();
        }
        if (options?.driverGPS) return options.driverGPS;
        if (currentUser?.gps) return currentUser.gps;
        if (typeof window !== 'undefined' && window._driverLiveGPS) return window._driverLiveGPS;
        return null;
      };

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

        // Enforce strict 60-second request lifetime
        const createdMs = new Date(row.created_at || notes.createdAt || Date.now()).getTime();
        const isExpired = (Date.now() - createdMs) > 60000;

        const isCompleted = isExpired || row.status === 'completed' || row.status === 'cancelled' ||
                            notes.status === 'driver_accepted' || notes.status === 'ride_started' ||
                            notes.status === 'ride_completed' || notes.status === 'cancelled' || notes.status === 'expired';
        if (isCompleted) {
          removeRideById(row.vehicle_number || notes.id || row.id);
          return;
        }

        const normalized = normalizeRideData(row);
        if (!normalized) return;

        // Geo-Radius Proximity Filtering (within 10-15 km of driver's live GPS)
        const driverLoc = getDriverLocation();
        if (driverLoc && driverLoc.lat && driverLoc.lng && normalized.pickupLat && normalized.pickupLng) {
          const distKm = calculateProximityKm(driverLoc.lat, driverLoc.lng, normalized.pickupLat, normalized.pickupLng);
          normalized.proximityKm = distKm;
          if (distKm !== null && distKm > maxRadiusKm) {
            console.log(`📍 [PROXIMITY RADAR FILTER] Ride ${normalized.id} pickup is ${distKm} km away (> ${maxRadiusKm} km limit), filtered out.`);
            removeRideById(normalized.id);
            return;
          }
        }

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
          // Strictly query requests created within the last 60 seconds
          const recentCutoff = new Date(Date.now() - 60000).toISOString();
          const resp = await supabaseRest(`rides?select=*&status=neq.cancelled&status=neq.completed&created_at=gte.${recentCutoff}&order=created_at.desc&limit=15`);

          if (!resp.ok || !Array.isArray(resp.data)) return;

          const now = Date.now();
          const freshRides = [];
          const driverLoc = getDriverLocation();

          for (const row of resp.data) {
            if (!row) continue;
            let notes = {};
            try { notes = JSON.parse(row.notes || '{}'); } catch (e) {}

            // Exclude if expired (older than 60s)
            const createdMs = new Date(row.created_at || notes.createdAt || 0).getTime();
            if (now - createdMs > 60000) continue;

            const isCompleted = row.status === 'completed' || row.status === 'cancelled' ||
                                notes.status === 'driver_accepted' || notes.status === 'ride_started' ||
                                notes.status === 'ride_completed' || notes.status === 'cancelled' || notes.status === 'expired';
            if (isCompleted) continue;

            // Strict Session Isolation: Exclude own rides
            if (isSelfBookedRide(row, currentUser)) {
              continue;
            }

            const normalized = normalizeRideData(row);
            if (!normalized) continue;

            // Geo-Radius Proximity Filtering (within 10-15 km of driver's live GPS)
            if (driverLoc && driverLoc.lat && driverLoc.lng && normalized.pickupLat && normalized.pickupLng) {
              const distKm = calculateProximityKm(driverLoc.lat, driverLoc.lng, normalized.pickupLat, normalized.pickupLng);
              normalized.proximityKm = distKm;
              if (distKm !== null && distKm > maxRadiusKm) {
                continue; // Skip rides outside driver's 15km live radius
              }
            }

            freshRides.push(normalized);
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
     * DRIVER: Accept a ride request atomically with race-condition prevention & state lock resolution
     */
    async acceptRequest(requestId, driverUser, optionalDbId) {
      console.log('⚡ [ROUTEMATE DRIVER] Accepting ride:', requestId, 'dbId:', optionalDbId);
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      // Dynamically resolve driver's registered UPI ID from driver profile
      let resolvedUpiId = driverUser.upi_id || driverUser.upiId || driverUser.upi?.id || '';
      let resolvedUpiQr = driverUser.upi_qr || driverUser.upiQr || driverUser.upi?.qr || '';

      if (!resolvedUpiId && driverUser.phone) {
        const cleanP = String(driverUser.phone).replace(/\D/g, '').slice(-10);
        if (cleanP.length === 10) resolvedUpiId = `${cleanP}@upi`;
      }

      const driverPayload = {
        id: driverUser.id,
        name: driverUser.name,
        phone: driverUser.phone,
        email: driverUser.email,
        avatar: (driverUser.avatar_url && !driverUser.avatar_url.includes('unsplash')) ? driverUser.avatar_url : (driverUser.avatar && !driverUser.avatar.includes('unsplash') ? driverUser.avatar : getSvgInitialsAvatar(driverUser.name || 'Driver', '#10B981')),
        vehicleName: driverUser.vehicleName || driverUser.vehicle_name || 'Verified Commuter Vehicle',
        vehicleNumber: driverUser.vehicleNumber || driverUser.vehicle_number || 'TG 08 AB 1234',
        vehicleType: driverUser.vehicleType || driverUser.vehicle_type || 'bike',
        upiId: resolvedUpiId,
        upi_id: resolvedUpiId,
        upiQr: resolvedUpiQr,
        upi_qr: resolvedUpiQr,
        rating: (driverUser.rating !== undefined && driverUser.rating !== null) ? Number(driverUser.rating) : 5.0
      };

      // 1. Fetch existing row by optionalDbId (UUID), vehicle_number, ID, or notes.id
      let existingNotes = {};
      let existingRow = null;
      try {
        if (optionalDbId && isUUID(optionalDbId)) {
          const fetchDb = await supabaseRest(`rides?id=eq.${encodeURIComponent(optionalDbId)}&select=*&limit=1`);
          if (fetchDb.ok && Array.isArray(fetchDb.data) && fetchDb.data[0]) {
            existingRow = fetchDb.data[0];
          }
        }

        if (!existingRow && isUUID(requestId)) {
          const fetchUuid = await supabaseRest(`rides?id=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
          if (fetchUuid.ok && Array.isArray(fetchUuid.data) && fetchUuid.data[0]) {
            existingRow = fetchUuid.data[0];
          }
        }

        if (!existingRow) {
          const fetchVeh = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
          if (fetchVeh.ok && Array.isArray(fetchVeh.data) && fetchVeh.data[0]) {
            existingRow = fetchVeh.data[0];
          }
        }

        if (!existingRow) {
          const fetchNotes = await supabaseRest(`rides?notes=ilike.*${encodeURIComponent(requestId)}*&select=*&limit=1`);
          if (fetchNotes.ok && Array.isArray(fetchNotes.data) && fetchNotes.data[0]) {
            existingRow = fetchNotes.data[0];
          }
        }

        if (existingRow) {
          if (typeof existingRow.notes === 'string') {
            try { existingNotes = JSON.parse(existingRow.notes || '{}'); } catch (e) {}
          } else if (existingRow.notes && typeof existingRow.notes === 'object') {
            existingNotes = existingRow.notes;
          }
        }
      } catch (e) {
        console.warn('Error fetching ride before acceptance:', e);
      }

      if (!existingRow) {
        // Fallback: Query backend serverless endpoint
        try {
          const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://www.routemate.pro';
          const apiRes = await fetch(`${apiBase}/api/driver-kyc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept_ride',
              requestId,
              dbId: optionalDbId,
              driver: driverPayload
            })
          });
          const apiData = await apiRes.json().catch(() => ({}));
          if (apiData.success && apiData.row) {
            existingRow = apiData.row;
            return {
              success: true,
              ride: {
                ...normalizeRideData(existingRow),
                status: 'driver_accepted',
                driver: driverPayload
              }
            };
          }
        } catch (_) {}

        return { success: false, notFound: true, message: 'Ride request not found or has already expired.' };
      }

      // 2. Check current status & assignment
      const currentStatus = String(existingRow.status || existingNotes.status || '').toLowerCase();
      const assignedDriverId = existingRow.driver_id || existingNotes.driverId || existingNotes.driver?.id;
      const assignedDriverEmail = existingNotes.driverEmail || existingNotes.driver?.email;

      // Idempotency: If this driver ALREADY accepted it, treat as success!
      if (assignedDriverId && (assignedDriverId === driverUser.id || (driverUser.email && assignedDriverEmail === driverUser.email))) {
        console.log('✅ Driver already assigned to this ride, returning success.');
        return { success: true, alreadyAccepted: true, ride: normalizeRideData(existingRow) };
      }

      // If already accepted by someone else:
      if ((currentStatus === 'accepted' || existingNotes.status === 'driver_accepted' || existingNotes.status === 'ride_started') && assignedDriverId && assignedDriverId !== driverUser.id) {
        return { success: false, alreadyTaken: true, message: 'This ride has already been accepted by another driver.' };
      }

      if (currentStatus === 'cancelled' || existingNotes.status === 'cancelled') {
        return { success: false, cancelled: true, message: 'This ride was cancelled by the commuter.' };
      }

      // Check expiry with 90s grace window (allowing in-flight accepts without false timeout rejection)
      const createdMs = new Date(existingRow.created_at || existingNotes.createdAt || 0).getTime();
      const ageSec = Math.floor((Date.now() - createdMs) / 1000);
      if (ageSec > 90 && (existingNotes.status === 'expired' || currentStatus === 'expired')) {
        return { success: false, expired: true, message: 'This ride request has expired.' };
      }

      const mergedNotes = {
        ...existingNotes,
        isRequest: true,
        status: 'driver_accepted',
        driverId: driverUser.id,
        driverName: driverUser.name,
        driverPhone: driverUser.phone,
        driverEmail: driverUser.email,
        driver: driverPayload,
        acceptedAt: new Date().toISOString()
      };

      // 3. ATOMIC UPDATE in Supabase
      const patchBody = {
        status: 'accepted',
        driver_name: driverUser.name || 'Verified Driver',
        driver_role: 'Driver',
        notes: JSON.stringify(mergedNotes)
      };
      if (isUUID(driverUser.id)) {
        patchBody.driver_id = driverUser.id;
      }

      let patchSuccess = false;
      let finalRow = existingRow;

      // Attempt 1: Call Atomic RPC Function (if installed in Supabase SQL editor)
      if (isUUID(existingRow.id)) {
        try {
          const rpcRes = await supabaseRest('rpc/accept_ride_request', {
            method: 'POST',
            body: {
              p_ride_id: existingRow.id,
              p_driver_id: isUUID(driverUser.id) ? driverUser.id : null,
              p_driver_name: driverUser.name || 'Verified Driver',
              p_driver_phone: driverUser.phone || '',
              p_driver_email: driverUser.email || '',
              p_driver_avatar: driverPayload.avatar || '',
              p_vehicle_number: driverPayload.vehicleNumber || 'TG 08 AB 1234',
              p_vehicle_type: driverPayload.vehicleType || 'bike',
              p_upi_id: resolvedUpiId,
              p_upi_qr: resolvedUpiQr
            }
          });
          if (rpcRes.ok && rpcRes.data) {
            if (rpcRes.data.alreadyAccepted) {
              return { success: true, alreadyAccepted: true, ride: normalizeRideData(existingRow) };
            }
            if (rpcRes.data.alreadyTaken) {
              return { success: false, alreadyTaken: true, message: rpcRes.data.message };
            }
            if (rpcRes.data.cancelled) {
              return { success: false, cancelled: true, message: rpcRes.data.message };
            }
            if (rpcRes.data.success) {
              patchSuccess = true;
              finalRow = { ...existingRow, ...patchBody, notes: mergedNotes };
              console.log('✅ [ATOMIC RPC SUCCESS] Ride accepted via public.accept_ride_request');
            }
          }
        } catch (rpcErr) {
          console.warn('RPC accept notice:', rpcErr.message);
        }
      }

      // Attempt 2: Direct REST PATCH with check-constraint safety
      if (!patchSuccess) {
        const patchResp = await supabaseRest(`rides?id=eq.${encodeURIComponent(existingRow.id)}`, {
          method: 'PATCH',
          prefer: 'return=representation',
          body: patchBody
        });

        if (patchResp.ok) {
          patchSuccess = true;
          if (Array.isArray(patchResp.data) && patchResp.data[0]) {
            finalRow = patchResp.data[0];
          } else {
            finalRow = { ...existingRow, ...patchBody, notes: mergedNotes };
          }
        } else if (patchResp.data?.code === '23514' || String(patchResp.data?.message || '').includes('check constraint')) {
          // If check constraint restricts status: 'accepted', safely update with status: 'active' and notes.status: 'driver_accepted'
          console.log('⚠️ Status check constraint hit on client, updating with status: active and notes.status: driver_accepted');
          patchBody.status = 'active';
          const retryPatch = await supabaseRest(`rides?id=eq.${encodeURIComponent(existingRow.id)}`, {
            method: 'PATCH',
            prefer: 'return=representation',
            body: patchBody
          });
          if (retryPatch.ok) {
            patchSuccess = true;
            finalRow = (Array.isArray(retryPatch.data) && retryPatch.data[0]) ? retryPatch.data[0] : { ...existingRow, ...patchBody, notes: mergedNotes };
          }
        }
      }

      // Attempt 3: Fallback using backend serverless API
      if (!patchSuccess) {
        try {
          const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://www.routemate.pro';
          const apiRes = await fetch(`${apiBase}/api/driver-kyc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'accept_ride',
              requestId,
              dbId: existingRow.id,
              driver: driverPayload
            })
          });
          const apiData = await apiRes.json().catch(() => ({}));
          if (apiData.success) {
            patchSuccess = true;
            finalRow = apiData.row || { ...existingRow, ...patchBody, notes: mergedNotes };
          }
        } catch (apiErr) {
          console.warn('API fallback error:', apiErr);
        }
      }

      if (!patchSuccess) {
        return { success: false, message: 'Failed to update ride status in database. Please check your network and try again.' };
      }

      // 4. Broadcast acceptance to Rider and Radar channels via WebSockets
      const client = getSupabase();
      if (client) {
        try {
          const directChannels = [
            `rider-ride-${requestId}`,
            `rider-ride-${existingRow.vehicle_number}`,
            `rider-ride-${existingRow.id}`
          ];
          directChannels.forEach(chName => {
            try {
              const ch = client.channel(chName);
              ch.send({
                type: 'broadcast',
                event: 'driver_accepted',
                payload: {
                  status: 'driver_accepted',
                  requestId: existingRow.vehicle_number || requestId,
                  driver: driverPayload,
                  ...mergedNotes
                }
              });
            } catch (_) {}
          });

          // Broadcast removal to all other drivers' radars
          const radarChannel = client.channel('routemate-radar-feed');
          radarChannel.send({
            type: 'broadcast',
            event: 'cancel_ride_broadcast',
            payload: { id: requestId, vehicleNumber: existingRow.vehicle_number, takenBy: driverUser.id }
          });
        } catch (e) {}
      }

      return {
        success: true,
        ride: {
          ...normalizeRideData(finalRow),
          status: 'driver_accepted',
          driver: driverPayload
        }
      };
    },

    /**
     * Clean 60-Second Request Expiry in Backend & Radar
     */
    async expireRequest(requestId) {
      console.log('⏱️ [ROUTEMATE] Cleanly expiring ride request (60s timeout):', requestId);
      if (!requestId) return { success: false };
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      // 1. Broadcast expiry across realtime channels
      const client = getSupabase();
      if (client) {
        try {
          const radarChannel = client.channel('routemate-radar-feed');
          radarChannel.send({
            type: 'broadcast',
            event: 'cancel_ride_broadcast',
            payload: { id: requestId, expired: true }
          });

          const riderChannel = client.channel(`rider-ride-${requestId}`);
          riderChannel.send({
            type: 'broadcast',
            event: 'ride_expired',
            payload: { requestId, status: 'expired' }
          });
        } catch (e) {}
      }

      // 2. Mark as expired/cancelled in Supabase rides table
      try {
        const filter = isUUID(requestId)
          ? `or=(id.eq.${encodeURIComponent(requestId)},vehicle_number.eq.${encodeURIComponent(requestId)})`
          : `vehicle_number=eq.${encodeURIComponent(requestId)}`;

        await supabaseRest(`rides?${filter}`, {
          method: 'PATCH',
          body: {
            status: 'cancelled',
            notes: JSON.stringify({ isRequest: true, status: 'expired', expiredAt: new Date().toISOString() })
          }
        });
      } catch (e) {}

      // 3. API Gateway sync
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';
      try {
        await fetch(`${apiBase}/api/driver-kyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'expire_ride', requestId })
        });
      } catch (e) {}

      return { success: true };
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
          notes: JSON.stringify({ isRequest: true, status: 'cancelled', cancelledAt: new Date().toISOString() })
        }
      });
    },

    async startRide(requestId) {
      let existingNotes = {};
      try {
        const fetchResp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
        if (fetchResp.ok && Array.isArray(fetchResp.data) && fetchResp.data[0]) {
          const r = fetchResp.data[0];
          if (typeof r.notes === 'string') {
            try { existingNotes = JSON.parse(r.notes || '{}'); } catch (e) {}
          } else if (r.notes && typeof r.notes === 'object') {
            existingNotes = r.notes;
          }
        }
      } catch (e) {}

      const mergedNotes = {
        ...existingNotes,
        status: 'ride_started',
        startedAt: new Date().toISOString()
      };

      const client = getSupabase();
      if (client) {
        try {
          const riderDirect = client.channel(`rider-ride-${requestId}`);
          riderDirect.send({
            type: 'broadcast',
            event: 'ride_started',
            payload: { status: 'ride_started', requestId, ...mergedNotes }
          });
        } catch (e) {}
      }

      return await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: { status: 'in_progress', notes: JSON.stringify(mergedNotes) }
      });
    },

    async notifyDriverPayment(requestId, paymentInfo = {}) {
      let existingNotes = {};
      try {
        const fetchResp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
        if (fetchResp.ok && Array.isArray(fetchResp.data) && fetchResp.data[0]) {
          const r = fetchResp.data[0];
          if (typeof r.notes === 'string') {
            try { existingNotes = JSON.parse(r.notes || '{}'); } catch (e) {}
          } else if (r.notes && typeof r.notes === 'object') {
            existingNotes = r.notes;
          }
        }
      } catch (e) {}

      const mergedNotes = {
        ...existingNotes,
        isRequest: true,
        paymentSettled: true,
        paymentMethod: paymentInfo.paymentMethod || 'upi',
        settledAt: new Date().toISOString(),
        ...paymentInfo
      };

      const client = getSupabase();
      if (client) {
        try {
          const riderDirect = client.channel(`rider-ride-${requestId}`);
          riderDirect.send({
            type: 'broadcast',
            event: 'rider_payment_ready',
            payload: {
              status: 'rider_payment_ready',
              requestId,
              ...mergedNotes
            }
          });
        } catch (e) {}
      }

      // Also persist payment settlement metadata in Supabase rides table
      try {
        await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
          method: 'PATCH',
          body: {
            notes: JSON.stringify(mergedNotes)
          }
        });
      } catch (e) {}

      return { success: true };
    },

    async completeRide(requestId, completedData = {}) {
      let existingNotes = {};
      let existingRow = null;
      try {
        const fetchResp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}&select=*&limit=1`);
        if (fetchResp.ok && Array.isArray(fetchResp.data) && fetchResp.data[0]) {
          existingRow = fetchResp.data[0];
          if (typeof existingRow.notes === 'string') {
            try { existingNotes = JSON.parse(existingRow.notes || '{}'); } catch (e) {}
          } else if (existingRow.notes && typeof existingRow.notes === 'object') {
            existingNotes = existingRow.notes;
          }
        }
      } catch (e) {}

      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
      const completedAt = new Date().toISOString();

      const mergedNotes = {
        ...existingNotes,
        isRequest: true,
        status: 'completed',
        completedAt: completedAt,
        paymentVerifiedByDriver: true,
        riderId: completedData.riderId || existingNotes.riderId || '',
        riderName: completedData.riderName || existingNotes.riderName || 'Commuter',
        riderEmail: completedData.riderEmail || existingNotes.riderEmail || '',
        riderPhone: completedData.riderPhone || existingNotes.riderPhone || '',
        driverId: completedData.driverId || existingNotes.driverId || (existingNotes.driver && existingNotes.driver.id) || '',
        driverName: completedData.driverName || existingNotes.driverName || (existingNotes.driver && existingNotes.driver.name) || 'Verified Driver',
        driverPhone: completedData.driverPhone || existingNotes.driverPhone || (existingNotes.driver && existingNotes.driver.phone) || '',
        driverEmail: completedData.driverEmail || existingNotes.driverEmail || (existingNotes.driver && existingNotes.driver.email) || '',
        driver: {
          ...(existingNotes.driver || {}),
          ...(completedData.driver || {})
        },
        pickup: completedData.pickup || existingNotes.pickup || existingRow?.pickup || 'Pickup Location',
        drop: completedData.drop || existingNotes.drop || existingRow?.drop_location || 'Drop Location',
        fare: completedData.fare !== undefined ? completedData.fare : (existingNotes.fare !== undefined ? existingNotes.fare : existingRow?.per_seat_price || 110),
        distance: completedData.distance !== undefined ? completedData.distance : (existingNotes.distance !== undefined ? existingNotes.distance : 0),
        vehicleType: completedData.vehicleType || existingNotes.vehicleType || existingRow?.vehicle_type || 'bike',
        paymentMethod: completedData.paymentMethod || existingNotes.paymentMethod || 'upi',
        commissionDeducted: completedData.commissionDeducted !== undefined ? completedData.commissionDeducted : existingNotes.commissionDeducted,
        commissionSlab: completedData.commissionSlab || existingNotes.commissionSlab || 'standard',
        vehicleNumber: completedData.vehicleNumber || existingNotes.vehicleNumber || existingRow?.vehicle_number || ''
      };

      const patchBody = {
        status: 'completed',
        driver_name: mergedNotes.driverName,
        per_seat_price: mergedNotes.fare,
        pickup: mergedNotes.pickup,
        drop_location: mergedNotes.drop,
        notes: JSON.stringify(mergedNotes)
      };
      if (isUUID(mergedNotes.driverId)) {
        patchBody.driver_id = mergedNotes.driverId;
      }

      // Update Supabase rides table
      const resp = await supabaseRest(`rides?vehicle_number=eq.${encodeURIComponent(requestId)}`, {
        method: 'PATCH',
        body: patchBody
      });

      // Broadcast ride completion across Realtime WebSockets to Commuter
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
              ...mergedNotes
            }
          });
        } catch (e) {}
      }

      // Automatically insert dual-user permanent activity records in Supabase profiles
      const driverActivityRecord = {
        id: requestId,
        dbId: existingRow?.id || requestId,
        userRole: 'driver',
        roleLabel: 'Completed Ride as Driver',
        status: 'completed',
        pickup: mergedNotes.pickup,
        drop: mergedNotes.drop,
        fare: mergedNotes.fare,
        distance: mergedNotes.distance,
        vehicleType: mergedNotes.vehicleType,
        paymentMethod: mergedNotes.paymentMethod,
        driverId: mergedNotes.driverId,
        driverName: mergedNotes.driverName,
        riderId: mergedNotes.riderId,
        riderName: mergedNotes.riderName,
        createdAt: completedAt
      };

      const commuterActivityRecord = {
        ...driverActivityRecord,
        userRole: 'commuter',
        roleLabel: 'Completed Trip as Commuter'
      };

      if (isUUID(mergedNotes.driverId)) {
        appendProfileRecentRide(mergedNotes.driverId, driverActivityRecord).catch(() => {});
      }
      if (isUUID(mergedNotes.riderId)) {
        appendProfileRecentRide(mergedNotes.riderId, commuterActivityRecord).catch(() => {});
      }

      return resp;
    },

    /**
     * Permanent Activity History Deletion from Supabase database
     */
    async deleteUserActivities(user) {
      if (!user) return { success: false };
      const userId = user.id ? String(user.id).trim() : '';
      const userEmail = user.email ? String(user.email).trim().toLowerCase() : '';
      const userPhoneDigits = String(user.phone || '').replace(/\D/g, '').slice(-10);
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      console.log('🗑️ [SUPABASE RIDES] Permanently clearing activity records for user:', userId, userEmail);

      // 1. Delete rows from rides table where user was driver
      if (userId && isUUID(userId)) {
        try {
          await supabaseRest(`rides?driver_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
        } catch (e) {}
      }

      // 2. Delete rows from rides table where user was rider (or in notes)
      if (userId) {
        try {
          await supabaseRest(`rides?notes=ilike.*${encodeURIComponent(userId)}*`, { method: 'DELETE' });
        } catch (e) {}
      }
      if (userEmail) {
        try {
          await supabaseRest(`rides?notes=ilike.*${encodeURIComponent(userEmail)}*`, { method: 'DELETE' });
        } catch (e) {}
      }
      if (userPhoneDigits && userPhoneDigits.length >= 10) {
        try {
          await supabaseRest(`rides?notes=ilike.*${encodeURIComponent(userPhoneDigits)}*`, { method: 'DELETE' });
        } catch (e) {}
      }

      // 3. Clear recent_rides from user's Supabase profiles role JSON
      try {
        if (userId && isUUID(userId)) {
          const profResp = await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
          if (profResp.ok && Array.isArray(profResp.data) && profResp.data[0]) {
            const p = profResp.data[0];
            let extra = {};
            try { extra = JSON.parse(p.role || '{}'); } catch (e) {}
            extra.recent_rides = [];
            await supabaseRest(`profiles?id=eq.${encodeURIComponent(userId)}`, {
              method: 'PATCH',
              body: { role: JSON.stringify(extra) }
            });
          }
        }
      } catch (e) {}

      return { success: true };
    }
  };

  // -------------------------------------------------------------------------
  // BROADCAST NOTIFICATION SERVICE (SUPER ADMIN DISPATCH & REALTIME DELIVERY)
  // -------------------------------------------------------------------------
  const broadcast = {
    async getBroadcasts() {
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';
      try {
        const resp = await fetch(`${apiBase}/api/broadcast`);
        const data = await resp.json().catch(() => ({}));
        return data?.broadcasts || [];
      } catch (e) {
        return [];
      }
    },

    async sendBroadcast(payload) {
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      const resp = await fetch(`${apiBase}/api/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json().catch(() => ({}));

      // Broadcast over Supabase Realtime channel for live active users
      if (data?.success && data?.broadcast) {
        try {
          const client = getSupabase();
          if (client) {
            const ch = client.channel('routemate-broadcasts');
            await ch.send({
              type: 'broadcast',
              event: 'new_broadcast',
              payload: data.broadcast
            });
          }
        } catch (rtErr) {
          console.warn('[Broadcast Realtime Notice]:', rtErr.message);
        }
      }

      return data;
    }
  };

  // -------------------------------------------------------------------------
  // NOTIFICATIONS SERVICE (DATABASE-BACKED NOTIFICATIONS & CLEAR ACTIONS)
  // -------------------------------------------------------------------------
  const notifications = {
    async getNotifications(options = {}) {
      const userId = options.userId || '';
      const userRole = (options.userRole || 'commuter').toLowerCase(); // 'driver' or 'commuter'

      let items = [];
      try {
        const client = getSupabase();
        if (client) {
          const { data, error } = await client
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

          if (!error && Array.isArray(data)) {
            items = data;
          }
        }
      } catch (e) {
        // Fallback to REST
        try {
          const res = await supabaseRest('notifications?select=*&order=created_at.desc&limit=50');
          if (Array.isArray(res)) items = res;
        } catch (restErr) {}
      }

      // Filter by recipient role and userId
      return items.filter(n => {
        if (n.user_id && userId && String(n.user_id) === String(userId)) return true;
        if (!n.user_id || n.user_id === 'all') {
          const role = String(n.recipient_role || 'all').toLowerCase();
          if (role === 'all') return true;
          if (role === 'drivers' && (userRole === 'driver' || userRole === 'drivers')) return true;
          if (role === 'commuters' && (userRole === 'commuter' || userRole === 'commuters' || userRole === 'rider')) return true;
        }
        return false;
      });
    },

    async clearNotifications(userId) {
      if (!userId) return { success: true };

      // 1. Delete user-specific notification rows from Supabase `notifications` table
      try {
        const client = getSupabase();
        if (client) {
          await client.from('notifications').delete().eq('user_id', userId);
        } else {
          await supabaseRest(`notifications?user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE' });
        }
      } catch (dbErr) {
        console.warn('Notice: delete from public.notifications:', dbErr.message);
      }

      // 2. Call backend endpoint to purge user's warnings & broadcasts from profile role JSON
      const apiBase = (typeof window !== 'undefined' && window.location && window.location.origin)
        ? window.location.origin
        : 'https://www.routemate.pro';

      try {
        const resp = await fetch(`${apiBase}/api/driver-kyc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clear_notifications',
            userId: userId
          })
        });
        const data = await resp.json().catch(() => ({}));
        return { success: true, ...data };
      } catch (apiErr) {
        console.warn('Notice: clear_notifications API call:', apiErr.message);
        return { success: true };
      }
    }
  };

  // Export clean global database object
  window.db = {
    getSupabase,
    auth,
    kyc,
    feedbacks,
    broadcast,
    notifications,
    supabaseRest,
    matching,
    isSelfBookedRide,
    normalizeRideData
  };

})(window);
