// Routemate - Supabase Database Client & ORM Helpers
// Configured with Project URL & Publishable Key

const SUPABASE_CONFIG = {
  url: 'https://hjieeilzfbvubkhmlmdg.supabase.co',
  publishableKey: 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a'
};

// Initialize Supabase Client using global @supabase/supabase-js
let supabase = null;

if (typeof window !== 'undefined' && window.supabase && window.supabase.createClient) {
  try {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
    console.log('✅ Supabase client initialized for Routemate (hjieeilzfbvubkhmlmdg.supabase.co)');
  } catch (err) {
    console.warn('⚠️ Error initializing Supabase client:', err);
  }
} else {
  console.warn('⚠️ Supabase JS library not loaded yet; fallback mock mode active.');
}

// Database helper functions for rides, profiles, and bookings
const db = {
  client: supabase,

  // ==========================================
  // RIDES TABLE HELPERS
  // ==========================================
  rides: {
    // Fetch all active rides from Supabase
    async fetchAll(vehicleType = null) {
      if (!supabase) return null;
      try {
        let query = supabase
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
      if (!supabase) return { success: false, data: null };
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

        const { data, error } = await supabase
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
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
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

    async upsert(profileData) {
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
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
      if (!supabase) return { success: false };
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

        const { data, error } = await supabase
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
      if (!supabase) return null;
      try {
        const { data, error } = await supabase
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
