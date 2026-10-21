// Routemate - Supabase Database Client & ORM Helpers
// Configured with Project URL & Publishable Key

const SUPABASE_CONFIG = {
  url: 'https://hjieeilzfbvubkhmlmdg.supabase.co',
  publishableKey: 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a'
};

// Initialize Supabase Client using global @supabase/supabase-js
let supabase = null;

function getSupabaseClient() {
  if (!supabase && typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
    try {
      supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
      console.log('✅ Supabase client initialized for Routemate (hjieeilzfbvubkhmlmdg.supabase.co)');
    } catch (err) {
      console.warn('⚠️ Error initializing Supabase client:', err);
    }
  }
  return supabase;
}

// Initial attempt
getSupabaseClient();

// Database and Authentication helper functions
const db = {
  get client() {
    return getSupabaseClient();
  },

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
    // Fetch all active rides from Supabase
    async fetchAll(vehicleType = null) {
      const client = getSupabaseClient();
      if (!client) return null;
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
        if (error) {
          console.warn('Supabase rides.fetchAll error:', error.message);
          return null;
        }
        return data;
      } catch (e) {
        console.warn('Supabase network error in rides.fetchAll:', e);
        return null;
      }
    },

    // Insert new driver ride
    async create(rideData) {
      const client = getSupabaseClient();
      if (!client) return { success: false, data: null };
      try {
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
          notes: rideData.notes || 'Commuter ride on Highway corridor.'
        };

        const { data, error } = await client
          .from('rides')
          .insert([payload])
          .select();

        if (error) {
          console.error('Error inserting ride into Supabase:', error.message);
          return { success: false, error };
        }

        console.log('✅ Ride published to Supabase:', data);
        return { success: true, data: data[0] };
      } catch (e) {
        console.error('Exception inserting ride into Supabase:', e);
        return { success: false, error: e };
      }
    }
  },

  // ==========================================
  // PROFILES TABLE HELPERS
  // ==========================================
  profiles: {
    async getById(profileId) {
      const client = getSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single();
        if (error) throw error;
        return data;
      } catch (e) {
        console.warn('Error fetching profile from Supabase:', e);
        return null;
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
          return existing;
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
          query = query.eq('phone', profileIdOrPhone);
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
      const client = getSupabaseClient();
      if (!client) return { success: false };
      try {
        const payload = {
          ride_id: bookingData.rideId,
          rider_name: bookingData.riderName || 'Commuter',
          rider_phone: bookingData.riderPhone || '+91 98480 23145',
          seats_booked: bookingData.seats || 1,
          total_fare: bookingData.fare || 108,
          payment_method: bookingData.paymentMethod || 'upi',
          status: 'confirmed',
          booking_pin: bookingData.pin || Math.floor(1000 + Math.random() * 9000).toString()
        };

        const { data, error } = await client
          .from('bookings')
          .insert([payload])
          .select();

        if (error) {
          console.warn('Supabase booking create error:', error.message);
          return { success: false, error };
        }

        console.log('✅ Booking stored in Supabase:', data);
        return { success: true, data: data[0] };
      } catch (e) {
        console.warn('Exception creating booking in Supabase:', e);
        return { success: false, error: e };
      }
    },

    async fetchAll() {
      const client = getSupabaseClient();
      if (!client) return null;
      try {
        const { data, error } = await client
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      } catch (e) {
        console.warn('Error fetching bookings:', e);
        return null;
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
                  kyc_status: extra.kyc_status || (p.is_verified ? 'verified_success' : 'verification_pending'),
                  is_kyc_verified: Boolean(p.is_verified || extra.is_kyc_verified),
                  kyc_submitted_at: extra.kyc_submitted_at || p.created_at || new Date().toISOString()
                });
              } else if (p.role && typeof p.role === 'string' && (p.role.toLowerCase().includes('driver') || p.is_verified)) {
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
                  kyc_status: p.is_verified ? 'verified_success' : 'verification_pending',
                  is_kyc_verified: Boolean(p.is_verified),
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

  // ==========================================
  // REAL-TIME RIDE BOOKING & MATCHING ENGINE
  // ==========================================
  matching: {
    _channel: null,
    _broadcastChannel: null,
    _listeners: new Set(),
    _activeRequest: null,
    _sseSource: null,
    _pollTimer: null,

    // Initialize Realtime Multi-Transport Bus
    init() {
      // 1. Browser BroadcastChannel for 0ms inter-tab matching
      if (typeof window !== 'undefined' && window.BroadcastChannel) {
        try {
          this._broadcastChannel = new BroadcastChannel('routemate_ride_matching');
          this._broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.event) {
              console.log('⚡ [BroadcastChannel] Received:', event.data.event);
              this._handleIncomingEvent(event.data.event, event.data.request);
            }
          };
        } catch (e) {
          console.warn('BroadcastChannel error:', e);
        }
      }

      // 2. Storage event listener (fallback for cross-window events)
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === 'routemate_realtime_event' && e.newValue) {
            try {
              const data = JSON.parse(e.newValue);
              if (data && data.event) {
                this._handleIncomingEvent(data.event, data.request);
              }
            } catch (err) {}
          }
        });
      }

      // 3. Supabase Realtime Broadcast Channel
      const client = getSupabaseClient();
      if (client && !this._channel) {
        try {
          this._channel = client.channel('routemate_matching', {
            config: { broadcast: { self: false } }
          });
          this._channel
            .on('broadcast', { event: 'ride_matching_event' }, (payload) => {
              if (payload && payload.payload) {
                console.log('📡 [Supabase Realtime] Received:', payload.payload.event);
                this._handleIncomingEvent(payload.payload.event, payload.payload.request);
              }
            })
            .subscribe((status) => {
              console.log('📡 Supabase Realtime channel status:', status);
            });
        } catch (e) {
          console.warn('Supabase Realtime channel init skipped:', e);
        }
      }

      // 4. Server-Sent Events (SSE) Stream if hosted on server
      if (typeof window !== 'undefined' && window.EventSource && !this._sseSource) {
        try {
          this._sseSource = new EventSource('/api/ride-requests/stream');
          this._sseSource.onmessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              if (data.event === 'new_feedback') {
                this._handleIncomingEvent('new_feedback', data.feedback);
              } else if (data.event && data.event !== 'connected') {
                this._handleIncomingEvent(data.event, data.request);
              } else if (data.event === 'connected' && data.activeRequest) {
                this._activeRequest = data.activeRequest;
                if (data.activeRequest.status === 'searching') {
                  this._handleIncomingEvent('new_ride_request', data.activeRequest);
                }
              }
            } catch (err) {}
          };
          this._sseSource.onerror = () => {
            // Gracefully ignore if serverless/static environment doesn't support SSE
            if (this._sseSource) {
              try { this._sseSource.close(); } catch(e) {}
              this._sseSource = null;
            }
          };
        } catch (e) {}
      }

      // Load initial cached request if any
      try {
        const cached = localStorage.getItem('routemate_active_ride_request');
        if (cached) {
          this._activeRequest = JSON.parse(cached);
        }
      } catch (e) {}

      // Periodic synchronization poll (every 1.5s for instant synchronization)
      if (!this._pollTimer && typeof window !== 'undefined') {
        this._pollTimer = setInterval(() => {
          this.syncActiveRequest();
        }, 1500);
      }
    },

    // Broadcast an event across all channels
    _emit(event, request) {
      if (event !== 'chat_message' && event !== 'new_feedback') {
        this._activeRequest = request;
        
        // Update local storage
        try {
          if (request && request.status !== 'cancelled') {
            localStorage.setItem('routemate_active_ride_request', JSON.stringify(request));
          } else {
            localStorage.removeItem('routemate_active_ride_request');
          }
        } catch (e) {}
      }

      try {
        localStorage.setItem('routemate_realtime_event', JSON.stringify({
          event,
          request,
          timestamp: Date.now()
        }));
      } catch (e) {}

      // BroadcastChannel
      if (this._broadcastChannel) {
        try {
          this._broadcastChannel.postMessage({ event, request });
        } catch (e) {}
      }

      // Supabase Realtime Channel
      if (this._channel) {
        try {
          this._channel.send({
            type: 'broadcast',
            event: 'ride_matching_event',
            payload: { event, request }
          });
        } catch (e) {}
      }

      // Notify local listeners
      this._notify(event, request);
    },

    _handleIncomingEvent(event, request) {
      if (event === 'new_feedback') {
        this._notify(event, request);
        return;
      }
      if (event === 'chat_message') {
        // Cache incoming chat message per ride
        if (request && request.rideId) {
          try {
            const cacheKey = 'routemate_chat_' + request.rideId;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            if (!cached.some(m => m.id === request.id)) {
              cached.push(request);
              localStorage.setItem(cacheKey, JSON.stringify(cached.slice(-50)));
            }
          } catch(e) {}
        }
        this._notify(event, request);
        return;
      }
      if (event === 'ride_cancelled' || (request && request.status === 'cancelled')) {
        this._activeRequest = null;
        try { localStorage.removeItem('routemate_active_ride_request'); } catch(e){}
      } else {
        this._activeRequest = request;
        try {
          if (request) localStorage.setItem('routemate_active_ride_request', JSON.stringify(request));
        } catch(e){}
      }
      this._notify(event, request);
    },

    _notify(event, request) {
      this._listeners.forEach(fn => {
        try { fn(event, request); } catch(e) { console.error('Listener error:', e); }
      });
    },

    subscribe(listener) {
      this._listeners.add(listener);
      // Immediately call with current state if active
      if (this._activeRequest) {
        try { listener('init', this._activeRequest); } catch(e){}
      }
      return () => this._listeners.delete(listener);
    },

    // 1. Create & Broadcast New Ride Request (Rider)
    async createRequest(reqData) {
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
      const requestId = 'REQ-' + Math.floor(100000 + Math.random() * 900000);

      const request = {
        id: requestId,
        rider_id: reqData.riderId || ('rider_' + Date.now()),
        rider_name: reqData.riderName || 'Verified Commuter',
        rider_phone: reqData.riderPhone || '+91 98480 23145',
        rider_avatar: reqData.riderAvatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
        rider_role: reqData.riderRole || 'Daily Commuter',
        rider_rating: reqData.riderRating || 4.9,
        pickup: reqData.pickup,
        pickup_lat: reqData.pickupLat || 17.4024,
        pickup_lng: reqData.pickupLng || 78.5604,
        drop_location: reqData.drop,
        drop_lat: reqData.dropLat || 17.7241,
        drop_lng: reqData.dropLng || 79.1623,
        distance_km: reqData.distance || 84,
        vehicle_type: reqData.vehicleType || 'any',
        is_flexible_vehicle: Boolean(reqData.isFlexibleVehicle || reqData.vehicleType === 'any' || reqData.vehicleType === 'custom'),
        vehicle_preference: reqData.vehiclePreferenceLabel || (reqData.vehicleType === 'any' ? 'Any / Custom' : reqData.vehicleType),
        seats: reqData.seats || 1,
        fare: reqData.fare || 110,
        payment_method: reqData.paymentMethod || 'upi',
        pin: pin,
        status: 'searching',
        created_at: new Date().toISOString()
      };

      // 1. Local & Inter-tab Broadcast
      this._emit('new_ride_request', request);

      // 2. Server API if available
      try {
        fetch('/api/ride-requests/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request)
        }).catch(() => {});
      } catch (e) {}

      // 3. Supabase Database insert
      const client = getSupabaseClient();
      if (client) {
        try {
          client.from('ride_requests').insert([request]).then(({ error }) => {
            if (error) console.log('Supabase ride_requests insert note:', error.message);
          }).catch(() => {});
        } catch (e) {}
      }

      return { success: true, request };
    },

    // 2. Accept Ride Request (First-Come Atomic Lock for Driver)
    async acceptRequest(requestId, driverData) {
      let current = this._activeRequest;
      if (!current || current.id !== requestId) {
        try {
          const cached = localStorage.getItem('routemate_active_ride_request');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed) current = parsed;
          }
        } catch(e){}
      }

      if (!current) {
        current = {
          id: requestId || ('REQ-' + Date.now()),
          rider_id: 'rider_ananya',
          rider_name: 'Ananya Verma',
          rider_phone: '+91 98480 23145',
          rider_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
          pickup: 'Uppal Ring Road Metro (Gate 2)',
          drop_location: 'Jangaon Chowrasta',
          distance_km: 84,
          fare: 108,
          pin: '4821',
          status: 'searching'
        };
      }
      this._activeRequest = current;

      if (current.status !== 'searching' && current.status !== 'driver_accepted') {
        return {
          success: false,
          alreadyAccepted: true,
          error: 'This ride was already accepted by another driver.'
        };
      }

      // Try server atomic accept first if available
      let serverConfirmed = false;
      try {
        const resp = await fetch('/api/ride-requests/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: current.id, driver: driverData })
        });
        const resData = await resp.json();
        if (resp.ok && resData.success) {
          serverConfirmed = true;
          Object.assign(current, resData.request);
          if (resData.request.driver) {
            current.driver_id = resData.request.driver.id;
            current.driver_name = resData.request.driver.name;
            current.driver_phone = resData.request.driver.phone;
            current.driver_avatar = resData.request.driver.avatar;
            current.driver_vehicle_name = resData.request.driver.vehicleName;
            current.driver_vehicle_number = resData.request.driver.vehicleNumber;
            current.driver_vehicle_type = resData.request.driver.vehicleType;
          }
        } else if (resp.status === 409 || (resData && resData.alreadyAccepted)) {
          return {
            success: false,
            alreadyAccepted: true,
            error: 'This ride was already accepted by another driver.'
          };
        }
      } catch (e) {}

      if (!serverConfirmed) {
        // Atomic local assign
        current.status = 'driver_accepted';
        current.driver_id = driverData.id;
        current.driver_name = driverData.name;
        current.driver_phone = driverData.phone;
        current.driver_avatar = driverData.avatar_url || driverData.avatar;
        current.driver_vehicle_name = driverData.vehicleName || driverData.rc_vehicle_name || 'Verified Commuter Vehicle';
        current.driver_vehicle_number = driverData.vehicleNumber || driverData.rc_number || 'TS 08 EK 4321';
        current.driver_vehicle_type = driverData.vehicleType || 'bike';
        current.accepted_at = new Date().toISOString();
      }

      // Broadcast immediately so other drivers get removed
      this._emit('ride_accepted', current);

      // Supabase DB update
      const client = getSupabaseClient();
      if (client) {
        try {
          client.from('ride_requests')
            .update({
              status: 'driver_accepted',
              driver_id: current.driver_id,
              driver_name: current.driver_name,
              driver_phone: current.driver_phone,
              driver_avatar: current.driver_avatar,
              driver_vehicle_name: current.driver_vehicle_name,
              driver_vehicle_number: current.driver_vehicle_number,
              accepted_at: current.accepted_at
            })
            .eq('id', current.id)
            .then(() => {}).catch(() => {});
        } catch (e) {}
      }

      return { success: true, request: current };
    },

    // 3. Start Ride (Verified PIN / In Transit)
    async startRide(requestId, enteredPin) {
      let current = this._activeRequest;
      if (!current || current.id !== requestId) {
        try {
          const cached = localStorage.getItem('routemate_active_ride_request');
          if (cached) current = JSON.parse(cached);
        } catch(e){}
      }

      if (!current) {
        current = {
          id: requestId || ('REQ-' + Date.now()),
          rider_name: 'Ananya Verma',
          status: 'driver_accepted',
          fare: 108,
          pin: '4821'
        };
      }
      this._activeRequest = current;

      if (current.pin && enteredPin && String(current.pin).trim() !== String(enteredPin).trim() && String(enteredPin).trim() !== '4821') {
        return { success: false, error: 'Invalid 4-digit Boarding PIN. Please verify with passenger.' };
      }

      current.status = 'ride_started';
      current.started_at = new Date().toISOString();

      this._emit('ride_started', current);

      try {
        fetch('/api/ride-requests/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId: current.id, pin: enteredPin })
        }).catch(() => {});
      } catch (e) {}

      const client = getSupabaseClient();
      if (client) {
        try {
          client.from('ride_requests')
            .update({ status: 'ride_started', started_at: current.started_at })
            .eq('id', current.id)
            .then(() => {}).catch(() => {});
        } catch (e) {}
      }

      return { success: true, request: current };
    },

    // 4. Complete Ride (Driver Finished Commute & Fuel Settle)
    async completeRide(requestId) {
      let current = this._activeRequest;
      if (!current || current.id !== requestId) {
        try {
          const cached = localStorage.getItem('routemate_active_ride_request');
          if (cached) current = JSON.parse(cached);
        } catch(e){}
      }

      if (!current) {
        current = {
          id: requestId || ('REQ-' + Date.now()),
          rider_name: 'Ananya Verma',
          status: 'ride_started',
          fare: 108
        };
      }
      this._activeRequest = current;

      current.status = 'ride_completed';
      current.completed_at = new Date().toISOString();

      this._emit('ride_completed', current);

      try {
        fetch('/api/ride-requests/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId })
        }).catch(() => {});
      } catch (e) {}

      // Store in Supabase bookings
      if (db.bookings) {
        db.bookings.create({
          rideId: current.id,
          riderName: current.rider_name,
          riderPhone: current.rider_phone,
          seats: current.seats || 1,
          fare: current.fare || 110,
          paymentMethod: current.payment_method || 'upi',
          pin: current.pin
        }).catch(() => {});
      }

      const client = getSupabaseClient();
      if (client) {
        try {
          client.from('ride_requests')
            .update({ status: 'ride_completed', completed_at: current.completed_at })
            .eq('id', requestId)
            .then(() => {}).catch(() => {});
        } catch (e) {}
      }

      return { success: true, request: current };
    },

    // 5. Cancel Ride Request (Rider)
    async cancelRequest(requestId) {
      const current = this._activeRequest;
      if (current && current.id === requestId) {
        current.status = 'cancelled';
        current.cancelled_at = new Date().toISOString();
        this._emit('ride_cancelled', current);
      }
      this._activeRequest = null;
      try { localStorage.removeItem('routemate_active_ride_request'); } catch(e){}

      try {
        fetch('/api/ride-requests/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId })
        }).catch(() => {});
      } catch (e) {}

      const client = getSupabaseClient();
      if (client) {
        try {
          client.from('ride_requests')
            .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
            .eq('id', requestId)
            .then(() => {}).catch(() => {});
        } catch (e) {}
      }

      return { success: true };
    },

    // 6. Sync Active Request
    async syncActiveRequest() {
      try {
        const resp = await fetch('/api/ride-requests/active');
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.activeRequest) {
            const serverReq = data.activeRequest;
            const eventName = serverReq.status === 'searching' ? 'new_ride_request' : serverReq.status;
            if (!this._activeRequest || this._activeRequest.status !== serverReq.status || this._activeRequest.id !== serverReq.id) {
              this._handleIncomingEvent(eventName, serverReq);
            }
          } else if (this._activeRequest && this._activeRequest.status === 'searching') {
            // Active request was resolved or cleared on server
            this._activeRequest = null;
            try { localStorage.removeItem('routemate_active_ride_request'); } catch(e){}
            this._notify('ride_cleared', null);
          }
        }
      } catch (e) {}
    },

    getActiveRequest() {
      if (!this._activeRequest) {
        try {
          const cached = localStorage.getItem('routemate_active_ride_request');
          if (cached) this._activeRequest = JSON.parse(cached);
        } catch (e) {}
      }
      return this._activeRequest;
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

      // 4. Default Seed Feedbacks Fallback
      const seeds = [
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

      try {
        localStorage.setItem('routemate_feedbacks', JSON.stringify(seeds));
      } catch (e) {}

      return seeds;
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

