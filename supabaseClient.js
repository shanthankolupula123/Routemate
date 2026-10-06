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

    // Send OTP to Phone
    async signInWithOtp(phone) {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Supabase client library not loaded yet.' };
      }
      try {
        console.log(`📱 Sending OTP via Supabase to: ${phone}`);
        const { data, error } = await client.auth.signInWithOtp({
          phone: phone, // Must be E.164, e.g. +919848023145
        });

        if (error) {
          console.warn('Supabase signInWithOtp error response:', error);
          return {
            success: false,
            error: error.message,
            errorCode: error.code || error.error_code,
            rawError: error
          };
        }

        console.log('✅ Supabase signInWithOtp success:', data);
        return { success: true, data };
      } catch (e) {
        console.error('Exception in signInWithOtp:', e);
        return { success: false, error: e.message || 'Network error sending OTP' };
      }
    },

    // Verify 6-digit OTP Token
    async verifyOtp(phone, token) {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, error: 'Supabase client not loaded.' };
      }
      try {
        console.log(`🔑 Verifying OTP token for ${phone}...`);
        const { data, error } = await client.auth.verifyOtp({
          phone: phone,
          token: token,
          type: 'sms'
        });

        if (error) {
          console.warn('Supabase verifyOtp error response:', error);
          return {
            success: false,
            error: error.message,
            errorCode: error.code || error.error_code,
            rawError: error
          };
        }

        console.log('✅ Supabase verifyOtp success:', data);
        return { success: true, data };
      } catch (e) {
        console.error('Exception in verifyOtp:', e);
        return { success: false, error: e.message || 'Verification exception' };
      }
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

    async getOrCreateByPhone(phone, customName = null) {
      const client = getSupabaseClient();
      if (!client) {
        return {
          id: 'local-' + Date.now(),
          phone: phone,
          name: customName || 'Verified Commuter',
          role: 'Daily Commuter',
          rating: 5.0,
          total_rides: 1,
          is_verified: true
        };
      }
      try {
        const { data: existing, error } = await client
          .from('profiles')
          .select('*')
          .eq('phone', phone)
          .maybeSingle();

        if (existing) {
          return existing;
        }

        const newProfile = {
          name: customName || 'Verified Commuter',
          role: 'Daily Commuter',
          rating: 5.00,
          total_rides: 1,
          phone: phone,
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80',
          is_verified: true
        };

        const { data: created, error: createErr } = await client
          .from('profiles')
          .insert([newProfile])
          .select()
          .maybeSingle();

        if (createErr) {
          console.warn('Could not insert profile into Supabase:', createErr.message);
          return newProfile;
        }
        return created || newProfile;
      } catch (e) {
        console.warn('Error in getOrCreateByPhone:', e);
        return {
          id: 'local-' + Date.now(),
          phone: phone,
          name: customName || 'Verified Commuter',
          role: 'Daily Commuter',
          rating: 5.0,
          total_rides: 1,
          is_verified: true
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
  }
};

// Export to window
window.db = db;
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
