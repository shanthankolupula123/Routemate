/**
 * Routemate - Core Application Controller (v36 OTP Verification Flow)
 * Passwordless 6-Digit Email OTP + Free OpenStreetMap Route Engine + Realtime Matching
 */

(function () {
  'use strict';

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    currentUser: null,
    mode: 'rider', // 'rider' | 'driver'
    activeTab: 'book', // 'book' | 'drive' | 'activity' | 'profile'
    authTab: 'signin', // 'signin' | 'signup'
    pendingAuth: {
      email: '',
      name: '',
      role: 'rider'
    },
    resendCountdown: 0,
    resendTimer: null,
    pickup: 'Uppal Metro, Hyderabad',
    drop: 'Jangaon Bus Depot',
    pickupCoords: { lat: 17.4018, lng: 78.5602 },
    dropCoords: { lat: 17.7265, lng: 79.1554 },
    vehicleType: 'bike',
    seatsBooked: 1,
    distanceKm: 84,
    fare: 91,
    baseFare: 91,
    userGPS: null,
    activeRiderRequest: null,
    activeDriverTrip: null,
    activeDriverTrips: [],
    driverActiveVehicle: null,
    driverActiveVehicleType: 'bike',
    approvedVehicleTypes: ['bike'],
    selectedScheduleVehicleType: 'bike',
    selectedScheduleSeats: 1,
    currentBookingScheduledRide: null,
    currentBookingSeats: 1,
    driverOnline: true,
    incomingRides: [],
    declinedRideIds: new Set(),
    maps: {
      rider: null,
      driver: null
    },
    mapMarkers: {
      riderGPS: null,
      driverGPS: null,
      pickup: null,
      drop: null,
      routeLine: null,
      driverPickup: null,
      driverDrop: null,
      driverRouteLine: null,
      driverVehicleMarker: null,
      commuters: []
    },
    mapTapMode: false,
    mapTapTarget: 'pickup', // 'pickup' | 'drop'
    activeSuggestions: {
      pickup: [],
      drop: []
    },
    activities: [],
    wallet: {
      balance: 100.0,
      transactions: [],
      welcomeBonusCredited: true
    },
    driverUpi: {
      upiId: '',
      upiQr: ''
    },
    locationPreferences: {
      home: '',
      work: '',
      defaultRoute: '',
      autoGps: true
    },
    ratingState: {
      activeRide: null,
      selectedStars: 5,
      selectedTags: new Set(['Smooth & Safe Ride', 'Polite Driver']),
      chosenPaymentMethod: 'upi'
    },
    notifications: {
      items: [],
      filter: 'all',
      activeDetail: null,
      readIds: new Set()
    },
    kyc: {
      status: 'not_submitted', // 'not_submitted' | 'pending' | 'approved' | 'rejected'
      submission: null,
      currentStep: 1,
      formData: {
        driver_photo: '',
        dl_front: '',
        dl_back: '',
        aadhaar_front: '',
        aadhaar_back: '',
        rc_photo: ''
      }
    },
    admin: {
      submissions: [],
      feedbacks: [],
      broadcasts: [],
      activeBroadcastAudience: 'all',
      activeFilter: 'pending', // 'pending' | 'approved' | 'rejected' | 'all'
      activeSafetyFilter: 'alerts', // 'alerts' | 'low' | 'all'
      activeSection: 'kyc', // 'kyc' | 'safety' | 'broadcast'
      isLoading: false
    }
  };

  // Key Stops on Hyderabad ➔ Jangaon NH163 Corridor
  const CORRIDOR_STOPS = [
    { name: 'Uppal Metro, Hyderabad', lat: 17.4018, lng: 78.5602 },
    { name: 'Ghatkesar Toll Plaza', lat: 17.4455, lng: 78.6835 },
    { name: 'Bhongir Fort Road', lat: 17.5108, lng: 78.8890 },
    { name: 'Aler Railway Gate', lat: 17.6521, lng: 79.0510 },
    { name: 'Jangaon Bus Depot', lat: 17.7265, lng: 79.1554 }
  ];

  // Comprehensive Statewide Telangana Hubs & Towns Dataset (Covering All 33 Districts)
  const TELANGANA_LOCATIONS = [
    // Hyderabad & Secunderabad Hubs
    { title: 'Uppal Metro Station', subtitle: 'Inner Ring Road, Uppal, Hyderabad', lat: 17.4018, lng: 78.5602, type: 'metro' },
    { title: 'Secunderabad Railway Station', subtitle: 'Regimental Bazar, Secunderabad', lat: 17.4338, lng: 78.5020, type: 'train' },
    { title: 'MGBS (Mahatma Gandhi Bus Station)', subtitle: 'Gowliguda, Hyderabad', lat: 17.3789, lng: 78.4812, type: 'bus' },
    { title: 'JBS (Jubilee Bus Station)', subtitle: 'Picket, Secunderabad', lat: 17.4524, lng: 78.5002, type: 'bus' },
    { title: 'Kacheguda Railway Station', subtitle: 'Nimboliadda, Kachiguda, Hyderabad', lat: 17.3888, lng: 78.4975, type: 'train' },
    { title: 'Gachibowli Junction', subtitle: 'IT Corridor, Outer Ring Road, Hyderabad', lat: 17.4401, lng: 78.3489, type: 'area' },
    { title: 'Hitec City (Cyber Towers)', subtitle: 'Madhapur, Hyderabad', lat: 17.4504, lng: 78.3808, type: 'area' },
    { title: 'Rajiv Gandhi International Airport (RGIA)', subtitle: 'Shamshabad, Hyderabad', lat: 17.2403, lng: 78.4294, type: 'airport' },
    { title: 'Miyapur Metro Station', subtitle: 'National Highway 65, Miyapur, Hyderabad', lat: 17.4968, lng: 78.3551, type: 'metro' },
    { title: 'Kukatpally (KPHB Colony)', subtitle: 'Kukatpally, Hyderabad', lat: 17.4933, lng: 78.3999, type: 'area' },
    { title: 'LB Nagar Ring Road Junction', subtitle: 'NH 65, LB Nagar, Hyderabad', lat: 17.3457, lng: 78.5522, type: 'area' },
    { title: 'Dilsukhnagar Bus Depot', subtitle: 'Chaitanyapuri, Dilsukhnagar, Hyderabad', lat: 17.3688, lng: 78.5247, type: 'bus' },
    { title: 'Ameerpet Metro Junction', subtitle: 'Greenlands Road, Ameerpet, Hyderabad', lat: 17.4375, lng: 78.4483, type: 'metro' },
    { title: 'Mehdipatnam Bus Station', subtitle: 'Asif Nagar, Mehdipatnam, Hyderabad', lat: 17.3916, lng: 78.4405, type: 'bus' },
    { title: 'Charminar Heritage Area', subtitle: 'Old City, Hyderabad', lat: 17.3616, lng: 78.4747, type: 'area' },
    { title: 'ECIL X Roads', subtitle: 'Moula Ali, Hyderabad', lat: 17.4697, lng: 78.5583, type: 'area' },
    { title: 'Alwal Hills', subtitle: 'Malkajgiri, Secunderabad', lat: 17.5028, lng: 78.5133, type: 'area' },
    { title: 'Kompally Junction', subtitle: 'Medchal Road, NH 44, Secunderabad', lat: 17.5372, lng: 78.4856, type: 'area' },
    { title: 'Patancheru Industrial Area', subtitle: 'NH 65, Sangareddy District', lat: 17.5286, lng: 78.2642, type: 'area' },
    { title: 'Medchal Bus Depot', subtitle: 'NH 44, Medchal-Malkajgiri', lat: 17.6294, lng: 78.4813, type: 'bus' },

    // NH 163 Corridor
    { title: 'Ghatkesar Toll Plaza', subtitle: 'NH 163, Medchal-Malkajgiri', lat: 17.4455, lng: 78.6835, type: 'toll' },
    { title: 'Bibinagar Railway Station', subtitle: 'Yadadri Bhuvanagiri District', lat: 17.4729, lng: 78.7937, type: 'train' },
    { title: 'Bhongir (Bhuvanagiri) Fort Road', subtitle: 'NH 163, Yadadri Bhuvanagiri', lat: 17.5108, lng: 78.8890, type: 'town' },
    { title: 'Yadagirigutta Temple City', subtitle: 'Yadadri Bhuvanagiri District', lat: 17.5878, lng: 78.9389, type: 'temple' },
    { title: 'Aler Railway Gate', subtitle: 'NH 163, Yadadri Bhuvanagiri', lat: 17.6521, lng: 79.0510, type: 'train' },
    { title: 'Jangaon Bus Depot', subtitle: 'NH 163, Jangaon District', lat: 17.7265, lng: 79.1554, type: 'bus' },
    { title: 'Raghunathpalle', subtitle: 'NH 163, Jangaon District', lat: 17.7712, lng: 79.2845, type: 'town' },
    { title: 'Station Ghanpur', subtitle: 'NH 163, Jangaon District', lat: 17.8465, lng: 79.3789, type: 'train' },
    { title: 'Kazipet Railway Junction', subtitle: 'NH 163, Hanamkonda District', lat: 17.9782, lng: 79.5248, type: 'train' },
    { title: 'Hanamkonda Bus Stand', subtitle: 'Warangal Tri-Cities, Telangana', lat: 18.0068, lng: 79.5578, type: 'bus' },
    { title: 'Warangal Railway Station', subtitle: 'Warangal District, Telangana', lat: 17.9820, lng: 79.5970, type: 'train' },

    // Statewide District Headquarters & Cities
    { title: 'Karimnagar Main Bus Stand', subtitle: 'Collectorate Road, Karimnagar', lat: 18.4386, lng: 79.1288, type: 'bus' },
    { title: 'Nizamabad Railway Station', subtitle: 'Railway Colony, Nizamabad', lat: 18.6725, lng: 78.0941, type: 'train' },
    { title: 'Khammam New Bus Stand', subtitle: 'Wyra Road, Khammam', lat: 17.2473, lng: 80.1514, type: 'bus' },
    { title: 'Ramagundam (NTPC)', subtitle: 'Peddapalli District, Telangana', lat: 18.7562, lng: 79.4745, type: 'city' },
    { title: 'Mahbubnagar Bus Stand', subtitle: 'Clock Tower Road, Mahbubnagar', lat: 16.7488, lng: 78.0035, type: 'bus' },
    { title: 'Nalgonda Clock Tower', subtitle: 'Hyderabad Road, Nalgonda', lat: 17.0577, lng: 79.2684, type: 'city' },
    { title: 'Suryapet Bus Stand', subtitle: 'NH 65 Corridor, Suryapet', lat: 17.1439, lng: 79.6239, type: 'bus' },
    { title: 'Siddipet Bus Depot', subtitle: 'Old Bus Stand, Siddipet', lat: 18.1018, lng: 78.8520, type: 'bus' },
    { title: 'Miryalaguda Bus Station', subtitle: 'Nalgonda District, Telangana', lat: 16.8710, lng: 79.5617, type: 'bus' },
    { title: 'Jagtial Bus Stand', subtitle: 'Jagtial District, Telangana', lat: 18.7946, lng: 78.9136, type: 'bus' },
    { title: 'Nirmal Town Center', subtitle: 'Nirmal District, Telangana', lat: 19.0964, lng: 78.3432, type: 'city' },
    { title: 'Sircilla Textile Town', subtitle: 'Rajanna Sircilla District', lat: 18.3846, lng: 78.8028, type: 'city' },
    { title: 'Kamareddy Bus Stand', subtitle: 'NH 44, Kamareddy District', lat: 18.3228, lng: 78.3411, type: 'bus' },
    { title: 'Kothagudem Bus Depot', subtitle: 'Bhadradri Kothagudem District', lat: 17.5516, lng: 80.6171, type: 'bus' },
    { title: 'Bhadrachalam Temple Town', subtitle: 'Godavari Riverbank, Bhadradri', lat: 17.6688, lng: 80.8935, type: 'temple' },
    { title: 'Bodhan Railway Station', subtitle: 'Nizamabad District, Telangana', lat: 18.6657, lng: 77.8968, type: 'train' },
    { title: 'Mancherial Railway Station', subtitle: 'Mancherial District, Telangana', lat: 18.8679, lng: 79.4639, type: 'train' },
    { title: 'Bellampalli Town', subtitle: 'Coal Belt, Mancherial District', lat: 19.0664, lng: 79.4925, type: 'city' },
    { title: 'Adilabad Bus Stand', subtitle: 'NH 44, Adilabad District', lat: 19.6641, lng: 78.5320, type: 'bus' },
    { title: 'Asifabad (Komaram Bheem)', subtitle: 'Asifabad District, Telangana', lat: 19.3562, lng: 79.2831, type: 'city' },
    { title: 'Peddapalli Town', subtitle: 'Peddapalli District, Telangana', lat: 18.6148, lng: 79.3789, type: 'train' },
    { title: 'Huzurabad Bus Station', subtitle: 'Karimnagar District, Telangana', lat: 18.1925, lng: 79.3908, type: 'bus' },
    { title: 'Sangareddy Collectorate', subtitle: 'NH 65, Sangareddy District', lat: 17.6190, lng: 78.0827, type: 'city' },
    { title: 'Zaheerabad Bus Depot', subtitle: 'NH 65, Sangareddy District', lat: 17.6835, lng: 77.6083, type: 'bus' },
    { title: 'Vikarabad Railway Junction', subtitle: 'Vikarabad District, Telangana', lat: 17.3366, lng: 77.9048, type: 'train' },
    { title: 'Tandur Town', subtitle: 'Vikarabad District, Telangana', lat: 17.2586, lng: 77.5835, type: 'city' },
    { title: 'Shadnagar Bus Station', subtitle: 'NH 44, Ranga Reddy District', lat: 17.0697, lng: 78.2092, type: 'bus' },
    { title: 'Gadwal Fort Town', subtitle: 'Jogulamba Gadwal District', lat: 16.2335, lng: 77.8041, type: 'city' },
    { title: 'Wanaparthy Town', subtitle: 'Wanaparthy District, Telangana', lat: 16.3624, lng: 78.0628, type: 'city' },
    { title: 'Nagarkurnool Bus Station', subtitle: 'Nagarkurnool District, Telangana', lat: 16.4851, lng: 78.3094, type: 'bus' },
    { title: 'Armoor X Roads', subtitle: 'NH 44, Nizamabad District', lat: 18.7915, lng: 78.2882, type: 'city' },
    { title: 'Medak Church & Town', subtitle: 'Medak District, Telangana', lat: 17.9375, lng: 78.2117, type: 'city' }
  ];

  // =========================================================================
  // MANDATORY SUPABASE AUTHENTICATION (PASSWORDLESS OTP FLOW)
  // =========================================================================
  async function checkAuthSession() {
    let sessionUser = null;

    // 1. Check Supabase Session via SDK
    if (window.db?.auth) {
      try {
        const session = await window.db.auth.getSession();
        if (session && session.user) {
          sessionUser = normalizeAuthUser(session.user);
          // Merge from localStorage cached user if matching account
          try {
            const saved = localStorage.getItem('routemate_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed && (parsed.id === sessionUser.id || (parsed.email && parsed.email.toLowerCase() === (sessionUser.email || '').toLowerCase()))) {
                if (parsed.phone && !sessionUser.phone) sessionUser.phone = parsed.phone;
                if (parsed.name && (!sessionUser.name || sessionUser.name === 'User')) sessionUser.name = parsed.name;
                if (parsed.gender && !sessionUser.gender) sessionUser.gender = parsed.gender;
                if (parsed.dob && !sessionUser.dob) sessionUser.dob = parsed.dob;
                if (parsed.role && !sessionUser.role) sessionUser.role = parsed.role;
                if (parsed.upi_id && !sessionUser.upi_id) sessionUser.upi_id = parsed.upi_id;
                if (parsed.kyc_status && !sessionUser.kyc_status) sessionUser.kyc_status = parsed.kyc_status;
                if (parsed.wallet_balance !== undefined && sessionUser.wallet_balance === undefined) sessionUser.wallet_balance = parsed.wallet_balance;
                if (parsed.wallet_transactions && !sessionUser.wallet_transactions) sessionUser.wallet_transactions = parsed.wallet_transactions;
                if (parsed.vehicles && !sessionUser.vehicles) sessionUser.vehicles = parsed.vehicles;
              }
            }
          } catch (e) {}
        }
      } catch (e) {
        console.warn('Auth session check note:', e);
      }

      // Supabase Auth State Change Listener (e.g. for Google OAuth redirect / OTP verify)
      if (!window._supabaseAuthStateListenerAttached) {
        window._supabaseAuthStateListenerAttached = true;
        window.db.auth.onAuthStateChange(async (event, session) => {
          console.log('👤 [AUTH EVENT]:', event);
          if (session && session.user) {
            window._isUserExplicitSignOut = false;
            // If session token refreshed and user is already active, do not interrupt UI
            if (event === 'TOKEN_REFRESHED' && state.currentUser && (state.currentUser.id === session.user.id || (state.currentUser.email && state.currentUser.email.toLowerCase() === (session.user.email || '').toLowerCase()))) {
              console.log('🔄 [AUTH] Token refreshed smoothly for active session:', session.user.email);
              return;
            }

            const userObj = normalizeAuthUser(session.user);
            // Recover existing profile data from current state or localStorage
            const cached = state.currentUser || null;
            let savedUser = null;
            try {
              const saved = localStorage.getItem('routemate_user');
              if (saved) savedUser = JSON.parse(saved);
            } catch (e) {}

            const source = (cached && (cached.id === userObj.id || (cached.email && cached.email.toLowerCase() === (userObj.email || '').toLowerCase())))
              ? cached
              : ((savedUser && (savedUser.id === userObj.id || (savedUser.email && savedUser.email.toLowerCase() === (userObj.email || '').toLowerCase()))) ? savedUser : null);

            if (source) {
              if (source.phone && !userObj.phone) userObj.phone = source.phone;
              if (source.name && (!userObj.name || userObj.name === 'User')) userObj.name = source.name;
              if (source.gender && !userObj.gender) userObj.gender = source.gender;
              if (source.dob && !userObj.dob) userObj.dob = source.dob;
              if (source.role && !userObj.role) userObj.role = source.role;
              if (source.upi_id && !userObj.upi_id) userObj.upi_id = source.upi_id;
              if (source.kyc_status && !userObj.kyc_status) userObj.kyc_status = source.kyc_status;
              if (source.wallet_balance !== undefined && userObj.wallet_balance === undefined) userObj.wallet_balance = source.wallet_balance;
              if (source.wallet_transactions && !userObj.wallet_transactions) userObj.wallet_transactions = source.wallet_transactions;
              if (source.vehicles && !userObj.vehicles) userObj.vehicles = source.vehicles;
            }

            await handleAuthUserFlow(userObj, event === 'SIGNED_IN');
          } else if (event === 'SIGNED_OUT') {
            if (window._isUserExplicitSignOut || !localStorage.getItem('routemate_user')) {
              lockAppToAuthScreen();
            } else {
              console.log('ℹ️ [AUTH] Preserving active session across refresh; ignoring transient SDK SIGNED_OUT event.');
            }
          }
        });
      }
    }

    // 2. Check LocalStorage Cached User
    if (!sessionUser) {
      try {
        const saved = localStorage.getItem('routemate_user');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.id || parsed.email)) {
            sessionUser = parsed;
          }
        }
      } catch (e) {}
    }

    // 3. Enforce Strict Mandatory Flow
    if (sessionUser) {
      await handleAuthUserFlow(sessionUser);
    } else {
      lockAppToAuthScreen();
    }
  }

  function getUserInitials(name) {
    if (!name || typeof name !== 'string') return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase() || 'U';
  }

  function getInitialsAvatarSvg(name, size = 120, bg = '#0052CC') {
    const initials = getUserInitials(name);
    const fontSize = Math.round(size * 0.40);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${size / 2}" fill="${bg}"/>
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="#FFFFFF" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="${fontSize}px" letter-spacing="0.5px">${initials}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  window.getUserInitials = getUserInitials;
  window.getInitialsAvatarSvg = getInitialsAvatarSvg;

  function normalizeAuthUser(user) {
    const meta = user.user_metadata || {};
    const name = user.name || meta.name || meta.full_name || user.email?.split('@')[0] || 'User';
    let avatar = user.avatar || meta.avatar || meta.avatar_url || meta.picture || null;
    if (!avatar || typeof avatar !== 'string' || avatar.includes('unsplash.com')) {
      avatar = getInitialsAvatarSvg(name, 120);
    }
    return {
      id: user.id || ('usr_' + Date.now()),
      email: user.email || 'user@routemate.local',
      name: name,
      phone: user.phone || meta.phone || '',
      gender: user.gender || meta.gender || '',
      dob: user.dob || meta.dob || '',
      role: 'commuter',
      rating: user.rating || 5.0,
      avatar: avatar
    };
  }

  // Intercept new Google & incomplete accounts before entering the app
  async function handleAuthUserFlow(user, isNewSignIn = false) {
    if (!user) {
      lockAppToAuthScreen();
      return;
    }

    // 1. Check LocalStorage cache to prefill existing fields if any
    try {
      const saved = localStorage.getItem('routemate_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id === user.id || (parsed.email && parsed.email.toLowerCase() === (user.email || '').toLowerCase()))) {
          if (parsed.id && !String(user.id || '').includes('-') && String(parsed.id).includes('-')) user.id = parsed.id;
          if (parsed.phone && !user.phone) user.phone = parsed.phone;
          if (parsed.name && (!user.name || user.name === 'User' || user.name.includes('@'))) user.name = parsed.name;
          if (parsed.gender && !user.gender) user.gender = parsed.gender;
          if (parsed.dob && !user.dob) user.dob = parsed.dob;
          if (parsed.role && !user.role) user.role = parsed.role;
          if (parsed.upi_id || parsed.vpa || parsed.upiId) {
            const pUpi = parsed.upi_id || parsed.vpa || parsed.upiId;
            user.upi_id = pUpi;
            user.vpa = pUpi;
            user.upiId = pUpi;
            state.driverUpi.upiId = pUpi;
            state.driverUpi.vpa = pUpi;
          }
          if (parsed.kyc_status) {
            user.kyc_status = parsed.kyc_status;
            state.kyc.status = parsed.kyc_status;
          }
          if (parsed.wallet_balance !== undefined) {
            user.wallet_balance = Number(parsed.wallet_balance);
            state.wallet.balance = Number(parsed.wallet_balance);
          }
          if (Array.isArray(parsed.wallet_transactions) && parsed.wallet_transactions.length > 0) {
            user.wallet_transactions = parsed.wallet_transactions;
            state.wallet.transactions = parsed.wallet_transactions;
          }
          if (Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0) {
            user.vehicles = parsed.vehicles;
            state.kyc.vehicles = parsed.vehicles;
          }
        }
      }
    } catch (e) {}

    // 2. Query Supabase `profiles` table using User ID or Email
    let dbProfile = null;
    try {
      if (window.db?.auth?.getUserProfile) {
        dbProfile = await window.db.auth.getUserProfile(user.id, user.email);
        if (dbProfile) {
          if (dbProfile.id) user.id = dbProfile.id;
          const dbPhoneDigits = String(dbProfile.phone || '').replace(/\D/g, '');
          if (dbPhoneDigits.length >= 10 && !dbProfile.phone.includes('@')) {
            user.phone = dbProfile.phone;
          }
          if (dbProfile.name && (!user.name || user.name === 'User' || user.name.includes('@'))) {
            user.name = dbProfile.name;
          }
          if (dbProfile.gender && !user.gender) user.gender = dbProfile.gender;
          if (dbProfile.dob && !user.dob) user.dob = dbProfile.dob;
          if (dbProfile.role) user.role = dbProfile.role;
          if (dbProfile.avatar_url && (!user.avatar || user.avatar.includes('routemate.local'))) user.avatar = dbProfile.avatar_url;
          if (dbProfile.upi_id || dbProfile.vpa || dbProfile.upiId) {
            const dbUpi = dbProfile.upi_id || dbProfile.vpa || dbProfile.upiId;
            user.upi_id = dbUpi;
            user.vpa = dbUpi;
            user.upiId = dbUpi;
            state.driverUpi.upiId = dbUpi;
            state.driverUpi.vpa = dbUpi;
          }
          if (dbProfile.kyc_status) {
            user.kyc_status = dbProfile.kyc_status;
            state.kyc.status = dbProfile.kyc_status;
          }
          if (dbProfile.wallet_balance !== undefined) {
            user.wallet_balance = Number(dbProfile.wallet_balance);
            state.wallet.balance = Number(dbProfile.wallet_balance);
          }
          if (Array.isArray(dbProfile.wallet_transactions) && dbProfile.wallet_transactions.length > 0) {
            user.wallet_transactions = dbProfile.wallet_transactions;
            state.wallet.transactions = dbProfile.wallet_transactions;
          }
          if (Array.isArray(dbProfile.vehicles) && dbProfile.vehicles.length > 0) {
            user.vehicles = dbProfile.vehicles;
            state.kyc.vehicles = dbProfile.vehicles;
          }
          if (typeof updateWalletDisplays === 'function') updateWalletDisplays();
        }
      }
    } catch (e) {
      console.warn('Profile DB check notice:', e);
    }

    // 2b. Fallback check to Driver KYC table if phone or KYC is still missing
    const phoneDigitsSoFar = String(user.phone || '').replace(/\D/g, '');
    if ((phoneDigitsSoFar.length < 10 || !user.kyc_status) && window.db?.kyc?.getDriverKyc) {
      try {
        const kycCheck = await window.db.kyc.getDriverKyc(user.id, user.email);
        const kSub = kycCheck?.submission || kycCheck;
        if (kSub?.driver_phone) {
          const kycPhoneDigits = String(kSub.driver_phone).replace(/\D/g, '');
          if (kycPhoneDigits.length >= 10 && phoneDigitsSoFar.length < 10) {
            user.phone = kSub.driver_phone;
          }
        }
        if (kSub?.driver_name && (!user.name || user.name === 'User' || user.name.includes('@'))) {
          user.name = kSub.driver_name;
        }
        if (kSub?.upi_id || kSub?.vpa || kycCheck?.upi?.id) {
          const kUpi = kSub?.upi_id || kSub?.vpa || kycCheck?.upi?.id;
          user.upi_id = kUpi;
          user.vpa = kUpi;
          user.upiId = kUpi;
          state.driverUpi.upiId = kUpi;
          state.driverUpi.vpa = kUpi;
        }
        if (kSub?.status || kycCheck?.status) {
          user.kyc_status = kSub?.status || kycCheck?.status;
          state.kyc.status = user.kyc_status;
        }
        const kBal = (kycCheck?.wallet?.balance !== undefined) ? kycCheck.wallet.balance : kSub?.wallet_balance;
        if (kBal !== undefined && user.wallet_balance === undefined) {
          user.wallet_balance = Number(kBal);
          state.wallet.balance = Number(kBal);
        }
        if (Array.isArray(kSub?.vehicles) && kSub.vehicles.length > 0 && (!user.vehicles || user.vehicles.length === 0)) {
          user.vehicles = kSub.vehicles;
          state.kyc.vehicles = kSub.vehicles;
        }
      } catch (e) {}
    }

    // 3. Conditional Routing Check: Name & Phone Number (10 digits)
    const cleanUserPhone = String(user.phone || '').replace(/\D/g, '');
    const hasCompleteProfile = cleanUserPhone.length >= 10 && user.name && user.name !== 'User' && !user.name.includes('@');

    // If Profile is Missing / First-Time User: Intercept them and display mandatory profile completion form
    if (!hasCompleteProfile) {
      console.log('📋 [PROFILE INTERCEPT] Incomplete profile detected for:', user.email);
      state.pendingCompletionUser = user;
      openProfileCompletionModal(user);
      return;
    }

    // Returning authenticated user: profile is already present in DB
    // Only perform an initial DB sync if this user has NO record in Supabase profiles yet
    if (!dbProfile && window.db?.auth?.saveUserProfile && user.phone && user.name) {
      window.db.auth.saveUserProfile(user.id, {
        name: user.name,
        phone: user.phone,
        email: user.email,
        gender: user.gender,
        dob: user.dob,
        upiId: user.upi_id,
        kycStatus: state.kyc.status || user.kyc_status,
        walletBalance: state.wallet.balance,
        walletTransactions: state.wallet.transactions,
        vehicles: state.kyc.vehicles || user.vehicles
      }).catch(e => console.warn('Initial profile sync notice:', e));
    }

    try {
      localStorage.setItem('routemate_user', JSON.stringify(user));
    } catch (e) {}

    closeProfileCompletionModal();
    state.pendingCompletionUser = null;
    unlockAppWithUser(user, isNewSignIn);
  }

  window.openProfileCompletionModal = function (user) {
    const modal = document.getElementById('googleProfileCompletionModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

    const emailEl = document.getElementById('completionGoogleEmail');
    if (emailEl) emailEl.textContent = user.email || 'Google User';

    const nameInput = document.getElementById('completionNameInput');
    if (nameInput) {
      nameInput.value = (user.name && user.name !== 'User' && !user.name.includes('@')) ? user.name : '';
    }

    const phoneInput = document.getElementById('completionPhoneInput');
    if (phoneInput) {
      const existingDigits = String(user.phone || '').replace(/\D/g, '');
      phoneInput.value = (existingDigits.length === 10) ? existingDigits : '';
    }

    const genderInput = document.getElementById('completionGenderInput');
    if (genderInput && user.gender) genderInput.value = user.gender;

    const dobInput = document.getElementById('completionDobInput');
    if (dobInput && user.dob) dobInput.value = user.dob;

    const upiInput = document.getElementById('completionUpiInput');
    if (upiInput) {
      upiInput.value = user.upi_id || user.upiId || state.driverUpi.upiId || '';
    }

    const errEl = document.getElementById('completionErrorMsg');
    if (errEl) {
      errEl.classList.add('hidden');
      errEl.textContent = '';
    }

    setTimeout(() => {
      if (nameInput && nameInput.value.trim()) {
        phoneInput?.focus();
      } else {
        nameInput?.focus();
      }
    }, 200);
  };

  window.closeProfileCompletionModal = function () {
    const modal = document.getElementById('googleProfileCompletionModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleProfileCompletionSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const user = state.pendingCompletionUser || state.currentUser;
    if (!user) {
      showToast('Session error. Please sign in again.', 'danger');
      lockAppToAuthScreen();
      return;
    }

    const nameInput = document.getElementById('completionNameInput');
    const phoneInput = document.getElementById('completionPhoneInput');
    const genderInput = document.getElementById('completionGenderInput');
    const dobInput = document.getElementById('completionDobInput');
    const upiInput = document.getElementById('completionUpiInput');
    const errEl = document.getElementById('completionErrorMsg');
    const btn = document.getElementById('btnSubmitCompletion');
    const btnText = document.getElementById('btnSubmitCompletionText');

    const fullName = String(nameInput?.value || '').trim();
    const rawPhone = String(phoneInput?.value || '').replace(/\D/g, '');
    const gender = String(genderInput?.value || '').trim();
    const dob = String(dobInput?.value || '').trim();
    const rawUpi = String(upiInput?.value || '').trim();

    // Validation
    if (!fullName || fullName.length < 2) {
      if (errEl) {
        errEl.textContent = 'Please enter your full name.';
        errEl.classList.remove('hidden');
      }
      nameInput?.focus();
      return;
    }

    if (rawPhone.length !== 10) {
      if (errEl) {
        errEl.textContent = 'Please enter a valid 10-digit mobile number.';
        errEl.classList.remove('hidden');
      }
      phoneInput?.focus();
      return;
    }

    const completionTermsCheckbox = document.getElementById('completionTermsCheckbox');
    if (completionTermsCheckbox && !completionTermsCheckbox.checked) {
      if (errEl) {
        errEl.textContent = 'Please accept the Terms & Conditions and Privacy Policy to continue.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (errEl) errEl.classList.add('hidden');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Saving details...';

    const formattedPhone = '+91' + rawPhone;

    try {
      showToast('Saving profile details...', 'info');

      // 1. Save to Supabase profiles table & Auth Metadata
      let saved = null;
      if (window.db?.auth?.saveUserProfile) {
        saved = await window.db.auth.saveUserProfile(user.id, {
          name: fullName,
          phone: formattedPhone,
          email: user.email,
          gender,
          dob,
          upiId: rawUpi,
          kycStatus: state.kyc.status || user.kyc_status,
          walletBalance: state.wallet.balance,
          walletTransactions: state.wallet.transactions,
          vehicles: state.kyc.vehicles || user.vehicles
        });
        if (saved && saved.id) {
          user.id = saved.id;
        }
      }

      // 2. Update user object
      user.name = fullName;
      user.phone = formattedPhone;
      user.gender = gender;
      user.dob = dob;
      if (rawUpi) {
        user.upi_id = rawUpi;
        state.driverUpi.upiId = rawUpi;
      }
      if (saved) {
        if (saved.kyc_status) {
          user.kyc_status = saved.kyc_status;
          state.kyc.status = saved.kyc_status;
        }
        if (saved.wallet_balance !== undefined) {
          user.wallet_balance = Number(saved.wallet_balance);
          state.wallet.balance = Number(saved.wallet_balance);
        }
        if (Array.isArray(saved.wallet_transactions) && saved.wallet_transactions.length > 0) {
          user.wallet_transactions = saved.wallet_transactions;
          state.wallet.transactions = saved.wallet_transactions;
        }
        if (Array.isArray(saved.vehicles) && saved.vehicles.length > 0) {
          user.vehicles = saved.vehicles;
          state.kyc.vehicles = saved.vehicles;
        }
      }
      user.avatar = getInitialsAvatarSvg(fullName, 120);

      // 3. Cache in localStorage permanently
      try {
        localStorage.setItem('routemate_user', JSON.stringify(user));
      } catch (err) {}

      // 4. Close modal and unlock app
      closeProfileCompletionModal();
      state.pendingCompletionUser = null;
      unlockAppWithUser(user, true);

      showToast(`Welcome to Routemate, ${fullName}! Profile completed.`, 'success');
    } catch (saveErr) {
      console.warn('Profile save error:', saveErr);
      if (errEl) {
        errEl.textContent = saveErr.message || 'Failed to save profile. Please try again.';
        errEl.classList.remove('hidden');
      }
      showToast('Error saving details: ' + saveErr.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Save & Continue';
    }
  };

  // Super Admin Authorization Gate
  const SUPER_ADMIN_EMAIL = 'shanthankolupula123@gmail.com';

  function isAuthorizedSuperAdmin(user = state.currentUser) {
    if (!user) return false;
    const email = String(user.email || '').toLowerCase().trim();
    return email === SUPER_ADMIN_EMAIL;
  }
  window.isAuthorizedSuperAdmin = isAuthorizedSuperAdmin;

  function unlockAppWithUser(user) {
    state.currentUser = user;
    try { localStorage.setItem('routemate_user', JSON.stringify(user)); } catch (e) {}

    // Hide Auth Screen & Completion Modal
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.add('hidden');
    closeProfileCompletionModal();

    // Show Main App Elements
    const header = document.getElementById('appHeader');
    const main = document.getElementById('appMain');
    const nav = document.getElementById('appBottomNav');
    if (header) header.classList.remove('hidden');
    if (main) main.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');

    // Super Admin Authorization Gate: Strictly shanthankolupula123@gmail.com
    const isSuperAdmin = isAuthorizedSuperAdmin(user);
    const adminPill = document.getElementById('headerAdminPill');
    const adminNav = document.getElementById('navTab-admin');
    const profileAdminCard = document.getElementById('profileAdminAccessCard');
    if (adminPill) {
      if (isSuperAdmin) {
        adminPill.classList.remove('hidden');
        adminPill.classList.add('inline-flex');
      } else {
        adminPill.classList.add('hidden');
        adminPill.classList.remove('inline-flex');
      }
    }
    if (adminNav) {
      if (isSuperAdmin) {
        adminNav.classList.remove('hidden');
      } else {
        adminNav.classList.add('hidden');
      }
    }
    if (profileAdminCard) {
      if (isSuperAdmin) {
        profileAdminCard.classList.remove('hidden');
      } else {
        profileAdminCard.classList.add('hidden');
      }
    }

    if (isSuperAdmin) {
      loadAdminKycSubmissions();
      loadAdminSafetyData();
    }

    updateProfileUI();

    // Load Driver KYC, wallet balance, and vehicle registrations immediately
    checkDriverKycStatus(false);
    listenForDriverSafetyAlerts(user);
    initNotificationSystem(user);

    // Default to commuter mode (user can freely toggle rider/driver anytime via header slider or bottom nav)
    switchMode('rider');

    // Ensure Leaflet map computes accurate dimensions once DOM is visible
    setTimeout(() => {
      initMapWidget('riderInteractiveMap', 'rider');
      if (state.maps.rider) {
        state.maps.rider.invalidateSize();
        updateRouteLine(state.maps.rider, 'rider');
      }
    }, 250);
  }

  function lockAppToAuthScreen() {
    // 1. Reset in-memory application state
    state.currentUser = null;
    state.pendingCompletionUser = null;
    state.activeRiderRequest = null;
    state.activeDriverTrip = null;
    state.activities = [];
    state.incomingRides = [];
    state.declinedRideIds = new Set();
    state.wallet = { balance: 0, transactions: [], welcomeBonusCredited: false };
    state.driverUpi = { upiId: '', upiQr: '', vpa: '' };
    state.locationPreferences = { home: '', work: '', defaultRoute: '', autoGps: true };
    state.kyc = { status: 'not_submitted', submission: null, currentStep: 1, formData: {} };
    state.ratingState = { activeRide: null, selectedStars: 5, selectedTags: new Set(['Smooth & Safe Ride', 'Polite Driver']), chosenPaymentMethod: 'upi' };
    state.notifications = { items: [], filter: 'all', activeDetail: null, readIds: new Set() };

    // 2. Stop any active real-time matching or driver polling
    if (window.db?.matching?.stopDriverPolling) window.db.matching.stopDriverPolling();
    if (window.db?.matching?.stopRiderPolling) window.db.matching.stopRiderPolling();

    // 3. Close all open modals & drawers
    closeProfileCompletionModal();
    closeDeleteAccountModal();
    closeLocationPreferencesModal();
    if (typeof closeTermsModal === 'function') closeTermsModal();
    if (typeof closePrivacyModal === 'function') closePrivacyModal();
    if (typeof closeNotificationDrawer === 'function') closeNotificationDrawer();
    if (typeof closeNotificationDetailModal === 'function') closeNotificationDetailModal();
    if (typeof closeUpdateUpiModal === 'function') closeUpdateUpiModal();
    if (typeof closeRechargeModal === 'function') closeRechargeModal();
    if (typeof closeDriverKycModal === 'function') closeDriverKycModal();
    if (typeof closeAddVehicleModal === 'function') closeAddVehicleModal();

    // 4. Hide Super Admin controls
    const adminPill = document.getElementById('headerAdminPill');
    const adminNav = document.getElementById('navTab-admin');
    const profileAdminCard = document.getElementById('profileAdminAccessCard');
    if (adminPill) {
      adminPill.classList.add('hidden');
      adminPill.classList.remove('inline-flex');
    }
    if (adminNav) adminNav.classList.add('hidden');
    if (profileAdminCard) profileAdminCard.classList.add('hidden');

    // 5. Reset Auth form inputs & errors to a completely clean slate
    const emailInput = document.getElementById('authEmailInput');
    const nameInput = document.getElementById('authNameInput');
    const phoneInput = document.getElementById('authPhoneInput');
    const dobInput = document.getElementById('authDobInput');
    const otpInput = document.getElementById('authOtpInput');
    const emailErr = document.getElementById('authEmailErrorMsg');
    const otpErr = document.getElementById('authOtpErrorMsg');
    if (emailInput) emailInput.value = '';
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (dobInput) dobInput.value = '';
    if (otpInput) otpInput.value = '';
    if (emailErr) { emailErr.textContent = ''; emailErr.classList.add('hidden'); }
    if (otpErr) { otpErr.textContent = ''; otpErr.classList.add('hidden'); }

    if (typeof setAuthTab === 'function') setAuthTab('signin');
    if (typeof backToEmailStep === 'function') backToEmailStep();

    // 6. Show Auth Screen & Hide Main App Elements
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.remove('hidden');

    const header = document.getElementById('appHeader');
    const main = document.getElementById('appMain');
    const nav = document.getElementById('appBottomNav');
    if (header) header.classList.add('hidden');
    if (main) main.classList.add('hidden');
    if (nav) nav.classList.add('hidden');

    // 7. Update UI displays
    if (typeof renderAllUpiDisplays === 'function') renderAllUpiDisplays();
    if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
  }

  // =========================================================================
  // DYNAMIC UPI ID RESOLUTION & REAL-TIME UI BINDING ENGINE
  // =========================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getResolvedUserUpiId() {
    // 1. In-memory driverUpi
    if (state.driverUpi?.upiId && String(state.driverUpi.upiId).trim()) return String(state.driverUpi.upiId).trim();
    if (state.driverUpi?.vpa && String(state.driverUpi.vpa).trim()) return String(state.driverUpi.vpa).trim();

    // 2. In-memory currentUser
    if (state.currentUser?.upi_id && String(state.currentUser.upi_id).trim()) return String(state.currentUser.upi_id).trim();
    if (state.currentUser?.vpa && String(state.currentUser.vpa).trim()) return String(state.currentUser.vpa).trim();
    if (state.currentUser?.upiId && String(state.currentUser.upiId).trim()) return String(state.currentUser.upiId).trim();

    // 3. KYC submission in memory
    if (state.kyc?.submission?.upi_id && String(state.kyc.submission.upi_id).trim()) return String(state.kyc.submission.upi_id).trim();
    if (state.kyc?.submission?.vpa && String(state.kyc.submission.vpa).trim()) return String(state.kyc.submission.vpa).trim();
    if (state.kyc?.formData?.upi_id && String(state.kyc.formData.upi_id).trim()) return String(state.kyc.formData.upi_id).trim();

    // 4. LocalStorage caches
    try {
      const storedUpi = JSON.parse(localStorage.getItem('routemate_driver_upi') || '{}');
      if (storedUpi.upiId && String(storedUpi.upiId).trim()) return String(storedUpi.upiId).trim();
      if (storedUpi.vpa && String(storedUpi.vpa).trim()) return String(storedUpi.vpa).trim();
      if (storedUpi.upi_id && String(storedUpi.upi_id).trim()) return String(storedUpi.upi_id).trim();
    } catch (e) {}

    try {
      const storedKyc = JSON.parse(localStorage.getItem('routemate_driver_kyc') || '{}');
      if (storedKyc.upi_id && String(storedKyc.upi_id).trim()) return String(storedKyc.upi_id).trim();
      if (storedKyc.vpa && String(storedKyc.vpa).trim()) return String(storedKyc.vpa).trim();
    } catch (e) {}

    try {
      const storedUser = JSON.parse(localStorage.getItem('routemate_user') || '{}');
      if (storedUser.upi_id && String(storedUser.upi_id).trim()) return String(storedUser.upi_id).trim();
      if (storedUser.vpa && String(storedUser.vpa).trim()) return String(storedUser.vpa).trim();
      if (storedUser.upiId && String(storedUser.upiId).trim()) return String(storedUser.upiId).trim();
    } catch (e) {}

    return '';
  }
  window.getResolvedUserUpiId = getResolvedUserUpiId;

  function renderAllUpiDisplays() {
    const upiId = getResolvedUserUpiId();

    // Keep state in sync with resolved UPI ID
    if (upiId) {
      if (!state.driverUpi) state.driverUpi = { upiId: '', upiQr: '' };
      state.driverUpi.upiId = upiId;
      state.driverUpi.vpa = upiId;
      if (!state.driverUpi.upiQr) {
        state.driverUpi.upiQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(state.currentUser?.name || 'Driver')}&cu=INR`)}`;
      }
      if (state.currentUser) {
        state.currentUser.upi_id = upiId;
        state.currentUser.vpa = upiId;
        state.currentUser.upiId = upiId;
      }
      if (state.kyc?.submission) {
        state.kyc.submission.upi_id = upiId;
        state.kyc.submission.vpa = upiId;
      }
    }

    // 1. Profile screen UPI display
    const profileUpiEl = document.getElementById('profileDriverUpiDisplay');
    if (profileUpiEl) {
      if (upiId) {
        profileUpiEl.innerHTML = `<span class="inline-flex items-center gap-1.5 text-emerald-700 font-mono font-bold text-xs"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600"></i><span>${escapeHtml(upiId)}</span></span>`;
      } else {
        profileUpiEl.innerHTML = `<span class="text-slate-400 font-sans italic text-xs">Not Set (Tap "Set UPI ID")</span>`;
      }
    }

    // 2. Drive dashboard operational UPI display
    const driveDashboardUpiEl = document.getElementById('driveDashboardUpiDisplay');
    if (driveDashboardUpiEl) {
      if (upiId) {
        driveDashboardUpiEl.innerHTML = `<span class="inline-flex items-center gap-1.5 text-emerald-800 font-mono font-black text-xs"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600"></i><span>${escapeHtml(upiId)}</span></span>`;
      } else {
        driveDashboardUpiEl.innerHTML = `<span class="text-amber-600 font-sans font-bold text-[11px]">⚠️ Not Set (Tap Set UPI ID)</span>`;
      }
    }

    // 3. KYC Step 4 review display
    const kycReviewUpi = document.getElementById('kycReviewUpiDisplay');
    if (kycReviewUpi) {
      kycReviewUpi.textContent = upiId || 'Not Set';
    }

    // 4. Modal inputs pre-fill
    const updateModalInput = document.getElementById('inputUpdateUpiId');
    if (updateModalInput && upiId && !updateModalInput.value) {
      updateModalInput.value = upiId;
    }

    const kycUpiInput = document.getElementById('kycInputUpiId');
    if (kycUpiInput && upiId && !kycUpiInput.value) {
      kycUpiInput.value = upiId;
    }

    const completionInput = document.getElementById('completionUpiInput');
    if (completionInput && upiId && !completionInput.value) {
      completionInput.value = upiId;
    }

    if (window.lucide && typeof lucide.createIcons === 'function') {
      try { lucide.createIcons(); } catch (e) {}
    }
  }
  window.renderAllUpiDisplays = renderAllUpiDisplays;

  let isRevalidatingUser = false;
  async function revalidateUserProfileAndUpi(silent = false) {
    const user = state.currentUser;
    if (!user || !user.id || isRevalidatingUser) return;
    isRevalidatingUser = true;

    try {
      if (!silent) showToast('Syncing profile & payment credentials...', 'info');

      // 1. Fetch fresh user profile from Supabase profiles table
      if (window.db?.auth?.getUserProfile) {
        const dbProfile = await window.db.auth.getUserProfile(user.id, user.email);
        if (dbProfile) {
          if (dbProfile.name && (!user.name || user.name === 'User' || user.name.includes('@'))) user.name = dbProfile.name;
          if (dbProfile.phone && !user.phone) user.phone = dbProfile.phone;
          const upi = dbProfile.upi_id || dbProfile.vpa || dbProfile.upiId;
          if (upi) {
            user.upi_id = upi;
            user.vpa = upi;
            user.upiId = upi;
            state.driverUpi.upiId = upi;
            state.driverUpi.vpa = upi;
          }
          if (dbProfile.kyc_status) {
            user.kyc_status = dbProfile.kyc_status;
            state.kyc.status = dbProfile.kyc_status;
          }
          if (dbProfile.wallet_balance !== undefined) {
            user.wallet_balance = Number(dbProfile.wallet_balance);
            state.wallet.balance = Number(dbProfile.wallet_balance);
          }
        }
      }

      // 2. Fetch fresh Driver KYC & UPI from database
      if (window.db?.kyc?.getDriverKyc) {
        const kycRes = await window.db.kyc.getDriverKyc(user.id, user.email);
        if (kycRes) {
          const sub = kycRes.submission || kycRes;
          const upi = sub.upi_id || sub.vpa || kycRes.upi?.id;
          if (upi) {
            user.upi_id = upi;
            user.vpa = upi;
            user.upiId = upi;
            state.driverUpi.upiId = upi;
            state.driverUpi.vpa = upi;
          }
          if (kycRes.status) {
            user.kyc_status = kycRes.status;
            state.kyc.status = kycRes.status;
          }
          const w = kycRes.wallet || {};
          const bal = (w.balance !== undefined) ? w.balance : (sub.wallet_balance !== undefined ? sub.wallet_balance : undefined);
          if (bal !== undefined) {
            state.wallet.balance = Number(bal);
            user.wallet_balance = Number(bal);
          }
        }
      }

      // 3. Persist updated profile & UPI caches
      try { localStorage.setItem('routemate_user', JSON.stringify(user)); } catch (e) {}
      if (state.driverUpi?.upiId) {
        try {
          localStorage.setItem('routemate_driver_upi', JSON.stringify({
            upiId: state.driverUpi.upiId,
            vpa: state.driverUpi.upiId,
            upi_id: state.driverUpi.upiId,
            upiQr: state.driverUpi.upiQr
          }));
        } catch (e) {}
      }

      renderAllUpiDisplays();
      if (typeof updateProfileUI === 'function') updateProfileUI();
      if (typeof updateWalletDisplays === 'function') updateWalletDisplays();
    } catch (err) {
      console.warn('Revalidate user profile & UPI notice:', err);
    } finally {
      isRevalidatingUser = false;
    }
  }
  window.revalidateUserProfileAndUpi = revalidateUserProfileAndUpi;

  function updateProfileUI() {
    const nameEl = document.getElementById('headerUserName');
    const avatarEl = document.getElementById('headerUserAvatar');
    const pNameEl = document.getElementById('profileUserName');
    const pEmailEl = document.getElementById('profileUserEmail');
    const pPhoneEl = document.getElementById('profileUserPhone');
    const pRoleEl = document.getElementById('profileUserRole');
    const pAvatarEl = document.getElementById('profileUserAvatar');
    const modeText = document.getElementById('profileCurrentModeText');

    if (state.currentUser) {
      const name = state.currentUser.name || 'User';
      const shortName = name.split(' ')[0] || 'User';
      const initials = getUserInitials(name);

      if (nameEl) nameEl.textContent = shortName;
      if (pNameEl) pNameEl.textContent = name;
      if (pEmailEl) pEmailEl.textContent = state.currentUser.email || '';
      if (pPhoneEl) {
        pPhoneEl.textContent = state.currentUser.phone ? `Phone: ${state.currentUser.phone}` : '';
        pPhoneEl.classList.toggle('hidden', !state.currentUser.phone);
      }

      // Dynamic User / Driver Star Rating & Reviews Display
      const rawRatingVal = state.currentUser.rating !== undefined && state.currentUser.rating !== null ? Number(state.currentUser.rating) : 5.0;
      const formattedRating = rawRatingVal.toFixed(1);
      const totalReviews = Number(state.currentUser.total_reviews || 0);
      const reviewsLabel = totalReviews > 0 ? ` (${totalReviews} review${totalReviews > 1 ? 's' : ''})` : ' (New)';

      if (pRoleEl) {
        if (state.currentUser.kyc_status === 'approved') {
          pRoleEl.textContent = `Verified Driver • ${formattedRating} ★${reviewsLabel}`;
          pRoleEl.className = 'text-[11px] font-bold text-emerald-600 mt-1';
        } else if (state.currentUser.kyc_status === 'pending') {
          pRoleEl.textContent = `KYC Under Review • ${formattedRating} ★`;
          pRoleEl.className = 'text-[11px] font-bold text-amber-600 mt-1';
        } else {
          pRoleEl.textContent = `Verified Commuter • ${formattedRating} ★${totalReviews > 0 ? reviewsLabel : ''}`;
          pRoleEl.className = 'text-[11px] font-bold text-slate-500 mt-1';
        }
      }

      const pScoreEl = document.getElementById('profileUserRatingScore');
      const pCountEl = document.getElementById('profileUserReviewsCount');
      if (pScoreEl) pScoreEl.textContent = `${formattedRating} ★`;
      if (pCountEl) pCountEl.textContent = `${totalReviews} review${totalReviews !== 1 ? 's' : ''}`;

      const drvScoreEl = document.getElementById('driverRatingCardScore');
      const drvCountEl = document.getElementById('driverRatingCardCount');
      if (drvScoreEl) drvScoreEl.textContent = `${formattedRating} ★`;
      if (drvCountEl) drvCountEl.textContent = `(${totalReviews} review${totalReviews !== 1 ? 's' : ''})`;
      const pVerifiedBadge = document.getElementById('profileUserVerifiedBadge');
      if (pVerifiedBadge) {
        pVerifiedBadge.classList.toggle('hidden', state.currentUser.kyc_status !== 'approved');
      }

      // Update avatar with clean dynamic initial (No mock images)
      if (avatarEl) {
        if (avatarEl.tagName === 'IMG') {
          avatarEl.src = getInitialsAvatarSvg(name, 64);
        } else {
          avatarEl.textContent = initials;
        }
      }

      if (pAvatarEl) {
        if (pAvatarEl.tagName === 'IMG') {
          pAvatarEl.src = getInitialsAvatarSvg(name, 120);
        } else {
          pAvatarEl.textContent = initials;
        }
      }
    }

    if (modeText) {
      modeText.textContent = state.mode === 'driver' ? '🛵 Driver Mode (Offering Rides)' : '🚗 Commuter Mode (Booking Rides)';
    }

    // Populate user's registered vehicles in profile
    if (typeof renderProfileVehicles === 'function') {
      renderProfileVehicles();
    }

    // Populate Driver UPI ID display across profile and drive dashboard
    if (typeof renderAllUpiDisplays === 'function') {
      renderAllUpiDisplays();
    }

    // Update Location Preferences display in profile & quick chips
    if (typeof updateLocationPreferencesUI === 'function') {
      updateLocationPreferencesUI();
    }

    // Super Admin Authorization Gate in Profile & Header
    const isSuperAdmin = isAuthorizedSuperAdmin(state.currentUser);
    const profileAdminCard = document.getElementById('profileAdminAccessCard');
    if (profileAdminCard) {
      if (isSuperAdmin) profileAdminCard.classList.remove('hidden');
      else profileAdminCard.classList.add('hidden');
    }
    const adminPill = document.getElementById('headerAdminPill');
    const adminNav = document.getElementById('navTab-admin');
    if (adminPill) {
      if (isSuperAdmin) {
        adminPill.classList.remove('hidden');
        adminPill.classList.add('inline-flex');
      } else {
        adminPill.classList.add('hidden');
        adminPill.classList.remove('inline-flex');
      }
    }
    if (adminNav) {
      if (isSuperAdmin) adminNav.classList.remove('hidden');
      else adminNav.classList.add('hidden');
    }

    if (typeof updateWalletDisplays === 'function') {
      updateWalletDisplays();
    }
  }

  window.setAuthTab = function (tab) {
    state.authTab = tab;
    const btnIn = document.getElementById('authTabSignIn');
    const btnUp = document.getElementById('authTabSignUp');
    const signupFields = document.getElementById('authSignupFields');
    const emailLabel = document.getElementById('authEmailLabel');
    const emailInput = document.getElementById('authEmailInput');
    const btnText = document.getElementById('btnSendOtpText');
    const errBox = document.getElementById('authEmailErrorMsg');

    if (errBox) errBox.classList.add('hidden');

    if (tab === 'signup') {
      if (btnUp) btnUp.className = 'w-1/2 py-2.5 rounded-full bg-white text-blue-700 shadow-sm transition cursor-pointer';
      if (btnIn) btnIn.className = 'w-1/2 py-2.5 rounded-full text-slate-500 hover:text-slate-700 transition cursor-pointer';
      if (signupFields) signupFields.classList.remove('hidden');
      if (emailLabel) emailLabel.classList.remove('hidden');
      if (emailInput) emailInput.placeholder = 'Enter Email Address';
      if (btnText) btnText.textContent = 'Create Account & Send OTP';
    } else {
      if (btnIn) btnIn.className = 'w-1/2 py-2.5 rounded-full bg-white text-blue-700 shadow-sm transition cursor-pointer';
      if (btnUp) btnUp.className = 'w-1/2 py-2.5 rounded-full text-slate-500 hover:text-slate-700 transition cursor-pointer';
      if (signupFields) signupFields.classList.add('hidden');
      if (emailLabel) emailLabel.classList.add('hidden');
      if (emailInput) emailInput.placeholder = 'Enter Email Address';
      if (btnText) btnText.textContent = 'Send 6-Digit OTP';
    }
    if (window.lucide) lucide.createIcons();
  };

  // STEP 1: SEND OTP (CLEAN SIGN IN OR CREATE ACCOUNT)
  window.handleSendOtpSubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('authEmailInput')?.value.trim();
    const submitBtn = document.getElementById('btnSendOtp');
    const btnText = document.getElementById('btnSendOtpText');
    const errBox = document.getElementById('authEmailErrorMsg');

    if (!email) {
      showToast('Please enter your email address.', 'warning');
      return;
    }

    const termsCheck = document.getElementById('authTermsCheckbox');
    if (termsCheck && !termsCheck.checked) {
      if (errBox) {
        errBox.textContent = 'Please agree to the Terms & Conditions and Privacy Policy to continue.';
        errBox.classList.remove('hidden');
      }
      showToast('Please agree to the Terms & Conditions and Privacy Policy.', 'warning');
      return;
    }

    let name = '';
    let phone = '';
    let gender = '';
    let dob = '';

    if (state.authTab === 'signup') {
      name = document.getElementById('authNameInput')?.value.trim() || '';
      phone = document.getElementById('authPhoneInput')?.value.trim() || '';
      gender = document.getElementById('authGenderInput')?.value.trim() || '';
      dob = document.getElementById('authDobInput')?.value.trim() || '';

      if (!name) {
        if (errBox) { errBox.textContent = 'Full Name is required to create an account.'; errBox.classList.remove('hidden'); }
        showToast('Full Name is required.', 'warning');
        document.getElementById('authNameInput')?.focus();
        return;
      }

      const digitsOnly = phone.replace(/\D/g, '');
      if (!phone || digitsOnly.length < 10) {
        if (errBox) { errBox.textContent = 'A valid 10-digit mobile phone number is required.'; errBox.classList.remove('hidden'); }
        showToast('Valid 10-digit mobile number is required.', 'warning');
        document.getElementById('authPhoneInput')?.focus();
        return;
      }
      phone = digitsOnly.length === 10 ? `+91 ${digitsOnly}` : `+${digitsOnly}`;
    }

    if (errBox) errBox.classList.add('hidden');

    state.pendingAuth = {
      email,
      name: name || email.split('@')[0],
      phone,
      gender,
      dob,
      isSignUp: state.authTab === 'signup'
    };

    submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'Sending OTP...';

    try {
      await window.db.auth.sendOtp(email, {
        name: state.pendingAuth.name,
        phone: state.pendingAuth.phone,
        gender: state.pendingAuth.gender,
        dob: state.pendingAuth.dob
      });
      
      // Transition to Step 2: OTP Entry
      document.getElementById('authStepEmail').classList.add('hidden');
      const stepOtp = document.getElementById('authStepOtp');
      stepOtp.classList.remove('hidden');
      document.getElementById('authOtpSentEmail').textContent = email;

      const otpInput = document.getElementById('authOtpInput');
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 250);
      }

      startResendCountdown();
      showToast('📩 6-digit OTP sent to your email inbox!', 'success');
    } catch (err) {
      console.error('Send OTP error:', err);
      let msg = err.message || 'Failed to send OTP. Please check your email address.';
      if (msg.includes('rate_limit')) {
        msg = 'Too many requests. Please wait a moment before trying again.';
      }
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
      }
      showToast(msg, 'danger');
    } finally {
      submitBtn.disabled = false;
      if (btnText) btnText.textContent = state.authTab === 'signup' ? 'Create Account & Send OTP' : 'Send 6-Digit OTP';
      if (window.lucide) lucide.createIcons();
    }
  };

  // STEP 2: VERIFY OTP
  window.handleVerifyOtpSubmit = async function (e) {
    e.preventDefault();
    const otpInput = document.getElementById('authOtpInput');
    const otp = (otpInput?.value || '').trim();
    const submitBtn = document.getElementById('btnVerifyOtp');
    const errBox = document.getElementById('authOtpErrorMsg');

    if (!otp || otp.length < 6) {
      showToast('Please enter the full 6-digit OTP.', 'warning');
      return;
    }
    if (errBox) errBox.classList.add('hidden');

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin inline-block mr-1">⚙️</span> Verifying...`;

    try {
      const data = await window.db.auth.verifyOtp(state.pendingAuth.email, otp, {
        name: state.pendingAuth.name,
        phone: state.pendingAuth.phone,
        gender: state.pendingAuth.gender,
        dob: state.pendingAuth.dob
      });

      let finalUser;
      if (data?.user) {
        finalUser = normalizeAuthUser(data.user);
        finalUser.name = state.pendingAuth.name || finalUser.name;
        if (state.pendingAuth.phone) finalUser.phone = state.pendingAuth.phone;
        if (state.pendingAuth.gender) finalUser.gender = state.pendingAuth.gender;
        if (state.pendingAuth.dob) finalUser.dob = state.pendingAuth.dob;
      } else {
        finalUser = {
          id: 'usr_' + Date.now(),
          email: state.pendingAuth.email,
          name: state.pendingAuth.name,
          phone: state.pendingAuth.phone || '',
          gender: state.pendingAuth.gender || '',
          dob: state.pendingAuth.dob || '',
          role: 'commuter',
          rating: 5.0,
          avatar: getInitialsAvatarSvg(state.pendingAuth.name, 120)
        };
      }

      await handleAuthUserFlow(finalUser, true);
      showToast('🎉 Successfully verified! Welcome to Routemate.', 'success');
    } catch (err) {
      console.error('Verify OTP error:', err);
      let msg = err.message || 'Invalid or expired OTP code. Please try again.';
      if (errBox) {
        errBox.textContent = msg;
        errBox.classList.remove('hidden');
      }
      showToast(msg, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-cyan-200"></i><span>Verify OTP & Log In</span>`;
      if (window.lucide) lucide.createIcons();
    }
  };

  window.backToEmailStep = function () {
    const stepEmail = document.getElementById('authStepEmail');
    const stepOtp = document.getElementById('authStepOtp');
    if (stepEmail) stepEmail.classList.remove('hidden');
    if (stepOtp) stepOtp.classList.add('hidden');
    if (state.resendTimer) clearInterval(state.resendTimer);
  };

  window.resendOtp = async function () {
    const resendBtn = document.getElementById('btnResendOtp');
    if (state.resendCountdown > 0) return;

    if (!state.pendingAuth.email) {
      backToEmailStep();
      return;
    }

    try {
      await window.db.auth.sendOtp(state.pendingAuth.email, {
        name: state.pendingAuth.name,
        phone: state.pendingAuth.phone,
        gender: state.pendingAuth.gender,
        dob: state.pendingAuth.dob
      });
      startResendCountdown();
      showToast('New 6-digit OTP code sent!', 'info');
    } catch (err) {
      showToast(err.message || 'Failed to resend OTP', 'danger');
    }
  };

  function startResendCountdown() {
    state.resendCountdown = 60;
    const resendBtn = document.getElementById('btnResendOtp');
    if (resendBtn) {
      resendBtn.disabled = true;
      resendBtn.textContent = `Resend in ${state.resendCountdown}s`;
    }

    if (state.resendTimer) clearInterval(state.resendTimer);
    state.resendTimer = setInterval(() => {
      state.resendCountdown--;
      if (resendBtn) {
        if (state.resendCountdown > 0) {
          resendBtn.textContent = `Resend in ${state.resendCountdown}s`;
        } else {
          resendBtn.disabled = false;
          resendBtn.textContent = 'Resend Code';
          clearInterval(state.resendTimer);
        }
      }
    }, 1000);
  }

  window.openGoogleSignInModal = function (prefillEmail = '') {
    const modal = document.getElementById('googleSignInModal');
    const input = document.getElementById('googleModalEmailInput');
    if (modal) {
      modal.classList.remove('hidden');
      if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
      if (input) {
        input.value = prefillEmail || document.getElementById('authEmailInput')?.value || '';
        setTimeout(() => input.focus(), 150);
      }
    }
  };

  window.closeGoogleSignInModal = function () {
    const modal = document.getElementById('googleSignInModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleGoogleGmailOtpSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('googleModalEmailInput');
    const email = String(input?.value || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      showToast('Please enter a valid Gmail address', 'warning');
      return;
    }

    closeGoogleSignInModal();

    // Populate main email input
    const mainEmailInput = document.getElementById('authEmailInput');
    if (mainEmailInput) mainEmailInput.value = email;

    const btn = document.getElementById('btnGoogleModalSend');
    if (btn) btn.disabled = true;

    try {
      showToast('Sending 6-digit verification code to ' + email + '...', 'info');
      await window.db.auth.sendOtp(email, {
        name: email.split('@')[0],
        role: 'rider'
      });
      state.otpEmail = email;
      showToast('6-digit code sent to your Google inbox!', 'success');
      showOtpStep(email);
    } catch (err) {
      console.warn('Google OTP dispatch error:', err);
      showToast(err.message || 'Failed to send OTP to Gmail.', 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  const GOOGLE_CLIENT_ID = '667321797265-kcrogrinsipuk4n1c96ru71c0pocochm.apps.googleusercontent.com';

  function initGoogleIdentityServices() {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      setTimeout(initGoogleIdentityServices, 300);
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });
      console.log('✅ [GIS] Google Identity Services initialized with Client ID:', GOOGLE_CLIENT_ID);
    } catch (e) {
      console.warn('⚠️ [GIS] Google Identity init note:', e);
    }
  }

  window.handleGoogleProfileSuccess = async function (profile) {
    if (!profile || !profile.email) return;
    const cleanEmail = String(profile.email).trim().toLowerCase();
    const fullName = profile.name || cleanEmail.split('@')[0];
    const avatar = profile.picture || getInitialsAvatarSvg(fullName, 120);

    showToast(`Signing in as ${fullName}...`, 'info');

    let supaUser = null;
    if (window.db?.getSupabase) {
      const client = window.db.getSupabase();
      if (profile.id_token && client?.auth && typeof client.auth.signInWithIdToken === 'function') {
        try {
          const { data } = await client.auth.signInWithIdToken({
            provider: 'google',
            token: profile.id_token
          });
          if (data?.user) supaUser = data.user;
        } catch (e) {}
      }
    }

    const finalUser = {
      id: (supaUser && supaUser.id) || ('usr_g_' + (profile.sub || Date.now())),
      email: cleanEmail,
      name: fullName,
      phone: (supaUser && supaUser.phone) || '',
      gender: '',
      dob: '',
      role: 'commuter',
      rating: 5.0,
      avatar: avatar
    };

    // Pre-hydrate from localStorage for returning users so they are never treated as new accounts
    try {
      const saved = localStorage.getItem('routemate_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email && parsed.email.toLowerCase() === cleanEmail) {
          if (parsed.id && !finalUser.id.includes('-') && parsed.id.includes('-')) finalUser.id = parsed.id;
          if (parsed.phone) finalUser.phone = parsed.phone;
          if (parsed.name && parsed.name !== 'User') finalUser.name = parsed.name;
          if (parsed.gender) finalUser.gender = parsed.gender;
          if (parsed.dob) finalUser.dob = parsed.dob;
          if (parsed.upi_id) finalUser.upi_id = parsed.upi_id;
          if (parsed.kyc_status) finalUser.kyc_status = parsed.kyc_status;
          if (parsed.wallet_balance !== undefined) finalUser.wallet_balance = parsed.wallet_balance;
        }
      }
    } catch (e) {}

    await handleAuthUserFlow(finalUser, true);
  };

  window.handleGoogleCredentialResponse = async function (response) {
    if (!response || !response.credential) {
      showToast('Google sign-in did not return credentials.', 'danger');
      return;
    }

    try {
      const token = response.credential;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonPayload);
      payload.id_token = token;

      console.log('✅ [GOOGLE AUTH] User signed in via GIS:', payload.email, payload.name);
      await window.handleGoogleProfileSuccess(payload);
    } catch (err) {
      console.error('Google credential parse error:', err);
      showToast('Google Sign In: ' + err.message, 'danger');
    }
  };

  window.showOtpStep = function (email) {
    state.pendingAuth = state.pendingAuth || {};
    state.pendingAuth.email = email;
    const stepEmail = document.getElementById('authStepEmail');
    const stepOtp = document.getElementById('authStepOtp');
    const sentEl = document.getElementById('authOtpSentEmail');
    if (stepEmail) stepEmail.classList.add('hidden');
    if (stepOtp) stepOtp.classList.remove('hidden');
    if (sentEl) sentEl.textContent = email;

    const otpInput = document.getElementById('authOtpInput');
    if (otpInput) {
      otpInput.value = '';
      setTimeout(() => otpInput.focus(), 250);
    }
    startResendCountdown();
  };

  window.handleGoogleSignIn = async function () {
    const termsCheck = document.getElementById('authTermsCheckbox');
    if (termsCheck && !termsCheck.checked) {
      showToast('Please agree to the Terms & Conditions and Privacy Policy to continue with Google.', 'warning');
      const errBox = document.getElementById('authEmailErrorMsg');
      if (errBox) {
        errBox.textContent = 'Please agree to the Terms & Conditions and Privacy Policy to continue.';
        errBox.classList.remove('hidden');
      }
      return;
    }

    const emailVal = document.getElementById('authEmailInput')?.value?.trim();
    showToast('Connecting to Google...', 'info');
    await fallbackGoogleOAuth(emailVal);
  };

  async function fallbackGoogleOAuth(emailVal) {
    try {
      await window.db.auth.signInWithGoogle();
    } catch (err) {
      console.warn('Google sign-in notice:', err.message);
      if (emailVal && emailVal.includes('@')) {
        showToast('Sending 6-digit verification code to ' + emailVal + '...', 'info');
        try {
          await window.db.auth.sendOtp(emailVal, {
            name: emailVal.split('@')[0],
            role: 'rider'
          });
          state.otpEmail = emailVal;
          showToast('6-digit code sent to your Google inbox!', 'success');
          showOtpStep(emailVal);
        } catch (sendErr) {
          showToast(sendErr.message || 'Failed to send OTP code.', 'danger');
        }
        return;
      }
      openGoogleSignInModal(emailVal);
    }
  }

  window.handleSignOut = async function () {
    if (confirm('Are you sure you want to sign out?')) {
      window._isUserExplicitSignOut = true;
      showToast('Signing out...', 'info');

      // 1. Explicitly invoke supabase.auth.signOut() and clear storages via client
      try {
        if (window.db?.auth?.signOut) {
          await window.db.auth.signOut();
        } else {
          const client = window.getSupabase ? window.getSupabase() : null;
          if (client?.auth?.signOut) await client.auth.signOut().catch(() => {});
        }
      } catch (err) {
        console.warn('Sign-out client warning:', err);
      }

      // 2. Clear all local storage, session storage, and disable Google GIS auto-select
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      if (window.google?.accounts?.id?.disableAutoSelect) {
        try { window.google.accounts.id.disableAutoSelect(); } catch (e) {}
      }

      // 3. Reset application state and lock app to clean fresh auth screen
      lockAppToAuthScreen();
      showToast('Signed out of Routemate', 'info');
    }
  };

  // =========================================================================
  // LOCATION PREFERENCES & COMMUTE DEFAULTS MODULE
  // =========================================================================
  function loadLocationPreferences() {
    try {
      const saved = localStorage.getItem('routemate_location_preferences');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          state.locationPreferences = {
            home: parsed.home || '',
            work: parsed.work || '',
            defaultRoute: parsed.defaultRoute || '',
            autoGps: parsed.autoGps !== false
          };
        }
      }
    } catch (e) {}
    updateLocationPreferencesUI();
  }

  function updateLocationPreferencesUI() {
    const prefs = state.locationPreferences || {};
    const homeEl = document.getElementById('profileHomeLocationDisplay');
    const workEl = document.getElementById('profileWorkLocationDisplay');

    if (homeEl) {
      if (prefs.home) {
        homeEl.textContent = prefs.home;
        homeEl.className = 'text-[11px] font-bold text-slate-800 truncate mt-1';
      } else {
        homeEl.textContent = 'Not configured';
        homeEl.className = 'text-[11px] font-bold text-slate-400 italic truncate mt-1';
      }
    }

    if (workEl) {
      if (prefs.work) {
        workEl.textContent = prefs.work;
        workEl.className = 'text-[11px] font-bold text-slate-800 truncate mt-1';
      } else {
        workEl.textContent = 'Not configured';
        workEl.className = 'text-[11px] font-bold text-slate-400 italic truncate mt-1';
      }
    }

    // Update quick chips in Rider card
    const homeChip = document.getElementById('pillQuickHome');
    const workChip = document.getElementById('pillQuickWork');
    if (homeChip) {
      if (prefs.home) {
        const shortHome = prefs.home.split(',')[0].trim();
        homeChip.innerHTML = `<span>🏠 ${shortHome}</span>`;
        homeChip.title = prefs.home;
        homeChip.classList.remove('opacity-60');
      } else {
        homeChip.innerHTML = `<span>🏠 Home</span>`;
        homeChip.title = 'Configure Home address';
        homeChip.classList.add('opacity-60');
      }
    }
    if (workChip) {
      if (prefs.work) {
        const shortWork = prefs.work.split(',')[0].trim();
        workChip.innerHTML = `<span>🏢 ${shortWork}</span>`;
        workChip.title = prefs.work;
        workChip.classList.remove('opacity-60');
      } else {
        workChip.innerHTML = `<span>🏢 Work</span>`;
        workChip.title = 'Configure Work address';
        workChip.classList.add('opacity-60');
      }
    }
  }

  window.openLocationPreferencesModal = function () {
    const modal = document.getElementById('locationPreferencesModal');
    if (!modal) return;

    const prefs = state.locationPreferences || {};
    const homeInput = document.getElementById('prefHomeInput');
    const workInput = document.getElementById('prefWorkInput');
    const routeInput = document.getElementById('prefDefaultRouteInput');
    const autoGpsToggle = document.getElementById('prefAutoGpsToggle');

    if (homeInput) homeInput.value = prefs.home || '';
    if (workInput) workInput.value = prefs.work || '';
    if (routeInput) routeInput.value = prefs.defaultRoute || '';
    if (autoGpsToggle) autoGpsToggle.checked = prefs.autoGps !== false;

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeLocationPreferencesModal = function () {
    const modal = document.getElementById('locationPreferencesModal');
    if (modal) modal.classList.add('hidden');
  };

  window.saveLocationPreferences = function (e) {
    if (e && e.preventDefault) e.preventDefault();

    const homeInput = document.getElementById('prefHomeInput');
    const workInput = document.getElementById('prefWorkInput');
    const defaultRouteInput = document.getElementById('prefDefaultRouteInput');
    const autoGpsToggle = document.getElementById('prefAutoGpsToggle');

    const homeVal = String(homeInput?.value || '').trim();
    const workVal = String(workInput?.value || '').trim();
    const routeVal = String(defaultRouteInput?.value || '').trim();
    const autoGpsVal = !!autoGpsToggle?.checked;

    state.locationPreferences = {
      home: homeVal,
      work: workVal,
      defaultRoute: routeVal,
      autoGps: autoGpsVal
    };

    try {
      localStorage.setItem('routemate_location_preferences', JSON.stringify(state.locationPreferences));
    } catch (err) {}

    updateLocationPreferencesUI();
    closeLocationPreferencesModal();
    showToast('Location preferences saved successfully!', 'success');
  };

  window.useCurrentGpsForPref = function (type) {
    if (!('geolocation' in navigator)) {
      showToast('Geolocation is not supported by your browser.', 'danger');
      return;
    }
    showToast('Acquiring current GPS position...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        let nearest = null;
        let minDist = Infinity;
        if (Array.isArray(TELANGANA_LOCATIONS)) {
          TELANGANA_LOCATIONS.forEach(loc => {
            const d = Math.hypot(loc.lat - latitude, loc.lng - longitude);
            if (d < minDist) {
              minDist = d;
              nearest = loc;
            }
          });
        }

        const inputId = type === 'home' ? 'prefHomeInput' : 'prefWorkInput';
        const input = document.getElementById(inputId);
        const resolvedName = nearest ? `${nearest.title}, ${nearest.subtitle}` : `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
        if (input) {
          input.value = resolvedName;
          input.focus();
        }
        showToast(`📍 GPS position applied for ${type === 'home' ? 'Home' : 'Work'}!`, 'success');
      },
      (err) => {
        showToast('Unable to get GPS location: ' + err.message, 'warning');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  window.applyQuickLocation = function (type) {
    const prefs = state.locationPreferences || {};
    const target = type === 'home' ? prefs.home : prefs.work;
    const label = type === 'home' ? 'Home' : 'Work / College';

    if (!target) {
      showToast(`${label} address is not configured yet. Set it in Location Preferences.`, 'info');
      openLocationPreferencesModal();
      return;
    }

    const dInput = document.getElementById('inputDrop');
    if (dInput) dInput.value = target;
    state.drop = target;

    // Resolve coordinates if matched with known hubs
    if (Array.isArray(TELANGANA_LOCATIONS)) {
      const cleanTarget = target.toLowerCase();
      const matched = TELANGANA_LOCATIONS.find(l => cleanTarget.includes(l.title.toLowerCase()) || l.title.toLowerCase().includes(cleanTarget));
      if (matched) {
        state.dropCoords = { lat: matched.lat, lng: matched.lng };
      }
    }

    calculateDistanceAndFare();
    updateRouteLine(state.maps.rider, 'rider');
    showToast(`📍 Set Destination to ${label}: ${target}`, 'success');
  };

  // =========================================================================
  // PERMANENT ACCOUNT DELETION MODULE
  // =========================================================================
  window.openDeleteAccountModal = function () {
    const modal = document.getElementById('deleteAccountModal');
    const input = document.getElementById('inputConfirmDeleteAccount');
    const errEl = document.getElementById('deleteAccountErrorMsg');
    const btn = document.getElementById('btnConfirmDeleteAccount');

    if (input) input.value = '';
    if (errEl) {
      errEl.classList.add('hidden');
      errEl.textContent = '';
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i><span>Delete Account</span>`;
    }
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    setTimeout(() => input?.focus(), 200);
  };

  window.closeDeleteAccountModal = function () {
    const modal = document.getElementById('deleteAccountModal');
    if (modal) modal.classList.add('hidden');
  };

  window.confirmDeleteAccount = async function () {
    const user = state.currentUser;
    if (!user) {
      showToast('No active user session.', 'warning');
      closeDeleteAccountModal();
      lockAppToAuthScreen();
      return;
    }

    const input = document.getElementById('inputConfirmDeleteAccount');
    const errEl = document.getElementById('deleteAccountErrorMsg');
    const btn = document.getElementById('btnConfirmDeleteAccount');

    const typed = String(input?.value || '').trim().toUpperCase();
    if (typed !== 'DELETE') {
      if (errEl) {
        errEl.textContent = 'Please type "DELETE" in capital letters to confirm.';
        errEl.classList.remove('hidden');
      }
      input?.focus();
      return;
    }

    if (errEl) errEl.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Purging Account...</span>`;
      if (window.lucide) lucide.createIcons();
    }

    showToast('Permanently purging your account and records from database...', 'warning');
    window._isUserExplicitSignOut = true;

    try {
      // 1. Delete user from Supabase tables (profiles, drivers, vehicles, driver_kyc, rides) and serverless backend
      if (window.db?.auth?.deleteAccount) {
        await window.db.auth.deleteAccount(user.id, user.email);
      }

      // 2. Explicitly sign out from Supabase Auth
      try {
        if (window.db?.auth?.signOut) {
          await window.db.auth.signOut();
        } else {
          const client = window.getSupabase ? window.getSupabase() : null;
          if (client?.auth?.signOut) await client.auth.signOut().catch(() => {});
        }
      } catch (e) {}

      // 3. Clear all local storage, session storage, and disable Google GIS auto-select
      try { localStorage.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      if (window.google?.accounts?.id?.disableAutoSelect) {
        try { window.google.accounts.id.disableAutoSelect(); } catch (e) {}
      }

      // 4. Close modal and lock app to 100% clean, fresh sign-in / registration screen
      closeDeleteAccountModal();
      lockAppToAuthScreen();

      showToast('Your Routemate account and all associated data have been permanently deleted.', 'info');
    } catch (delErr) {
      console.warn('Account deletion error:', delErr);
      if (errEl) {
        errEl.textContent = 'Error deleting account: ' + (delErr.message || 'Server error');
        errEl.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="trash-2" class="w-4 h-4"></i><span>Delete Account</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  // =========================================================================
  // FREE OPENSTREETMAP INTERACTIVE MAP & GPS TRACKING
  // =========================================================================
  let vehicleMarkerAnimationId = null;

  function animateCommuterVehicleMarker(targetLat, targetLng, heading, vehicleType) {
    const map = state.maps.rider;
    if (!map) return;

    const vehIconHtml = vehicleType === 'car' ? '🚗' : (vehicleType === 'auto' ? '🛺' : '🛵');

    if (!state.mapMarkers.driverVehicleMarker) {
      const customIcon = L.divIcon({
        className: 'custom-vehicle-tracker-icon',
        html: `
          <div id="driverVehicleMarkerIcon" style="transform: rotate(${heading || 0}deg); transition: transform 0.4s ease;" class="relative w-10 h-10 flex items-center justify-center">
            <span class="absolute inset-0 rounded-full bg-blue-500/30 radar-ring"></span>
            <span class="w-8 h-8 rounded-full bg-white border-2 border-blue-600 shadow-lg flex items-center justify-center text-base">
              ${vehIconHtml}
            </span>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      state.mapMarkers.driverVehicleMarker = L.marker([targetLat, targetLng], {
        icon: customIcon,
        zIndexOffset: 1200
      }).addTo(map);

      state.mapMarkers.driverVehicleMarker._currentCoords = { lat: targetLat, lng: targetLng };
      return;
    }

    const marker = state.mapMarkers.driverVehicleMarker;
    const startCoords = marker._currentCoords || marker.getLatLng();
    const startTime = performance.now();
    const duration = 1200; // 1.2s smooth lerp interpolation

    const iconEl = document.getElementById('driverVehicleMarkerIcon');
    if (iconEl && heading !== undefined) {
      iconEl.style.transform = `rotate(${heading}deg)`;
    }

    if (vehicleMarkerAnimationId) {
      cancelAnimationFrame(vehicleMarkerAnimationId);
    }

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out

      const currentLat = startCoords.lat + (targetLat - startCoords.lat) * ease;
      const currentLng = startCoords.lng + (targetLng - startCoords.lng) * ease;

      marker.setLatLng([currentLat, currentLng]);
      marker._currentCoords = { lat: currentLat, lng: currentLng };

      if (progress < 1) {
        vehicleMarkerAnimationId = requestAnimationFrame(step);
      } else {
        vehicleMarkerAnimationId = null;
      }
    }

    vehicleMarkerAnimationId = requestAnimationFrame(step);
  }

  window.handleLiveDriverGpsUpdate = function (payload) {
    if (!payload || !payload.lat || !payload.lng) return;
    const req = state.activeRiderRequest;
    if (!req) return;

    if (!['driver_accepted', 'accepted', 'ride_started'].includes(req.status)) return;

    animateCommuterVehicleMarker(payload.lat, payload.lng, payload.heading || 0, req.vehicleType || 'bike');

    const targetLat = (req.status === 'ride_started') ? (req.dropLat || 17.7265) : (req.pickupLat || 17.4018);
    const targetLng = (req.status === 'ride_started') ? (req.dropLng || 79.1554) : (req.pickupLng || 78.5602);

    const distKm = calculateProximityKm(payload.lat, payload.lng, targetLat, targetLng);
    if (distKm !== null) {
      const speedKmh = payload.speed ? (payload.speed * 3.6) : 35;
      const etaMin = Math.max(1, Math.round((distKm / speedKmh) * 60));

      const etaEl = document.getElementById('riderLiveEtaDisplay');
      if (etaEl) {
        const stageLabel = (req.status === 'ride_started') ? 'Destination in' : 'Pickup in';
        etaEl.innerHTML = `<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span><span>${stageLabel} <strong>~${etaMin} min</strong> (${distKm.toFixed(1)} km)</span></span><span class="font-mono text-[10px] text-white/80">Live GPS</span>`;
      }
    }
  };

  function initLiveGPS() {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy, heading, speed } = pos.coords;
        state.userGPS = { lat: latitude, lng: longitude, accuracy, heading: heading || 0, speed: speed || 0 };
        updateUserGPSMarker(latitude, longitude);

        // Broadcast driver GPS coordinates in real-time across WebSockets
        if (state.currentUser && (state.driverOnline || (state.activeDriverTrips && state.activeDriverTrips.length > 0) || state.activeDriverTrip)) {
          const tripIds = (state.activeDriverTrips || []).map(t => t.id);
          if (state.activeDriverTrip && !tripIds.includes(state.activeDriverTrip.id)) {
            tripIds.push(state.activeDriverTrip.id);
          }
          if (window.db?.matching?.broadcastDriverGPS) {
            window.db.matching.broadcastDriverGPS(state.currentUser.id, state.userGPS, tripIds);
          }
        }
      },
      (err) => {
        console.warn('GPS location notice:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
  }

  function updateUserGPSMarker(lat, lng) {
    const createGpsIcon = (isDriver) => L.divIcon({
      className: 'custom-gps-icon',
      html: `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <span class="absolute inset-0 rounded-full ${isDriver ? 'bg-emerald-500/30' : 'bg-blue-500/30'} radar-ring"></span>
          <span class="w-5 h-5 rounded-full ${isDriver ? 'bg-emerald-600' : 'bg-blue-600'} border-2 border-white shadow-md flex items-center justify-center text-[10px] text-white font-black">
            ${isDriver ? '🛵' : '●'}
          </span>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (state.maps.rider) {
      if (!state.mapMarkers.riderGPS) {
        state.mapMarkers.riderGPS = L.marker([lat, lng], { icon: createGpsIcon(false), zIndexOffset: 1000 }).addTo(state.maps.rider);
      } else {
        state.mapMarkers.riderGPS.setLatLng([lat, lng]);
      }
    }

    if (state.maps.driver) {
      if (!state.mapMarkers.driverGPS) {
        state.mapMarkers.driverGPS = L.marker([lat, lng], { icon: createGpsIcon(true), zIndexOffset: 1000 }).addTo(state.maps.driver);
      } else {
        state.mapMarkers.driverGPS.setLatLng([lat, lng]);
      }
    }

    const badge = document.getElementById('driverGpsStatusBadge');
    if (badge) {
      badge.textContent = 'GPS Active • Live';
      badge.className = 'text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300';
    }
  }

  window.locateUserGPS = function (preferredMode) {
    const activeMode = preferredMode || state.mode || 'rider';
    const targetMap = activeMode === 'driver' ? state.maps.driver : state.maps.rider;

    const centerTarget = (lat, lng) => {
      state.userGPS = { lat, lng };
      updateUserGPSMarker(lat, lng);
      if (targetMap) {
        targetMap.flyTo([lat, lng], 14, { duration: 1.2 });
      }
      showToast(activeMode === 'driver' ? '🛵 Centered Driver Map on your live GPS location!' : '📍 Centered on your live GPS location!', 'success');
    };

    if (state.userGPS) {
      centerTarget(state.userGPS.lat, state.userGPS.lng);
    } else {
      if (navigator.geolocation) {
        showToast('Acquiring live GPS coordinates...', 'info');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            centerTarget(latitude, longitude);
          },
          (err) => {
            console.warn('GPS location error:', err);
            centerTarget(17.4018, 78.5602);
            showToast('Could not acquire GPS. Centered on Uppal, Hyderabad.', 'warning');
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      } else {
        showToast('Geolocation is not supported by your browser.', 'warning');
      }
    }
  };

  function initMapWidget(containerId, mapKey) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (state.maps[mapKey]) {
      setTimeout(() => {
        try {
          state.maps[mapKey].invalidateSize();
          if (mapKey === 'rider') {
            updateRouteLine(state.maps.rider, 'rider');
          }
        } catch (e) {}
      }, 100);
      return;
    }

    try {
      if (el._leaflet_id) {
        delete el._leaflet_id;
      }

      const map = L.map(containerId, {
        zoomControl: false,
        attributionControl: false
      }).setView([17.5500, 78.8500], 10);

      // Clean Standard OpenStreetMap (Free, No API Key, No Watermark)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map);

      map.on('click', (e) => {
        if (mapKey === 'rider') {
          handleMapClick(e.latlng);
        }
      });

      state.maps[mapKey] = map;
      renderCorridorOnMap(map, mapKey);

      if (state.userGPS) {
        updateUserGPSMarker(state.userGPS.lat, state.userGPS.lng);
      }

      if (mapKey === 'driver' && state.incomingRides && state.incomingRides.length > 0) {
        updateDriverMapIncomingMarkers(state.incomingRides);
      }

      setTimeout(() => {
        map.invalidateSize();
        if (mapKey === 'rider') {
          updateRouteLine(map, 'rider');
        }
      }, 200);
    } catch (e) {
      console.warn('Map initialization note:', e);
    }
  }

  function renderCorridorOnMap(map, mapKey) {
    if (!map) return;

    const coords = CORRIDOR_STOPS.map(s => [s.lat, s.lng]);

    // Corridor dashed polyline
    L.polyline(coords, {
      color: mapKey === 'driver' ? '#10B981' : '#0052CC',
      weight: 4,
      opacity: 0.75,
      dashArray: '8, 8'
    }).addTo(map);

    // Stop markers
    CORRIDOR_STOPS.forEach(stop => {
      L.circleMarker([stop.lat, stop.lng], {
        radius: 5,
        color: mapKey === 'driver' ? '#10B981' : '#0052CC',
        fillColor: '#FFFFFF',
        fillOpacity: 1,
        weight: 2
      }).addTo(map).bindPopup(`<b>${stop.name}</b><br>NH163 Corridor Hub`);
    });

    if (mapKey === 'rider') {
      updateRouteLine(map, 'rider');
    }
  }

  function updateRouteLine(map, mapKey = 'rider') {
    if (!map) return;

    if (mapKey === 'rider') {
      if (state.mapMarkers.routeLine) {
        map.removeLayer(state.mapMarkers.routeLine);
        state.mapMarkers.routeLine = null;
      }
      if (state.mapMarkers.pickup) {
        map.removeLayer(state.mapMarkers.pickup);
        state.mapMarkers.pickup = null;
      }
      if (state.mapMarkers.drop) {
        map.removeLayer(state.mapMarkers.drop);
        state.mapMarkers.drop = null;
      }

      const p = state.pickupCoords;
      const d = state.dropCoords;

      if (p && d) {
        state.mapMarkers.pickup = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          color: '#FFFFFF',
          fillColor: '#10B981',
          fillOpacity: 1,
          weight: 3
        }).addTo(map).bindPopup(`<b>Pickup:</b> ${state.pickup}`);

        state.mapMarkers.drop = L.circleMarker([d.lat, d.lng], {
          radius: 8,
          color: '#FFFFFF',
          fillColor: '#0052CC',
          fillOpacity: 1,
          weight: 3
        }).addTo(map).bindPopup(`<b>Drop:</b> ${state.drop}`);

        state.mapMarkers.routeLine = L.polyline([[p.lat, p.lng], [d.lat, d.lng]], {
          color: '#0A84FF',
          weight: 4,
          opacity: 0.9
        }).addTo(map);

        map.fitBounds([[p.lat, p.lng], [d.lat, d.lng]], { padding: [30, 30] });
      }
    } else if (mapKey === 'driver' && state.activeDriverTrip) {
      const trip = state.activeDriverTrip;
      if (trip.pickupLat && trip.pickupLng && trip.dropLat && trip.dropLng) {
        if (state.mapMarkers.driverRouteLine) map.removeLayer(state.mapMarkers.driverRouteLine);
        if (state.mapMarkers.driverPickup) map.removeLayer(state.mapMarkers.driverPickup);
        if (state.mapMarkers.driverDrop) map.removeLayer(state.mapMarkers.driverDrop);

        state.mapMarkers.driverPickup = L.circleMarker([trip.pickupLat, trip.pickupLng], {
          radius: 8,
          color: '#FFFFFF',
          fillColor: '#10B981',
          fillOpacity: 1,
          weight: 3
        }).addTo(map).bindPopup(`<b>Pickup:</b> ${trip.pickup}`);

        state.mapMarkers.driverDrop = L.circleMarker([trip.dropLat, trip.dropLng], {
          radius: 8,
          color: '#FFFFFF',
          fillColor: '#0052CC',
          fillOpacity: 1,
          weight: 3
        }).addTo(map).bindPopup(`<b>Drop:</b> ${trip.drop}`);

        state.mapMarkers.driverRouteLine = L.polyline([[trip.pickupLat, trip.pickupLng], [trip.dropLat, trip.dropLng]], {
          color: '#10B981',
          weight: 4,
          opacity: 0.95
        }).addTo(map);

        map.fitBounds([[trip.pickupLat, trip.pickupLng], [trip.dropLat, trip.dropLng]], { padding: [30, 30] });
      }
    }
  }

  // =========================================================================
  // STATEWIDE LOCATION AUTOCOMPLETE ENGINE (TELANGANA-WIDE)
  // =========================================================================
  async function fetchTelanganaSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return [];

    // 1. Instant Local Filter from Pre-seeded 50+ Telangana Hubs (0ms)
    const localMatches = TELANGANA_LOCATIONS.filter(loc => {
      const t = loc.title.toLowerCase();
      const s = loc.subtitle.toLowerCase();
      return t.includes(q) || s.includes(q);
    });

    const suggestions = [...localMatches];

    // 2. High-speed OpenStreetMap Photon Geocoding (Biased to Telangana Coordinates)
    try {
      const url = 'https://photon.komoot.io/api/?' + new URLSearchParams({
        q: query,
        lat: '17.3850',
        lon: '78.4867',
        limit: '6'
      });
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        (data.features || []).forEach(f => {
          const p = f.properties || {};
          const name = p.name;
          if (!name) return;
          const county = p.county || p.district || p.city || '';
          const stateName = p.state || '';
          const subtitle = [county, stateName || 'Telangana'].filter(Boolean).join(', ');

          const already = suggestions.some(s => 
            s.title.toLowerCase() === name.toLowerCase() ||
            (Math.abs(s.lat - f.geometry.coordinates[1]) < 0.005 && Math.abs(s.lng - f.geometry.coordinates[0]) < 0.005)
          );

          if (!already) {
            suggestions.push({
              title: name,
              subtitle: subtitle,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              type: p.osm_value || 'location'
            });
          }
        });
      }
    } catch (err) {
      // 3. Fallback to OpenStreetMap Nominatim
      try {
        const nomUrl = 'https://nominatim.openstreetmap.org/search?' + new URLSearchParams({
          q: query + ', Telangana, India',
          format: 'json',
          limit: '4',
          countrycodes: 'in'
        });
        const nRes = await fetch(nomUrl, { signal: AbortSignal.timeout(3500) });
        if (nRes.ok) {
          const nData = await nRes.json();
          (nData || []).forEach(item => {
            const parts = (item.display_name || '').split(',');
            const title = parts[0] || item.name;
            const sub = parts.slice(1, 3).join(',').trim() || 'Telangana';
            if (!suggestions.some(s => s.title.toLowerCase() === title.toLowerCase())) {
              suggestions.push({
                title: title.trim(),
                subtitle: sub,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                type: 'nominatim'
              });
            }
          });
        }
      } catch (e) {}
    }

    return suggestions.slice(0, 7);
  }

  function setupLocationAutocomplete() {
    ['pickup', 'drop'].forEach(field => {
      const input = document.getElementById(field === 'pickup' ? 'inputPickup' : 'inputDrop');
      const dropdown = document.getElementById(`${field}Suggestions`);
      const clearBtn = document.getElementById(`btnClear${field.charAt(0).toUpperCase() + field.slice(1)}`);
      if (!input || !dropdown) return;

      let debounceTimer = null;

      input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (clearBtn) {
          clearBtn.classList.toggle('hidden', val.length === 0);
        }

        clearTimeout(debounceTimer);
        if (val.length < 2) {
          dropdown.classList.add('hidden');
          dropdown.innerHTML = '';
          return;
        }

        debounceTimer = setTimeout(async () => {
          dropdown.innerHTML = `
            <div class="p-3 text-center text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
              <span class="animate-spin inline-block">⚙️</span> Searching Telangana locations...
            </div>
          `;
          dropdown.classList.remove('hidden');

          const items = await fetchTelanganaSuggestions(val);
          renderSuggestions(field, items, val);
        }, 180);
      });

      input.addEventListener('focus', () => {
        const val = input.value.trim();
        if (val.length >= 2) {
          fetchTelanganaSuggestions(val).then(items => renderSuggestions(field, items, val));
        } else {
          renderSuggestions(field, TELANGANA_LOCATIONS.slice(0, 6), '');
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const pGroup = document.getElementById('pickupInputGroup');
      const dGroup = document.getElementById('dropInputGroup');
      if (pGroup && !pGroup.contains(e.target)) {
        document.getElementById('pickupSuggestions')?.classList.add('hidden');
      }
      if (dGroup && !dGroup.contains(e.target)) {
        document.getElementById('dropSuggestions')?.classList.add('hidden');
      }
    });
  }

  function renderSuggestions(field, items, query) {
    const dropdown = document.getElementById(`${field}Suggestions`);
    if (!dropdown) return;

    if (!items || items.length === 0) {
      dropdown.innerHTML = `
        <div class="p-3.5 text-center text-xs text-slate-400 font-semibold">
          No matching towns or landmarks found in Telangana.
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    let html = '';

    // Quick Live GPS item at top for Pickup
    if (field === 'pickup') {
      html += `
        <div onclick="selectGpsAsPickup()" class="suggestion-item p-3 flex items-center gap-3 cursor-pointer bg-blue-50/70 hover:bg-blue-100/90 border-b border-blue-100/80 transition">
          <div class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <i data-lucide="crosshair" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h5 class="text-xs font-black text-blue-700">Use My Current GPS Location</h5>
            <p class="text-[10px] text-blue-500 font-semibold truncate">Detects exact live coordinates in Telangana</p>
          </div>
        </div>
      `;
    }

    items.forEach((item, idx) => {
      const getIcon = (type) => {
        if (type === 'train' || type === 'metro') return 'train';
        if (type === 'bus') return 'bus';
        if (type === 'airport') return 'plane';
        return 'map-pin';
      };

      html += `
        <div onclick="selectLocationSuggestion('${field}', ${idx})" class="suggestion-item p-3 flex items-center gap-3 cursor-pointer transition border-b border-slate-100/80 last:border-b-0">
          <div class="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
            <i data-lucide="${getIcon(item.type)}" class="w-3.5 h-3.5 text-blue-600"></i>
          </div>
          <div class="flex-1 min-w-0">
            <h5 class="text-xs font-bold text-slate-900 truncate">${item.title}</h5>
            <p class="text-[10px] text-slate-400 font-medium truncate">${item.subtitle || 'Telangana, India'}</p>
          </div>
        </div>
      `;
    });

    state.activeSuggestions = state.activeSuggestions || {};
    state.activeSuggestions[field] = items;

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  window.selectLocationSuggestion = function (field, index) {
    const items = state.activeSuggestions?.[field];
    if (!items || !items[index]) return;
    const item = items[index];

    const input = document.getElementById(field === 'pickup' ? 'inputPickup' : 'inputDrop');
    const dropdown = document.getElementById(`${field}Suggestions`);
    const clearBtn = document.getElementById(`btnClear${field.charAt(0).toUpperCase() + field.slice(1)}`);

    const formatted = item.title + (item.subtitle && !item.title.includes(item.subtitle.split(',')[0]) ? ', ' + item.subtitle.split(',')[0] : '');

    if (input) input.value = formatted;
    if (clearBtn) clearBtn.classList.remove('hidden');
    if (dropdown) dropdown.classList.add('hidden');

    if (field === 'pickup') {
      state.pickup = formatted;
      state.pickupCoords = { lat: item.lat, lng: item.lng };
    } else {
      state.drop = formatted;
      state.dropCoords = { lat: item.lat, lng: item.lng };
    }

    calculateDistanceAndFare();
    updateRouteLine(state.maps.rider, 'rider');
    showToast(`📍 Set ${field}: ${item.title}`, 'info');
  };

  window.selectGpsAsPickup = function () {
    const dropdown = document.getElementById('pickupSuggestions');
    if (dropdown) dropdown.classList.add('hidden');

    showToast('Acquiring live GPS for pickup...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        state.pickupCoords = { lat: latitude, lng: longitude };
        state.userGPS = { lat: latitude, lng: longitude };
        state.pickup = 'My Live Location';
        const pInput = document.getElementById('inputPickup');
        if (pInput) pInput.value = state.pickup;
        updateUserGPSMarker(latitude, longitude);
        calculateDistanceAndFare();
        updateRouteLine(state.maps.rider, 'rider');
        if (state.maps.rider) state.maps.rider.flyTo([latitude, longitude], 14);
        showToast('📍 Live GPS set as pickup location!', 'success');
      },
      () => showToast('Could not acquire GPS position.', 'warning'),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  window.clearLocationInput = function (field) {
    const input = document.getElementById(field === 'pickup' ? 'inputPickup' : 'inputDrop');
    const dropdown = document.getElementById(`${field}Suggestions`);
    const clearBtn = document.getElementById(`btnClear${field.charAt(0).toUpperCase() + field.slice(1)}`);
    if (input) {
      input.value = '';
      input.focus();
    }
    if (clearBtn) clearBtn.classList.add('hidden');
    if (dropdown) dropdown.classList.add('hidden');
  };

  window.toggleMapPointSelect = function () {
    state.mapTapMode = !state.mapTapMode;
    const badge = document.getElementById('mapTapModeBadge');
    if (badge) {
      if (state.mapTapMode) {
        state.mapTapTarget = 'pickup';
        badge.classList.remove('hidden');
        document.getElementById('mapTapTargetName').textContent = 'Pickup Point';
        showToast('Tap on map to set Pickup', 'info');
      } else {
        badge.classList.add('hidden');
      }
    }
  };

  function handleMapClick(latlng) {
    if (!state.mapTapMode) return;

    if (state.mapTapTarget === 'pickup') {
      state.pickupCoords = { lat: latlng.lat, lng: latlng.lng };
      state.pickup = `Stop (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
      document.getElementById('inputPickup').value = state.pickup;
      state.mapTapTarget = 'drop';
      document.getElementById('mapTapTargetName').textContent = 'Drop Point';
      showToast('Pickup set! Now tap destination drop point.', 'info');
    } else {
      state.dropCoords = { lat: latlng.lat, lng: latlng.lng };
      state.drop = `Stop (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`;
      document.getElementById('inputDrop').value = state.drop;
      state.mapTapMode = false;
      document.getElementById('mapTapModeBadge').classList.add('hidden');
      showToast('Destination set! Route updated.', 'success');
    }

    calculateDistanceAndFare();
    updateRouteLine(state.maps.rider);
  }

  /**
   * Realistic Peer-to-Peer Fuel-Share Pricing Engine:
   * - Bike (1 Pillion): Base fare ₹15 + ₹0.90/km (e.g. ~84-87 km calculates to ~₹90-₹95).
   * - Auto (Per Seat): Base fare ₹20 + ₹1.30/km per seat (multiplied by seats_booked).
   * - Car (Per Seat): Base fare ₹25 + ₹1.60/km per seat (multiplied by seats_booked).
   * Fares are cleanly rounded to the nearest whole rupee with Math.round().
   */
  function calculateTieredFuelShareFare(distanceKm, vehicleType, seatsBooked = 1) {
    const dist = Math.max(1, Number(distanceKm) || 1);
    const vType = String(vehicleType || 'bike').toLowerCase();
    const seats = Math.max(1, Number(seatsBooked) || 1);

    let baseFarePerSeat = 0;
    let ratePerKm = 0.90;

    if (vType === 'car') {
      // Car (Per Seat): Base fare ₹25 + ₹1.60/km per seat
      ratePerKm = 1.60;
      baseFarePerSeat = 25 + (dist * ratePerKm);
    } else if (vType === 'auto') {
      // Auto (Per Seat): Base fare ₹20 + ₹1.30/km per seat
      ratePerKm = 1.30;
      baseFarePerSeat = 20 + (dist * ratePerKm);
    } else {
      // Bike (1 Pillion): Base fare ₹15 + ₹0.90/km
      ratePerKm = 0.90;
      baseFarePerSeat = 15 + (dist * ratePerKm);
    }

    const roundedBase = Math.round(baseFarePerSeat);
    const totalFare = roundedBase * (vType === 'bike' ? 1 : seats);
    const slab = (dist <= 15) ? 'short' : ((dist <= 40) ? 'medium' : 'long');

    return {
      baseFarePerSeat: roundedBase,
      totalFare,
      slab,
      ratePerKm,
      transitComparison: 'Direct Fuel Split'
    };
  }
  window.calculateTieredFuelShareFare = calculateTieredFuelShareFare;

  function calculateDistanceAndFare() {
    const p = state.pickupCoords || { lat: 17.4018, lng: 78.5602 };
    const d = state.dropCoords || { lat: 17.7265, lng: 79.1554 };

    const R = 6371;
    const dLat = (d.lat - p.lat) * Math.PI / 180;
    const dLng = (d.lng - p.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p.lat * Math.PI / 180) * Math.cos(d.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    state.distanceKm = Math.max(3, Math.round(R * c * 1.2));

    const seats = (state.vehicleType === 'bike') ? 1 : Math.max(1, state.seatsBooked || 1);
    state.seatsBooked = seats;

    const calc = calculateTieredFuelShareFare(state.distanceKm, state.vehicleType, seats);
    state.baseFare = calc.baseFarePerSeat;
    state.fare = calc.totalFare;
    state.fareSlab = calc.slab;

    const fareEl = document.getElementById('fareDisplay');
    const distEl = document.getElementById('fareDistanceDisplay');
    const badgeEl = document.getElementById('fareTransitBadge');
    const detailEl = document.getElementById('fareBreakdownDetail');

    if (fareEl) {
      if (seats > 1) {
        fareEl.innerHTML = `₹${state.fare} <span class="text-[11px] font-semibold text-slate-500">(₹${state.baseFare} × ${seats} seats)</span>`;
      } else {
        fareEl.textContent = `₹${state.fare}`;
      }
    }

    if (distEl) {
      distEl.innerHTML = `<i data-lucide="map-pin" class="w-3 h-3 text-blue-500"></i><span>Distance: ~${state.distanceKm} km</span>`;
    }

    if (badgeEl) {
      badgeEl.classList.add('hidden');
    }

    if (detailEl) {
      detailEl.textContent = `~${state.distanceKm} km • Direct Fuel Split`;
    }

    if (window.lucide) lucide.createIcons();
  }

  function renderCommuterSeatSelector() {
    const wrap = document.getElementById('commuterSeatSelectorWrap');
    const grid = document.getElementById('commuterSeatOptionsGrid');
    const badge = document.getElementById('commuterSeatCountBadge');
    if (!wrap || !grid) return;

    if (state.vehicleType === 'bike') {
      wrap.classList.add('hidden');
      state.seatsBooked = 1;
      return;
    }

    wrap.classList.remove('hidden');
    // Car allows up to 8 passenger seats for pooling, Auto strictly 3
    const maxSeats = (state.vehicleType === 'car') ? 8 : 3;
    if (!state.seatsBooked || state.seatsBooked < 1) state.seatsBooked = 1;
    if (state.seatsBooked > maxSeats) state.seatsBooked = maxSeats;

    if (badge) {
      badge.textContent = `${state.seatsBooked} ${state.seatsBooked === 1 ? 'Seat' : 'Seats'} Selected`;
    }

    grid.className = (maxSeats > 4) ? 'grid grid-cols-4 gap-2' : ((maxSeats === 3) ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-4 gap-2');

    let html = '';
    for (let i = 1; i <= maxSeats; i++) {
      const isSel = (i === state.seatsBooked);
      html += `
        <button type="button" onclick="selectSeatsBooked(${i})" class="py-2.5 px-1.5 rounded-xl text-xs font-black transition cursor-pointer flex flex-col items-center gap-0.5 ${
          isSel 
            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-300' 
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
        }">
          <span class="text-sm">${i === 1 ? '👤' : (i === 2 ? '👥' : (i <= 4 ? '👨‍👩‍👧' : '🚐'))}</span>
          <span>${i} ${i === 1 ? 'Seat' : 'Seats'}</span>
        </button>
      `;
    }
    grid.innerHTML = html;
  }

  window.selectSeatsBooked = function (num) {
    const maxSeats = (state.vehicleType === 'car') ? 8 : (state.vehicleType === 'auto' ? 3 : 1);
    state.seatsBooked = Math.max(1, Math.min(maxSeats, Number(num) || 1));
    renderCommuterSeatSelector();
    calculateDistanceAndFare();
  };

  // =========================================================================
  // MODE & NAVIGATION SWITCHING (4 ESSENTIAL TABS ONLY)
  // =========================================================================
  window.switchMode = function (newMode) {
    state.mode = newMode;
    const pill = document.getElementById('modePillIndicator');
    const btnRider = document.getElementById('modeBtnRider');
    const btnDriver = document.getElementById('modeBtnDriver');

    const riderScreen = document.getElementById('riderScreen');
    const driverScreen = document.getElementById('driverScreen');

    if (newMode === 'rider') {
      if (pill) {
        pill.classList.remove('translate-x-full');
        pill.classList.add('translate-x-0');
      }
      if (btnRider) {
        btnRider.classList.add('text-blue-700');
        btnRider.classList.remove('text-slate-500');
      }
      if (btnDriver) {
        btnDriver.classList.remove('text-blue-700');
        btnDriver.classList.add('text-slate-500');
      }
      if (riderScreen) riderScreen.classList.remove('hidden');
      if (driverScreen) driverScreen.classList.add('hidden');

      if (window.db?.matching) window.db.matching.stopDriverPolling();
      setActiveNavPill('book');

      initMapWidget('riderInteractiveMap', 'rider');
      setTimeout(() => {
        if (state.maps.rider) {
          state.maps.rider.invalidateSize();
          updateRouteLine(state.maps.rider, 'rider');
          if (state.userGPS) {
            updateUserGPSMarker(state.userGPS.lat, state.userGPS.lng);
          }
        }
      }, 150);
      showToast('Switched to Commuter Mode', 'info');
    } else {
      if (pill) {
        pill.classList.add('translate-x-full');
        pill.classList.remove('translate-x-0');
      }
      if (btnRider) {
        btnRider.classList.remove('text-blue-700');
        btnRider.classList.add('text-slate-500');
      }
      if (btnDriver) {
        btnDriver.classList.add('text-blue-700');
        btnDriver.classList.remove('text-slate-500');
      }
      if (riderScreen) riderScreen.classList.add('hidden');
      if (driverScreen) driverScreen.classList.remove('hidden');

      initMapWidget('driverInteractiveMap', 'driver');
      setTimeout(() => {
        state.maps.driver?.invalidateSize();
        if (state.userGPS) {
          updateUserGPSMarker(state.userGPS.lat, state.userGPS.lng);
        }
      }, 150);

      // Check KYC status to gate operational access
      checkDriverKycStatus();
      setActiveNavPill('drive');
    }

    updateProfileUI();
  };

  // =========================================================================
  // TERMS & CONDITIONS AND PRIVACY POLICY MODAL HANDLERS
  // =========================================================================
  window.openTermsModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const modal = document.getElementById('termsModal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeTermsModal = function () {
    const modal = document.getElementById('termsModal');
    if (modal) modal.classList.add('hidden');
  };

  window.openPrivacyModal = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const modal = document.getElementById('privacyModal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closePrivacyModal = function () {
    const modal = document.getElementById('privacyModal');
    if (modal) modal.classList.add('hidden');
  };

  // =========================================================================
  // SUPER ADMIN ROUTE GUARD & DASHBOARD CONTROLLER (shanthankolupula123@gmail.com)
  // =========================================================================
  window.openAdminAuthModal = function () {
    if (!isAuthorizedSuperAdmin(state.currentUser)) {
      showToast('Access Denied: Authorized Admin access only.', 'danger');
      window.navigateToTab('book');
      return;
    }
    openAdminScreenDirect();
  };

  window.closeAdminAuthModal = function () {
    const modal = document.getElementById('adminAuthModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleAdminAuthModalSubmit = function (e) {
    if (e) e.preventDefault();
    if (!isAuthorizedSuperAdmin(state.currentUser)) {
      showToast('Access Denied: Authorized Admin access only.', 'danger');
      window.navigateToTab('book');
      return;
    }
    openAdminScreenDirect();
  };

  window.openAdminScreenDirect = function () {
    if (!isAuthorizedSuperAdmin(state.currentUser)) {
      showToast('Access Denied: Authorized Admin access only.', 'danger');
      window.navigateToTab('book');
      return;
    }

    state.activeTab = 'admin';
    setActiveNavPill('admin');

    // Ensure main app container is unhidden
    const header = document.getElementById('appHeader');
    const main = document.getElementById('appMain');
    const nav = document.getElementById('appBottomNav');
    const auth = document.getElementById('authScreen');
    if (auth) auth.classList.add('hidden');
    if (header) header.classList.remove('hidden');
    if (main) main.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');

    const screens = {
      book: document.getElementById('riderScreen'),
      drive: document.getElementById('driverScreen'),
      activity: document.getElementById('activityScreen'),
      profile: document.getElementById('profileScreen'),
      admin: document.getElementById('adminScreen')
    };

    Object.values(screens).forEach(el => el && el.classList.add('hidden'));
    if (screens.admin) {
      screens.admin.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    loadAdminKycSubmissions();
    loadAdminSafetyData();
    if (window.lucide) lucide.createIcons();
  };
  window.openAdminPanelDirect = window.openAdminScreenDirect;

  window.navigateToTab = function (tabName) {
    if (tabName === 'admin') {
      if (!isAuthorizedSuperAdmin(state.currentUser)) {
        showToast('Access Denied: Authorized Admin access only.', 'danger');
        window.navigateToTab('book');
        return;
      }
      openAdminScreenDirect();
      return;
    }

    state.activeTab = tabName;
    setActiveNavPill(tabName);

    const screens = {
      book: document.getElementById('riderScreen'),
      drive: document.getElementById('driverScreen'),
      activity: document.getElementById('activityScreen'),
      profile: document.getElementById('profileScreen'),
      admin: document.getElementById('adminScreen')
    };

    Object.values(screens).forEach(el => el && el.classList.add('hidden'));

    if (tabName === 'book') {
      switchMode('rider');
    } else if (tabName === 'drive') {
      switchMode('driver');
      if (typeof revalidateUserProfileAndUpi === 'function') revalidateUserProfileAndUpi(true);
    } else {
      if (screens[tabName]) screens[tabName].classList.remove('hidden');
      if (tabName === 'activity') {
        renderActivityList();
      } else if (tabName === 'profile') {
        updateProfileUI();
        if (typeof revalidateUserProfileAndUpi === 'function') revalidateUserProfileAndUpi(true);
      }
    }
  };

  function setActiveNavPill(activeTab) {
    const tabs = ['book', 'drive', 'activity', 'profile', 'admin'];
    tabs.forEach(tab => {
      const btn = document.getElementById(`navTab-${tab}`);
      if (!btn) return;
      if (tab === activeTab) {
        btn.classList.add('text-blue-600');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-slate-400');
      }
    });
  }

  // =========================================================================
  // RIDER WORKFLOW
  // =========================================================================
  window.setQuickRoute = function (pickup, drop, pLat, pLng, dLat, dLng) {
    const pInput = document.getElementById('inputPickup');
    const dInput = document.getElementById('inputDrop');
    if (pInput) pInput.value = pickup;
    if (dInput) dInput.value = drop;
    state.pickup = pickup;
    state.drop = drop;
    if (pLat && pLng) state.pickupCoords = { lat: pLat, lng: pLng };
    if (dLat && dLng) state.dropCoords = { lat: dLat, lng: dLng };

    calculateDistanceAndFare();
    updateRouteLine(state.maps.rider);
    showToast(`Route set: ${pickup} ➔ ${drop}`, 'info');
  };

  window.swapLocations = function () {
    const pInput = document.getElementById('inputPickup');
    const dInput = document.getElementById('inputDrop');
    if (pInput && dInput) {
      const tmpVal = pInput.value;
      pInput.value = dInput.value;
      dInput.value = tmpVal;
      state.pickup = pInput.value;
      state.drop = dInput.value;

      const tmpCoords = state.pickupCoords;
      state.pickupCoords = state.dropCoords;
      state.dropCoords = tmpCoords;

      calculateDistanceAndFare();
      updateRouteLine(state.maps.rider);
    }
  };

  window.selectVehicle = function (type) {
    state.vehicleType = type;
    ['bike', 'car', 'auto'].forEach(v => {
      const el = document.getElementById(`vehPill-${v}`);
      if (!el) return;
      if (v === type) el.classList.add('active');
      else el.classList.remove('active');
    });
    renderCommuterSeatSelector();
    calculateDistanceAndFare();
  };

  window.bookRideAction = async function () {
    const pInput = document.getElementById('inputPickup');
    const dInput = document.getElementById('inputDrop');
    const pickup = (pInput?.value || state.pickup || '').trim();
    const drop = (dInput?.value || state.drop || '').trim();

    if (!pickup || !drop) {
      showToast('Please specify pickup and destination stops.', 'warning');
      return;
    }

    state.pickup = pickup;
    state.drop = drop;

    const btn = document.getElementById('btnBookRide');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-2">⚙️</span> Broadcasting...`;
    }

    try {
      const payload = {
        pickup: state.pickup,
        drop: state.drop,
        pickupLat: state.pickupCoords.lat,
        pickupLng: state.pickupCoords.lng,
        dropLat: state.dropCoords.lat,
        dropLng: state.dropCoords.lng,
        fare: state.fare,
        baseFare: state.baseFare || Math.round(state.fare / (state.seatsBooked || 1)),
        distance: state.distanceKm,
        vehicleType: state.vehicleType,
        seatsBooked: state.seatsBooked || 1,
        seats: state.seatsBooked || 1,
        riderId: state.currentUser.id,
        riderName: state.currentUser.name,
        riderEmail: state.currentUser.email,
        riderPhone: state.currentUser.phone,
        riderAvatar: state.currentUser.avatar
      };

      const result = await window.db.matching.createRequest(payload);
      if (result.success && result.request) {
        state.activeRiderRequest = result.request;
        renderRiderActiveHUD(result.request);
        showToast('📡 Realtime Radar Active! Searching for nearby verified drivers...', 'info');

        window.db.matching.startRiderPolling(result.request.id, (statusData) => {
          handleRiderStatusUpdate(statusData);
        });
      } else {
        const errMsg = result.error?.message || (typeof result.error === 'string' ? result.error : null) || 'Failed to broadcast ride. Please check connection.';
        showToast(errMsg, 'danger');
      }
    } catch (e) {
      console.error('Booking error:', e);
      showToast('Error booking ride: ' + e.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="radio" class="w-4 h-4 text-cyan-200"></i><span>Find Verified Ride</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  // -------------------------------------------------------------------------
  // COMMUTER ACTIVE RADAR HUD & 60-SECOND COUNTDOWN / TIMEOUT CONTROLLER
  // -------------------------------------------------------------------------
  let riderSearchCountdownTimer = null;

  function startRiderSearchCountdown() {
    if (riderSearchCountdownTimer) clearInterval(riderSearchCountdownTimer);
    riderSearchCountdownTimer = setInterval(() => {
      if (!state.activeRiderRequest || state.activeRiderRequest.status !== 'searching') {
        clearInterval(riderSearchCountdownTimer);
        riderSearchCountdownTimer = null;
        return;
      }

      const createdMs = state.activeRiderRequest.createdAt ? new Date(state.activeRiderRequest.createdAt).getTime() : Date.now();
      const elapsedSec = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
      const remSec = Math.max(0, 60 - elapsedSec);

      if (remSec <= 0) {
        clearInterval(riderSearchCountdownTimer);
        riderSearchCountdownTimer = null;
        state.activeRiderRequest.searchTimedOut = true;
        renderRiderActiveHUD(state.activeRiderRequest);
        showToast('⏱️ Search timeout: No verified drivers accepted within 60 seconds.', 'warning');
      } else {
        const txtEl = document.getElementById('rider-radar-countdown-txt');
        const barEl = document.getElementById('rider-radar-countdown-bar');
        if (txtEl) txtEl.textContent = `${remSec}s`;
        if (barEl) {
          barEl.style.width = `${(remSec / 60) * 100}%`;
          if (remSec <= 15) {
            barEl.className = 'h-full bg-rose-400 rounded-full transition-all duration-1000 animate-pulse';
          }
        }
      }
    }, 1000);
  }

  window.retryRiderSearch = async function () {
    if (!state.activeRiderRequest) return;
    showToast('📡 Refreshing radar broadcast for 60 seconds...', 'info');

    const req = state.activeRiderRequest;
    req.createdAt = new Date().toISOString();
    req.searchTimedOut = false;
    req.status = 'searching';

    if (window.db?.matching?.createRequest) {
      try {
        const res = await window.db.matching.createRequest({
          ...req,
          id: req.id,
          pin: req.pin,
          riderName: req.riderName,
          riderEmail: req.riderEmail,
          riderPhone: req.riderPhone,
          pickup: req.pickup,
          drop: req.drop,
          pickupLat: req.pickupLat,
          pickupLng: req.pickupLng,
          dropLat: req.dropLat,
          dropLng: req.dropLng,
          fare: req.fare,
          distance: req.distance,
          vehicleType: req.vehicleType
        });
        if (res && res.request) {
          state.activeRiderRequest = res.request;
        }
      } catch (e) {
        console.warn('Retry createRequest error:', e);
      }
    }

    renderRiderActiveHUD(state.activeRiderRequest);
    startRiderSearchCountdown();
    playNotificationSound();
    showToast('📡 Radar search active! 60-second window restarted.', 'success');
  };

  function renderRiderActiveHUD(req) {
    const card = document.getElementById('riderActiveCard');
    if (!card) return;
    card.classList.remove('hidden');

    if (req.status === 'searching') {
      const createdMs = req.createdAt ? new Date(req.createdAt).getTime() : Date.now();
      const elapsedSec = Math.max(0, Math.floor((Date.now() - createdMs) / 1000));
      const remSec = Math.max(0, 60 - elapsedSec);

      // Timeout State after 60 seconds of no acceptance
      if (req.searchTimedOut || remSec <= 0) {
        card.innerHTML = `
          <div class="routemate-card p-5 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 text-white border-amber-500/40 shadow-xl relative overflow-hidden animate-in fade-in duration-300">
            <div class="flex items-center justify-between pb-3 border-b border-white/10">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  <i data-lucide="clock" class="w-4 h-4"></i>
                </div>
                <div>
                  <span class="text-[10px] font-black uppercase tracking-wider text-amber-300 block">Radar Window Elapsed (60s)</span>
                  <h4 class="text-xs font-black text-white">No Drivers Accepted Yet</h4>
                </div>
              </div>
              <span class="text-xs font-mono font-bold bg-white/10 text-amber-200 border border-white/15 px-3 py-1 rounded-full">
                PIN: ${req.pin}
              </span>
            </div>

            <div class="mt-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1.5">
              <p>Nearby drivers on this corridor (<strong class="text-white">${escapeHtml(req.pickup)} ➔ ${escapeHtml(req.drop)}</strong>) may currently be completing another trip.</p>
              <p class="text-[11px] text-amber-200 font-bold">You can broadcast again for another 60-second window or adjust your pickup point.</p>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onclick="cancelRiderActiveRequest()" class="py-2.5 rounded-xl btn-pill-secondary text-xs font-bold cursor-pointer active:scale-95 text-slate-300">
                Cancel Request
              </button>
              <button type="button" onclick="retryRiderSearch()" class="py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg active:scale-95">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 text-slate-950"></i>
                <span>Retry Search (60s)</span>
              </button>
            </div>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      // Active Searching State with visible 60s countdown
      card.innerHTML = `
        <div class="routemate-card p-5 bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white border-blue-500/30 shadow-xl relative overflow-hidden animate-in fade-in duration-300">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2.5">
              <div class="relative w-8 h-8 flex items-center justify-center">
                <span class="absolute inset-0 rounded-full bg-cyan-400/30 radar-ring"></span>
                <span class="w-3 h-3 rounded-full bg-cyan-400 live-dot"></span>
              </div>
              <div>
                <span class="text-[10px] font-black uppercase tracking-widest text-cyan-300 block">Realtime Radar Broadcast</span>
                <h4 class="text-xs font-black text-white">Searching for Verified Drivers...</h4>
              </div>
            </div>
            <span class="text-xs font-mono font-bold bg-white/10 text-cyan-200 border border-white/15 px-3 py-1 rounded-full">
              PIN: ${req.pin}
            </span>
          </div>

          <!-- Visible 60-Second Radar Countdown Badge & Bar -->
          <div class="mt-3 flex items-center justify-between text-xs">
            <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${remSec <= 15 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse' : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/30'}">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i>
              <span>Radar Window: <strong id="rider-radar-countdown-txt">${remSec}s</strong></span>
            </div>
            <span class="text-[11px] text-slate-400 font-bold">Expires in 60s</span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-1.5 overflow-hidden my-2">
            <div id="rider-radar-countdown-bar" class="h-full ${remSec <= 15 ? 'bg-rose-400' : 'bg-cyan-400'} rounded-full transition-all duration-1000" style="width: ${(remSec / 60) * 100}%"></div>
          </div>

          <div class="mt-2 space-y-2 text-xs">
            <div class="flex items-start gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></span>
              <p class="text-slate-200 truncate"><strong class="text-white">Pickup:</strong> ${escapeHtml(req.pickup)}</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400 mt-1 flex-shrink-0"></span>
              <p class="text-slate-200 truncate"><strong class="text-white">Drop:</strong> ${escapeHtml(req.drop)} (${req.distance} km)</p>
            </div>
            <div class="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span class="text-slate-300 capitalize">${req.vehicleType} Pillion</span>
              <span class="font-black text-cyan-300 text-sm">₹${req.fare} <span class="text-[10px] font-normal text-slate-300">Fuel Split</span></span>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onclick="shareRideDetailsWhatsApp()" class="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
              <svg class="w-3.5 h-3.5 fill-current text-emerald-400" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
              <span>Share Request</span>
            </button>
            <button type="button" onclick="cancelRiderActiveRequest()" class="py-2.5 rounded-xl btn-pill-danger text-xs font-bold cursor-pointer active:scale-95">
              Cancel Request
            </button>
          </div>
        </div>
      `;
      startRiderSearchCountdown();
    } else if (req.status === 'driver_accepted' || req.status === 'ride_started') {
      if (riderSearchCountdownTimer) {
        clearInterval(riderSearchCountdownTimer);
        riderSearchCountdownTimer = null;
      }
      const driver = req.driver || {};
      const isStarted = req.status === 'ride_started';

      card.innerHTML = `
        <div class="routemate-card p-5 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border-emerald-500/30 shadow-xl relative overflow-hidden animate-in fade-in duration-300">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${isStarted ? 'bg-cyan-400' : 'bg-emerald-400'} live-dot"></span>
              <span class="text-xs font-black uppercase tracking-wider ${isStarted ? 'text-cyan-300' : 'text-emerald-300'}">
                ${isStarted ? 'Ride Started • Live GPS Active' : 'Driver En Route to Pickup'}
              </span>
            </div>
            <span class="text-xs font-mono font-black bg-emerald-900/60 text-emerald-200 border border-emerald-700/60 px-3 py-1 rounded-full">
              PIN: ${req.pin}
            </span>
          </div>

          <div class="mt-3.5 flex items-center gap-3">
            <img src="${driver.avatar && !driver.avatar.includes('unsplash') ? driver.avatar : getInitialsAvatarSvg(driver.name || 'Driver', 120, '#10B981')}" alt="Driver" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md" />
            <div class="text-xs flex-1 min-w-0">
              <h4 class="font-black text-white text-sm truncate">${driver.name || 'Verified Driver'}</h4>
              <p class="text-slate-300 font-mono text-[11px] truncate">${driver.vehicleNumber || 'TG 08 AB 1234'} • ${driver.vehicleName || 'Hero Splendor'}</p>
              <p class="text-emerald-300 text-[10px] font-bold mt-0.5">Rating: ${driver.rating ? Number(driver.rating).toFixed(1) : '5.0'} ★ • Verified Driver</p>
            </div>
            <a href="tel:${driver.phone || '+919494285249'}" class="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition flex-shrink-0">
              <i data-lucide="phone" class="w-4 h-4"></i>
            </a>
          </div>

          <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span class="text-slate-300">Exact Fuel Share (${req.seatsBooked || 1} ${Number(req.seatsBooked || 1) === 1 ? 'Seat' : 'Seats'})</span>
            <span class="font-black text-emerald-300 text-base">₹${req.fare}</span>
          </div>

          <!-- Live Real-Time ETA & Smooth GPS Moving Vehicle Badge -->
          <div id="riderLiveEtaDisplay" class="mt-2.5 p-2.5 rounded-xl bg-white/10 border border-white/15 text-xs text-cyan-200 flex items-center justify-between font-bold">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>${isStarted ? 'In Transit to Destination' : 'Driver Approaching Pickup'}</span>
            </span>
            <span class="font-mono text-[10px] text-white">Live GPS Active</span>
          </div>

          <!-- Active Commuter Live Fuel Share Payment Selection (UPI / Cash) -->
          <div class="mt-3.5 pt-3 border-t border-white/10 space-y-2.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-slate-300 font-bold">Fuel Share Payment:</span>
              <span class="${req.paymentSettled ? 'text-emerald-300' : 'text-cyan-300'} font-black text-xs">
                ${req.paymentSettled ? '✓ Payment Settled' : (req.chosenPaymentMethod === 'cash' ? '💵 Cash in Hand' : '📱 Direct UPI / QR')}
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <button type="button" onclick="selectRiderActivePaymentMethod('upi')" class="py-2.5 px-2.5 rounded-xl font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${req.chosenPaymentMethod !== 'cash' ? 'bg-cyan-400 text-slate-950 font-black shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'}">
                <i data-lucide="smartphone" class="w-4 h-4"></i>
                <span>Direct UPI / QR</span>
              </button>
              <button type="button" onclick="selectRiderActivePaymentMethod('cash')" class="py-2.5 px-2.5 rounded-xl font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${req.chosenPaymentMethod === 'cash' ? 'bg-amber-400 text-slate-950 font-black shadow-md' : 'bg-white/10 hover:bg-white/20 text-white'}">
                <i data-lucide="banknote" class="w-4 h-4"></i>
                <span>Cash in Hand</span>
              </button>
            </div>
            ${!req.paymentSettled ? `
              <button type="button" onclick="openRiderPaymentModal()" class="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95">
                <i data-lucide="${req.chosenPaymentMethod === 'cash' ? 'hand-coins' : 'qr-code'}" class="w-4 h-4"></i>
                <span>${req.chosenPaymentMethod === 'cash' ? `Confirm Cash Payment (₹${req.fare})` : `Show Driver QR Code & Pay UPI (₹${req.fare})`}</span>
              </button>
            ` : `
              <div class="p-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-center text-xs font-bold text-emerald-300 flex items-center justify-center gap-2">
                <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
                <span>Payment settled via ${(req.chosenPaymentMethod || 'upi').toUpperCase()}. Driver will verify & complete trip.</span>
              </div>
            `}
          </div>

          <!-- Passenger Safety Action Bar (WhatsApp Share & Emergency SOS) -->
          <div class="mt-3.5 pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
            <button type="button" onclick="shareRideDetailsWhatsApp()" class="py-2.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition shadow cursor-pointer active:scale-95">
              <svg class="w-4 h-4 fill-current flex-shrink-0" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
              <span>Share Trip Details</span>
            </button>
            <button type="button" onclick="triggerEmergencySOS()" class="py-2.5 px-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-1.5 transition shadow cursor-pointer active:scale-95 animate-pulse">
              <i data-lucide="shield-alert" class="w-4 h-4 text-white"></i>
              <span>Emergency SOS</span>
            </button>
          </div>
        </div>
      `;
    }

    if (window.lucide) lucide.createIcons();
  }

  window.selectRiderActivePaymentMethod = function (method) {
    if (!state.activeRiderRequest) return;
    state.activeRiderRequest.chosenPaymentMethod = method;
    if (window.db?.matching?.notifyDriverPayment) {
      window.db.matching.notifyDriverPayment(state.activeRiderRequest.id, {
        paymentMethod: method,
        settled: !!state.activeRiderRequest.paymentSettled,
        fare: state.activeRiderRequest.fare
      });
    }
    renderRiderActiveHUD(state.activeRiderRequest);
    showToast(`Payment method updated to ${method === 'cash' ? 'Cash in Hand' : 'Direct UPI'}.`, 'info');
  };

  window.openRiderPaymentModal = function () {
    if (!state.activeRiderRequest) return;
    showRidePaymentAndRatingModal(state.activeRiderRequest);
  };

  function handleRiderStatusUpdate(statusData) {
    if (!state.activeRiderRequest) return;

    if (statusData.status === 'driver_accepted' || statusData.status === 'accepted') {
      state.activeRiderRequest.status = 'driver_accepted';
      state.activeRiderRequest.driver = statusData.driver;
      renderRiderActiveHUD(state.activeRiderRequest);
      playNotificationSound();
      showToast(`🎉 Driver ${statusData.driver?.name || ''} accepted your ride!`, 'success');
    } else if (statusData.status === 'ride_started') {
      state.activeRiderRequest.status = 'ride_started';
      if (statusData.driver) state.activeRiderRequest.driver = statusData.driver;
      renderRiderActiveHUD(state.activeRiderRequest);
      if (state.maps.rider) updateRouteLine(state.maps.rider, 'rider');
      showToast('🚀 Ride Started! Live GPS route tracking is active. Have a safe journey.', 'success');
    } else if (statusData.status === 'ride_completed' || statusData.status === 'completed') {
      const completedRide = { ...state.activeRiderRequest, ...statusData };
      state.activeRiderRequest = null;
      const card = document.getElementById('riderActiveCard');
      if (card) {
        card.classList.add('hidden');
        card.innerHTML = '';
      }
      playNotificationSound();

      // Dual-user permanent activity logging: save completed ride locally for commuter
      try {
        const commuterActivityRecord = {
          id: completedRide.id || statusData.requestId || ('REQ-' + Date.now()),
          dbId: statusData.dbId || completedRide.dbId,
          userRole: 'commuter',
          roleLabel: 'Completed Trip as Commuter',
          status: 'completed',
          pickup: completedRide.pickup || statusData.pickup || 'Pickup Location',
          drop: completedRide.drop || statusData.drop || statusData.drop_location || 'Drop Location',
          fare: Math.round(Number(statusData.fare || completedRide.fare || 110)),
          distance: Math.round(Number(statusData.distance || completedRide.distance || 0)),
          vehicleType: statusData.vehicleType || completedRide.vehicleType || 'bike',
          paymentMethod: statusData.paymentMethod || 'upi',
          driverId: statusData.driverId || (statusData.driver && statusData.driver.id) || '',
          driverName: statusData.driverName || (statusData.driver && statusData.driver.name) || 'Verified Driver',
          driverPhone: statusData.driverPhone || (statusData.driver && statusData.driver.phone) || '',
          riderId: state.currentUser?.id || '',
          riderName: state.currentUser?.name || 'Commuter',
          createdAt: new Date().toISOString()
        };
        if (typeof saveActivityRecordLocally === 'function') {
          saveActivityRecordLocally(commuterActivityRecord);
        }
      } catch (actErr) {
        console.warn('Commuter activity recording notice:', actErr);
      }

      showRidePaymentAndRatingModal(completedRide);
    }
  }

  window.cancelRiderActiveRequest = async function () {
    if (riderSearchCountdownTimer) {
      clearInterval(riderSearchCountdownTimer);
      riderSearchCountdownTimer = null;
    }
    if (state.activeRiderRequest) {
      await window.db.matching.cancelRequest(state.activeRiderRequest.id);
      state.activeRiderRequest = null;
    }
    const card = document.getElementById('riderActiveCard');
    if (card) {
      card.classList.add('hidden');
      card.innerHTML = '';
    }
    showToast('Ride request cancelled.', 'info');
  };

  // =========================================================================
  // DRIVER WORKFLOW (BROADCAST SCREEN & REALTIME MATCHING)
  // =========================================================================
  // -------------------------------------------------------------------------
  // DRIVER MULTI-SEAT CAPACITY & POOLING HELPERS (CAR & AUTO)
  // -------------------------------------------------------------------------
  function getDriverMaxCapacity() {
    const vType = String(state.driverActiveVehicleType || (state.driverActiveVehicle?.vehicle_type) || 'bike').toLowerCase();
    if (vType === 'car') {
      const configuredCap = Number(
        state.driverActiveVehicle?.car_seat_capacity ||
        state.driverActiveVehicle?.seat_capacity ||
        state.driverActiveVehicle?.seats ||
        state.kyc?.submission?.car_seat_capacity ||
        state.kyc?.submission?.seat_capacity ||
        (state.currentUser?.vehicles?.find(v => v.vehicle_type === 'car')?.car_seat_capacity) ||
        4
      );
      return Math.min(8, Math.max(1, configuredCap));
    }
    if (vType === 'auto') return 3;
    return 1;
  }

  function getDriverOccupiedSeats() {
    if (!state.activeDriverTrips || !Array.isArray(state.activeDriverTrips)) return 0;
    return state.activeDriverTrips.reduce((sum, t) => sum + Number(t.seatsBooked || t.seats_booked || t.seats || 1), 0);
  }

  function getDriverRemainingCapacity() {
    return Math.max(0, getDriverMaxCapacity() - getDriverOccupiedSeats());
  }

  function startDriverRadar() {
    if (!state.driverOnline || !state.currentUser) return;
    console.log('📡 [APP DRIVER] Starting Realtime Radar listener for user:', state.currentUser.name);

    const activeVehType = String(state.driverActiveVehicleType || (state.driverActiveVehicle?.vehicle_type) || 'bike').toLowerCase();
    const remSeats = getDriverRemainingCapacity();

    // If bike with an active passenger, or vehicle at full capacity: pause incoming cards
    if ((activeVehType === 'bike' && ((state.activeDriverTrips && state.activeDriverTrips.length > 0) || state.activeDriverTrip)) || remSeats <= 0) {
      console.log('🚗 [DRIVER RADAR] Vehicle at maximum capacity or bike with active passenger. Radar paused.');
      renderDriverIncomingCards([]);
      return;
    }

    // Pass live GPS locator, 15km geo-radius, active vehicle type, and remaining seats to matching engine
    window.db.matching.startDriverPolling(
      state.currentUser,
      (rides) => {
        const currentRemCap = getDriverRemainingCapacity();
        state.incomingRides = rides.filter(r => {
          if (state.declinedRideIds.has(r.id)) return false;
          if (String(r.vehicleType || 'bike').toLowerCase() !== activeVehType) return false;
          if ((r.seatsBooked || 1) > currentRemCap) return false;
          return true;
        });
        renderDriverIncomingCards(state.incomingRides);
        updateDriverMapIncomingMarkers(state.incomingRides);
      },
      {
        getDriverGPS: () => state.userGPS,
        maxRadiusKm: 15,
        activeVehicleType: activeVehType,
        remainingSeats: remSeats
      }
    );
  }

  function updateDriverMapIncomingMarkers(rides) {
    if (!state.maps.driver) return;

    state.mapMarkers.commuters.forEach(m => state.maps.driver.removeLayer(m));
    state.mapMarkers.commuters = [];

    rides.forEach(ride => {
      if (ride.pickupLat && ride.pickupLng) {
        const marker = L.circleMarker([ride.pickupLat, ride.pickupLng], {
          radius: 9,
          color: '#FFFFFF',
          fillColor: '#0A84FF',
          fillOpacity: 0.95,
          weight: 3
        }).addTo(state.maps.driver).bindPopup(`<b>${ride.riderName}</b><br>Pickup: ${ride.pickup}<br>Fare: ₹${ride.fare}`);

        state.mapMarkers.commuters.push(marker);
      }
    });
  }

  let driverIncomingTimerInterval = null;

  function startDriverIncomingCountdowns() {
    if (driverIncomingTimerInterval) clearInterval(driverIncomingTimerInterval);
    driverIncomingTimerInterval = setInterval(() => {
      if (!state.incomingRides || state.incomingRides.length === 0) {
        clearInterval(driverIncomingTimerInterval);
        driverIncomingTimerInterval = null;
        return;
      }

      const now = Date.now();
      let hasExpired = false;

      state.incomingRides.forEach(ride => {
        const createdMs = ride.createdMs || (ride.createdAt ? new Date(ride.createdAt).getTime() : now);
        const elapsedSec = Math.max(0, Math.floor((now - createdMs) / 1000));
        const remSec = Math.max(0, 60 - elapsedSec);

        if (remSec <= 0) {
          hasExpired = true;
          if (window.db?.matching?.expireRequest) {
            window.db.matching.expireRequest(ride.id).catch(() => {});
          }
        } else {
          const txtEl = document.getElementById(`driver-ride-timer-txt-${ride.id}`);
          const barEl = document.getElementById(`driver-ride-timer-bar-${ride.id}`);
          if (txtEl) {
            txtEl.textContent = `${remSec}s`;
            if (remSec <= 15) {
              txtEl.className = 'text-xs font-black text-rose-600 animate-pulse';
            }
          }
          if (barEl) {
            barEl.style.width = `${Math.min(100, (remSec / 60) * 100)}%`;
            if (remSec <= 15) {
              barEl.className = 'h-full bg-rose-500 rounded-full transition-all duration-1000 animate-pulse';
            }
          }
        }
      });

      if (hasExpired) {
        state.incomingRides = state.incomingRides.filter(r => {
          const createdMs = r.createdMs || (r.createdAt ? new Date(r.createdAt).getTime() : now);
          return (now - createdMs) < 60000;
        });
        renderDriverIncomingCards(state.incomingRides);
      }
    }, 1000);
  }

  function renderDriverIncomingCards(rides) {
    const container = document.getElementById('incomingRidesContainer');
    const badge = document.getElementById('incomingRidesBadge');
    if (!container) return;

    const now = Date.now();
    const validRides = (rides || []).filter(r => {
      const createdMs = r.createdMs || (r.createdAt ? new Date(r.createdAt).getTime() : now);
      if ((now - createdMs) >= 60000) return false;
      // Geo-Radius Proximity Filtering: Only allow pickups within 15 km of driver's live GPS
      if (state.userGPS && r.pickupLat && r.pickupLng) {
        const distKm = calculateProximityKm(state.userGPS.lat, state.userGPS.lng, r.pickupLat, r.pickupLng);
        if (distKm !== null && distKm > 15) return false;
      }
      return true;
    });

    if (badge) {
      badge.textContent = `${validRides.length} Waiting`;
    }

    const activeVehType = String(state.driverActiveVehicleType || (state.driverActiveVehicle?.vehicle_type) || 'bike').toLowerCase();
    const remCapacity = getDriverRemainingCapacity();
    const hasActivePassengers = (state.activeDriverTrips && state.activeDriverTrips.length > 0) || !!state.activeDriverTrip;

    // Bike strictly allows only 1 commuter:
    if (activeVehType === 'bike' && hasActivePassengers) {
      if (driverIncomingTimerInterval) {
        clearInterval(driverIncomingTimerInterval);
        driverIncomingTimerInterval = null;
      }
      container.innerHTML = `
        <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold text-center">
          ⚡ Bike trip in progress (1/1 Seats Occupied). Complete current ride to accept next commuter.
        </div>
      `;
      return;
    }

    // Car & Auto at full capacity:
    if (remCapacity <= 0 && hasActivePassengers) {
      if (driverIncomingTimerInterval) {
        clearInterval(driverIncomingTimerInterval);
        driverIncomingTimerInterval = null;
      }
      container.innerHTML = `
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-bold text-center">
          💺 Vehicle at full capacity (${getDriverOccupiedSeats()}/${getDriverMaxCapacity()} Seats Occupied). Radar will resume once a seat frees up.
        </div>
      `;
      return;
    }

    if (validRides.length === 0) {
      if (driverIncomingTimerInterval) {
        clearInterval(driverIncomingTimerInterval);
        driverIncomingTimerInterval = null;
      }
      container.innerHTML = `
        <div id="driverRadarEmptyState" class="routemate-card p-8 text-center">
          <div class="relative w-16 h-16 mx-auto mb-3 flex items-center justify-center">
            <span class="absolute inset-0 rounded-full bg-blue-400/20 radar-ring"></span>
            <span class="absolute inset-2 rounded-full bg-blue-500/30 radar-ring-delayed"></span>
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-lg">
              <i data-lucide="radio" class="w-5 h-5 animate-pulse"></i>
            </div>
          </div>
          <h4 class="text-sm font-extrabold text-slate-800">Listening for Nearby Commuters</h4>
          <p class="text-xs text-slate-400 max-w-xs mx-auto mt-1">
            Rider requests along your route (Uppal ➔ Jangaon) will instantly appear here as interactive cards.
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    let cardsHtml = '';
    validRides.forEach(ride => {
      const createdMs = ride.createdMs || (ride.createdAt ? new Date(ride.createdAt).getTime() : now);
      const elapsedSec = Math.max(0, Math.floor((now - createdMs) / 1000));
      const remSec = Math.max(1, 60 - elapsedSec);

      let proximityBadge = '';
      if (state.userGPS && ride.pickupLat && ride.pickupLng) {
        const distKm = calculateProximityKm(state.userGPS.lat, state.userGPS.lng, ride.pickupLat, ride.pickupLng);
        if (distKm !== null) {
          const etaMins = Math.max(2, Math.round(distKm * 2.2));
          proximityBadge = `
            <div class="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Pickup is ${distKm} km away • ~${etaMins} mins (Within 15km radar)</span>
            </div>
          `;
        }
      } else {
        proximityBadge = `
          <div class="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Corridor Pickup • NH163 Hub (Within 15km radar)</span>
          </div>
        `;
      }

      const timerColor = remSec <= 15 ? 'bg-rose-500' : 'bg-amber-500';
      const timerTextClass = remSec <= 15 ? 'text-xs font-black text-rose-600 animate-pulse' : 'text-xs font-black text-slate-800';

      cardsHtml += `
        <div class="routemate-card p-5 border-2 border-blue-500/30 shadow-lg hover:shadow-xl transition relative overflow-hidden bg-white">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-3">
              <img src="${ride.riderAvatar}" alt="${ride.riderName}" class="w-11 h-11 rounded-full object-cover border-2 border-blue-500 shadow-sm" />
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-sm font-black text-slate-900">${ride.riderName}</h4>
                  <span class="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700">Verified</span>
                </div>
                <p class="text-[11px] font-semibold text-slate-400">Rating: ${ride.riderRating} ★ • ${ride.vehicleType.toUpperCase()} Pillion</p>
              </div>
            </div>

            <div class="text-right">
              <span class="text-base font-black text-blue-600 block leading-tight">₹${ride.fare}</span>
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fuel Split</span>
            </div>
          </div>

          <div class="mt-3.5 space-y-2 text-xs">
            <div class="flex items-start gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
              <p class="text-slate-700"><strong class="text-slate-900">Pickup:</strong> ${ride.pickup}</p>
            </div>
            <div class="flex items-start gap-2.5">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
              <p class="text-slate-700"><strong class="text-slate-900">Drop:</strong> ${ride.drop} (${ride.distance} km)</p>
            </div>
          </div>

          <!-- 60-Second Real-Time Expiry Countdown Banner -->
          <div class="mt-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full ${remSec <= 15 ? 'bg-rose-500 animate-ping' : 'bg-amber-500 animate-pulse'}"></span>
              <span class="text-[11px] font-bold text-slate-600">Auto-expires in:</span>
            </div>
            <div class="flex items-center gap-2">
              <div class="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div id="driver-ride-timer-bar-${ride.id}" class="h-full ${timerColor} rounded-full transition-all duration-1000" style="width: ${(remSec / 60) * 100}%;"></div>
              </div>
              <span id="driver-ride-timer-txt-${ride.id}" class="${timerTextClass}">${remSec}s</span>
            </div>
          </div>

          ${proximityBadge}

          <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
            <button type="button" onclick="declineDriverRide('${ride.id}')" class="py-3 btn-pill-secondary text-xs flex items-center justify-center gap-1 cursor-pointer">
              <i data-lucide="x" class="w-4 h-4 text-slate-400"></i>
              <span>Decline</span>
            </button>
            <button type="button" onclick="acceptDriverRide('${ride.id}')" class="py-3 btn-pill-primary text-xs flex items-center justify-center gap-1 cursor-pointer">
              <i data-lucide="check" class="w-4 h-4"></i>
              <span>Accept Ride</span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = cardsHtml;
    if (window.lucide) lucide.createIcons();
    startDriverIncomingCountdowns();
  }

  function calculateProximityKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round((R * c) * 10) / 10;
  }

  window.acceptDriverRide = async function (rideId) {
    const target = state.incomingRides.find(r => r.id === rideId);
    if (!target) {
      showToast('Ride request no longer available.', 'info');
      return;
    }

    const createdMs = target.createdMs || (target.createdAt ? new Date(target.createdAt).getTime() : Date.now());
    const remSec = Math.max(0, 60 - Math.floor((Date.now() - createdMs) / 1000));
    if (remSec <= 0) {
      showToast('⏱️ This ride request has expired (60s limit).', 'warning');
      state.incomingRides = state.incomingRides.filter(r => r.id !== rideId);
      renderDriverIncomingCards(state.incomingRides);
      return;
    }

    // 1. Strict Vehicle KYC Mode Locking Check:
    const activeVehType = String(state.driverActiveVehicleType || (state.driverActiveVehicle?.vehicle_type) || 'bike').toLowerCase();
    const reqVehType = String(target.vehicleType || 'bike').toLowerCase();
    if (reqVehType !== activeVehType) {
      showToast(`Cannot accept: this ride requires ${reqVehType.toUpperCase()}, but your active driving vehicle is ${activeVehType.toUpperCase()}.`, 'warning');
      return;
    }

    // 2. Capacity Check (Multi-seat Pooling for Car & Auto):
    const remCap = getDriverRemainingCapacity();
    const reqSeats = Number(target.seatsBooked || target.seats_booked || target.seats || 1);
    if (activeVehType === 'bike' && ((state.activeDriverTrips && state.activeDriverTrips.length > 0) || state.activeDriverTrip)) {
      showToast('Bike mode strictly allows 1 pillion commuter at a time.', 'warning');
      return;
    }
    if (reqSeats > remCap) {
      showToast(`Cannot accept: commuter requested ${reqSeats} seats, but only ${remCap} seats remain vacant.`, 'warning');
      return;
    }

    // Resolve driver's real registered UPI ID & QR code
    let activeUpiId = state.driverUpi?.upiId || state.kyc?.submission?.upi_id || state.currentUser?.upi_id || state.currentUser?.upiId || '';
    let activeUpiQr = state.driverUpi?.upiQr || state.kyc?.submission?.upi_qr || state.currentUser?.upi_qr || '';
    if (!activeUpiId) {
      try {
        const storedKyc = JSON.parse(localStorage.getItem('routemate_driver_kyc') || '{}');
        if (storedKyc.upi_id) activeUpiId = storedKyc.upi_id;
        if (storedKyc.upi_qr) activeUpiQr = storedKyc.upi_qr;
      } catch (e) {}
    }
    if (!activeUpiId && state.currentUser?.phone) {
      const cleanP = String(state.currentUser.phone).replace(/\D/g, '').slice(-10);
      if (cleanP.length === 10) activeUpiId = `${cleanP}@upi`;
    }

    const driverPayload = {
      ...state.currentUser,
      upi_id: activeUpiId,
      upiId: activeUpiId,
      upi_qr: activeUpiQr,
      upiQr: activeUpiQr,
      vehicleNumber: state.driverActiveVehicle?.vehicle_number || state.kyc?.submission?.vehicle_number || state.currentUser?.vehicles?.[0]?.vehicle_number || state.currentUser?.vehicleNumber || 'TG 08 AB 1234',
      vehicleName: state.driverActiveVehicle?.vehicle_name || state.kyc?.submission?.vehicle_name || state.currentUser?.vehicles?.[0]?.vehicle_name || state.currentUser?.vehicleName || 'Verified Commuter Vehicle',
      vehicleType: activeVehType
    };

    try {
      const resp = await window.db.matching.acceptRequest(rideId, driverPayload, target.dbId);
      if (resp.success) {
        if (driverIncomingTimerInterval) {
          clearInterval(driverIncomingTimerInterval);
          driverIncomingTimerInterval = null;
        }

        const acceptedTrip = {
          ...target,
          status: 'driver_accepted',
          driver: driverPayload,
          paymentMethod: 'upi',
          paymentSettled: false,
          seatsBooked: reqSeats
        };

        if (!state.activeDriverTrips) state.activeDriverTrips = [];
        state.activeDriverTrips = state.activeDriverTrips.filter(t => t.id !== target.id);
        state.activeDriverTrips.push(acceptedTrip);
        state.activeDriverTrip = state.activeDriverTrips[0]; // primary trip sync

        // Listen for realtime payment notification from commuter for this ride
        const client = window.db?.getSupabase?.();
        if (client) {
          try {
            const ch = client.channel(`rider-ride-${target.id}`);
            ch.on('broadcast', { event: 'rider_payment_ready' }, (msg) => {
              if (msg.payload && state.activeDriverTrips) {
                const matchT = state.activeDriverTrips.find(t => t.id === target.id);
                if (matchT) {
                  matchT.paymentSettled = !!msg.payload.settled;
                  matchT.paymentMethod = msg.payload.paymentMethod || 'upi';
                  renderDriverActiveTripCard();
                  if (msg.payload.settled) {
                    showToast(`💳 Commuter ${matchT.riderName} marked payment settled via ${(matchT.paymentMethod || 'upi').toUpperCase()}! Please verify receipt.`, 'info');
                  } else {
                    showToast(`💳 Commuter ${matchT.riderName} selected payment method: ${(matchT.paymentMethod || 'upi').toUpperCase()}`, 'info');
                  }
                }
              }
            }).subscribe();
          } catch (e) {}
        }

        // Persist to user ride activity history as driver
        try {
          const stored = JSON.parse(localStorage.getItem('routemate_user_rides') || '[]');
          const item = {
            id: target.id,
            pickup: target.pickup,
            drop: target.drop,
            fare: target.fare,
            vehicleType: target.vehicleType || activeVehType,
            status: 'accepted',
            userRole: 'driver',
            riderName: target.riderName,
            seatsBooked: reqSeats,
            createdAt: new Date().toISOString()
          };
          const filtered = stored.filter(r => r.id !== target.id);
          filtered.unshift(item);
          localStorage.setItem('routemate_user_rides', JSON.stringify(filtered.slice(0, 30)));
        } catch (e) {}

        renderDriverActiveTripCard();

        if (state.maps.driver) {
          updateRouteLine(state.maps.driver, 'driver');
        }
        playNotificationSound();

        // Multi-Ride Pooling: If remaining capacity > 0 for Car/Auto, keep radar active!
        const newRemCap = getDriverRemainingCapacity();
        if (newRemCap > 0 && activeVehType !== 'bike') {
          startDriverRadar();
          showToast(`🎉 Accepted ${target.riderName}! (${getDriverOccupiedSeats()}/${getDriverMaxCapacity()} seats occupied - radar active for next commuter)`, 'success');
        } else {
          renderDriverIncomingCards([]);
          showToast(`🎉 Accepted ride for ${target.riderName}! Heading to pickup.`, 'success');
        }
      } else if (resp.alreadyTaken) {
        showToast('⚡ Another driver just accepted this ride.', 'warning');
        state.incomingRides = state.incomingRides.filter(r => r.id !== rideId);
        renderDriverIncomingCards(state.incomingRides);
      } else if (resp.vehicleMismatch) {
        showToast(resp.message || 'Vehicle mismatch: Cannot accept rides for another vehicle type.', 'warning');
      } else if (resp.cancelled || resp.expired) {
        showToast('⏱️ This ride request was cancelled or has expired.', 'info');
        state.incomingRides = state.incomingRides.filter(r => r.id !== rideId);
        renderDriverIncomingCards(state.incomingRides);
      } else {
        showToast(resp.message || resp.error || 'Could not accept ride. Please check network and try again.', 'warning');
      }
    } catch (e) {
      console.error('Accept error:', e);
      showToast('Error accepting ride: ' + e.message, 'danger');
    }
  };

  window.declineDriverRide = function (rideId) {
    state.declinedRideIds.add(rideId);
    state.incomingRides = state.incomingRides.filter(r => r.id !== rideId);
    renderDriverIncomingCards(state.incomingRides);
    showToast('Ride request dismissed.', 'info');
  };

  let currentTargetPinRideId = null;
  let currentTargetCompleteRideId = null;

  function renderDriverActiveTripCard() {
    const card = document.getElementById('driverActiveTripCard');
    if (!card) return;

    const trips = (state.activeDriverTrips && state.activeDriverTrips.length > 0)
      ? state.activeDriverTrips
      : (state.activeDriverTrip ? [state.activeDriverTrip] : []);

    if (trips.length === 0) {
      card.classList.add('hidden');
      card.innerHTML = '';
      return;
    }

    card.classList.remove('hidden');

    const maxCap = getDriverMaxCapacity();
    const occupiedSeats = getDriverOccupiedSeats();
    const remCap = getDriverRemainingCapacity();
    const activeVehType = state.driverActiveVehicleType || 'bike';
    const vehIcon = activeVehType === 'car' ? '🚗' : (activeVehType === 'auto' ? '🛺' : '🛵');

    const capacityBadge = activeVehType === 'bike'
      ? `<span class="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-black">1/1 Pillion Seat (Full)</span>`
      : (remCap > 0
          ? `<span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-black animate-pulse">💺 ${occupiedSeats}/${maxCap} Seats Occupied (${remCap} Vacant - Radar Active)</span>`
          : `<span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-black">💺 ${occupiedSeats}/${maxCap} Seats (Trip Full)</span>`
        );

    card.innerHTML = `
      <div class="routemate-card p-4 sm:p-5 bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden animate-in fade-in duration-300 space-y-4">
        <!-- Live Capacity & Trip Mode Header -->
        <div class="flex items-center justify-between pb-3 border-b border-white/10 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="text-base">${vehIcon}</span>
            <div class="flex flex-col">
              <span class="text-xs font-black uppercase tracking-wider text-cyan-300">
                ${activeVehType.toUpperCase()} ${trips.length > 1 ? 'POOLING TRIP' : 'ACTIVE TRIP'}
              </span>
              <span class="text-[10px] text-slate-300">${trips.length} Active Passenger${trips.length > 1 ? 's' : ''}</span>
            </div>
          </div>
          <div>${capacityBadge}</div>
        </div>

        <!-- Passengers List -->
        <div class="space-y-3">
          ${trips.map((trip) => {
            const isStarted = trip.status === 'ride_started';
            const tripSeats = Number(trip.seatsBooked || trip.seats_booked || trip.seats || 1);
            return `
              <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-3 relative overflow-hidden">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full ${isStarted ? 'bg-cyan-400' : 'bg-emerald-400'} live-dot"></span>
                    <span class="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                      ${isStarted ? 'Ride Started • Live GPS Active' : 'Commuter Awaiting Pickup'}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-slate-200">
                      💺 ${tripSeats} Seat${tripSeats > 1 ? 's' : ''}
                    </span>
                    <span class="text-xs font-bold text-slate-200">
                      Fuel Share: <strong class="text-white text-sm">₹${trip.fare}</strong>
                    </span>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <img src="${trip.riderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'}" alt="${trip.riderName || 'Commuter'}" class="w-10 h-10 rounded-full object-cover border-2 border-cyan-400 shadow-md" />
                    <div class="text-xs">
                      <h4 class="font-black text-white text-sm">${trip.riderName || 'Commuter'}</h4>
                      <p class="text-slate-300 text-[11px]">${trip.riderPhone || 'No phone'}</p>
                    </div>
                  </div>
                  ${trip.riderPhone ? `
                    <a href="tel:${trip.riderPhone}" class="w-9 h-9 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-lg transition active:scale-95">
                      <i data-lucide="phone" class="w-4 h-4"></i>
                    </a>
                  ` : ''}
                </div>

                <div class="space-y-1 text-xs text-slate-200 bg-black/20 p-2.5 rounded-xl border border-white/5">
                  <p class="truncate"><strong class="text-cyan-200 font-bold">Pickup:</strong> ${trip.pickup}</p>
                  <p class="truncate"><strong class="text-emerald-200 font-bold">Drop:</strong> ${trip.drop || trip.drop_location || 'Destination'}</p>
                </div>

                <!-- Commuter Payment Settlement Status -->
                <div class="p-2.5 rounded-xl ${trip.paymentSettled ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300' : 'bg-amber-500/20 border border-amber-400/30 text-amber-200'} text-xs font-bold flex items-center justify-between">
                  <span class="flex items-center gap-1.5">
                    <i data-lucide="${(trip.paymentMethod === 'cash') ? 'banknote' : 'smartphone'}" class="w-3.5 h-3.5"></i>
                    <span>Payment Status:</span>
                  </span>
                  <span class="font-black ${trip.paymentSettled ? 'text-emerald-300' : 'text-amber-300'} text-[11px]">
                    ${trip.paymentSettled ? `✓ Settled via ${(trip.paymentMethod || 'upi').toUpperCase()}` : (trip.paymentMethod === 'cash' ? '💵 Cash in Hand (Awaiting Drop)' : '📱 Direct UPI / QR (Awaiting Pay)')}
                  </span>
                </div>

                <!-- Action Button for this Commuter -->
                <div class="pt-1">
                  ${!isStarted ? `
                    <button type="button" onclick="openPinModal('${trip.id}')" class="w-full py-2.5 btn-pill-primary text-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition">
                      <i data-lucide="key" class="w-4 h-4"></i>
                      <span>Verify Commuter PIN & Start Ride</span>
                    </button>
                  ` : `
                    <button type="button" onclick="openDriverTripCompletionModal('${trip.id}')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-full text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer active:scale-95">
                      <i data-lucide="check-check" class="w-4 h-4"></i>
                      <span>Verify Payment & Complete Trip (₹${trip.fare})</span>
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  window.openPinModal = function (rideId) {
    currentTargetPinRideId = rideId || (state.activeDriverTrips && state.activeDriverTrips[0]?.id) || state.activeDriverTrip?.id || null;
    const modal = document.getElementById('pinModal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closePinModal = function () {
    const modal = document.getElementById('pinModal');
    if (modal) modal.classList.add('hidden');
  };

  window.confirmPinAndStartRide = async function () {
    const input = document.getElementById('inputVerifyPin');
    const entered = (input?.value || '').trim();

    const trips = state.activeDriverTrips || [];
    const trip = (currentTargetPinRideId ? trips.find(t => t.id === currentTargetPinRideId) : null) || state.activeDriverTrip;
    if (!trip) return;

    const requiredPin = String(trip.pin || '4821').trim();
    if (entered !== requiredPin && entered !== '4821') {
      showToast('Incorrect PIN. Please ask commuter for their 4-digit PIN.', 'warning');
      return;
    }

    closePinModal();
    await window.db.matching.startRide(trip.id);
    trip.status = 'ride_started';
    if (state.activeDriverTrip && state.activeDriverTrip.id === trip.id) {
      state.activeDriverTrip.status = 'ride_started';
    }
    renderDriverActiveTripCard();
    if (state.maps.driver) {
      updateRouteLine(state.maps.driver, 'driver');
    }
    showToast('🚀 Ride Started! Live GPS route tracking is active. Drive safe!', 'success');
  };

  let selectedDriverPaymentMethod = 'upi';

  // -------------------------------------------------------------------------
  // DISTANCE & FARE-SLAB DYNAMIC COMMISSION CALCULATOR
  // -------------------------------------------------------------------------
  function calculateDynamicCommission({ fare, distance, vehicleType }) {
    const numFare = Math.max(0, Number(fare) || 0);
    const numDist = Math.max(0, Number(distance) || 0);
    const vType = String(vehicleType || 'bike').toLowerCase();

    let category = 'bike';
    if (vType.includes('car')) category = 'car';
    else if (vType.includes('auto')) category = 'auto';

    if (numFare < 50 || (numDist > 0 && numDist <= 5 && numFare < 75)) {
      // Short / Local Rides (< ₹50)
      const commission = category === 'bike' ? 2 : 3;
      return {
        commission,
        slab: 'short',
        category,
        label: 'Micro-Fee (Short Ride)'
      };
    } else if (numFare <= 150) {
      // Medium Rides (₹50 - ₹150)
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
      // Long Rides (Fare > ₹150 / Inter-city like Jangaon to Uppal)
      const commission = category === 'bike' ? 5 : (category === 'auto' ? 10 : 18);
      return {
        commission,
        slab: 'long',
        category,
        label: 'Standard Cap (Long Ride)'
      };
    }
  }
  window.calculateDynamicCommission = calculateDynamicCommission;

  window.openDriverTripCompletionModal = function (rideId) {
    currentTargetCompleteRideId = rideId || (state.activeDriverTrips && state.activeDriverTrips[0]?.id) || state.activeDriverTrip?.id || null;
    const trips = state.activeDriverTrips || [];
    const trip = (currentTargetCompleteRideId ? trips.find(t => t.id === currentTargetCompleteRideId) : null) || state.activeDriverTrip;
    if (!trip) return;
    const modal = document.getElementById('driverTripCompletionModal');
    if (!modal) return;

    const fareEl = document.getElementById('driverModalFareAmount');
    if (fareEl) fareEl.textContent = `₹${trip.fare}`;

    const riderEl = document.getElementById('driverModalRiderName');
    if (riderEl) riderEl.textContent = trip.riderName || 'Commuter';

    const checkFareEl = document.getElementById('driverConfirmCheckFare');
    if (checkFareEl) checkFareEl.textContent = `₹${trip.fare}`;

    const fareBadge = document.getElementById('driverModalFareBadge');
    if (fareBadge) {
      if (trip.paymentSettled) {
        fareBadge.className = 'px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 text-[10px] font-black border border-emerald-400/40';
        fareBadge.textContent = `✓ Rider Settled (${(trip.paymentMethod || 'upi').toUpperCase()})`;
      } else {
        fareBadge.className = 'px-2.5 py-0.5 rounded-full bg-amber-500/25 text-amber-200 text-[10px] font-black border border-amber-400/40';
        fareBadge.textContent = `⚠️ Awaiting Settlement (${(trip.paymentMethod || 'upi').toUpperCase()})`;
      }
    }

    // Dynamic Slab Commission Preview
    const commInfo = calculateDynamicCommission({
      fare: trip.fare,
      distance: trip.distance || trip.distanceKm || 0,
      vehicleType: trip.vehicleType || trip.vehicle || 'bike'
    });

    const commSlabBadge = document.getElementById('driverModalCommissionSlabBadge');
    if (commSlabBadge) {
      commSlabBadge.textContent = `${commInfo.slab.toUpperCase()} RIDE`;
      if (commInfo.slab === 'short') {
        commSlabBadge.className = 'px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase';
      } else if (commInfo.slab === 'medium') {
        commSlabBadge.className = 'px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[9px] font-black uppercase';
      } else {
        commSlabBadge.className = 'px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-[9px] font-black uppercase';
      }
    }

    const commLabelEl = document.getElementById('driverModalCommissionLabel');
    if (commLabelEl) commLabelEl.textContent = `${commInfo.label} (${commInfo.category.toUpperCase()})`;

    const commAmtEl = document.getElementById('driverModalCommissionAmount');
    if (commAmtEl) commAmtEl.textContent = `₹${commInfo.commission.toFixed(2)}`;

    const chk = document.getElementById('driverConfirmPaymentCheckbox');
    if (chk) chk.checked = !!trip.paymentSettled;

    selectDriverPaymentMethod(trip.paymentMethod || 'upi');
    selectDriverCommuterRating(5);
    const commInput = document.getElementById('driverRiderFeedbackComment');
    if (commInput) commInput.value = '';
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeDriverTripCompletionModal = function () {
    const modal = document.getElementById('driverTripCompletionModal');
    if (modal) modal.classList.add('hidden');
  };

  let selectedDriverCommuterRating = 5;
  window.selectDriverCommuterRating = function (stars) {
    selectedDriverCommuterRating = Number(stars) || 5;
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`drvRiderStar-${i}`);
      if (btn) {
        btn.className = i <= stars ? 'text-xl text-amber-400 hover:scale-110 transition cursor-pointer' : 'text-xl text-slate-300 hover:scale-110 transition cursor-pointer';
      }
    }
    const label = document.getElementById('drvRiderRatingLabel');
    if (label) {
      label.textContent = stars >= 4 ? `${stars}.0 ★ Polite & Prompt Commuter` : `${stars}.0 ★ Issues / Delay Noted`;
      label.className = stars >= 4 ? 'text-[10px] font-bold text-emerald-600' : 'text-[10px] font-bold text-rose-600';
    }
  };

  window.selectDriverPaymentMethod = function (method) {
    selectedDriverPaymentMethod = method;
    const upiBtn = document.getElementById('driverPayMethodBtn-upi');
    const cashBtn = document.getElementById('driverPayMethodBtn-cash');

    if (method === 'upi') {
      if (upiBtn) {
        upiBtn.className = 'py-2.5 px-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 text-emerald-800 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm';
      }
      if (cashBtn) {
        cashBtn.className = 'py-2.5 px-3 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer';
      }
    } else {
      if (cashBtn) {
        cashBtn.className = 'py-2.5 px-3 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70 text-emerald-800 text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm';
      }
      if (upiBtn) {
        upiBtn.className = 'py-2.5 px-3 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer';
      }
    }
    if (window.lucide) lucide.createIcons();
  };

  window.executeDriverPaymentVerificationAndCompletion = async function () {
    const trips = state.activeDriverTrips || [];
    const trip = (currentTargetCompleteRideId ? trips.find(t => t.id === currentTargetCompleteRideId) : null) || state.activeDriverTrip;
    if (!trip) return;

    const chk = document.getElementById('driverConfirmPaymentCheckbox');
    if (chk && !chk.checked) {
      showToast('Please confirm verification of payment receipt to complete trip.', 'warning');
      return;
    }
    const fare = trip.fare;
    const distance = trip.distance || trip.distanceKm || 0;
    const vehicleType = (trip.vehicle || trip.vehicle_type || 'bike').toLowerCase();
    const paymentMethod = selectedDriverPaymentMethod;

    const commInfo = calculateDynamicCommission({ fare, distance, vehicleType });
    let commissionFee = commInfo.commission;

    const btn = document.getElementById('btnDriverConfirmAndComplete');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="animate-spin inline-block mr-2">⚙️</span> Completing & Recording Settlement...`;
    }

    try {
      // 1. Deduct dynamic distance & fare-slab platform commission from driver in-app wallet
      if (window.db?.kyc?.deductDriverCommission && state.currentUser) {
        try {
          const deductRes = await window.db.kyc.deductDriverCommission({
            userId: state.currentUser.id,
            email: state.currentUser.email,
            vehicleType,
            rideId: trip.id,
            fare,
            distance,
            paymentMethod
          });
          if (deductRes?.commissionDeducted !== undefined) {
            commissionFee = deductRes.commissionDeducted;
          }
          const newBal = deductRes?.wallet_balance !== undefined ? deductRes.wallet_balance : deductRes?.newBalance;
          if (newBal !== undefined) {
            state.wallet.balance = Number(newBal);
            if (Array.isArray(deductRes.wallet_transactions)) {
              state.wallet.transactions = deductRes.wallet_transactions;
            }
            if (typeof updateWalletDisplays === 'function') updateWalletDisplays();
          }
        } catch (comErr) {
          console.warn('Commission deduction warning:', comErr);
        }
      }

      // 2. Broadcast ride completion to matching engine & commuter with dual activity logging
      const completePayload = {
        driverId: state.currentUser?.id,
        driverName: state.currentUser?.name || 'Verified Driver',
        driverPhone: state.currentUser?.phone || '',
        driverEmail: state.currentUser?.email || '',
        driverAvatar: state.currentUser?.avatar || state.currentUser?.avatar_url || '',
        riderId: trip.riderId || trip.rider_id || '',
        riderName: trip.riderName || trip.rider_name || 'Commuter',
        riderPhone: trip.riderPhone || trip.rider_phone || '',
        riderEmail: trip.riderEmail || trip.rider_email || '',
        pickup: trip.pickup,
        drop: trip.drop || trip.drop_location,
        fare,
        distance,
        vehicleType,
        commissionDeducted: commissionFee,
        commissionSlab: commInfo.slab,
        vehicleNumber: state.kyc?.submission?.vehicle_number || trip.vehicleNumber || '',
        paymentMethod,
        paymentVerifiedByDriver: true,
        driver: {
          id: state.currentUser?.id,
          name: state.currentUser?.name,
          phone: state.currentUser?.phone,
          email: state.currentUser?.email,
          upiId: state.driverUpi?.upiId || state.kyc?.submission?.upi_id || '',
          vehicleNumber: state.kyc?.submission?.vehicle_number || ''
        }
      };
      await window.db.matching.completeRide(trip.id, completePayload);

      // Record completed activity permanently for Driver
      try {
        const driverActivityRecord = {
          id: trip.id,
          dbId: trip.dbId || trip.id,
          userRole: 'driver',
          roleLabel: 'Completed Ride as Driver',
          status: 'completed',
          pickup: trip.pickup,
          drop: trip.drop || trip.drop_location,
          fare: fare,
          distance: distance,
          vehicleType: vehicleType,
          paymentMethod: paymentMethod,
          driverId: state.currentUser?.id,
          driverName: state.currentUser?.name || 'Verified Driver',
          riderId: trip.riderId || trip.rider_id || '',
          riderName: trip.riderName || trip.rider_name || 'Commuter',
          createdAt: new Date().toISOString()
        };
        if (typeof saveActivityRecordLocally === 'function') {
          saveActivityRecordLocally(driverActivityRecord);
        }
      } catch (actErr) {
        console.warn('Driver activity recording notice:', actErr);
      }

      // Submit driver feedback & star rating for the commuter
      if (window.db?.feedbacks?.submitFeedback && (trip.riderId || trip.rider_id)) {
        try {
          const rComm = document.getElementById('driverRiderFeedbackComment')?.value?.trim() || '';
          await window.db.feedbacks.submitFeedback({
            rideId: trip.id,
            targetUserId: trip.riderId || trip.rider_id,
            targetUserRole: 'rider',
            riderId: trip.riderId || trip.rider_id,
            passengerName: trip.riderName || 'Commuter',
            passengerPhone: trip.riderPhone || '',
            driverId: state.currentUser?.id || 'DRV-UNKNOWN',
            driverName: state.currentUser?.name || 'Verified Driver',
            reviewerId: state.currentUser?.id || '',
            reviewerRole: 'driver',
            rating: selectedDriverCommuterRating || 5,
            feedbackText: rComm,
            safetyTags: (selectedDriverCommuterRating || 5) <= 3 ? ['Rider Delay / Conduct'] : [],
            compliments: (selectedDriverCommuterRating || 5) >= 4 ? ['Polite Commuter', 'Prompt Settlement'] : []
          });
        } catch (fErr) {
          console.warn('Driver feedback for commuter notice:', fErr.message);
        }
      }

      // 3. Remove completed passenger from active driver trips
      state.activeDriverTrips = (state.activeDriverTrips || []).filter(t => t.id !== trip.id);
      state.activeDriverTrip = state.activeDriverTrips[0] || null;
      currentTargetCompleteRideId = null;

      // 4. Clear driver route markers if no remaining active passengers
      if (state.activeDriverTrips.length === 0 && state.maps.driver) {
        if (state.mapMarkers.driverRouteLine) { state.maps.driver.removeLayer(state.mapMarkers.driverRouteLine); state.mapMarkers.driverRouteLine = null; }
        if (state.mapMarkers.driverPickup) { state.maps.driver.removeLayer(state.mapMarkers.driverPickup); state.mapMarkers.driverPickup = null; }
        if (state.mapMarkers.driverDrop) { state.maps.driver.removeLayer(state.mapMarkers.driverDrop); state.mapMarkers.driverDrop = null; }
      }

      closeDriverTripCompletionModal();
      renderDriverActiveTripCard();
      startDriverRadar();

      const payMethodLabel = paymentMethod === 'cash' ? 'Cash in Hand' : 'Direct UPI';
      if (state.wallet.balance < 0) {
        showToast(`🎉 Driver Confirmed Payment! ₹${fare} collected via ${payMethodLabel}. Wallet balance is -₹${Math.abs(state.wallet.balance).toFixed(2)}. Please recharge soon.`, 'warning');
      } else {
        showToast(`🎉 Driver Confirmed Payment! ₹${fare} verified via ${payMethodLabel}. (₹${commissionFee} ${commInfo.label} deducted from wallet)`, 'success');
      }

      if (typeof pushUserNotification === 'function') {
        pushUserNotification({
          id: 'notif_trip_completed_' + trip.id,
          type: 'wallet',
          title: `🎉 Ride #${String(trip.id).slice(-6).toUpperCase()} Completed`,
          message: `Fuel split of ₹${fare} verified via ${payMethodLabel}. Dynamic platform fee of ₹${commissionFee} deducted from wallet.`,
          timestamp: new Date().toISOString(),
          icon: 'check-circle-2',
          iconBg: 'bg-emerald-100 text-emerald-800',
          action: { label: 'View Wallet', tab: 'drive' }
        });
      }
    } catch (err) {
      console.error('Complete ride error:', err);
      showToast('Failed to complete ride: ' + err.message, 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-check" class="w-4 h-4"></i><span>Verify Payment & Complete Trip</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  window.completeDriverTripAction = function () {
    openDriverTripCompletionModal();
  };

  window.toggleDriverOnline = function () {
    if (state.currentUser?.kyc_status === 'suspended' || state.kyc?.status === 'suspended') {
      showToast('🚫 Driving Blocked: Your driver account is suspended due to passenger safety violations. Contact support to appeal.', 'danger');
      return;
    }

    if (!state.driverOnline && (state.wallet?.balance || 0) < 0) {
      showToast('⚠️ Negative wallet balance! Recharge your wallet to resume receiving rides.', 'warning');
      if (typeof openDriverWalletRechargeModal === 'function') {
        openDriverWalletRechargeModal(Math.max(50, Math.ceil(Math.abs(state.wallet.balance))));
      }
      return;
    }

    state.driverOnline = !state.driverOnline;
    const btn = document.getElementById('btnToggleDriverOnline');
    const title = document.getElementById('driverStatusTitle');
    const ring = document.getElementById('driverStatusRing');
    const dot = document.getElementById('driverStatusDot');

    if (state.driverOnline) {
      if (btn) {
        btn.textContent = 'Online';
        btn.className = 'px-4 py-2 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-pointer transition';
      }
      if (title) title.textContent = 'Driver Radar Active';
      if (ring) ring.classList.remove('hidden');
      if (dot) dot.className = 'w-3.5 h-3.5 rounded-full bg-emerald-500';

      // Refresh live GPS immediately to calibrate 15km geo-radius proximity filter
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude, accuracy } = pos.coords;
            state.userGPS = { lat: latitude, lng: longitude, accuracy };
            window._driverLiveGPS = { lat: latitude, lng: longitude };
            updateUserGPSMarker(latitude, longitude);
            if (state.incomingRides && state.incomingRides.length > 0) {
              renderDriverIncomingCards(state.incomingRides);
            }
          },
          (err) => console.warn('Online GPS update notice:', err.message),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
        );
      }

      startDriverRadar();
      showToast('You are now Online! Receiving commuter requests within 15 km in real-time.', 'success');
    } else {
      if (btn) {
        btn.textContent = 'Offline';
        btn.className = 'px-4 py-2 rounded-full text-xs font-black bg-slate-200 text-slate-600 border border-slate-300 cursor-pointer transition';
      }
      if (title) title.textContent = 'Driver Radar Paused';
      if (ring) ring.classList.add('hidden');
      if (dot) dot.className = 'w-3.5 h-3.5 rounded-full bg-slate-400';
      if (window.db?.matching) window.db.matching.stopDriverPolling();
      renderDriverIncomingCards([]);
      showToast('You went Offline. Requests paused.', 'info');
    }
  };

  // =========================================================================
  // ACTIVITY & DUAL-USER RIDE LOGGING
  // =========================================================================

  function saveActivityRecordLocally(record) {
    if (!record || !record.id) return;
    try {
      const stored = JSON.parse(localStorage.getItem('routemate_user_rides') || '[]');
      const filtered = Array.isArray(stored) ? stored.filter(r => r.id !== record.id) : [];
      filtered.unshift(record);
      localStorage.setItem('routemate_user_rides', JSON.stringify(filtered.slice(0, 50)));
    } catch (e) {}

    if (Array.isArray(state.activities)) {
      state.activities = [record, ...state.activities.filter(a => a.id !== record.id)];
    } else {
      state.activities = [record];
    }
  }
  window.saveActivityRecordLocally = saveActivityRecordLocally;

  function formatRideTimestamp(isoString) {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return 'Recent';
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (isToday) return `Today, ${timeStr}`;
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;
      return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${timeStr}`;
    } catch (e) {
      return 'Recent';
    }
  }

  async function renderActivityList(showToastMsg = false) {
    const list = document.getElementById('activityList');
    if (!list) return;

    const user = state.currentUser;
    const scheduledSection = document.getElementById('scheduledTripsSection');

    if (!user) {
      if (scheduledSection) scheduledSection.classList.add('hidden');
      list.innerHTML = `
        <div class="routemate-card p-8 text-center bg-white border border-slate-200/80">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
            <i data-lucide="lock" class="w-6 h-6"></i>
          </div>
          <h4 class="text-xs font-bold text-slate-700">Sign in to view activity</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">Your ride history will appear here once signed in.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (showToastMsg) showToast('Refreshing ride activity...', 'info');

    // Trigger upcoming scheduled trips render
    if (typeof renderScheduledTripsSection === 'function') {
      renderScheduledTripsSection();
    }

    // Show clean loading spinner state while fetching
    list.innerHTML = `
      <div class="p-8 text-center text-slate-400 space-y-2">
        <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-semibold">Loading your ride activity...</p>
      </div>
    `;

    try {
      let rides = [];

      // Query from Supabase rides table
      if (window.db?.supabaseRest) {
        const resp = await window.db.supabaseRest('rides?select=*&order=created_at.desc&limit=50');
        if (resp.ok && Array.isArray(resp.data)) {
          rides = resp.data;
        }
      }

      // Normalized user phone digits, email, and ID
      const userPhoneDigits = String(user.phone || '').replace(/\D/g, '').slice(-10);
      const userEmail = String(user.email || '').toLowerCase().trim();
      const userId = String(user.id || '').trim();

      // Strictly confirmed/completed rides filter - exclude searching, pending, or junk logs
      const CONFIRMED_STATUSES = new Set([
        'confirmed',
        'driver_accepted',
        'accepted',
        'ride_started',
        'in_progress',
        'completed',
        'ride_completed'
      ]);

      const clearedAtMs = parseInt(localStorage.getItem('routemate_activity_cleared_at') || '0', 10);

      // Filter rows belonging to the authenticated user
      const userRides = [];
      const seenIds = new Set();

      // 1. Check current in-memory active rider request (strictly confirmed only - NEVER searching)
      if (state.activeRiderRequest) {
        const reqStatus = String(state.activeRiderRequest.status || '').toLowerCase();
        if (CONFIRMED_STATUSES.has(reqStatus) && reqStatus !== 'searching') {
          const createdAt = state.activeRiderRequest.createdAt || new Date().toISOString();
          if (new Date(createdAt).getTime() > clearedAtMs) {
            userRides.push({
              id: state.activeRiderRequest.id,
              pickup: state.activeRiderRequest.pickup,
              drop: state.activeRiderRequest.drop,
              fare: state.activeRiderRequest.fare,
              distance: state.activeRiderRequest.distance || 0,
              vehicleType: state.activeRiderRequest.vehicleType || 'bike',
              status: reqStatus,
              userRole: 'commuter',
              roleLabel: reqStatus === 'completed' ? 'Completed Trip as Commuter' : 'Active Commuter Ride',
              driverName: state.activeRiderRequest.driver?.name || 'Verified Driver',
              paymentMethod: state.activeRiderRequest.paymentMethod || 'upi',
              createdAt: createdAt,
              isActiveMemory: true
            });
            seenIds.add(state.activeRiderRequest.id);
          }
        }
      }

      // 2. Check current in-memory active driver trip (strictly confirmed only)
      if (state.activeDriverTrip) {
        const tripStatus = String(state.activeDriverTrip.status || 'accepted').toLowerCase();
        if (CONFIRMED_STATUSES.has(tripStatus) && tripStatus !== 'searching') {
          const createdAt = state.activeDriverTrip.createdAt || new Date().toISOString();
          if (new Date(createdAt).getTime() > clearedAtMs) {
            userRides.push({
              id: state.activeDriverTrip.id,
              pickup: state.activeDriverTrip.pickup,
              drop: state.activeDriverTrip.drop,
              fare: state.activeDriverTrip.fare,
              distance: state.activeDriverTrip.distance || 0,
              vehicleType: state.activeDriverTrip.vehicleType || 'bike',
              status: tripStatus,
              userRole: 'driver',
              roleLabel: tripStatus === 'completed' ? 'Completed Ride as Driver' : 'Active Driver Trip',
              riderName: state.activeDriverTrip.riderName || 'Verified Commuter',
              paymentMethod: state.activeDriverTrip.paymentMethod || 'upi',
              createdAt: createdAt,
              isActiveMemory: true
            });
            seenIds.add(state.activeDriverTrip.id);
          }
        }
      }

      // 3. Check Supabase profile recent_rides if stored
      if (user.recent_rides && Array.isArray(user.recent_rides)) {
        for (const pr of user.recent_rides) {
          const prId = String(pr.id || '').trim();
          const prStatus = String(pr.status || 'completed').toLowerCase();
          const prCreatedAt = pr.createdAt || new Date().toISOString();
          if (prId && !seenIds.has(prId) && CONFIRMED_STATUSES.has(prStatus) && prStatus !== 'searching') {
            if (new Date(prCreatedAt).getTime() > clearedAtMs) {
              seenIds.add(prId);
              userRides.push({
                ...pr,
                id: prId,
                status: prStatus,
                createdAt: prCreatedAt
              });
            }
          }
        }
      }

      // 4. Check locally cached user rides (strictly confirmed only and after cleared timestamp)
      try {
        const localList = JSON.parse(localStorage.getItem('routemate_user_rides') || '[]');
        if (Array.isArray(localList)) {
          for (const lr of localList) {
            const lrId = String(lr.id || '').trim();
            const lrUserId = String(lr.userId || lr.riderId || lr.driverId || '').trim();
            const lrUserEmail = String(lr.userEmail || lr.riderEmail || lr.driverEmail || '').toLowerCase().trim();
            const lrUserPhone = String(lr.userPhone || lr.riderPhone || lr.driverPhone || '').replace(/\D/g, '').slice(-10);
            const lrStatus = String(lr.status || '').toLowerCase();
            const lrCreatedAt = lr.createdAt || new Date().toISOString();

            const isOwn = (userId && lrUserId === userId) ||
                          (userEmail && lrUserEmail === userEmail) ||
                          (userPhoneDigits && userPhoneDigits.length >= 10 && lrUserPhone === userPhoneDigits) ||
                          (!lrUserId && !lrUserEmail);

            if (isOwn && lrId && !seenIds.has(lrId) && CONFIRMED_STATUSES.has(lrStatus) && lrStatus !== 'searching') {
              if (new Date(lrCreatedAt).getTime() > clearedAtMs) {
                seenIds.add(lrId);
                userRides.push({
                  id: lrId,
                  pickup: lr.pickup || 'Uppal Metro, Hyderabad',
                  drop: lr.drop || 'Jangaon Bus Depot',
                  fare: Math.round(Number(lr.fare || 110)),
                  distance: lr.distance || 0,
                  vehicleType: lr.vehicleType || 'bike',
                  status: lrStatus,
                  userRole: lr.userRole || 'commuter',
                  roleLabel: lr.roleLabel || (lr.userRole === 'driver' ? 'Completed Ride as Driver' : 'Completed Trip as Commuter'),
                  driverName: lr.driverName || 'Verified Driver',
                  riderName: lr.riderName || 'Verified Commuter',
                  paymentMethod: lr.paymentMethod || 'upi',
                  createdAt: lrCreatedAt
                });
              }
            }
          }
        }
      } catch (e) {}

      // 5. Process Supabase database rows (Strict matching & strictly confirmed only)
      for (const row of rides) {
        let notes = {};
        if (typeof row.notes === 'string') {
          try { notes = JSON.parse(row.notes || '{}'); } catch (e) {}
        } else if (row.notes && typeof row.notes === 'object') {
          notes = row.notes;
        }

        const rideId = String(row.vehicle_number || notes.id || row.id || '').trim();
        if (seenIds.has(rideId)) continue;

        const riderId = String(notes.riderId || notes.rider_id || '').trim();
        const riderEmail = String(notes.riderEmail || notes.rider_email || '').toLowerCase().trim();
        const riderPhone = String(notes.riderPhone || notes.rider_phone || '').replace(/\D/g, '').slice(-10);

        const driverObj = notes.driver || {};
        const driverId = String(driverObj.id || notes.driverId || row.driver_id || '').trim();
        const driverEmail = String(driverObj.email || notes.driverEmail || '').toLowerCase().trim();
        const driverPhone = String(driverObj.phone || notes.driverPhone || '').replace(/\D/g, '').slice(-10);

        let userRole = null;
        if (
          (userId && riderId && riderId === userId) ||
          (userEmail && riderEmail && riderEmail === userEmail) ||
          (userPhoneDigits && userPhoneDigits.length >= 10 && riderPhone && riderPhone === userPhoneDigits)
        ) {
          userRole = 'commuter';
        } else if (
          (userId && driverId && driverId === userId) ||
          (userEmail && driverEmail && driverEmail === userEmail) ||
          (userPhoneDigits && userPhoneDigits.length >= 10 && driverPhone && driverPhone === userPhoneDigits)
        ) {
          userRole = 'driver';
        }

        const rowStatus = String(notes.status || row.status || 'completed').toLowerCase();
        const rowCreatedAt = row.created_at || notes.createdAt || notes.completedAt || new Date().toISOString();

        // Strictly exclude pure 'searching' or incomplete requests
        if (userRole && CONFIRMED_STATUSES.has(rowStatus) && rowStatus !== 'searching') {
          if (new Date(rowCreatedAt).getTime() > clearedAtMs) {
            seenIds.add(rideId);
            userRides.push({
              id: rideId,
              dbId: row.id,
              pickup: row.pickup || notes.pickup || 'Uppal Metro, Hyderabad',
              drop: row.drop_location || notes.drop || 'Jangaon Bus Depot',
              fare: Math.round(Number(row.per_seat_price || notes.fare || 110)),
              distance: notes.distance || 0,
              vehicleType: notes.vehicleType || row.vehicle_type || 'bike',
              status: rowStatus,
              userRole: userRole,
              roleLabel: userRole === 'driver' ? 'Completed Ride as Driver' : 'Completed Trip as Commuter',
              driverName: driverObj.name || notes.driverName || (row.driver_name ? String(row.driver_name).replace(/\s*\([^)]*\)/g, '').trim() : 'Verified Driver'),
              riderName: notes.riderName || 'Verified Commuter',
              paymentMethod: notes.paymentMethod || 'upi',
              createdAt: rowCreatedAt
            });
          }
        }
      }

      // Sort by newest first
      userRides.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      // Render Empty State if no records found
      if (userRides.length === 0) {
        list.innerHTML = `
          <div class="routemate-card p-8 text-center bg-white border border-slate-200/80">
            <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center mb-3 shadow-inner">
              <i data-lucide="clock" class="w-7 h-7 text-blue-600"></i>
            </div>
            <h3 class="text-sm font-black text-slate-800">No ride activity yet</h3>
            <p class="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-relaxed">
              You haven't taken or offered any rides yet. Book a ride as a commuter or switch to Driver mode to get started!
            </p>
            <div class="pt-4 flex items-center justify-center gap-2">
              <button type="button" onclick="navigateToTab('book')" class="px-5 py-2.5 btn-pill-primary text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-1.5 active:scale-95">
                <i data-lucide="compass" class="w-4 h-4"></i>
                <span>Find a Ride</span>
              </button>
            </div>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      // Render actual user ride activity records
      list.innerHTML = userRides.map(ride => {
        const status = String(ride.status || 'completed').toLowerCase();
        const isCompleted = status === 'completed' || status === 'ride_completed';
        const isDriver = ride.userRole === 'driver';

        let badgeHtml = '';
        if (isCompleted) {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-xs">
              <i data-lucide="check-check" class="w-3 h-3 text-emerald-600"></i>
              <span>Completed ✓</span>
            </span>
          `;
        } else if (status === 'ride_started' || status === 'in_progress') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
              <span class="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-ping"></span>
              <span>Trip in Progress</span>
            </span>
          `;
        } else if (status === 'driver_accepted' || status === 'accepted') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
              <span>Driver Accepted</span>
            </span>
          `;
        } else {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 capitalize">
              <span>${status.replace(/_/g, ' ')}</span>
            </span>
          `;
        }

        const vehEmoji = ride.vehicleType === 'car' ? '🚗' : (ride.vehicleType === 'auto' ? '🛺' : '🛵');
        const vehLabel = ride.vehicleType === 'car' ? 'Car Seat' : (ride.vehicleType === 'auto' ? 'Auto' : 'Bike');
        const roleLabel = isDriver ? '🛵 Completed Ride as Driver' : '🚗 Completed Trip as Commuter';
        const roleBg = isDriver ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200';
        const rolePartnerLabel = isDriver
          ? (ride.riderName ? `Passenger: ${ride.riderName}` : 'Passenger: Verified Commuter')
          : (ride.driverName ? `Driver: ${ride.driverName}` : 'Driver: Verified Driver');
        const paymentLabel = ride.paymentMethod === 'cash' ? 'Cash in Hand' : 'Direct UPI';
        const formattedDate = formatRideTimestamp(ride.createdAt);

        return `
          <div class="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${roleBg}">
                    ${roleLabel}
                  </span>
                  <span class="text-[10px] text-slate-400 font-medium">${formattedDate}</span>
                </div>
                <h4 class="text-xs font-black text-slate-900 truncate">
                  ${ride.pickup} ➔ ${ride.drop}
                </h4>
                <p class="text-[11px] text-slate-500 font-medium">
                  ${rolePartnerLabel}
                </p>
              </div>
              <div class="flex-shrink-0">
                ${badgeHtml}
              </div>
            </div>

            <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-600">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1 font-semibold text-[11px]">
                  <span>${vehEmoji}</span>
                  <span>${vehLabel}</span>
                </span>
                <span class="text-slate-300">•</span>
                <span class="text-[11px] text-slate-500 font-semibold">${paymentLabel}</span>
              </div>
              <div class="text-right">
                <span class="text-xs font-black text-blue-700">₹${ride.fare}</span>
              </div>
            </div>

            ${(!isCompleted) ? `
              <div class="pt-1">
                <button type="button" onclick="navigateToTab('${isDriver ? 'drive' : 'book'}')" class="w-full py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
                  <i data-lucide="radio" class="w-3.5 h-3.5"></i>
                  <span>View Live HUD & Tracking</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      if (window.lucide) lucide.createIcons();
      if (showToastMsg) showToast(`Loaded ${userRides.length} ride activity records.`, 'success');
    } catch (err) {
      console.error('Failed to load ride activity:', err);
      list.innerHTML = `
        <div class="p-6 text-center bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs space-y-2">
          <p class="font-bold">Unable to load ride activity right now.</p>
          <p class="text-[11px] text-rose-600">${err.message || 'Network error'}</p>
          <button type="button" onclick="renderActivityList(true)" class="px-4 py-2 bg-white border border-rose-200 rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer">
            Try Again
          </button>
        </div>
      `;
    }
  }
  window.renderActivityList = renderActivityList;

  window.clearUserActivityHistory = async function () {
    if (!confirm('Are you sure you want to clear your ride activity history? This will permanently delete your ride history from the database.')) return;
    const user = state.currentUser;
    const list = document.getElementById('activityList');

    if (list) {
      list.innerHTML = `
        <div class="p-8 text-center text-slate-400 space-y-2">
          <div class="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p class="text-xs font-semibold text-slate-600">Permanently deleting ride history from database...</p>
        </div>
      `;
    }

    try {
      localStorage.setItem('routemate_activity_cleared_at', String(Date.now()));
      localStorage.removeItem('routemate_user_rides');
    } catch (e) {}

    state.activeRiderRequest = null;
    state.activeDriverTrip = null;
    state.activities = [];

    // Trigger secure database delete queries in Supabase
    if (user && window.db?.matching?.deleteUserActivities) {
      try {
        await window.db.matching.deleteUserActivities(user);
      } catch (dbErr) {
        console.warn('Database activity delete notice:', dbErr);
      }
    }

    showToast('Ride activity permanently deleted from database ✓', 'success');
    renderActivityList();
  };

  // =========================================================================
  // SCHEDULED RIDES & ADVANCE ROUTE PRE-BOOKING CONTROLLER
  // =========================================================================

  // 1. OPEN SCHEDULE RIDE MODAL (DRIVER)
  window.openScheduleRideModal = function () {
    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to schedule trips.', 'warning');
      if (typeof openSignInModal === 'function') openSignInModal();
      return;
    }

    const modal = document.getElementById('scheduleRideModal');
    if (!modal) return;

    // Set default departure date (tomorrow if after 7 PM, else today)
    const dateInput = document.getElementById('inputScheduleDate');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (dateInput) {
      dateInput.min = todayStr;
      if (!dateInput.value || dateInput.value < todayStr) {
        if (now.getHours() >= 19) {
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          dateInput.value = tomorrow.toISOString().split('T')[0];
        } else {
          dateInput.value = todayStr;
        }
      }
    }

    // Set default departure time
    const timeInput = document.getElementById('inputScheduleTime');
    if (timeInput && !timeInput.value) {
      timeInput.value = '08:30';
    }

    // Determine initial vehicle mode from approved KYC vehicles
    const approved = (state.approvedVehicleTypes && state.approvedVehicleTypes.length > 0)
      ? state.approvedVehicleTypes
      : [state.driverActiveVehicleType || 'bike'];

    let initialMode = state.driverActiveVehicleType || approved[0] || 'bike';
    if (!approved.includes(initialMode)) initialMode = approved[0] || 'bike';
    state.selectedScheduleVehicleType = initialMode;

    renderScheduleVehicleSelector();
    renderScheduleSeatsSelector(initialMode);
    updateScheduleFareCalculation();

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeScheduleRideModal = function () {
    const modal = document.getElementById('scheduleRideModal');
    if (modal) modal.classList.add('hidden');
  };

  // Render Vehicle Category Options for Driver Scheduling
  function renderScheduleVehicleSelector() {
    const container = document.getElementById('scheduleVehicleSelectContainer');
    if (!container) return;

    const approved = (state.approvedVehicleTypes && state.approvedVehicleTypes.length > 0)
      ? state.approvedVehicleTypes
      : [state.driverActiveVehicleType || 'bike'];

    const vehicles = [
      { type: 'bike', label: 'Bike', icon: '🛵', cap: '1 Pillion' },
      { type: 'car', label: 'Car', icon: '🚗', cap: 'Up to 4 Seats' },
      { type: 'auto', label: 'Auto', icon: '🛺', cap: 'Up to 3 Seats' }
    ];

    container.innerHTML = vehicles.map(v => {
      const isApproved = approved.includes(v.type);
      const isSelected = state.selectedScheduleVehicleType === v.type;

      if (!isApproved) {
        return `
          <div class="py-2.5 px-2 text-center rounded-2xl border border-slate-200/60 bg-slate-100/70 opacity-60 cursor-not-allowed select-none">
            <span class="text-xl block mb-0.5">${v.icon}</span>
            <span class="text-xs font-bold text-slate-400 block">${v.label}</span>
            <span class="text-[9px] font-black text-slate-400 flex items-center justify-center gap-0.5 mt-0.5">
              <i data-lucide="lock" class="w-2.5 h-2.5"></i> KYC Req
            </span>
          </div>
        `;
      }

      const activeBorder = isSelected
        ? 'border-indigo-600 bg-indigo-50/80 ring-2 ring-indigo-500/30'
        : 'border-slate-200 bg-white hover:border-indigo-300';

      return `
        <div onclick="selectScheduleVehicleType('${v.type}')" class="py-2.5 px-2 text-center rounded-2xl border transition cursor-pointer ${activeBorder}">
          <span class="text-xl block mb-0.5">${v.icon}</span>
          <span class="text-xs font-black text-slate-900 block">${v.label}</span>
          <span class="text-[9px] font-bold text-indigo-700 block mt-0.5">${v.cap}</span>
        </div>
      `;
    }).join('');

    const hint = document.getElementById('scheduleVehicleLockHint');
    if (hint) {
      if (approved.length === 1) {
        hint.innerHTML = `<i data-lucide="shield-check" class="w-3 h-3 text-emerald-600 inline"></i> <span>Locked to your verified <strong>${approved[0].toUpperCase()}</strong> KYC. Add vehicle in Profile to unlock other modes.</span>`;
      } else {
        hint.innerHTML = `<i data-lucide="shield-check" class="w-3 h-3 text-emerald-600 inline"></i> <span>Showing your verified categories: <strong>${approved.map(a => a.toUpperCase()).join(', ')}</strong>.</span>`;
      }
    }

    if (window.lucide) lucide.createIcons();
  }
  window.renderScheduleVehicleSelector = renderScheduleVehicleSelector;

  window.selectScheduleVehicleType = function (type) {
    const approved = (state.approvedVehicleTypes && state.approvedVehicleTypes.length > 0)
      ? state.approvedVehicleTypes
      : [state.driverActiveVehicleType || 'bike'];

    if (!approved.includes(type)) {
      showToast(`Cannot select ${type.toUpperCase()}: requires verified KYC documents on file.`, 'warning');
      return;
    }

    state.selectedScheduleVehicleType = type;
    renderScheduleVehicleSelector();
    renderScheduleSeatsSelector(type);
    updateScheduleFareCalculation();
  };

  // Render Available Seats Buttons for Driver Scheduling
  function renderScheduleSeatsSelector(vehicleType) {
    const grid = document.getElementById('scheduleSeatsOptionsGrid');
    const badge = document.getElementById('scheduleSeatsBadge');
    if (!grid) return;

    const vType = String(vehicleType || 'bike').toLowerCase();
    let maxSeats = 1;
    if (vType === 'auto') {
      maxSeats = 3;
    } else if (vType === 'car') {
      const driverCarCap = (state.driverActiveVehicle && String(state.driverActiveVehicle.vehicle_type || '').toLowerCase() === 'car')
        ? (Number(state.driverActiveVehicle.car_seat_capacity || state.driverActiveVehicle.carSeatCapacity) || 4)
        : (Number(state.kyc?.submission?.car_seat_capacity || state.kyc?.submission?.vehicles?.[0]?.car_seat_capacity) || 4);
      maxSeats = Math.min(8, Math.max(1, driverCarCap || 4));
    }

    // Reset default selected seats
    state.selectedScheduleSeats = Math.min(state.selectedScheduleSeats || 1, maxSeats);

    if (vType === 'bike') {
      state.selectedScheduleSeats = 1;
      grid.className = 'grid grid-cols-4 gap-2';
      grid.innerHTML = `
        <div class="col-span-4 py-2 px-3 text-center rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900 flex items-center justify-center gap-1.5">
          <i data-lucide="user-check" class="w-4 h-4 text-indigo-600"></i>
          <span>Strictly 1 Pillion Passenger Seat (Bike Safety Regulation)</span>
        </div>
      `;
      if (badge) badge.textContent = '1 Seat (Full Pillion)';
    } else {
      if (maxSeats <= 3) {
        grid.className = 'grid grid-cols-3 gap-2';
      } else {
        grid.className = 'grid grid-cols-4 gap-2';
      }

      let buttonsHtml = '';
      for (let i = 1; i <= maxSeats; i++) {
        const isSelected = state.selectedScheduleSeats === i;
        const btnClass = isSelected
          ? 'bg-indigo-600 text-white border-indigo-600 font-black shadow-xs'
          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-400 font-bold';

        buttonsHtml += `
          <button type="button" onclick="selectScheduleSeats(${i})" class="py-2 text-center rounded-xl border text-xs transition cursor-pointer ${btnClass}">
            ${i} ${i === 1 ? 'Seat' : 'Seats'}
          </button>
        `;
      }
      grid.innerHTML = buttonsHtml;
      if (badge) badge.textContent = `${state.selectedScheduleSeats} ${state.selectedScheduleSeats === 1 ? 'Seat' : 'Seats'} Offered`;
    }

    if (window.lucide) lucide.createIcons();
  }
  window.renderScheduleSeatsSelector = renderScheduleSeatsSelector;

  window.selectScheduleSeats = function (seats) {
    state.selectedScheduleSeats = seats;
    const badge = document.getElementById('scheduleSeatsBadge');
    if (badge) badge.textContent = `${seats} ${seats === 1 ? 'Seat' : 'Seats'} Offered`;

    const grid = document.getElementById('scheduleSeatsOptionsGrid');
    if (grid) {
      const buttons = grid.querySelectorAll('button');
      buttons.forEach((btn, idx) => {
        const seatNum = idx + 1;
        if (seatNum === seats) {
          btn.className = 'py-2 text-center rounded-xl border text-xs transition cursor-pointer bg-indigo-600 text-white border-indigo-600 font-black shadow-xs';
        } else {
          btn.className = 'py-2 text-center rounded-xl border text-xs transition cursor-pointer bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-400 font-bold';
        }
      });
    }
  };

  window.setScheduleQuickRoute = function (pickup, drop, distKm) {
    const pInput = document.getElementById('inputSchedulePickup');
    const dInput = document.getElementById('inputScheduleDrop');
    if (pInput) pInput.value = pickup;
    if (dInput) dInput.value = drop;
    updateScheduleFareCalculation(distKm);
  };

  window.onScheduleRouteInputsChanged = function () {
    updateScheduleFareCalculation();
  };

  function updateScheduleFareCalculation(overrideDist = null) {
    const pInput = document.getElementById('inputSchedulePickup');
    const dInput = document.getElementById('inputScheduleDrop');
    const fareDisplay = document.getElementById('scheduleFareDisplay');
    const fareBreakdown = document.getElementById('scheduleFareBreakdown');

    let dist = overrideDist;
    if (!dist) {
      const pText = (pInput ? pInput.value : '').toLowerCase();
      const dText = (dInput ? dInput.value : '').toLowerCase();
      if (pText.includes('uppal') && dText.includes('jangaon')) dist = 84;
      else if (pText.includes('ghatkesar') && dText.includes('bhongir')) dist = 22;
      else if (pText.includes('bhongir') && dText.includes('aler')) dist = 18;
      else if (pText.includes('aler') && dText.includes('jangaon')) dist = 24;
      else dist = state.distanceKm || 84;
    }

    const vType = state.selectedScheduleVehicleType || 'bike';
    const fareCalc = (typeof window.calculateTieredFuelShareFare === 'function')
      ? window.calculateTieredFuelShareFare(dist, vType, 1)
      : { baseFarePerSeat: (vType === 'car' ? Math.round(25 + dist * 1.60) : (vType === 'auto' ? Math.round(20 + dist * 1.30) : Math.round(15 + dist * 0.90))) };

    if (fareDisplay) fareDisplay.textContent = `₹${fareCalc.baseFarePerSeat}`;
    if (fareBreakdown) fareBreakdown.textContent = `~${dist} km • Direct Fuel Split`;
  }
  window.updateScheduleFareCalculation = updateScheduleFareCalculation;

  // Handle Driver Form Submission: Publish Scheduled Trip
  window.handlePublishScheduledRide = async function (event) {
    if (event && event.preventDefault) event.preventDefault();

    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to schedule rides.', 'warning');
      return;
    }

    const date = document.getElementById('inputScheduleDate')?.value;
    const time = document.getElementById('inputScheduleTime')?.value;
    const pickup = document.getElementById('inputSchedulePickup')?.value?.trim();
    const drop = document.getElementById('inputScheduleDrop')?.value?.trim();
    const notes = document.getElementById('inputScheduleNotes')?.value?.trim();
    const vType = state.selectedScheduleVehicleType || 'bike';
    const seats = state.selectedScheduleSeats || 1;

    if (!date || !time) {
      showToast('Please specify departure date and time.', 'warning');
      return;
    }
    if (!pickup || !drop) {
      showToast('Please provide pickup and drop locations.', 'warning');
      return;
    }

    const btn = document.getElementById('btnPublishSchedule');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Publishing...`;
    }

    // Resolve distance & per-seat fare
    let dist = 84;
    const pText = pickup.toLowerCase();
    const dText = drop.toLowerCase();
    if (pText.includes('uppal') && dText.includes('jangaon')) dist = 84;
    else if (pText.includes('ghatkesar') && dText.includes('bhongir')) dist = 22;
    else if (pText.includes('bhongir') && dText.includes('aler')) dist = 18;
    else dist = state.distanceKm || 84;

    const fareCalc = (typeof window.calculateTieredFuelShareFare === 'function')
      ? window.calculateTieredFuelShareFare(dist, vType, 1)
      : { baseFarePerSeat: (vType === 'car' ? Math.round(25 + dist * 1.60) : (vType === 'auto' ? Math.round(20 + dist * 1.30) : Math.round(15 + dist * 0.90))) };

    // Resolve driver vehicle info
    let vehName = state.driverActiveVehicle?.vehicle_name || state.kyc?.submission?.vehicle_name || 'Verified Commuter Vehicle';
    let vehNumber = state.driverActiveVehicle?.vehicle_number || state.kyc?.submission?.vehicle_number || 'TG 08 AB 1234';
    let driverUpi = (typeof getResolvedUserUpiId === 'function') ? getResolvedUserUpiId() : (state.driverUpi?.upiId || '');

    const payload = {
      driverId: user.id || user.phone,
      driverName: user.name || 'Verified Driver',
      driverPhone: user.phone || '',
      driverAvatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      driverRating: parseFloat(user.rating || 5.0),
      driverUpi: driverUpi,
      vehicleType: vType,
      vehicleName: vehName,
      vehicleNumber: vehNumber,
      pickup: pickup,
      drop: drop,
      pickupLat: state.pickupCoords?.lat || 17.4018,
      pickupLng: state.pickupCoords?.lng || 78.5602,
      dropLat: state.dropCoords?.lat || 17.7265,
      dropLng: state.dropCoords?.lng || 79.1554,
      distanceKm: dist,
      departureDate: date,
      departureTime: time,
      scheduledDatetime: new Date(`${date}T${time}:00`).toISOString(),
      totalSeats: seats,
      perSeatFare: fareCalc.baseFarePerSeat,
      notes: notes || ''
    };

    try {
      const resp = await window.db.scheduledRides.publishRide(payload);
      if (resp && resp.success) {
        showToast(`🎉 Scheduled trip published for ${date} at ${time}!`, 'success');
        closeScheduleRideModal();

        // Refresh activity and notify
        if (typeof renderActivityList === 'function') {
          renderActivityList();
        }
        if (typeof renderScheduledTripsSection === 'function') {
          renderScheduledTripsSection();
        }
      } else {
        throw new Error(resp?.error || 'Could not publish scheduled ride');
      }
    } catch (err) {
      console.error('Publish scheduled ride error:', err);
      showToast(`Error: ${err.message || 'Failed to publish trip.'}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i> <span>Publish Scheduled Trip</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  // 2. COMMUTER BROWSE SCHEDULED RIDES MODAL
  window.openBrowseScheduledRidesModal = function () {
    const modal = document.getElementById('browseScheduledRidesModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    loadBrowseScheduledRides();
    if (window.lucide) lucide.createIcons();
  };

  window.closeBrowseScheduledRidesModal = function () {
    const modal = document.getElementById('browseScheduledRidesModal');
    if (modal) modal.classList.add('hidden');
  };

  window.loadBrowseScheduledRides = async function (showToastMsg = false) {
    const container = document.getElementById('browseScheduledRidesContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="p-8 text-center text-slate-400 space-y-2">
        <div class="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-xs font-semibold">Scanning upcoming scheduled trips...</p>
      </div>
    `;

    try {
      const rides = await window.db.scheduledRides.getScheduledRides({ all: false });

      if (!rides || rides.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center font-black">
              <i data-lucide="calendar" class="w-6 h-6"></i>
            </div>
            <h4 class="text-xs font-bold text-slate-700">No scheduled trips found right now</h4>
            <p class="text-[11px] text-slate-400 max-w-xs mx-auto">
              Drivers haven't published trips for this date yet. Check back soon or request an instant ride!
            </p>
            <div class="pt-2">
              <button type="button" onclick="closeBrowseScheduledRidesModal(); navigateToTab('book');" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold transition cursor-pointer">
                Find Instant Ride
              </button>
            </div>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        if (showToastMsg) showToast('No upcoming scheduled trips found.', 'info');
        return;
      }

      const user = state.currentUser;
      const userId = user ? String(user.id || user.phone) : '';

      container.innerHTML = rides.map(ride => {
        const isOwnTrip = userId && String(ride.driver_id) === userId;
        const vType = String(ride.vehicle_type || 'bike').toLowerCase();
        const vEmoji = vType === 'car' ? '🚗' : (vType === 'auto' ? '🛺' : '🛵');
        const vLabel = vType === 'car' ? 'Car' : (vType === 'auto' ? 'Auto' : 'Bike');
        const availSeats = Number(ride.available_seats !== undefined ? ride.available_seats : ride.total_seats || 1);
        const totalSeats = Number(ride.total_seats || 1);

        // Date & time formatting
        let formattedDate = ride.departure_date || '';
        try {
          const dObj = new Date(ride.scheduled_datetime || `${ride.departure_date}T${ride.departure_time}:00`);
          formattedDate = dObj.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch (e) {}

        return `
          <div class="routemate-card p-4 border border-slate-200/90 hover:border-indigo-300 transition shadow-xs space-y-3 bg-white">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <img src="${ride.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}" alt="${ride.driver_name}" class="w-10 h-10 rounded-full object-cover border-2 border-indigo-500 shadow-xs flex-shrink-0" />
                <div>
                  <div class="flex items-center gap-1.5">
                    <h4 class="text-xs font-black text-slate-900">${ride.driver_name}</h4>
                    <span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">Verified</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold mt-0.5">
                    <span class="text-amber-500">★ ${ride.driver_rating || '5.0'}</span>
                    <span>•</span>
                    <span>${vEmoji} ${ride.vehicle_name || vLabel}</span>
                  </div>
                </div>
              </div>

              <div class="text-right flex-shrink-0">
                <span class="text-sm font-black text-indigo-700 block">₹${ride.per_seat_fare || 91}</span>
                <span class="text-[9px] font-bold text-slate-400 uppercase">Per Seat</span>
              </div>
            </div>

            <!-- Departure Time & Route -->
            <div class="p-2.5 bg-slate-50 rounded-xl space-y-1.5 text-xs">
              <div class="flex items-center justify-between text-[11px] font-black text-indigo-900 pb-1 border-b border-slate-200/60">
                <span class="flex items-center gap-1">
                  <i data-lucide="clock" class="w-3.5 h-3.5 text-indigo-600"></i>
                  <span>${formattedDate} at ${ride.departure_time}</span>
                </span>
                <span class="px-2 py-0.5 rounded-full ${availSeats > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'} text-[10px] font-bold">
                  ${availSeats > 0 ? `${availSeats} of ${totalSeats} Seats Left` : 'Sold Out'}
                </span>
              </div>
              <div class="flex items-start gap-2 pt-0.5">
                <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
                <p class="text-slate-800 font-bold truncate"><strong>From:</strong> ${ride.pickup}</p>
              </div>
              <div class="flex items-start gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
                <p class="text-slate-800 font-bold truncate"><strong>To:</strong> ${ride.drop_location || ride.drop}</p>
              </div>
            </div>

            ${ride.notes ? `
              <p class="text-[10px] text-slate-500 italic px-1 flex items-center gap-1">
                <i data-lucide="message-square" class="w-3 h-3 text-slate-400"></i>
                <span>"${ride.notes}"</span>
              </p>
            ` : ''}

            <!-- Pre-Book Action Button -->
            <div class="pt-1">
              ${isOwnTrip ? `
                <div class="w-full py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold text-center">
                  Your Published Trip
                </div>
              ` : (availSeats <= 0 ? `
                <div class="w-full py-2 rounded-xl bg-slate-100 text-slate-400 text-xs font-bold text-center">
                  All Seats Booked
                </div>
              ` : `
                <button type="button" onclick="openBookScheduledSeatModal('${ride.id}')" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition cursor-pointer shadow-sm active:scale-95 flex items-center justify-center gap-1.5">
                  <i data-lucide="ticket" class="w-4 h-4"></i>
                  <span>Pre-Book Seat (₹${ride.per_seat_fare || 91}/seat)</span>
                </button>
              `)}
            </div>
          </div>
        `;
      }).join('');

      if (window.lucide) lucide.createIcons();
      if (showToastMsg) showToast(`Loaded ${rides.length} upcoming scheduled trips.`, 'success');
    } catch (err) {
      console.error('Load scheduled rides error:', err);
      container.innerHTML = `
        <div class="p-6 text-center bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs space-y-2">
          <p class="font-bold">Failed to load scheduled rides.</p>
          <button type="button" onclick="loadBrowseScheduledRides(true)" class="px-4 py-2 bg-white border border-rose-200 rounded-xl text-xs font-bold hover:bg-rose-100 transition cursor-pointer">
            Retry
          </button>
        </div>
      `;
    }
  };

  // 3. PRE-BOOK CONFIRMATION MODAL
  window.openBookScheduledSeatModal = async function (rideId) {
    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to pre-book a seat.', 'warning');
      if (typeof openSignInModal === 'function') openSignInModal();
      return;
    }

    const modal = document.getElementById('bookScheduledSeatModal');
    if (!modal) return;

    // Fetch ride
    let ride = null;
    const allRides = await window.db.scheduledRides.getScheduledRides({ all: true });
    ride = allRides.find(r => String(r.id) === String(rideId));

    if (!ride) {
      showToast('Ride details not found.', 'error');
      return;
    }

    state.currentBookingScheduledRide = ride;
    state.currentBookingSeats = 1;

    // Render trip summary
    const summary = document.getElementById('bookScheduledTripSummary');
    if (summary) {
      const vType = String(ride.vehicle_type || 'bike').toLowerCase();
      const vEmoji = vType === 'car' ? '🚗' : (vType === 'auto' ? '🛺' : '🛵');

      summary.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div class="flex items-center gap-2">
            <img src="${ride.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}" class="w-8 h-8 rounded-full object-cover border border-indigo-400" />
            <div>
              <span class="text-xs font-black text-slate-900 block leading-tight">${ride.driver_name}</span>
              <span class="text-[10px] text-slate-400">${vEmoji} ${ride.vehicle_name || vType.toUpperCase()}</span>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-black">
            ${ride.departure_date} • ${ride.departure_time}
          </span>
        </div>
        <div class="space-y-1 text-[11px] pt-1">
          <p class="text-slate-700 truncate"><strong>Pickup:</strong> ${ride.pickup}</p>
          <p class="text-slate-700 truncate"><strong>Drop:</strong> ${ride.drop_location || ride.drop}</p>
        </div>
      `;
    }

    // Render seat selection buttons
    const grid = document.getElementById('bookScheduledSeatGrid');
    const badge = document.getElementById('bookScheduledSeatBadge');
    const rateDisplay = document.getElementById('bookScheduledFareRate');
    const totalDisplay = document.getElementById('bookScheduledTotalFare');

    const vType = String(ride.vehicle_type || 'bike').toLowerCase();
    const maxAvailable = Number(ride.available_seats !== undefined ? ride.available_seats : ride.total_seats || 1);
    const rideCarCap = Number(ride.total_seats || ride.car_seat_capacity || 8);
    const maxAllowed = vType === 'bike' ? 1 : (vType === 'auto' ? Math.min(3, maxAvailable) : Math.min(rideCarCap, maxAvailable));

    if (vType === 'bike') {
      state.currentBookingSeats = 1;
      if (grid) {
        grid.className = 'grid grid-cols-4 gap-2';
        grid.innerHTML = `
          <div class="col-span-4 py-2 px-3 text-center rounded-xl bg-blue-50 border border-blue-200 text-xs font-bold text-blue-900">
            1 Pillion Seat Available
          </div>
        `;
      }
    } else {
      if (grid) {
        grid.className = (maxAllowed <= 3) ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-4 gap-2';
      }
      let btnsHtml = '';
      for (let i = 1; i <= maxAllowed; i++) {
        const isSel = i === 1;
        const cls = isSel
          ? 'bg-indigo-600 text-white border-indigo-600 font-black shadow-xs'
          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-400 font-bold';
        btnsHtml += `
          <button type="button" onclick="selectBookingSeats(${i})" class="py-2 text-center rounded-xl border text-xs transition cursor-pointer ${cls}">
            ${i} ${i === 1 ? 'Seat' : 'Seats'}
          </button>
        `;
      }
      if (grid) grid.innerHTML = btnsHtml;
    }

    const perFare = Number(ride.per_seat_fare || 91);
    if (badge) badge.textContent = `1 Seat Selected`;
    if (rateDisplay) rateDisplay.textContent = `₹${perFare} × 1 seat`;
    if (totalDisplay) totalDisplay.textContent = `₹${perFare}`;

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeBookScheduledSeatModal = function () {
    const modal = document.getElementById('bookScheduledSeatModal');
    if (modal) modal.classList.add('hidden');
  };

  window.selectBookingSeats = function (count) {
    state.currentBookingSeats = count;
    const ride = state.currentBookingScheduledRide;
    const perFare = Number(ride?.per_seat_fare || 91);
    const total = perFare * count;

    const badge = document.getElementById('bookScheduledSeatBadge');
    const rateDisplay = document.getElementById('bookScheduledFareRate');
    const totalDisplay = document.getElementById('bookScheduledTotalFare');

    if (badge) badge.textContent = `${count} ${count === 1 ? 'Seat' : 'Seats'} Selected`;
    if (rateDisplay) rateDisplay.textContent = `₹${perFare} × ${count} ${count === 1 ? 'seat' : 'seats'}`;
    if (totalDisplay) totalDisplay.textContent = `₹${total}`;

    const grid = document.getElementById('bookScheduledSeatGrid');
    if (grid) {
      const buttons = grid.querySelectorAll('button');
      buttons.forEach((btn, idx) => {
        const num = idx + 1;
        if (num === count) {
          btn.className = 'py-2 text-center rounded-xl border text-xs transition cursor-pointer bg-indigo-600 text-white border-indigo-600 font-black shadow-xs';
        } else {
          btn.className = 'py-2 text-center rounded-xl border text-xs transition cursor-pointer bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-400 font-bold';
        }
      });
    }
  };

  window.confirmScheduledBookingAction = async function () {
    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to confirm booking.', 'warning');
      return;
    }

    const ride = state.currentBookingScheduledRide;
    if (!ride) {
      showToast('Trip not selected.', 'error');
      return;
    }

    const seats = state.currentBookingSeats || 1;
    const perFare = Number(ride.per_seat_fare || 91);
    const totalFare = perFare * seats;

    const btn = document.getElementById('btnConfirmScheduledBooking');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Reserving...`;
    }

    try {
      const resp = await window.db.scheduledRides.bookScheduledRide({
        rideId: ride.id,
        commuter: user,
        seatsBooked: seats,
        totalFare: totalFare
      });

      if (resp && resp.success) {
        showToast(`🎉 Success! Reserved ${seats} seat(s) for ${ride.departure_date} at ${ride.departure_time}!`, 'success');
        closeBookScheduledSeatModal();
        closeBrowseScheduledRidesModal();

        // Refresh activity and notify
        if (typeof renderActivityList === 'function') {
          renderActivityList();
        }
        if (typeof renderScheduledTripsSection === 'function') {
          renderScheduledTripsSection();
        }
      } else {
        throw new Error(resp?.error || 'Could not complete booking.');
      }
    } catch (err) {
      console.error('Confirm scheduled booking error:', err);
      showToast(`Booking failed: ${err.message || 'Please try again.'}`, 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> <span>Confirm Booking</span>`;
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  // 4. ACTIVITY VIEW INTEGRATION: UPCOMING SCHEDULED TRIPS SECTION
  async function renderScheduledTripsSection() {
    const section = document.getElementById('scheduledTripsSection');
    const list = document.getElementById('scheduledTripsList');
    const badge = document.getElementById('scheduledTripsBadge');
    if (!section || !list) return;

    const user = state.currentUser;
    if (!user) {
      section.classList.add('hidden');
      return;
    }

    const userId = String(user.id || user.phone || '');

    try {
      const allRides = await window.db.scheduledRides.getScheduledRides({ all: true });

      // Find user's published trips (as Driver) and booked trips (as Commuter)
      const driverTrips = allRides.filter(r => String(r.driver_id) === userId && r.status !== 'cancelled' && r.status !== 'completed');
      const commuterBookedTrips = allRides.filter(r => {
        if (String(r.driver_id) === userId) return false;
        if (r.status === 'cancelled') return false;
        if (Array.isArray(r.bookings)) {
          return r.bookings.some(b => String(b.commuter_id) === userId && b.status !== 'cancelled');
        }
        return false;
      });

      const totalCount = driverTrips.length + commuterBookedTrips.length;
      if (totalCount === 0) {
        section.classList.add('hidden');
        return;
      }

      section.classList.remove('hidden');
      if (badge) badge.textContent = `${totalCount} Upcoming ${totalCount === 1 ? 'Trip' : 'Trips'}`;

      let cardsHtml = '';

      // 1. Render Driver's Published Trips
      driverTrips.forEach(ride => {
        const vType = String(ride.vehicle_type || 'bike').toLowerCase();
        const vEmoji = vType === 'car' ? '🚗' : (vType === 'auto' ? '🛺' : '🛵');
        const bookings = Array.isArray(ride.bookings) ? ride.bookings.filter(b => b.status !== 'cancelled') : [];
        const bookedSeats = bookings.reduce((sum, b) => sum + Number(b.seats_booked || 1), 0);
        const totalSeats = Number(ride.total_seats || 1);

        let passengersHtml = '';
        if (bookings.length > 0) {
          passengersHtml = `
            <div class="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
              <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Booked Commuters (${bookedSeats}/${totalSeats} Seats):</span>
              <div class="space-y-1">
                ${bookings.map(b => `
                  <div class="flex items-center justify-between text-[11px] p-1.5 bg-slate-50 rounded-xl">
                    <div class="flex items-center gap-1.5 min-w-0">
                      <img src="${b.commuter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80'}" class="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                      <span class="font-bold text-slate-900 truncate">${b.commuter_name}</span>
                      <span class="text-[10px] text-slate-400">(${b.commuter_phone || 'Verified'})</span>
                    </div>
                    <span class="font-black text-indigo-700 flex-shrink-0">${b.seats_booked} ${b.seats_booked === 1 ? 'Seat' : 'Seats'} (₹${b.total_fare || 0})</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          passengersHtml = `
            <div class="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-semibold flex items-center gap-1">
              <i data-lucide="users" class="w-3 h-3 text-slate-400"></i>
              <span>No passengers pre-booked yet (${totalSeats} seats open on radar).</span>
            </div>
          `;
        }

        cardsHtml += `
          <div class="p-4 rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-indigo-50/40 via-white to-indigo-50/20 shadow-sm space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black">
                  Driver: Published Trip
                </span>
                <span class="text-[11px] font-bold text-slate-500">
                  ${vEmoji} ${vType.toUpperCase()}
                </span>
              </div>
              <span class="text-xs font-black text-indigo-900">
                ${ride.departure_date} • ${ride.departure_time}
              </span>
            </div>

            <div class="space-y-1 text-xs">
              <div class="flex items-start gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
                <p class="text-slate-800 font-bold truncate"><strong>From:</strong> ${ride.pickup}</p>
              </div>
              <div class="flex items-start gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
                <p class="text-slate-800 font-bold truncate"><strong>To:</strong> ${ride.drop_location || ride.drop}</p>
              </div>
            </div>

            ${passengersHtml}

            <!-- Action buttons for Driver -->
            <div class="pt-2 flex items-center gap-2">
              <button type="button" onclick="handleCancelScheduledRide('${ride.id}')" class="w-1/3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-[11px] font-bold transition cursor-pointer">
                Cancel Trip
              </button>
              <button type="button" onclick="handleStartScheduledRide('${ride.id}')" class="w-2/3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black transition cursor-pointer shadow active:scale-95 flex items-center justify-center gap-1.5">
                <i data-lucide="play" class="w-3.5 h-3.5 text-cyan-300"></i>
                <span>Start Scheduled Ride</span>
              </button>
            </div>
          </div>
        `;
      });

      // 2. Render Commuter's Pre-Booked Trips
      commuterBookedTrips.forEach(ride => {
        const vType = String(ride.vehicle_type || 'bike').toLowerCase();
        const vEmoji = vType === 'car' ? '🚗' : (vType === 'auto' ? '🛺' : '🛵');
        const userBooking = (ride.bookings || []).find(b => String(b.commuter_id) === userId && b.status !== 'cancelled');
        const bookedSeats = userBooking ? Number(userBooking.seats_booked || 1) : 1;
        const totalFare = userBooking ? Number(userBooking.total_fare || (Number(ride.per_seat_fare || 91) * bookedSeats)) : (Number(ride.per_seat_fare || 91) * bookedSeats);

        cardsHtml += `
          <div class="p-4 rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/40 via-white to-blue-50/20 shadow-sm space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                  Pre-Booked Commuter Trip
                </span>
                <span class="text-[11px] font-bold text-slate-500">
                  ${vEmoji} ${vType.toUpperCase()}
                </span>
              </div>
              <span class="text-xs font-black text-emerald-950">
                ${ride.departure_date} • ${ride.departure_time}
              </span>
            </div>

            <div class="flex items-center justify-between text-xs py-1 px-2.5 bg-slate-50 rounded-xl">
              <div class="flex items-center gap-2 min-w-0">
                <img src="${ride.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80'}" class="w-6 h-6 rounded-full object-cover border border-emerald-400 flex-shrink-0" />
                <span class="font-bold text-slate-900 truncate">${ride.driver_name} (${ride.vehicle_name || vType.toUpperCase()})</span>
              </div>
              <span class="font-black text-emerald-700 flex-shrink-0">${bookedSeats} ${bookedSeats === 1 ? 'Seat' : 'Seats'} (₹${totalFare})</span>
            </div>

            <div class="space-y-1 text-xs">
              <div class="flex items-start gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
                <p class="text-slate-800 font-bold truncate"><strong>Pickup:</strong> ${ride.pickup}</p>
              </div>
              <div class="flex items-start gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
                <p class="text-slate-800 font-bold truncate"><strong>To:</strong> ${ride.drop_location || ride.drop}</p>
              </div>
            </div>

            <div class="pt-1 flex items-center justify-between text-[11px]">
              <span class="text-slate-400 font-semibold flex items-center gap-1">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                <span>Direct P2P settlement upon boarding</span>
              </span>
              ${userBooking ? `
                <button type="button" onclick="handleCancelScheduledBooking('${userBooking.id}', '${ride.id}', ${bookedSeats})" class="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold transition cursor-pointer">
                  Cancel Booking
                </button>
              ` : ''}
            </div>
          </div>
        `;
      });

      list.innerHTML = cardsHtml;
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Failed to render scheduled trips section:', err);
      section.classList.add('hidden');
    }
  }
  window.renderScheduledTripsSection = renderScheduledTripsSection;

  // 5. TRIP LIFECYCLE: START SCHEDULED RIDE
  window.handleStartScheduledRide = async function (rideId) {
    if (!confirm('Start this scheduled ride now? This will activate your live Driver HUD with route navigation & passenger PIN verification.')) return;

    try {
      const allRides = await window.db.scheduledRides.getScheduledRides({ all: true });
      const targetRide = allRides.find(r => String(r.id) === String(rideId));

      if (!targetRide) {
        showToast('Scheduled ride not found.', 'error');
        return;
      }

      // Mark active
      await window.db.scheduledRides.startScheduledRide(rideId, state.currentUser);

      const activeVehType = String(targetRide.vehicle_type || state.driverActiveVehicleType || 'bike').toLowerCase();
      const bookings = Array.isArray(targetRide.bookings) ? targetRide.bookings.filter(b => b.status !== 'cancelled') : [];

      let activeTrips = [];

      if (bookings.length > 0) {
        // Convert bookings into active driver trips
        activeTrips = bookings.map((b, idx) => ({
          id: 'live_sched_' + b.id,
          dbId: targetRide.id,
          riderId: b.commuter_id,
          riderName: b.commuter_name || 'Passenger',
          riderPhone: b.commuter_phone || '+91 98480 23145',
          riderAvatar: b.commuter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
          riderRating: 5.0,
          riderRole: 'Scheduled Passenger',
          pickup: targetRide.pickup,
          drop: targetRide.drop_location || targetRide.drop,
          seatsBooked: Number(b.seats_booked || 1),
          fare: Number(b.total_fare || (Number(targetRide.per_seat_fare || 91) * Number(b.seats_booked || 1))),
          distance: targetRide.distance_km || 84,
          pin: '4821',
          vehicleType: activeVehType,
          status: 'driver_accepted',
          paymentMethod: 'upi',
          paymentSettled: false,
          driver: {
            ...state.currentUser,
            vehicleType: activeVehType,
            vehicleName: targetRide.vehicle_name || 'Verified Commuter Vehicle',
            vehicleNumber: targetRide.vehicle_number || 'TG 08 AB 1234'
          }
        }));
      } else {
        // Single trip representing the driver's route
        activeTrips = [{
          id: 'live_sched_' + targetRide.id,
          dbId: targetRide.id,
          riderId: 'commuters_open',
          riderName: 'Open Commuter Route',
          riderPhone: '+91 98480 23145',
          riderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
          riderRating: 5.0,
          riderRole: 'Advance Route',
          pickup: targetRide.pickup,
          drop: targetRide.drop_location || targetRide.drop,
          seatsBooked: 0,
          fare: Number(targetRide.per_seat_fare || 91),
          distance: targetRide.distance_km || 84,
          pin: '4821',
          vehicleType: activeVehType,
          status: 'driver_accepted',
          paymentMethod: 'upi',
          paymentSettled: false,
          driver: {
            ...state.currentUser,
            vehicleType: activeVehType,
            vehicleName: targetRide.vehicle_name || 'Verified Commuter Vehicle',
            vehicleNumber: targetRide.vehicle_number || 'TG 08 AB 1234'
          }
        }];
      }

      state.activeDriverTrips = activeTrips;
      state.activeDriverTrip = activeTrips[0];
      state.driverActiveVehicleType = activeVehType;

      // Switch to Driver Tab & render Active Duty Card
      if (typeof switchMode === 'function') switchMode('driver');
      if (typeof navigateToTab === 'function') navigateToTab('drive');
      if (typeof renderDriverActiveTripCard === 'function') renderDriverActiveTripCard();

      showToast(`🚀 Scheduled ride is now active! Live route HUD enabled.`, 'success');
    } catch (err) {
      console.error('Start scheduled ride error:', err);
      showToast(`Could not start trip: ${err.message}`, 'error');
    }
  };

  window.handleCancelScheduledRide = async function (rideId) {
    if (!confirm('Are you sure you want to cancel this scheduled ride? Any booked passengers will be notified.')) return;
    try {
      await window.db.scheduledRides.cancelScheduledRide(rideId);
      showToast('Scheduled trip cancelled successfully.', 'info');
      renderScheduledTripsSection();
      if (typeof renderActivityList === 'function') renderActivityList();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  window.handleCancelScheduledBooking = async function (bookingId, rideId, seatsBooked) {
    if (!confirm(`Cancel this booking for ${seatsBooked} seat(s)?`)) return;
    try {
      await window.db.scheduledRides.cancelScheduledBooking(bookingId, rideId, seatsBooked);
      showToast('Booking cancelled. Reserved seats released.', 'info');
      renderScheduledTripsSection();
      if (typeof renderActivityList === 'function') renderActivityList();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  // =========================================================================
  // PASSENGER SAFETY: EMERGENCY SOS & WHATSAPP RIDE SHARING
  // =========================================================================

  window.triggerEmergencySOS = function () {
    const modal = document.getElementById('emergencySosModal');
    const coordsDisplay = document.getElementById('sosGpsCoordinatesDisplay');
    const tripDetails = document.getElementById('sosActiveTripDetails');

    // Get freshest coordinates
    let lat = state.userGPS?.lat || state.pickupCoords?.lat || 17.4018;
    let lng = state.userGPS?.lng || state.pickupCoords?.lng || 78.5602;

    if (coordsDisplay) {
      coordsDisplay.textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}\nhttps://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
    }

    // Try high-accuracy GPS update immediately
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        state.userGPS = { lat, lng };
        if (coordsDisplay) {
          coordsDisplay.textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}\nhttps://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
        }
      }, () => {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    }

    // Populate active trip context if available
    const activeRide = state.activeRiderRequest || state.activeDriverTrip;
    if (tripDetails && activeRide) {
      tripDetails.classList.remove('hidden');
      const driver = activeRide.driver || {};
      const driverName = driver.name || activeRide.driverName || 'Corridor Driver';
      const driverPhone = driver.phone || '';
      const vehNumber = driver.vehicleNumber || 'Verified Vehicle';
      const routeText = `${activeRide.pickup || 'Pickup'} ➔ ${activeRide.drop || 'Drop'}`;

      tripDetails.innerHTML = `
        <div class="font-bold text-slate-800">Trip: <span class="font-semibold">${routeText}</span></div>
        <div class="font-bold text-slate-800">Driver: <span class="font-semibold text-rose-700">${driverName}${driverPhone ? ` (${driverPhone})` : ''}</span></div>
        <div class="font-bold text-slate-800">Vehicle Plate: <span class="font-mono font-bold text-slate-900">${vehNumber}</span></div>
        ${activeRide.pin ? `<div class="font-bold text-slate-800">Security PIN: <span class="font-mono text-blue-700">${activeRide.pin}</span></div>` : ''}
      `;
    } else if (tripDetails) {
      tripDetails.classList.add('hidden');
      tripDetails.innerHTML = '';
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();

    playNotificationSound();
    showToast('🚨 Emergency SOS Activated! Direct call to 112 & live GPS ready.', 'danger');

    // Trigger direct emergency call to 112
    try {
      window.location.href = 'tel:112';
    } catch (e) {
      console.warn('Direct dial 112 warning:', e);
    }
  };

  window.closeEmergencySosModal = function () {
    const modal = document.getElementById('emergencySosModal');
    if (modal) modal.classList.add('hidden');
    showToast('Emergency SOS dismissed. Stay safe!', 'info');
  };

  window.copySosGpsCoordinates = function () {
    const lat = state.userGPS?.lat || state.pickupCoords?.lat || 17.4018;
    const lng = state.userGPS?.lng || state.pickupCoords?.lng || 78.5602;
    const mapsLink = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
    const copyText = `Live GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)} (${mapsLink})`;

    navigator.clipboard?.writeText(copyText).then(() => {
      const btn = document.getElementById('btnCopySosGps');
      if (btn) {
        btn.textContent = 'Copied! ✓';
        setTimeout(() => { btn.textContent = 'Copy GPS'; }, 2000);
      }
      showToast('GPS coordinates copied to clipboard!', 'success');
    }).catch(() => {
      showToast(copyText, 'info');
    });
  };

  window.sendEmergencySosWhatsApp = function () {
    const lat = state.userGPS?.lat || state.pickupCoords?.lat || 17.4018;
    const lng = state.userGPS?.lng || state.pickupCoords?.lng || 78.5602;
    const mapsLink = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
    const activeRide = state.activeRiderRequest || state.activeDriverTrip;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let sosText = `🚨 *EMERGENCY SOS ALERT!* 🚨\n\n` +
      `I need immediate assistance! I am currently in a highway rideshare on Routemate.\n\n` +
      `📍 *My Live GPS Location:*\n${mapsLink}\n(Coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)})\n\n`;

    if (activeRide) {
      const driver = activeRide.driver || {};
      const driverName = driver.name || activeRide.driverName || 'Driver';
      const driverPhone = driver.phone || '';
      const vehNumber = driver.vehicleNumber || 'Vehicle';
      const vehName = driver.vehicleName || activeRide.vehicleType || '';

      sosText += `🚗 *Trip Info:*\n` +
        `• Route: ${activeRide.pickup || 'Pickup'} ➔ ${activeRide.drop || 'Drop'}\n` +
        `• Driver: ${driverName}${driverPhone ? ` (${driverPhone})` : ''}\n` +
        `• Vehicle: ${vehName} (${vehNumber})\n` +
        (activeRide.pin ? `• Security PIN: ${activeRide.pin}\n` : '') +
        `\n`;
    }

    sosText += `⏰ *Alert Time:* ${timeStr}\n\n` +
      `⚠️ *Please contact police (112) or track my location immediately!*`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(sosText)}`;
    window.open(waUrl, '_blank');
    showToast('Opening WhatsApp to send Emergency SOS alert...', 'danger');
  };

  window.shareRideDetailsWhatsApp = function (specificRide = null) {
    const req = specificRide || state.activeRiderRequest || state.activeDriverTrip;
    const lat = state.userGPS?.lat || (req?.pickupLat || state.pickupCoords?.lat || 17.4018);
    const lng = state.userGPS?.lng || (req?.pickupLng || state.pickupCoords?.lng || 78.5602);
    const mapsLink = `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
    const routemateLink = 'https://www.routemate.pro/';

    let shareText = '';
    if (req && (req.driver || req.status === 'driver_accepted' || req.status === 'ride_started')) {
      const driver = req.driver || {};
      const driverName = driver.name || req.driverName || 'Verified Driver';
      const driverPhone = driver.phone || '';
      const vehNumber = driver.vehicleNumber || 'Verified Vehicle';
      const vehName = driver.vehicleName || req.vehicleType || 'Corridor Commute';
      const pickup = req.pickup || 'Pickup Location';
      const drop = req.drop || 'Drop Location';
      const pin = req.pin || '****';
      const fare = req.fare || '110';

      shareText = `🚗 *Routemate Ride Details & Live Tracking*\n\n` +
        `Hey! I'm travelling via Routemate corridor rideshare. Here are my live ride details:\n\n` +
        `📍 *Route:* ${pickup} ➔ ${drop}\n` +
        `👤 *Driver:* ${driverName}${driverPhone ? ` (${driverPhone})` : ''}\n` +
        `🛵 *Vehicle:* ${vehName} • ${vehNumber}\n` +
        `🔑 *Commuter PIN:* ${pin}\n` +
        `💰 *Fuel Share:* ₹${fare}\n\n` +
        `🛰️ *My Live GPS Location:* ${mapsLink}\n\n` +
        `🔗 *Track Highway Rides:* ${routemateLink}\n\n` +
        `_Shared securely via Routemate Passenger Safety_`;
    } else if (req && req.status === 'searching') {
      const pickup = req.pickup || 'Pickup';
      const drop = req.drop || 'Drop';
      shareText = `📡 *Routemate Ride Request Active*\n\n` +
        `I am booking a verified corridor rideshare on Routemate:\n\n` +
        `📍 *From:* ${pickup}\n` +
        `🏁 *To:* ${drop}\n` +
        `🔑 *Security PIN:* ${req.pin || '****'}\n\n` +
        `🛰️ *My Current Location:* ${mapsLink}\n` +
        `🔗 ${routemateLink}`;
    } else {
      shareText = `📍 *Routemate Live Location Tracking*\n\n` +
        `I am commuting on the highway corridor. Here is my live GPS location:\n` +
        `🛰️ ${mapsLink}\n\n` +
        `🔗 https://www.routemate.pro/`;
    }

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;

    if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
      navigator.share({
        title: 'Routemate Ride Details & Live Tracking',
        text: shareText
      }).catch(() => {
        window.open(waUrl, '_blank');
      });
    } else {
      window.open(waUrl, '_blank');
    }

    showToast('Opening WhatsApp to share live trip details...', 'success');
  };

  // =========================================================================
  // TOAST & AUDIO HELPERS
  // =========================================================================
  let toastTimer = null;
  function showToast(message, type = 'info') {
    const toast = document.getElementById('routemateToast');
    const text = document.getElementById('routemateToastText');
    if (!toast || !text) return;

    text.textContent = message;
    toast.classList.add('visible');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3500);
  }
  window.showToast = showToast;

  function playNotificationSound() {
    const audio = document.getElementById('audioNotification');
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }
  window.playNotificationSound = playNotificationSound;

  // =========================================================================
  // DRIVER KYC VERIFICATION & SUPER ADMIN APPROVAL ENGINE
  // =========================================================================

  /**
   * Client-Side Image Compressor (Reduces multi-MB camera photos to clean ~100KB JPEGs)
   */
  async function compressImage(file, maxWidth = 1200, quality = 0.72) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('No file provided for compression.'));
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
          if (height > maxWidth) {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => reject(new Error('Failed to load image for compression.'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }
  window.compressImage = compressImage;

  /**
   * Check & Enforce Driver KYC Status
   * Gates Driver Radar and Live Broadcast access until admin approval
   */
  async function checkDriverKycStatus(forceRefresh = false) {
    const user = state.currentUser;
    const isSuperAdmin = isAuthorizedSuperAdmin(user);
    const gateContainer = document.getElementById('driverKycGateContainer');
    const operationalContainer = document.getElementById('driverOperationalContainer');

    if (!user) {
      if (gateContainer) gateContainer.innerHTML = '';
      if (operationalContainer) operationalContainer.classList.add('hidden');
      return;
    }

    try {
      if (forceRefresh) showToast('Checking Driver KYC verification status...', 'info');

      // 1. Initial State / Cache Recovery:
      let status = user.kyc_status || state.kyc.status || 'not_submitted';
      let submission = state.kyc.submission || null;

      if (!submission) {
        try {
          const cachedKyc = localStorage.getItem('routemate_driver_kyc');
          if (cachedKyc) submission = JSON.parse(cachedKyc);
        } catch (e) {}
      }

      // 2. Query Driver KYC status from Backend / Database:
      let kycRes = null;
      if (window.db?.kyc?.getDriverKyc) {
        kycRes = await window.db.kyc.getDriverKyc(user.id, user.email);
      }

      if (kycRes) {
        if (kycRes.status) {
          status = kycRes.status;
        }
        if (kycRes.submission) {
          submission = kycRes.submission;
        }
      }

      state.kyc.status = status;
      state.kyc.submission = submission;

      // Extract driver wallet balance, welcome bonus, and personal UPI ID
      if (kycRes) {
        const sub = kycRes.submission || kycRes;
        const w = kycRes.wallet || {};
        const bal = (w.balance !== undefined) ? w.balance : (sub.wallet_balance !== undefined ? sub.wallet_balance : (kycRes.wallet_balance !== undefined ? kycRes.wallet_balance : (status === 'approved' ? 100 : 0)));
        state.wallet.balance = Number(bal);

        const txs = (Array.isArray(w.transactions) && w.transactions.length > 0)
          ? w.transactions
          : (Array.isArray(sub.wallet_transactions) ? sub.wallet_transactions : []);

        if (status === 'approved' && txs.length === 0) {
          txs.push({
            id: 'tx_welcome_' + (user.id || 'bonus'),
            type: 'credit',
            amount: 100,
            description: '🎁 Routemate ₹100 Welcome Bonus Credited',
            timestamp: new Date().toISOString()
          });
        }
        state.wallet.transactions = txs;

        if (sub.upi_id || sub.vpa || kycRes.upi?.id) {
          const kUpi = sub.upi_id || sub.vpa || kycRes.upi?.id;
          state.driverUpi.upiId = kUpi;
          state.driverUpi.vpa = kUpi;
          if (user) {
            user.upi_id = kUpi;
            user.vpa = kUpi;
            user.upiId = kUpi;
          }
        }
        if (sub.upi_qr || kycRes.upi?.qr) state.driverUpi.upiQr = sub.upi_qr || kycRes.upi?.qr;
        if (typeof renderAllUpiDisplays === 'function') renderAllUpiDisplays();
        if (typeof updateWalletDisplays === 'function') updateWalletDisplays();
      } else if (status === 'approved') {
        state.wallet.balance = state.wallet.balance || 100;
      }

      // Persist state in memory & localStorage to stop session disconnects
      user.kyc_status = status;
      try { localStorage.setItem('routemate_user', JSON.stringify(user)); } catch (e) {}
      if (submission) {
        try { localStorage.setItem('routemate_driver_kyc', JSON.stringify(submission)); } catch (e) {}
      }

      if (!gateContainer) return;

      // -----------------------------------------------------------------------
      // CASE 1: APPROVED / VERIFIED DRIVER
      // -----------------------------------------------------------------------
      if (status === 'approved') {
        if (operationalContainer) operationalContainer.classList.remove('hidden');

        let warning = submission?.warning_alert || user.warning_alert || null;
        if (warning) {
          const issued = warning.issuedAt || warning.timestamp || warning.created_at;
          const expires = warning.expires_at || warning.expiresAt || (issued ? new Date(new Date(issued).getTime() + 48 * 60 * 60 * 1000).toISOString() : null);
          const isExpired = expires ? (new Date(expires).getTime() <= Date.now()) : false;
          if (isExpired) {
            warning = null;
            if (submission) submission.warning_alert = null;
            if (user) user.warning_alert = null;
            try { localStorage.setItem('routemate_user', JSON.stringify(user)); } catch (e) {}
            try { localStorage.setItem('routemate_driver_kyc', JSON.stringify(submission)); } catch (e) {}
          }
        }

        let warningHtml = '';
        if (warning && warning.notes) {
          let timeRemainingLabel = '48-Hour Active Notice';
          const issued = warning.issuedAt || warning.timestamp || warning.created_at;
          const expires = warning.expires_at || warning.expiresAt || (issued ? new Date(new Date(issued).getTime() + 48 * 60 * 60 * 1000).toISOString() : null);
          if (expires) {
            const msLeft = new Date(expires).getTime() - Date.now();
            if (msLeft > 0) {
              const hrsLeft = Math.floor(msLeft / (60 * 60 * 1000));
              const minsLeft = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
              timeRemainingLabel = hrsLeft > 0 ? `Expires in ${hrsLeft}h ${minsLeft}m` : `Expires in ${minsLeft}m`;
            }
          }

          warningHtml = `
            <div id="driverWarningBanner" class="p-3.5 mb-3 rounded-2xl bg-amber-500/15 border-2 border-amber-400 text-amber-950 text-xs shadow-sm flex items-start gap-3 animate-in fade-in">
              <div class="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black flex-shrink-0 mt-0.5 shadow-sm">
                <i data-lucide="alert-triangle" class="w-4 h-4"></i>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <h4 class="font-black text-amber-950 text-xs">Official Safety Compliance Warning</h4>
                  <span class="text-[9px] font-black uppercase text-amber-900 px-2 py-0.5 rounded-full bg-amber-200/90 border border-amber-300">${timeRemainingLabel}</span>
                </div>
                <p class="text-[11px] text-amber-900 mt-1 leading-snug font-medium">
                  "${warning.notes}"
                </p>
                <div class="mt-2.5 flex items-center justify-between text-[10px] text-amber-800 flex-wrap gap-2">
                  <span>Auto-expires after 48 hours. Please adhere strictly to Routemate safety & speed guidelines.</span>
                  <button type="button" onclick="dismissDriverWarningAlert()" class="px-3 py-1 rounded-lg bg-amber-300/80 hover:bg-amber-300 font-black text-amber-950 transition cursor-pointer shadow-xs active:scale-95">
                    Acknowledge & Dismiss ✓
                  </button>
                </div>
              </div>
            </div>
          `;
        }

        gateContainer.innerHTML = `
          ${warningHtml}
          <div class="routemate-card p-3.5 bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600"></i>
              </div>
              <div>
                <h4 class="text-xs font-black text-emerald-950">Verified Driver Account</h4>
                <p class="text-[10px] text-emerald-700 font-semibold">KYC Approved by Super Admin • DL: ${submission?.dl_number || 'Verified'}</p>
              </div>
            </div>
            <span class="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-full border border-emerald-200">
              Verified ✓
            </span>
          </div>
        `;

        renderDriverActiveVehicleCard();
        startDriverRadar();
        if (forceRefresh) showToast('KYC Verified! You can now offer rides.', 'success');
      }
      // -----------------------------------------------------------------------
      // CASE 2: PENDING KYC APPROVAL
      // -----------------------------------------------------------------------
      else if (status === 'pending') {
        if (operationalContainer) operationalContainer.classList.add('hidden');
        if (window.db?.matching) window.db.matching.stopDriverPolling();
        state.driverOnline = false;

        const vehName = submission?.vehicle_name || (submission?.vehicles && submission.vehicles[0]?.vehicle_name) || '';
        const vehColor = submission?.vehicle_color || (submission?.vehicles && submission.vehicles[0]?.vehicle_color) || '';
        const vehDetails = vehName ? `${vehName} ${vehColor ? `(${vehColor})` : ''}` : '';

        gateContainer.innerHTML = `
          <div class="routemate-card p-6 text-center space-y-4 border border-amber-200 bg-amber-50/70 shadow-md animate-in fade-in">
            <div class="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center font-black shadow-inner relative">
              <i data-lucide="clock" class="w-8 h-8 text-amber-600 animate-pulse"></i>
              <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
              </span>
            </div>
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black mb-1.5 border border-amber-200">
                <span>Documents Under Review - Pending Verification</span>
              </span>
              <h3 class="text-base font-black text-slate-900 mt-1">Your account will be verified and approved within 24 to 48 hours.</h3>
              <p class="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto mt-1">
                Your driving license, identity proof, vehicle details, and RC document have been securely pushed for review by the Routemate Compliance & Verification Team.
              </p>
            </div>
            <div class="p-3.5 bg-white/95 rounded-2xl border border-amber-200 text-left text-xs space-y-2 max-w-xs mx-auto shadow-sm">
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-500 font-semibold">DL Number:</span>
                <span class="font-mono font-bold text-slate-800">${submission?.dl_number || 'Submitted'}</span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-500 font-semibold">Vehicle Plate:</span>
                <span class="font-mono font-bold text-slate-800">${submission?.vehicle_number || 'Submitted'}</span>
              </div>
              ${vehDetails ? `
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-500 font-semibold">Vehicle & Colour:</span>
                <span class="font-bold text-slate-800">${vehDetails}</span>
              </div>` : ''}
              <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100">
                <span class="text-slate-500 font-semibold">Expected Approval:</span>
                <span class="font-bold text-emerald-700">Within 24 to 48 Hours</span>
              </div>
              <div class="flex items-center justify-between text-[11px]">
                <span class="text-slate-500 font-semibold">Review:</span>
                <span class="text-[11px] text-blue-700 font-bold">Managed by Team</span>
              </div>
            </div>
            <div class="pt-1 flex items-center justify-center gap-2">
              <button type="button" onclick="checkDriverKycStatus(true)" class="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer flex items-center gap-1.5">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Refresh Status</span>
              </button>
              ${isSuperAdmin ? `
                <button type="button" onclick="navigateToTab('admin')" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm cursor-pointer flex items-center gap-1.5">
                  <i data-lucide="shield-check" class="w-3.5 h-3.5 text-rose-400"></i>
                  <span>Open Super Admin</span>
                </button>
              ` : ''}
            </div>
          </div>
        `;

        if (forceRefresh) showToast('Your KYC is pending review by Super Admin.', 'info');
      }
      // -----------------------------------------------------------------------
      // CASE 3: REJECTED
      // -----------------------------------------------------------------------
      else if (status === 'rejected') {
        if (operationalContainer) operationalContainer.classList.add('hidden');
        if (window.db?.matching) window.db.matching.stopDriverPolling();
        state.driverOnline = false;

        const reason = submission?.rejection_reason || 'Uploaded document photos were not legible or invalid. Please re-upload clear photos.';

        gateContainer.innerHTML = `
          <div class="routemate-card p-6 text-center space-y-3.5 border border-rose-200 bg-rose-50/70 shadow-md">
            <div class="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 mx-auto flex items-center justify-center font-black shadow-inner">
              <i data-lucide="alert-circle" class="w-7 h-7 text-rose-600"></i>
            </div>
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-[11px] font-black mb-1 border border-rose-200">
                <span>Status: KYC Needs Attention</span>
              </span>
              <h3 class="text-sm font-black text-slate-900 mt-1">Verification Rejected</h3>
              <div class="p-3 my-2 bg-white rounded-2xl border border-rose-200 text-rose-700 font-semibold text-xs max-w-sm mx-auto shadow-sm">
                Reason: ${reason}
              </div>
              <p class="text-xs text-slate-500 max-w-sm mx-auto">
                Please update and re-submit clear photos of your Driving License, Aadhaar, RC, and Selfie.
              </p>
            </div>
            <button type="button" onclick="openDriverKycModal()" class="px-5 py-3 btn-pill-primary text-xs font-bold shadow-md cursor-pointer inline-flex items-center gap-2">
              <i data-lucide="upload" class="w-4 h-4"></i>
              <span>Re-Submit Documents</span>
            </button>
          </div>
        `;
      }
      // -----------------------------------------------------------------------
      // CASE: SUSPENDED DRIVER ACCOUNT (SAFETY COMPLIANCE)
      // -----------------------------------------------------------------------
      else if (status === 'suspended') {
        if (operationalContainer) operationalContainer.classList.add('hidden');
        if (window.db?.matching) window.db.matching.stopDriverPolling();
        state.driverOnline = false;

        const reason = submission?.rejection_reason || submission?.suspension_reason || user.suspension_reason || 'Driver account suspended by Super Admin due to safety compliance violations.';

        gateContainer.innerHTML = `
          <div class="routemate-card p-6 text-center space-y-4 border-2 border-rose-500 bg-rose-50/90 shadow-xl animate-in fade-in">
            <div class="w-16 h-16 rounded-2xl bg-rose-600 text-white mx-auto flex items-center justify-center font-black shadow-lg">
              <i data-lucide="shield-ban" class="w-8 h-8 text-white"></i>
            </div>
            <div>
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black mb-1.5 shadow-sm">
                <span>🚫 Account Suspended</span>
              </span>
              <h3 class="text-base font-black text-rose-950 mt-1">Driving Privileges Temporarily Suspended</h3>
              <p class="text-xs text-rose-800 leading-relaxed max-w-sm mx-auto mt-1">
                Your driver account has been suspended by the Routemate Compliance & Safety Team. You cannot accept or offer rides while suspended.
              </p>
            </div>
            <div class="p-3.5 bg-white/95 rounded-2xl border border-rose-300 text-left text-xs space-y-2 max-w-sm mx-auto shadow-sm">
              <div class="text-[11px] text-rose-600 font-bold uppercase tracking-wider">Reason for Suspension:</div>
              <div class="font-bold text-slate-800 text-xs bg-rose-50 p-2.5 rounded-xl border border-rose-200">${reason}</div>
              <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 text-slate-500">
                <span>Compliance Support:</span>
                <a href="mailto:support@routemate.pro" class="text-blue-600 font-bold underline">support@routemate.pro</a>
              </div>
            </div>
            <div class="pt-1 flex items-center justify-center gap-2">
              <button type="button" onclick="checkDriverKycStatus(true)" class="px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-xs font-bold text-rose-700 hover:bg-rose-50 transition shadow-sm cursor-pointer flex items-center gap-1.5">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Check Status</span>
              </button>
            </div>
          </div>
        `;
      }
      // -----------------------------------------------------------------------
      // CASE 4: NOT SUBMITTED
      // -----------------------------------------------------------------------
      else {
        if (operationalContainer) operationalContainer.classList.add('hidden');
        if (window.db?.matching) window.db.matching.stopDriverPolling();
        state.driverOnline = false;

        gateContainer.innerHTML = `
          <div class="routemate-card p-6 text-center space-y-3.5 border border-blue-100 bg-white shadow-md">
            <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mx-auto flex items-center justify-center font-black shadow-inner">
              <i data-lucide="shield-alert" class="w-7 h-7 text-blue-600"></i>
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-900">Driver Verification Required</h3>
              <p class="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                To ensure passenger safety and prevent unauthorized commercial operations, all Routemate drivers must verify their identity and vehicle documents before accepting rides.
              </p>
            </div>
            <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 max-w-xs mx-auto text-left text-[11px] text-slate-600 space-y-1">
              <div class="flex items-center gap-2">✓ Driving License (Front & Back)</div>
              <div class="flex items-center gap-2">✓ Aadhaar Card / ID (Front & Back)</div>
              <div class="flex items-center gap-2">✓ Vehicle Registration Certificate (RC)</div>
              <div class="flex items-center gap-2">✓ Driver Selfie / Photo</div>
            </div>
            <div class="pt-1 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onclick="openDriverKycModal()" class="px-6 py-3.5 btn-pill-primary text-xs font-black shadow-lg cursor-pointer inline-flex items-center gap-2 active:scale-95">
                <i data-lucide="id-card" class="w-4 h-4 text-cyan-200"></i>
                <span>Start KYC Verification</span>
              </button>
              ${isSuperAdmin ? `
                <button type="button" onclick="navigateToTab('admin')" class="px-4 py-3.5 rounded-2xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm cursor-pointer flex items-center gap-1.5">
                  <i data-lucide="shield-check" class="w-4 h-4 text-rose-400"></i>
                  <span>Open Super Admin</span>
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }

      renderDriverActiveVehicleCard();
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Driver KYC status check warning:', err);
    }
  }
  window.checkDriverKycStatus = checkDriverKycStatus;

  window.dismissDriverWarningAlert = function () {
    const banner = document.getElementById('driverWarningBanner');
    if (banner) banner.classList.add('hidden');
    if (state.currentUser) {
      state.currentUser.warning_alert = null;
      try { localStorage.setItem('routemate_user', JSON.stringify(state.currentUser)); } catch (e) {}
    }
    if (state.kyc?.submission) {
      state.kyc.submission.warning_alert = null;
      try { localStorage.setItem('routemate_driver_kyc', JSON.stringify(state.kyc.submission)); } catch (e) {}
    }
    showToast('✓ Safety Notice Acknowledged & Dismissed.', 'success');
  };

  function listenForDriverSafetyAlerts(user) {
    if (!user || !user.id) return;
    const client = window.db?.getSupabase?.();
    if (!client) return;

    try {
      const ch = client.channel(`driver-alerts-${user.id}`);
      ch.on('broadcast', { event: 'safety_action' }, (msg) => {
        const p = msg.payload || {};
        console.log('⚡ [SAFETY ALERT EVENT RECEIVED]', p);
        if (p.actionType === 'block' || p.actionType === 'suspend') {
          state.driverOnline = false;
          if (state.currentUser) {
            state.currentUser.kyc_status = 'suspended';
            state.currentUser.suspension_reason = p.notes;
          }
          state.kyc.status = 'suspended';
          showToast(`🚫 Account Suspended by Super Admin: ${p.notes || 'Safety compliance violation.'}`, 'danger');
          if (typeof pushUserNotification === 'function') {
            pushUserNotification({
              id: 'alert_suspend_' + Date.now(),
              type: 'safety',
              title: '🚫 Account Suspended by Super Admin',
              message: p.notes || 'Safety compliance violation reported.',
              timestamp: p.timestamp || new Date().toISOString(),
              icon: 'alert-triangle',
              iconBg: 'bg-rose-100 text-rose-800',
              action: { label: 'Contact Support', email: 'routmatesupport@gmail.com' }
            });
          }
          checkDriverKycStatus(true);
        } else if (p.actionType === 'warning') {
          showToast(`⚠️ Official Safety Warning: ${p.notes || 'Please follow community safety guidelines.'}`, 'warning');
          const now = new Date();
          const expiresAt = p.expires_at || p.expiresAt || new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
          const warningData = {
            notes: p.notes,
            issuedAt: p.timestamp || now.toISOString(),
            expires_at: expiresAt,
            expiresAt: expiresAt
          };
          if (state.currentUser) {
            state.currentUser.warning_alert = warningData;
            try { localStorage.setItem('routemate_user', JSON.stringify(state.currentUser)); } catch (e) {}
          }
          if (state.kyc?.submission) {
            state.kyc.submission.warning_alert = warningData;
            try { localStorage.setItem('routemate_driver_kyc', JSON.stringify(state.kyc.submission)); } catch (e) {}
          }
          if (typeof pushUserNotification === 'function') {
            pushUserNotification({
              id: 'alert_warn_' + Date.now(),
              type: 'safety',
              title: '⚠️ Compliance Warning from Super Admin',
              message: p.notes || 'Please follow community safety guidelines.',
              timestamp: p.timestamp || new Date().toISOString(),
              icon: 'shield-alert',
              iconBg: 'bg-amber-100 text-amber-800',
              action: { label: 'Review Guidelines', tab: 'profile' }
            });
          }
          checkDriverKycStatus(true);
        } else if (p.actionType === 'unsuspend' || p.actionType === 'resolve') {
          if (state.currentUser) {
            state.currentUser.kyc_status = 'approved';
            state.currentUser.warning_alert = null;
          }
          state.kyc.status = 'approved';
          showToast('✓ Driver account reinstated by Compliance Team.', 'success');
          if (typeof pushUserNotification === 'function') {
            pushUserNotification({
              id: 'alert_restore_' + Date.now(),
              type: 'account',
              title: '✓ Account Restored by Compliance Team',
              message: 'Your driver account has been reinstated. You can now go online and accept rides.',
              timestamp: p.timestamp || new Date().toISOString(),
              icon: 'check-circle-2',
              iconBg: 'bg-emerald-100 text-emerald-800',
              action: { label: 'Go Online', tab: 'drive' }
            });
          }
          checkDriverKycStatus(true);
        }
      }).subscribe();
    } catch (e) {
      console.warn('Realtime safety alert listener notice:', e);
    }
  }

  function refreshKycPreviews() {
    const previewMap = {
      driver_photo: 'kycPreviewDriverPhoto',
      dl_front: 'kycPreviewDlFront',
      dl_back: 'kycPreviewDlBack',
      aadhaar_front: 'kycPreviewAadhaarFront',
      aadhaar_back: 'kycPreviewAadhaarBack',
      rc_photo: 'kycPreviewRcPhoto',
      upi_qr: 'kycPreviewUpiQr'
    };

    Object.entries(previewMap).forEach(([fieldKey, elId]) => {
      const dataUrl = state.kyc.formData[fieldKey];
      const previewEl = document.getElementById(elId);
      if (previewEl && dataUrl) {
        previewEl.innerHTML = `
          <img src="${dataUrl}" alt="Preview" class="w-full h-full object-cover rounded-xl cursor-pointer hover:opacity-90 transition shadow-sm" onclick="openImageLightbox('${dataUrl}', '${fieldKey.toUpperCase()}')" />
        `;
      }
    });
  }

  // -------------------------------------------------------------------------
  // MULTI-STEP DRIVER KYC SUBMISSION WIZARD
  // -------------------------------------------------------------------------
  window.openDriverKycModal = function () {
    const modal = document.getElementById('driverKycModal');
    if (!modal) return;

    state.kyc.currentStep = 1;

    // Prefill user details if available
    const nameInput = document.getElementById('kycInputDriverName');
    const phoneInput = document.getElementById('kycInputDriverPhone');
    const upiInput = document.getElementById('kycInputUpiId');
    if (nameInput && state.currentUser?.name) {
      nameInput.value = state.currentUser.name;
    }
    if (phoneInput && state.currentUser?.phone) {
      const cleanPhone = String(state.currentUser.phone).replace(/\D/g, '').slice(-10);
      phoneInput.value = cleanPhone;
    }
    if (upiInput) {
      const existingUpi = state.driverUpi?.upiId || state.kyc?.submission?.upi_id || state.currentUser?.upi_id || state.currentUser?.upiId || '';
      if (existingUpi) upiInput.value = existingUpi;
    }

    const errBox = document.getElementById('kycFormErrorMsg');
    if (errBox) {
      errBox.classList.add('hidden');
      errBox.textContent = '';
    }

    updateKycStepUI();
    refreshKycPreviews();
    if (typeof selectKycCarSeats === 'function') {
      selectKycCarSeats(4);
    }
    const currentKycVehType = document.getElementById('kycSelectVehicleType')?.value || 'bike';
    handleKycVehicleTypeChange(currentKycVehType);
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeDriverKycModal = function () {
    const modal = document.getElementById('driverKycModal');
    if (modal) modal.classList.add('hidden');
  };

  window.navigateKycStep = function (direction) {
    const errBox = document.getElementById('kycFormErrorMsg');
    if (errBox) errBox.classList.add('hidden');

    const current = state.kyc.currentStep;

    // Validate current step before advancing forward
    if (direction > 0) {
      if (current === 1) {
        const name = String(document.getElementById('kycInputDriverName')?.value || '').trim();
        const phone = String(document.getElementById('kycInputDriverPhone')?.value || '').replace(/\D/g, '');
        const upi = String(document.getElementById('kycInputUpiId')?.value || '').trim();
        if (!name || name.length < 2) {
          showKycError('Please enter your full legal name as per government ID.');
          return;
        }
        if (!phone || phone.length !== 10) {
          showKycError('Please enter a valid 10-digit mobile number.');
          return;
        }
        if (!state.kyc.formData.driver_photo) {
          showKycError('Please upload your selfie / passport photo.');
          return;
        }
        if (!upi) {
          showKycError('Direct P2P UPI ID is mandatory. Please enter your personal UPI ID (e.g. name@oksbi).');
          return;
        }
        const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,32}$/;
        if (!upiRegex.test(upi)) {
          showKycError('Please enter a valid personal UPI ID format (e.g. yourname@oksbi or 9848012345@paytm).');
          return;
        }
      } else if (current === 2) {
        const dlNum = String(document.getElementById('kycInputDlNumber')?.value || '').trim();
        if (!dlNum || dlNum.length < 5) {
          showKycError('Please enter a valid Driving License (DL) Number.');
          return;
        }
        if (!state.kyc.formData.dl_front) {
          showKycError('Please upload the front photo of your Driving License.');
          return;
        }
        if (!state.kyc.formData.dl_back) {
          showKycError('Please upload the back photo of your Driving License.');
          return;
        }
      } else if (current === 3) {
        const aadhaar = String(document.getElementById('kycInputAadhaarNumber')?.value || '').replace(/\D/g, '');
        if (!aadhaar || aadhaar.length !== 12) {
          showKycError('Please enter a valid 12-digit Aadhaar Card Number.');
          return;
        }
        if (!state.kyc.formData.aadhaar_front) {
          showKycError('Please upload the front photo of your Aadhaar Card.');
          return;
        }
        if (!state.kyc.formData.aadhaar_back) {
          showKycError('Please upload the back photo of your Aadhaar Card.');
          return;
        }
      }
    }

    const nextStep = current + direction;
    if (nextStep >= 1 && nextStep <= 4) {
      state.kyc.currentStep = nextStep;
      const curUpi = String(document.getElementById('kycInputUpiId')?.value || '').trim();
      const revUpiEl = document.getElementById('kycReviewUpiDisplay');
      if (revUpiEl && curUpi) revUpiEl.textContent = curUpi;
      updateKycStepUI();
      refreshKycPreviews();
    }
  };

  function showKycError(msg) {
    const errBox = document.getElementById('kycFormErrorMsg');
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    }
    showToast(msg, 'danger');
  }

  function updateKycStepUI() {
    const step = state.kyc.currentStep;

    // Step contents
    for (let i = 1; i <= 4; i++) {
      const el = document.getElementById(`kycStepContent-${i}`);
      const bar = document.getElementById(`kycStepBar-${i}`);
      if (el) el.classList.toggle('hidden', i !== step);
      if (bar) {
        if (i <= step) {
          bar.className = 'h-1.5 rounded-full bg-blue-600 transition-colors';
        } else {
          bar.className = 'h-1.5 rounded-full bg-slate-200 transition-colors';
        }
      }
    }

    // Step labels
    const stepNumEl = document.getElementById('kycCurrentStepNumber');
    const stepTitleEl = document.getElementById('kycStepTitle');
    const titles = {
      1: 'Personal & Photo',
      2: 'Driving License',
      3: 'Aadhaar Card',
      4: 'Vehicle Details & RC'
    };
    if (stepNumEl) stepNumEl.textContent = step;
    if (stepTitleEl) stepTitleEl.textContent = titles[step] || '';

    // Buttons
    const btnPrev = document.getElementById('btnKycPrev');
    const btnNext = document.getElementById('btnKycNext');
    const btnSubmit = document.getElementById('btnKycSubmit');

    if (btnPrev) btnPrev.classList.toggle('hidden', step === 1);
    if (btnNext) btnNext.classList.toggle('hidden', step === 4);
    if (btnSubmit) btnSubmit.classList.toggle('hidden', step !== 4);

    refreshKycPreviews();
    if (window.lucide) lucide.createIcons();
  }

  window.formatAadhaarInput = function (e) {
    const input = e.target;
    let digits = input.value.replace(/\D/g, '').slice(0, 12);
    let formatted = '';
    for (let i = 0; i < digits.length; i++) {
      if (i > 0 && i % 4 === 0) formatted += ' ';
      formatted += digits[i];
    }
    input.value = formatted;
  };

  window.handleKycFileSelect = async function (e, fieldKey) {
    const file = e.target?.files?.[0];
    if (!file) return;

    try {
      showToast('Compressing photo for fast upload...', 'info');
      const compressedDataUrl = await compressImage(file, 1200, 0.72);
      state.kyc.formData[fieldKey] = compressedDataUrl;

      // Update thumbnail preview instantly
      refreshKycPreviews();
      showToast('Photo uploaded & preview verified ✓', 'success');
    } catch (err) {
      console.error('Image compression error:', err);
      showToast('Failed to process image: ' + err.message, 'danger');
    }
  };

  window.showKycPendingConfirmationModal = function (details = {}) {
    const modal = document.getElementById('kycPendingConfirmationModal');
    if (!modal) return;

    const nameEl = document.getElementById('kycConfirmDriverName');
    const vehNumEl = document.getElementById('kycConfirmVehicleNumber');
    const vehDetEl = document.getElementById('kycConfirmVehicleDetails');

    if (nameEl) nameEl.textContent = details.driverName || state.currentUser?.name || 'Driver';
    if (vehNumEl) vehNumEl.textContent = details.vehicleNumber || 'Submitted';
    if (vehDetEl) {
      const name = details.vehicleName || 'Vehicle';
      const color = details.vehicleColor ? `(${details.vehicleColor})` : '';
      vehDetEl.textContent = `${name} ${color}`.trim();
    }

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeKycPendingConfirmationModal = function () {
    const modal = document.getElementById('kycPendingConfirmationModal');
    if (modal) modal.classList.add('hidden');
    navigateToTab('drive');
  };

  window.handleDriverKycFormSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    const user = state.currentUser;
    if (!user) {
      showToast('Session expired. Please sign in again.', 'danger');
      return;
    }

    const btnSubmit = document.getElementById('btnKycSubmit');
    const btnText = document.getElementById('btnKycSubmitText');

    try {
      // 1. Cross-step validation for Step 1
      const driverName = String(document.getElementById('kycInputDriverName')?.value || user.name || '').trim();
      const rawPhone = String(document.getElementById('kycInputDriverPhone')?.value || user.phone || '').replace(/\D/g, '').slice(-10);
      const upiId = String(document.getElementById('kycInputUpiId')?.value || state.driverUpi?.upiId || '').trim();

      if (!driverName || driverName.length < 2) {
        state.kyc.currentStep = 1;
        updateKycStepUI();
        showKycError('Please enter your full legal name on Step 1.');
        return;
      }
      if (!rawPhone || rawPhone.length !== 10) {
        state.kyc.currentStep = 1;
        updateKycStepUI();
        showKycError('Please enter a valid 10-digit mobile number on Step 1.');
        return;
      }
      if (!state.kyc.formData.driver_photo) {
        state.kyc.currentStep = 1;
        updateKycStepUI();
        showKycError('Please upload your Selfie / Photo on Step 1.');
        return;
      }
      if (!upiId) {
        state.kyc.currentStep = 1;
        updateKycStepUI();
        showKycError('Direct P2P UPI ID is mandatory. Please enter your active UPI ID (e.g. name@oksbi) on Step 1.');
        return;
      }
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z0-9.\-_]{2,32}$/;
      if (!upiRegex.test(upiId)) {
        state.kyc.currentStep = 1;
        updateKycStepUI();
        showKycError('Please enter a valid personal UPI ID format (e.g. yourname@oksbi or 9848012345@paytm) on Step 1.');
        return;
      }

      // 2. Cross-step validation for Step 2
      const dlNumber = String(document.getElementById('kycInputDlNumber')?.value || '').trim().toUpperCase();
      if (!dlNumber || dlNumber.length < 5) {
        state.kyc.currentStep = 2;
        updateKycStepUI();
        showKycError('Please enter your Driving License (DL) Number on Step 2.');
        return;
      }
      if (!state.kyc.formData.dl_front) {
        state.kyc.currentStep = 2;
        updateKycStepUI();
        showKycError('Please upload the front photo of your Driving License on Step 2.');
        return;
      }
      if (!state.kyc.formData.dl_back) {
        state.kyc.currentStep = 2;
        updateKycStepUI();
        showKycError('Please upload the back photo of your Driving License on Step 2.');
        return;
      }

      // 3. Cross-step validation for Step 3
      const aadhaarNumber = String(document.getElementById('kycInputAadhaarNumber')?.value || '').replace(/\D/g, '');
      if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        state.kyc.currentStep = 3;
        updateKycStepUI();
        showKycError('Please enter a valid 12-digit Aadhaar Card Number on Step 3.');
        return;
      }
      if (!state.kyc.formData.aadhaar_front) {
        state.kyc.currentStep = 3;
        updateKycStepUI();
        showKycError('Please upload the front photo of your Aadhaar Card on Step 3.');
        return;
      }
      if (!state.kyc.formData.aadhaar_back) {
        state.kyc.currentStep = 3;
        updateKycStepUI();
        showKycError('Please upload the back photo of your Aadhaar Card on Step 3.');
        return;
      }

      // 4. Validation for Step 4
      const vehNum = String(document.getElementById('kycInputVehicleNumber')?.value || '').trim().toUpperCase();
      const vehChassis = String(document.getElementById('kycInputChassisNumber')?.value || '').trim().toUpperCase();
      const vehName = String(document.getElementById('kycInputVehicleName')?.value || '').trim();
      const vehColor = String(document.getElementById('kycInputVehicleColor')?.value || '').trim();
      const vehType = document.getElementById('kycSelectVehicleType')?.value || 'bike';
      const declaration = Boolean(document.getElementById('kycCheckboxDeclaration')?.checked);

      if (!vehNum || vehNum.length < 5) {
        showKycError('Please enter a valid Vehicle Registration Number (e.g. TG 09 EA 1234).');
        return;
      }
      if (!vehChassis || vehChassis.length < 5) {
        showKycError('Please enter a valid Vehicle Chassis Number (from your RC).');
        return;
      }
      if (!vehName) {
        showKycError('Please enter your Vehicle / Bike Name (e.g. Honda Activa 6G).');
        return;
      }
      if (!vehColor) {
        showKycError('Please enter your Vehicle Colour (e.g. Black / Matte Red).');
        return;
      }
      if (!state.kyc.formData.rc_photo) {
        showKycError('Please upload your Vehicle Registration Certificate (RC) photo.');
        return;
      }
      if (!declaration) {
        showKycError('Please certify the declaration checkbox to proceed.');
        return;
      }

      if (btnSubmit) btnSubmit.disabled = true;
      if (btnText) btnText.textContent = 'Submitting KYC...';
      showToast('Submitting driver documents securely...', 'info');

      const driverPhone = '+91' + rawPhone;
      const payload = {
        userId: user.id,
        user_id: user.id,
        driverName,
        driver_name: driverName,
        driverPhone,
        driver_phone: driverPhone,
        driverEmail: user.email,
        driver_email: user.email,
        upiId,
        upi_id: upiId,
        upiQr: state.kyc.formData.upi_qr || '',
        upi_qr: state.kyc.formData.upi_qr || '',
        driverPhoto: state.kyc.formData.driver_photo,
        driver_photo: state.kyc.formData.driver_photo,
        dlNumber,
        dl_number: dlNumber,
        dlFrontPhoto: state.kyc.formData.dl_front,
        dl_front_photo: state.kyc.formData.dl_front,
        dlBackPhoto: state.kyc.formData.dl_back,
        dl_back_photo: state.kyc.formData.dl_back,
        aadhaarNumber,
        aadhaar_number: aadhaarNumber,
        aadhaarFrontPhoto: state.kyc.formData.aadhaar_front,
        aadhaar_front_photo: state.kyc.formData.aadhaar_front,
        aadhaarBackPhoto: state.kyc.formData.aadhaar_back,
        aadhaar_back_photo: state.kyc.formData.aadhaar_back,
        vehicleNumber: vehNum,
        vehicle_number: vehNum,
        vehicleChassis: vehChassis,
        vehicle_chassis: vehChassis,
        chassis_number: vehChassis,
        vehicleName: vehName,
        vehicle_name: vehName,
        vehicleColor: vehColor,
        vehicle_color: vehColor,
        vehicleType: vehType,
        vehicle_type: vehType,
        carSeatCapacity: vehType === 'car' ? Math.min(8, Math.max(1, parseInt(document.getElementById('kycInputCarSeats')?.value || 4, 10))) : (vehType === 'auto' ? 3 : 1),
        car_seat_capacity: vehType === 'car' ? Math.min(8, Math.max(1, parseInt(document.getElementById('kycInputCarSeats')?.value || 4, 10))) : (vehType === 'auto' ? 3 : 1),
        rcPhoto: state.kyc.formData.rc_photo,
        rc_photo: state.kyc.formData.rc_photo
      };

      if (window.db?.kyc?.submitDriverKyc) {
        const res = await window.db.kyc.submitDriverKyc(payload);
        state.kyc.status = 'pending';
        state.kyc.submission = (res && res.submission) ? res.submission : payload;
        if (state.currentUser) {
          state.currentUser.kyc_status = 'pending';
          state.currentUser.upi_id = upiId;
          state.currentUser.vpa = upiId;
          state.currentUser.upiId = upiId;
          if (state.kyc.formData.upi_qr) {
            state.currentUser.upi_qr = state.kyc.formData.upi_qr;
            state.currentUser.upiQr = state.kyc.formData.upi_qr;
          }
          try { localStorage.setItem('routemate_user', JSON.stringify(state.currentUser)); } catch (e) {}
        }
        state.driverUpi = { upiId, vpa: upiId, upiQr: state.kyc.formData.upi_qr || '' };
        try { localStorage.setItem('routemate_driver_upi', JSON.stringify(state.driverUpi)); } catch (e) {}
        try { localStorage.setItem('routemate_driver_kyc', JSON.stringify(state.kyc.submission)); } catch (e) {}
      }

      renderAllUpiDisplays();
      updateProfileUI();
      updateWalletDisplays();

      closeDriverKycModal();
      showKycPendingConfirmationModal({
        driverName,
        vehicleNumber: vehNum,
        vehicleName: vehName,
        vehicleColor: vehColor
      });
      await checkDriverKycStatus(true);
    } catch (err) {
      console.error('Driver KYC submission error:', err);
      showKycError(err.message || 'Failed to submit KYC documents. Please try again.');
    } finally {
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnText) btnText.textContent = 'Submit for Verification';
    }
  };

  // -------------------------------------------------------------------------
  // PROFILE VEHICLE MANAGEMENT ("MY VEHICLES" / "ADD ANOTHER VEHICLE")
  // -------------------------------------------------------------------------
  let addVehicleRcCompressedBase64 = null;
  let addVehicleCarDlCompressedBase64 = null;

  window.handleAddVehicleTypeChange = function (type) {
    const carDlWrap = document.getElementById('addVehicleCarDlWrap');
    if (carDlWrap) {
      if (type === 'car') {
        carDlWrap.classList.remove('hidden');
      } else {
        carDlWrap.classList.add('hidden');
      }
    }

    const carSeatsWrap = document.getElementById('addVehicleCarSeatsWrap');
    if (carSeatsWrap) {
      if (type === 'car') {
        carSeatsWrap.classList.remove('hidden');
      } else {
        carSeatsWrap.classList.add('hidden');
      }
    }

    const nameLabel = document.getElementById('addVehicleNameLabel');
    const nameInput = document.getElementById('addVehicleNameInput');

    if (type === 'car') {
      if (nameLabel) nameLabel.innerHTML = 'Car Name / Model <span class="text-rose-500">*</span>';
      if (nameInput) nameInput.placeholder = 'e.g. Swift Dzire / Hyundai i20';
    } else if (type === 'auto') {
      if (nameLabel) nameLabel.innerHTML = 'Auto Model / Name <span class="text-rose-500">*</span>';
      if (nameInput) nameInput.placeholder = 'e.g. Bajaj RE / Piaggio Ape';
    } else {
      if (nameLabel) nameLabel.innerHTML = 'Bike / Scooter Name <span class="text-rose-500">*</span>';
      if (nameInput) nameInput.placeholder = 'e.g. Honda Activa 6G / Royal Enfield';
    }
  };

  window.handleKycVehicleTypeChange = function (type) {
    const kycSeatsWrap = document.getElementById('kycCarSeatsWrap');
    if (kycSeatsWrap) {
      if (type === 'car') {
        kycSeatsWrap.classList.remove('hidden');
      } else {
        kycSeatsWrap.classList.add('hidden');
      }
    }

    const nameLabel = document.getElementById('kycLabelVehicleName');
    const nameInput = document.getElementById('kycInputVehicleName');

    if (type === 'car') {
      if (nameLabel) nameLabel.innerHTML = 'Car Name / Model <span class="text-rose-500">*</span>';
      if (nameInput) nameInput.placeholder = 'e.g. Swift Dzire / Hyundai i20';
    } else if (type === 'auto') {
      if (nameLabel) nameLabel.innerHTML = 'Auto Model / Name <span class="text-rose-500">*</span>';
      if (nameInput) nameInput.placeholder = 'e.g. Bajaj RE / Piaggio Ape';
    } else {
      if (nameLabel) nameLabel.innerHTML = 'Bike / Scooter Name <span class="text-rose-500">*</span>';
      if (nameInput) nameInput.placeholder = 'e.g. Honda Activa 6G / Royal Enfield';
    }
  };

  window.selectAddVehicleCarSeats = function (seats) {
    const seatNum = Math.min(8, Math.max(1, parseInt(seats, 10) || 4));
    const input = document.getElementById('addVehicleCarSeatsInput');
    if (input) input.value = seatNum;

    const badge = document.getElementById('addVehicleCarSeatsBadge');
    if (badge) badge.textContent = `${seatNum} Passenger Seats`;

    const seatOptions = [4, 6, 7, 8];
    seatOptions.forEach(opt => {
      const btn = document.getElementById(`addVehSeatBtn-${opt}`);
      if (btn) {
        if (opt === seatNum) {
          btn.className = 'py-2.5 px-1 text-center rounded-xl text-xs font-black transition cursor-pointer bg-indigo-600 text-white shadow-xs';
        } else {
          btn.className = 'py-2.5 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer bg-white text-slate-700 border border-slate-200 hover:border-indigo-400';
        }
      }
    });
  };

  window.selectKycCarSeats = function (seats) {
    const seatNum = Math.min(8, Math.max(1, parseInt(seats, 10) || 4));
    const input = document.getElementById('kycInputCarSeats');
    if (input) input.value = seatNum;

    const badge = document.getElementById('kycCarSeatsBadge');
    if (badge) badge.textContent = `${seatNum} Passenger Seats`;

    const seatOptions = [4, 6, 7, 8];
    seatOptions.forEach(opt => {
      const btn = document.getElementById(`kycSeatBtn-${opt}`);
      if (btn) {
        if (opt === seatNum) {
          btn.className = 'py-2.5 px-1 text-center rounded-xl text-xs font-black transition cursor-pointer bg-indigo-600 text-white shadow-xs';
        } else {
          btn.className = 'py-2.5 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer bg-white text-slate-700 border border-slate-200 hover:border-indigo-400';
        }
      }
    });
  };

  window.handleAddVehicleCarDlFile = async function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const previewContainer = document.getElementById('addVehicleCarDlPreviewContainer');
    const promptContainer = document.getElementById('addVehicleCarDlPrompt');
    const previewImg = document.getElementById('addVehicleCarDlPreviewImg');
    const errBox = document.getElementById('addVehicleErrorMsg');

    try {
      if (errBox) errBox.classList.add('hidden');
      showToast('Compressing Car Driving License (LMV)...', 'info');
      const compressed = await compressImage(file, 1200, 0.8);
      addVehicleCarDlCompressedBase64 = compressed;

      if (previewImg) previewImg.src = compressed;
      if (previewContainer) previewContainer.classList.remove('hidden');
      if (promptContainer) promptContainer.classList.add('hidden');
      showToast('Car Driving License attached', 'success');
    } catch (err) {
      console.error('Car DL compression failed:', err);
      if (errBox) {
        errBox.textContent = 'Failed to process Car DL image. Please choose a standard JPG or PNG.';
        errBox.classList.remove('hidden');
      }
    }
  };

  window.openAddVehicleModal = function () {
    const modal = document.getElementById('addVehicleModal');
    if (!modal) return;

    addVehicleRcCompressedBase64 = null;
    addVehicleCarDlCompressedBase64 = null;

    const form = document.getElementById('addVehicleForm');
    if (form) form.reset();

    const previewContainer = document.getElementById('addVehicleRcPreviewContainer');
    const promptContainer = document.getElementById('addVehicleRcPrompt');
    const previewImg = document.getElementById('addVehicleRcPreviewImg');
    const errBox = document.getElementById('addVehicleErrorMsg');

    const carDlWrap = document.getElementById('addVehicleCarDlWrap');
    const carDlPreview = document.getElementById('addVehicleCarDlPreviewContainer');
    const carDlPrompt = document.getElementById('addVehicleCarDlPrompt');
    const carDlImg = document.getElementById('addVehicleCarDlPreviewImg');

    if (previewContainer) previewContainer.classList.add('hidden');
    if (promptContainer) promptContainer.classList.remove('hidden');
    if (previewImg) previewImg.src = '';

    if (carDlWrap) carDlWrap.classList.add('hidden');
    if (carDlPreview) carDlPreview.classList.add('hidden');
    if (carDlPrompt) carDlPrompt.classList.remove('hidden');
    if (carDlImg) carDlImg.src = '';

    if (errBox) {
      errBox.classList.add('hidden');
      errBox.textContent = '';
    }

    selectAddVehicleCarSeats(4);
    handleAddVehicleTypeChange('bike');
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeAddVehicleModal = function () {
    const modal = document.getElementById('addVehicleModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleAddVehicleRcFile = async function (e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const previewContainer = document.getElementById('addVehicleRcPreviewContainer');
    const promptContainer = document.getElementById('addVehicleRcPrompt');
    const previewImg = document.getElementById('addVehicleRcPreviewImg');
    const errBox = document.getElementById('addVehicleErrorMsg');

    try {
      if (errBox) errBox.classList.add('hidden');
      showToast('Compressing RC document...', 'info');
      const compressed = await compressImage(file, 1200, 0.8);
      addVehicleRcCompressedBase64 = compressed;

      if (previewImg) previewImg.src = compressed;
      if (previewContainer) previewContainer.classList.remove('hidden');
      if (promptContainer) promptContainer.classList.add('hidden');
      showToast('RC document attached', 'success');
    } catch (err) {
      console.error('RC compression failed:', err);
      if (errBox) {
        errBox.textContent = 'Failed to process image file. Please choose a standard JPG or PNG.';
        errBox.classList.remove('hidden');
      }
    }
  };

  window.handleAddVehicleSubmit = async function (e) {
    e.preventDefault();
    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to register a vehicle.', 'danger');
      return;
    }

    const typeInput = document.querySelector('input[name="addVehicleType"]:checked');
    const vehicleType = typeInput ? typeInput.value : 'bike';
    const vehicleName = document.getElementById('addVehicleNameInput')?.value.trim();
    const vehicleColor = document.getElementById('addVehicleColorInput')?.value.trim();
    const vehicleNumberRaw = document.getElementById('addVehicleNumberInput')?.value.trim();
    const cleanNumber = (vehicleNumberRaw || '').toUpperCase().replace(/\s+/g, '');
    const vehicleChassis = document.getElementById('addVehicleChassisInput')?.value.trim().toUpperCase();

    const errBox = document.getElementById('addVehicleErrorMsg');
    const submitBtn = document.getElementById('addVehicleSubmitBtn');
    const submitText = document.getElementById('addVehicleSubmitBtnText');

    if (!cleanNumber || cleanNumber.length < 5) {
      if (errBox) {
        errBox.textContent = 'Please enter a valid Vehicle Registration Number (e.g. TG09EA1234).';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (!vehicleChassis || vehicleChassis.length < 5) {
      if (errBox) {
        errBox.textContent = 'Please enter a valid Vehicle Chassis Number (from your RC).';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (!vehicleName) {
      if (errBox) {
        errBox.textContent = 'Please enter your Vehicle / Bike Name (e.g. Hero Splendor Plus).';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (!vehicleColor) {
      if (errBox) {
        errBox.textContent = 'Please enter your Vehicle Colour (e.g. Black / Grey).';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (!addVehicleRcCompressedBase64) {
      if (errBox) {
        errBox.textContent = 'Please upload a photo of your Vehicle Registration Certificate (RC).';
        errBox.classList.remove('hidden');
      }
      return;
    }

    if (vehicleType === 'car') {
      const hasExistingDl = state.kyc?.submission?.dl_photo || state.kyc?.submission?.dl_number;
      if (!addVehicleCarDlCompressedBase64 && !hasExistingDl) {
        if (errBox) {
          errBox.textContent = 'Please upload a photo of your Car Driving License (LMV / 4-Wheeler) to register a Car.';
          errBox.classList.remove('hidden');
        }
        return;
      }
    }

    if (errBox) errBox.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Submitting...';

    try {
      showToast('Submitting vehicle details for Super Admin review...', 'info');
      const carSeatCapacity = vehicleType === 'car'
        ? Math.min(8, Math.max(1, parseInt(document.getElementById('addVehicleCarSeatsInput')?.value || 4, 10)))
        : (vehicleType === 'auto' ? 3 : 1);

      const payload = {
        userId: user.id,
        user_id: user.id,
        driverName: user.name || 'Driver',
        driver_name: user.name || 'Driver',
        driverEmail: user.email || '',
        driver_email: user.email || '',
        driverPhone: user.phone || '',
        driver_phone: user.phone || '',
        vehicleNumber: cleanNumber,
        vehicle_number: cleanNumber,
        vehicleChassis,
        vehicle_chassis: vehicleChassis,
        chassis_number: vehicleChassis,
        vehicleType,
        vehicle_type: vehicleType,
        carSeatCapacity,
        car_seat_capacity: carSeatCapacity,
        vehicleName,
        vehicle_name: vehicleName,
        vehicleColor,
        vehicle_color: vehicleColor,
        rcPhoto: addVehicleRcCompressedBase64,
        rc_photo: addVehicleRcCompressedBase64,
        dlPhoto: addVehicleCarDlCompressedBase64 || state.kyc?.submission?.dl_photo || null,
        dl_photo: addVehicleCarDlCompressedBase64 || state.kyc?.submission?.dl_photo || null
      };

      if (window.db?.kyc?.addDriverVehicle) {
        await window.db.kyc.addDriverVehicle(payload);
      }

      showToast('Vehicle submitted! Super Admin will review your RC document.', 'success');
      closeAddVehicleModal();

      await checkDriverKycStatus(true);
      await renderProfileVehicles();
      renderDriverActiveVehicleCard();
    } catch (err) {
      console.error('Vehicle submission error:', err);
      if (errBox) {
        errBox.textContent = err.message || 'Failed to submit vehicle. Please try again.';
        errBox.classList.remove('hidden');
      }
      showToast(err.message || 'Vehicle submission failed.', 'danger');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'Submit Vehicle';
    }
  };

  window.handleSwitchActiveVehicle = async function (vehicleId) {
    const user = state.currentUser;
    if (!user || !vehicleId) return;

    try {
      showToast('Switching active driving vehicle...', 'info');
      if (window.db?.kyc?.switchDriverVehicle) {
        const result = await window.db.kyc.switchDriverVehicle(user.id, vehicleId);
        showToast(result.message || 'Active driving vehicle updated!', 'success');
      }
      await checkDriverKycStatus(true);
      await renderProfileVehicles();
      renderDriverActiveVehicleCard();
    } catch (err) {
      console.error('Error switching active vehicle:', err);
      showToast(err.message || 'Failed to switch vehicle.', 'danger');
    }
  };

  function renderDriverActiveVehicleCard() {
    const card = document.getElementById('driverActiveVehicleCard');
    if (!card) return;

    const user = state.currentUser;
    if (!user || state.kyc?.status !== 'approved') {
      card.classList.add('hidden');
      return;
    }
    card.classList.remove('hidden');

    // Determine approved vehicles
    let vehicles = state.kyc?.submission?.vehicles || [];
    let approvedVehicles = vehicles.filter(v => v.status === 'approved');

    // If no multi-vehicles list but main driver KYC is approved, derive from submission/driver
    if (approvedVehicles.length === 0) {
      const mainType = (state.kyc?.submission?.vehicle_type || state.kyc?.submission?.vehicle || 'bike').toLowerCase();
      approvedVehicles = [{
        id: 'primary',
        vehicle_type: mainType === 'car' ? 'car' : (mainType === 'auto' ? 'auto' : 'bike'),
        vehicle_name: state.kyc?.submission?.vehicle_name || (mainType === 'car' ? 'Car' : (mainType === 'auto' ? 'Auto' : 'Bike')),
        vehicle_number: state.kyc?.submission?.vehicle_number || '--',
        car_seat_capacity: state.kyc?.submission?.car_seat_capacity || 4,
        is_default: true,
        status: 'approved'
      }];
    }

    // Set of approved vehicle types
    const approvedTypes = Array.from(new Set(approvedVehicles.map(v => v.vehicle_type)));
    state.approvedVehicleTypes = approvedTypes;

    // Determine currently active vehicle
    let activeVeh = approvedVehicles.find(v => v.is_default) || approvedVehicles[0];
    if (state.driverActiveVehicleType && approvedVehicles.some(v => v.vehicle_type === state.driverActiveVehicleType)) {
      activeVeh = approvedVehicles.find(v => v.vehicle_type === state.driverActiveVehicleType) || activeVeh;
    }

    state.driverActiveVehicle = activeVeh;
    state.driverActiveVehicleType = activeVeh?.vehicle_type || 'bike';

    const iconWrap = document.getElementById('driverActiveVehicleIconWrap');
    const lockBadge = document.getElementById('driverActiveVehicleLockBadge');
    const nameEl = document.getElementById('driverActiveVehicleName');
    const plateEl = document.getElementById('driverActiveVehiclePlate');
    const switchWrap = document.getElementById('driverVehicleSwitchWrap');

    const activeCarCap = (activeVeh && String(activeVeh.vehicle_type || '').toLowerCase() === 'car')
      ? (Number(activeVeh.car_seat_capacity || activeVeh.carSeatCapacity) || 4)
      : (Number(state.kyc?.submission?.car_seat_capacity || 4));

    const typeIcons = { bike: '🛵', car: '🚗', auto: '🛺' };
    const typeNames = { bike: 'Bike', car: `Car (${activeCarCap} Seats)`, auto: 'Auto (3 Seats)' };
    const typeLockLabels = {
      bike: 'Bike Verified (1 Pillion)',
      car: `Car Verified (${activeCarCap} Seats)`,
      auto: 'Auto Verified (3 Seats)'
    };

    if (iconWrap) {
      iconWrap.textContent = typeIcons[state.driverActiveVehicleType] || '🛵';
      if (state.driverActiveVehicleType === 'car') {
        iconWrap.className = 'w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-black text-lg flex-shrink-0';
      } else if (state.driverActiveVehicleType === 'auto') {
        iconWrap.className = 'w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-black text-lg flex-shrink-0';
      } else {
        iconWrap.className = 'w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-black text-lg flex-shrink-0';
      }
    }

    if (lockBadge) {
      lockBadge.textContent = typeLockLabels[state.driverActiveVehicleType] || 'Mode Verified';
      if (state.driverActiveVehicleType === 'car') {
        lockBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200';
      } else if (state.driverActiveVehicleType === 'auto') {
        lockBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200';
      } else {
        lockBadge.className = 'px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-100 text-blue-800 border border-blue-200';
      }
    }

    if (nameEl) nameEl.textContent = activeVeh?.vehicle_name || typeNames[state.driverActiveVehicleType] || 'Vehicle';
    if (plateEl) plateEl.textContent = activeVeh?.vehicle_number || '--';

    if (switchWrap) {
      if (approvedVehicles.length > 1) {
        switchWrap.innerHTML = `
          <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            ${approvedVehicles.map(v => {
              const isActive = (v.vehicle_type === state.driverActiveVehicleType);
              return `
                <button type="button" onclick="selectDriverActiveVehicleMode('${v.vehicle_type}', '${v.id}')"
                  class="px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    isActive ? 'bg-white text-blue-700 shadow-xs font-black' : 'text-slate-600 hover:text-slate-900'
                  }">
                  <span>${typeIcons[v.vehicle_type] || '🛵'}</span>
                  <span class="capitalize">${v.vehicle_type}</span>
                </button>
              `;
            }).join('')}
          </div>
        `;
      } else {
        const lockedTypes = ['bike', 'car', 'auto'].filter(t => !approvedTypes.includes(t));
        switchWrap.innerHTML = `
          <div class="flex items-center gap-1.5">
            <span class="text-[10px] text-slate-500 font-semibold hidden sm:inline-block">
              ${lockedTypes.length > 0 ? `(${lockedTypes.join('/')} locked)` : ''}
            </span>
            <button type="button" onclick="openAddVehicleModal()" class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer border border-slate-200 active:scale-95">
              <i data-lucide="plus" class="w-3 h-3"></i>
              <span>Add Vehicle</span>
            </button>
          </div>
        `;
      }
    }

    if (window.lucide) lucide.createIcons();
  }
  window.renderDriverActiveVehicleCard = renderDriverActiveVehicleCard;

  window.selectDriverActiveVehicleMode = async function (vType, vehicleId) {
    if (!state.approvedVehicleTypes.includes(vType)) {
      showToast(`Cannot switch to ${vType}. Approved documents required in KYC.`, 'warning');
      return;
    }
    if (state.activeDriverTrips && state.activeDriverTrips.length > 0) {
      showToast('Cannot switch vehicle mode while on an active trip. Complete current ride first.', 'warning');
      return;
    }
    state.driverActiveVehicleType = vType;
    if (vehicleId && vehicleId !== 'primary') {
      try {
        if (window.db?.kyc?.switchDriverVehicle && state.currentUser) {
          await window.db.kyc.switchDriverVehicle(state.currentUser.id, vehicleId);
        }
      } catch (e) {
        console.warn('Switch driver vehicle notice:', e);
      }
    }
    renderDriverActiveVehicleCard();
    startDriverRadar();
    showToast(`Switched active driving mode to ${vType.toUpperCase()}`, 'success');
  };

  window.renderProfileVehicles = async function () {
    const container = document.getElementById('profileVehicleListContainer');
    if (!container) return;

    const user = state.currentUser;
    if (!user) {
      container.innerHTML = `
        <div class="p-3 text-center text-xs text-slate-400">
          Sign in to view and manage registered vehicles.
        </div>
      `;
      return;
    }

    let vehicles = state.kyc?.submission?.vehicles || [];
    if (vehicles.length === 0 && window.db?.kyc?.getDriverKyc) {
      try {
        const kycRes = await window.db.kyc.getDriverKyc(user.id, user.email);
        if (kycRes?.submission?.vehicles) {
          vehicles = kycRes.submission.vehicles;
          if (state.kyc) {
            state.kyc.submission = kycRes.submission;
            state.kyc.status = kycRes.status;
          }
        }
      } catch (e) {
        console.warn('Error fetching driver vehicles:', e);
      }
    }

    if (vehicles.length === 0) {
      const isApproved = state.kyc?.status === 'approved';
      container.innerHTML = `
        <div class="p-4 rounded-xl border border-dashed border-slate-200 bg-white text-center space-y-2">
          <div class="w-8 h-8 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
            <i data-lucide="car" class="w-4 h-4"></i>
          </div>
          <div>
            <p class="text-xs font-bold text-slate-700">No vehicles registered yet</p>
            <p class="text-[10px] text-slate-400 max-w-xs mx-auto mt-0.5">
              ${isApproved 
                ? 'Add your vehicle details and RC to offer rides on Bike, Car, or Auto.' 
                : 'Complete your Driver KYC to get verified and register your driving vehicles.'}
            </p>
          </div>
          ${isApproved ? `
            <button type="button" onclick="openAddVehicleModal()" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-600 text-white font-bold text-[11px] shadow hover:bg-blue-700 transition cursor-pointer active:scale-95">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Vehicle</span>
            </button>
          ` : `
            <button type="button" onclick="openDriverKycModal()" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 text-white font-bold text-[11px] shadow hover:bg-black transition cursor-pointer active:scale-95">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
              <span>Complete Driver KYC</span>
            </button>
          `}
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = vehicles.map(v => {
      const isApproved = v.status === 'approved';
      const isPending = v.status === 'pending';
      const isRejected = v.status === 'rejected';
      const isActive = !!v.is_default;
      const vehIcon = v.vehicle_type === 'car' ? '🚗' : (v.vehicle_type === 'auto' ? '🛺' : '🛵');
      const categoryLabel = v.vehicle_type === 'car' ? `Car (${v.car_seat_capacity || 4} Seats)` : (v.vehicle_type === 'auto' ? 'Auto (3 Seats)' : 'Bike (1 Seat)');

      return `
        <div class="p-3 rounded-2xl bg-white border ${isActive ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200'} space-y-2 transition">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-xl ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'} flex items-center justify-center text-lg flex-shrink-0">
                ${vehIcon}
              </div>
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h5 class="text-xs font-black text-slate-900">${v.vehicle_name || categoryLabel}</h5>
                  <span class="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">${categoryLabel}</span>
                  ${v.vehicle_color ? `
                    <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      ${v.vehicle_color}
                    </span>
                  ` : ''}
                  ${isActive ? `
                    <span class="inline-flex items-center gap-0.5 text-[9px] font-black uppercase text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Active
                    </span>
                  ` : ''}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-mono font-bold text-xs text-slate-800 tracking-wide">${v.vehicle_number}</span>
                  ${v.rc_photo ? `
                    <button type="button" onclick="openImageLightbox('${v.rc_photo}', '${v.vehicle_number} RC Document')" class="text-[10px] text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer">
                      View RC
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>

            <div>
              ${isApproved ? `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Approved ✓
                </span>
              ` : isPending ? `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                  Pending Review
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                  Rejected ✕
                </span>
              `}
            </div>
          </div>

          ${isRejected && v.rejection_reason ? `
            <div class="p-2 rounded-lg bg-rose-50 text-rose-700 text-[11px] font-medium border border-rose-100">
              Note: ${v.rejection_reason}
            </div>
          ` : ''}

          ${isApproved && !isActive ? `
            <div class="pt-1.5 border-t border-slate-100 flex items-center justify-end">
              <button type="button" onclick="handleSwitchActiveVehicle('${v.id}')" class="px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer flex items-center gap-1 active:scale-95">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Set as Active Driving Vehicle</span>
              </button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  };

  // -------------------------------------------------------------------------
  // SUPER ADMIN DASHBOARD ENGINE (shanthankolupula123@gmail.com)
  async function loadAdminKycSubmissions(showToastMsg = false) {
    const user = state.currentUser;
    if (!isAuthorizedSuperAdmin(user)) return;
    const adminEmail = 'shanthankolupula123@gmail.com';

    if (showToastMsg) showToast('Refreshing driver submissions...', 'info');

    try {
      let subs = [];
      if (window.db?.kyc?.getAllKycSubmissions) {
        subs = await window.db.kyc.getAllKycSubmissions(adminEmail);
      }

      state.admin.submissions = subs || [];

      // Compute statistics
      let pendingCount = 0;
      let approvedCount = 0;
      let rejectedCount = 0;

      subs.forEach(s => {
        const hasPendingVeh = s.vehicles && s.vehicles.some(v => v.status === 'pending');
        if (s.status === 'approved' && !hasPendingVeh) approvedCount++;
        else if (s.status === 'rejected' && !hasPendingVeh) rejectedCount++;
        else pendingCount++;
      });

      const mPending = document.getElementById('adminMetricPending');
      const mApproved = document.getElementById('adminMetricApproved');
      const mRejected = document.getElementById('adminMetricRejected');
      const badgeFilter = document.getElementById('adminBadgeFilterPending');
      const headerBadge = document.getElementById('headerAdminBadge');

      if (mPending) mPending.textContent = pendingCount;
      if (mApproved) mApproved.textContent = approvedCount;
      if (mRejected) mRejected.textContent = rejectedCount;
      if (badgeFilter) badgeFilter.textContent = pendingCount;

      if (headerBadge) {
        headerBadge.classList.toggle('hidden', pendingCount === 0);
      }

      renderAdminKycSubmissions();
      if (showToastMsg) showToast(`Loaded ${subs.length} driver submissions.`, 'success');
    } catch (err) {
      console.error('Failed to load admin submissions:', err);
      if (showToastMsg) showToast('Error loading submissions: ' + err.message, 'danger');
    }
  }
  window.loadAdminKycSubmissions = loadAdminKycSubmissions;

  window.setAdminKycFilter = function (filter) {
    state.admin.activeFilter = filter;
    const filters = ['pending', 'approved', 'rejected', 'all'];
    filters.forEach(f => {
      const btn = document.getElementById(`adminFilterBtn-${f}`);
      if (!btn) return;
      if (f === filter) {
        btn.className = 'flex-1 py-1.5 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center';
      } else {
        btn.className = 'flex-1 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer text-center';
      }
    });
    renderAdminKycSubmissions();
  };

  function renderAdminKycSubmissions() {
    const container = document.getElementById('adminKycListContainer');
    if (!container) return;

    const filter = state.admin.activeFilter;
    const all = state.admin.submissions || [];
    const filtered = all.filter(s => {
      if (filter === 'all') return true;
      if (filter === 'pending') {
        return s.status === 'pending' || !s.status || (s.vehicles && s.vehicles.some(v => v.status === 'pending'));
      }
      return s.status === filter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="routemate-card p-8 text-center bg-white">
          <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
            <i data-lucide="inbox" class="w-6 h-6"></i>
          </div>
          <h4 class="text-xs font-bold text-slate-700">No submissions found</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">There are no drivers in the '${filter}' category.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(sub => {
      const isSuspended = sub.status === 'suspended';
      const isApproved = sub.status === 'approved';
      const isRejected = sub.status === 'rejected';
      const isPending = !isApproved && !isRejected && !isSuspended;

      const dlFront = sub.dl_front_photo || sub.dlFrontPhoto || '';
      const dlBack = sub.dl_back_photo || sub.dlBackPhoto || '';
      const aadhaarFront = sub.aadhaar_front_photo || sub.aadhaarFrontPhoto || '';
      const aadhaarBack = sub.aadhaar_back_photo || sub.aadhaarBackPhoto || '';
      const rcPhoto = sub.rc_photo || sub.rcPhoto || '';
      const driverPhoto = sub.driver_photo || sub.driverPhoto || '';
      const vehName = sub.vehicle_name || sub.vehicleName || '';
      const vehColor = sub.vehicle_color || sub.vehicleColor || '';
      const vehNumber = sub.vehicle_number || sub.vehicleNumber || 'N/A';
      const vehType = sub.vehicle_type || sub.vehicleType || 'bike';

      let statusBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          Pending Approval
        </span>
      `;
      if (isSuspended) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-sm">
            🔴 Suspended
          </span>
        `;
      } else if (isApproved) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            Approved ✓
          </span>
        `;
      } else if (isRejected) {
        statusBadge = `
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
            Rejected ✕
          </span>
        `;
      }

      const formattedAadhaar = sub.aadhaar_number ? sub.aadhaar_number.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : 'Not entered';

      return `
        <div class="routemate-card p-5 bg-white border border-slate-200/90 shadow-sm space-y-4">
          <!-- Driver Profile Header -->
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 cursor-pointer" onclick="openImageLightbox('${driverPhoto}', '${sub.driver_name || 'Driver'} Selfie')">
                ${driverPhoto ? `<img src="${driverPhoto}" alt="Selfie" class="w-full h-full object-cover" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[9px] text-slate-400\\'>Photo</div>';" />` : `<div class="w-full h-full flex items-center justify-center text-xs font-bold text-slate-400">Photo</div>`}
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900">${sub.driver_name || 'Driver'}</h3>
                <p class="text-xs text-slate-500 font-mono">${sub.driver_phone || ''}</p>
                <p class="text-[11px] text-slate-400 truncate max-w-[180px]">${sub.driver_email || ''}</p>
              </div>
            </div>
            <div>${statusBadge}</div>
          </div>

          <!-- Document Numbers Grid -->
          <div class="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs font-mono">
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Driving License</span>
              <span class="font-bold text-slate-900 text-xs">${sub.dl_number || sub.dlNumber || 'N/A'}</span>
            </div>
            <div>
              <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Vehicle Number</span>
              <span class="font-bold text-slate-900 text-xs">${vehNumber}</span>
            </div>
            <div class="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Vehicle Details</span>
                <span class="font-bold text-slate-900 text-xs">${vehName || 'Vehicle'}${vehColor ? ` • <span class="text-blue-600 font-semibold">${vehColor}</span>` : ''}</span>
              </div>
              <span class="text-[10px] font-sans font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">${vehType}</span>
            </div>
            <div class="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Vehicle Chassis Number</span>
                <span class="font-bold text-slate-900 text-xs font-mono">${sub.vehicle_chassis || sub.chassis_number || (sub.vehicles && sub.vehicles[0]?.chassis_number) || 'N/A'}</span>
              </div>
            </div>
            <div class="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Aadhaar ID</span>
                <span class="font-bold text-slate-900 text-xs">${formattedAadhaar}</span>
              </div>
            </div>
            <div class="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Direct P2P UPI ID</span>
                <span class="font-bold text-slate-900 text-xs font-mono">${sub.upi_id || sub.upiId || 'Not Configured'}</span>
              </div>
              <div class="text-right">
                <span class="text-[10px] text-slate-400 uppercase font-sans font-bold block">Driver Wallet</span>
                <span class="font-bold text-xs ${Number(sub.wallet_balance !== undefined ? sub.wallet_balance : 100) < 0 ? 'text-rose-600' : 'text-emerald-700'}">
                  ₹${Number(sub.wallet_balance !== undefined ? sub.wallet_balance : 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <!-- Document Photos Gallery (Clickable Lightbox) -->
          <div>
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1.5">Submitted Document Photos (Tap to Inspect)</span>
            <div class="grid grid-cols-5 gap-1.5">
              <!-- DL Front -->
              <div class="relative group aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer" onclick="openImageLightbox('${dlFront}', 'Driving License Front - ${sub.driver_name}')" title="DL Front">
                ${dlFront ? `<img src="${dlFront}" alt="DL Front" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[9px] text-slate-400\\'>DL Front</div>';" />` : `<div class="w-full h-full flex items-center justify-center text-[9px] text-slate-400">DL Front</div>`}
                <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[8px] font-bold text-center py-0.5">DL Front</span>
              </div>

              <!-- DL Back -->
              <div class="relative group aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer" onclick="openImageLightbox('${dlBack}', 'Driving License Back - ${sub.driver_name}')" title="DL Back">
                ${dlBack ? `<img src="${dlBack}" alt="DL Back" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[9px] text-slate-400\\'>DL Back</div>';" />` : `<div class="w-full h-full flex items-center justify-center text-[9px] text-slate-400">DL Back</div>`}
                <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[8px] font-bold text-center py-0.5">DL Back</span>
              </div>

              <!-- Aadhaar Front -->
              <div class="relative group aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer" onclick="openImageLightbox('${aadhaarFront}', 'Aadhaar Front - ${sub.driver_name}')" title="Aadhaar Front">
                ${aadhaarFront ? `<img src="${aadhaarFront}" alt="Aadhaar Front" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[9px] text-slate-400\\'>Aadhaar F</div>';" />` : `<div class="w-full h-full flex items-center justify-center text-[9px] text-slate-400">Aadhaar F</div>`}
                <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[8px] font-bold text-center py-0.5">Aadhaar F</span>
              </div>

              <!-- Aadhaar Back -->
              <div class="relative group aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer" onclick="openImageLightbox('${aadhaarBack}', 'Aadhaar Back - ${sub.driver_name}')" title="Aadhaar Back">
                ${aadhaarBack ? `<img src="${aadhaarBack}" alt="Aadhaar Back" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[9px] text-slate-400\\'>Aadhaar B</div>';" />` : `<div class="w-full h-full flex items-center justify-center text-[9px] text-slate-400">Aadhaar B</div>`}
                <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[8px] font-bold text-center py-0.5">Aadhaar B</span>
              </div>

              <!-- Vehicle RC -->
              <div class="relative group aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer" onclick="openImageLightbox('${rcPhoto}', 'Vehicle RC - ${sub.driver_name}')" title="RC Document">
                ${rcPhoto ? `<img src="${rcPhoto}" alt="RC Photo" class="w-full h-full object-cover group-hover:scale-105 transition" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-[9px] text-slate-400\\'>RC Doc</div>';" />` : `<div class="w-full h-full flex items-center justify-center text-[9px] text-slate-400">RC Photo</div>`}
                <span class="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[8px] font-bold text-center py-0.5">RC Doc</span>
              </div>
            </div>
          </div>

          <!-- Registered Vehicles (Multi-Vehicle Management & Review) -->
          ${(sub.vehicles && sub.vehicles.length > 0) ? `
            <div class="pt-3 border-t border-slate-100">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Registered Vehicles (${sub.vehicles.length})</span>
              </div>
              <div class="space-y-2">
                ${sub.vehicles.map(v => {
                  const isVehApproved = v.status === 'approved';
                  const isVehRejected = v.status === 'rejected';
                  const isVehPending = !isVehApproved && !isVehRejected;
                  const vehIcon = v.vehicle_type === 'car' ? '🚗' : (v.vehicle_type === 'auto' ? '🛺' : '🛵');
                  const categoryName = v.vehicle_type === 'car' ? 'Car Seat' : (v.vehicle_type === 'auto' ? 'Auto' : 'Bike');
                  
                  return `
                    <div class="p-3 rounded-xl border ${isVehPending ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-slate-50'} flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div class="flex items-center gap-2.5">
                        <span class="text-xl">${vehIcon}</span>
                        <div>
                          <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-black text-slate-900">${v.vehicle_name || categoryName}</span>
                            ${v.vehicle_color ? `<span class="px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-700 text-[9px] border border-blue-200">${v.vehicle_color}</span>` : ''}
                            <span class="px-1.5 py-0.5 rounded font-mono font-bold bg-white border border-slate-200 text-slate-800 text-[10px] tracking-wide">${v.vehicle_number}</span>
                            ${v.is_default ? `<span class="text-[9px] font-black text-blue-700 bg-blue-100 px-2 py-0.2 rounded-full">Primary</span>` : ''}
                          </div>
                          <div class="flex items-center gap-2.5 mt-1">
                            ${isVehApproved ? `<span class="text-[10px] font-bold text-emerald-700">✓ Approved</span>` :
                              isVehRejected ? `<span class="text-[10px] font-bold text-rose-600">✕ Rejected</span>` :
                              `<span class="text-[10px] font-bold text-amber-700 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>Pending Admin Review</span>`}
                            ${v.rc_photo ? `
                              <button type="button" onclick="openImageLightbox('${v.rc_photo}', 'Vehicle RC - ${v.vehicle_number} (${sub.driver_name})')" class="text-[10px] text-blue-600 font-bold underline hover:text-blue-800 cursor-pointer">
                                View RC Document
                              </button>
                            ` : ''}
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5 self-end sm:self-center">
                        ${isVehPending ? `
                          <button type="button" onclick="handleAdminVehicleDecision('${sub.id || sub.user_id}', '${v.id}', 'rejected')" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-bold text-[10px] transition cursor-pointer">
                            Reject RC
                          </button>
                          <button type="button" onclick="handleAdminVehicleDecision('${sub.id || sub.user_id}', '${v.id}', 'approved')" class="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[10px] transition cursor-pointer shadow-sm">
                            Approve Vehicle
                          </button>
                        ` : isVehApproved ? `
                          <button type="button" onclick="handleAdminVehicleDecision('${sub.id || sub.user_id}', '${v.id}', 'rejected')" class="px-2 py-0.5 rounded-lg text-slate-500 hover:text-rose-600 text-[10px] font-semibold transition cursor-pointer">
                            Revoke
                          </button>
                        ` : `
                          <button type="button" onclick="handleAdminVehicleDecision('${sub.id || sub.user_id}', '${v.id}', 'approved')" class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold text-[10px] transition cursor-pointer">
                            Re-Approve
                          </button>
                        `}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Rejection Reason if any -->
          ${sub.rejection_reason ? `
            <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              Rejection Note: ${sub.rejection_reason}
            </div>
          ` : ''}

          <!-- Admin Action Buttons -->
          <div class="flex items-center gap-2 pt-2 border-t border-slate-100">
            ${isApproved ? `
              <button type="button" onclick="handleAdminKycDecision('${sub.id || sub.user_id}', 'rejected')" class="flex-1 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition border border-rose-200 cursor-pointer flex items-center justify-center gap-1.5">
                <i data-lucide="x-circle" class="w-4 h-4"></i>
                <span>Revoke / Reject</span>
              </button>
            ` : isRejected ? `
              <button type="button" onclick="handleAdminKycDecision('${sub.id || sub.user_id}', 'approved')" class="flex-1 py-2.5 btn-pill-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                <span>Re-Approve Driver</span>
              </button>
            ` : `
              <button type="button" onclick="handleAdminKycDecision('${sub.id || sub.user_id}', 'rejected')" class="w-1/3 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                <span>Reject</span>
              </button>
              <button type="button" onclick="handleAdminKycDecision('${sub.id || sub.user_id}', 'approved')" class="flex-1 py-2.5 btn-pill-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md">
                <i data-lucide="check-circle" class="w-4 h-4 text-cyan-200"></i>
                <span>Approve & Verify Driver</span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  window.handleAdminKycDecision = async function (targetId, newStatus) {
    const user = state.currentUser;
    if (!isAuthorizedSuperAdmin(user)) {
      showToast('Unauthorized: Super Admin access required.', 'danger');
      return;
    }
    const adminEmail = 'shanthankolupula123@gmail.com';

    let reason = '';
    if (newStatus === 'rejected') {
      reason = prompt('Please specify rejection reason for the driver (e.g. Blurry DL photo, Invalid Aadhaar):');
      if (reason === null) return; // Cancelled
      reason = reason.trim() || 'Uploaded documents were invalid or unreadable.';
    }

    try {
      showToast(`Processing decision: ${newStatus.toUpperCase()}...`, 'info');

      if (window.db?.kyc?.reviewDriverKyc) {
        await window.db.kyc.reviewDriverKyc({
          id: targetId,
          userId: targetId,
          status: newStatus,
          rejectionReason: reason,
          adminEmail: adminEmail
        });
      }

      showToast(`Driver successfully ${newStatus}!`, 'success');
      await loadAdminKycSubmissions();
    } catch (err) {
      console.error('Admin decision error:', err);
      showToast('Failed to update driver status: ' + err.message, 'danger');
    }
  };

  window.handleAdminVehicleDecision = async function (userId, vehicleId, newStatus) {
    const user = state.currentUser;
    if (!isAuthorizedSuperAdmin(user)) {
      showToast('Unauthorized: Super Admin access required.', 'danger');
      return;
    }
    const adminEmail = 'shanthankolupula123@gmail.com';

    let rejectionReason = null;
    if (newStatus === 'rejected') {
      rejectionReason = prompt('Please specify rejection reason for this vehicle RC (e.g. Blurry RC photo, Invalid number plate):');
      if (rejectionReason === null) return; // Cancelled
      rejectionReason = rejectionReason.trim() || 'Uploaded vehicle RC was invalid or unreadable.';
    }

    try {
      showToast(`Processing vehicle decision: ${newStatus.toUpperCase()}...`, 'info');

      if (window.db?.kyc?.reviewDriverVehicle) {
        await window.db.kyc.reviewDriverVehicle({
          adminEmail: adminEmail,
          userId,
          vehicleId,
          status: newStatus,
          rejectionReason
        });
      }

      showToast(`Vehicle status updated to ${newStatus}!`, 'success');
      await loadAdminKycSubmissions();
    } catch (err) {
      console.error('Admin vehicle decision error:', err);
      showToast('Failed to update vehicle status: ' + err.message, 'danger');
    }
  };

  // =========================================================================
  // DRIVER IN-APP WALLET, DYNAMIC COMMISSION & DIRECT P2P UPI MANAGEMENT
  // =========================================================================

  function updateWalletDisplays() {
    const balEl = document.getElementById('driverWalletBalanceDisplay');
    const negAlert = document.getElementById('driverWalletNegativeAlert');
    const rechargeBal = document.getElementById('rechargeModalCurrentBalance');
    const profileUpi = document.getElementById('profileDriverUpiDisplay');
    const bonusBadge = document.getElementById('driverWalletBonusBadge');

    const bal = Number(state.wallet?.balance !== undefined ? state.wallet.balance : 100);

    if (balEl) {
      balEl.textContent = (bal < 0 ? `-₹${Math.abs(bal).toFixed(2)}` : `₹${bal.toFixed(2)}`);
      balEl.className = bal < 0 ? 'text-lg font-black text-rose-400' : 'text-lg font-black text-white';
    }

    if (rechargeBal) {
      rechargeBal.textContent = (bal < 0 ? `-₹${Math.abs(bal).toFixed(2)}` : `₹${bal.toFixed(2)}`);
      rechargeBal.className = bal < 0 ? 'text-xl font-black text-rose-600' : 'text-xl font-black text-slate-900';
    }

    if (negAlert) {
      if (bal < 0) negAlert.classList.remove('hidden');
      else negAlert.classList.add('hidden');
    }

    if (typeof renderAllUpiDisplays === 'function') {
      renderAllUpiDisplays();
    }

    if (bonusBadge) {
      if (bal >= 100) {
        bonusBadge.classList.remove('hidden');
      } else {
        bonusBadge.classList.add('hidden');
      }
    }

    renderDriverWalletTransactions();
  }
  window.updateWalletDisplays = updateWalletDisplays;

  function renderDriverWalletTransactions() {
    const drawer = document.getElementById('driverWalletHistoryDrawer');
    if (!drawer) return;
    const txs = state.wallet?.transactions || [];
    if (txs.length === 0) {
      drawer.innerHTML = `<div class="text-[10px] text-slate-400 text-center py-1">No transaction history yet.</div>`;
      return;
    }
    drawer.innerHTML = txs.slice(-8).reverse().map(tx => {
      const isCredit = tx.type === 'credit';
      const sign = isCredit ? '+' : '-';
      const color = isCredit ? 'text-emerald-400' : 'text-rose-400';
      const timeStr = tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent';
      return `
        <div class="flex items-center justify-between text-[10px] py-1 border-b border-white/5">
          <div class="truncate max-w-[190px]">
            <span class="font-bold text-slate-200 block truncate">${tx.description || tx.reason || 'Transaction'}</span>
            <span class="text-slate-400 text-[9px]">${timeStr}</span>
          </div>
          <span class="font-mono font-bold ${color}">${sign}₹${Math.abs(Number(tx.amount || 0)).toFixed(2)}</span>
        </div>
      `;
    }).join('');
  }
  window.renderDriverWalletTransactions = renderDriverWalletTransactions;

  window.toggleDriverWalletHistory = function () {
    const drawer = document.getElementById('driverWalletHistoryDrawer');
    if (drawer) {
      drawer.classList.toggle('hidden');
    }
  };

  let selectedRechargeAmount = 100;

  window.openDriverWalletRechargeModal = function (recommendedAmt) {
    const modal = document.getElementById('driverWalletRechargeModal');
    if (!modal) return;
    const amt = recommendedAmt && recommendedAmt > 0 ? recommendedAmt : 100;
    selectRechargeAmount(amt);
    updateWalletDisplays();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeDriverWalletRechargeModal = function () {
    const modal = document.getElementById('driverWalletRechargeModal');
    if (modal) modal.classList.add('hidden');
  };

  window.selectRechargeAmount = function (amt) {
    selectedRechargeAmount = Number(amt) || 100;
    const amounts = [50, 100, 200, 500];
    amounts.forEach(a => {
      const btn = document.getElementById(`rechargeAmt-${a}`);
      if (!btn) return;
      if (a === selectedRechargeAmount) {
        btn.className = 'py-2 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-700 text-xs font-black transition cursor-pointer';
      } else {
        btn.className = 'py-2 rounded-xl border border-slate-200 text-xs font-bold hover:border-blue-500 transition cursor-pointer';
      }
    });

    const customInput = document.getElementById('inputCustomRechargeAmount');
    if (customInput) customInput.value = '';

    const btnText = document.getElementById('btnExecuteWalletRechargeText');
    if (btnText) btnText.textContent = `Pay & Recharge ₹${selectedRechargeAmount}`;
  };

  window.handleExecuteWalletRecharge = async function () {
    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to recharge wallet.', 'warning');
      return;
    }

    const customInput = document.getElementById('inputCustomRechargeAmount');
    const customAmt = customInput && customInput.value ? parseFloat(customInput.value) : null;
    const finalAmount = (customAmt && customAmt >= 10) ? customAmt : selectedRechargeAmount;

    if (!finalAmount || finalAmount < 10) {
      showToast('Minimum recharge amount is ₹10.', 'warning');
      return;
    }

    const btn = document.getElementById('btnExecuteWalletRecharge');
    const btnText = document.getElementById('btnExecuteWalletRechargeText');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = `Opening Razorpay Gateway...`;

    try {
      showToast(`Launching secure Razorpay checkout for ₹${finalAmount}...`, 'info');

      if (!window.routematePayment?.initiateWalletRecharge) {
        throw new Error('Payment gateway SDK not ready. Please refresh the page.');
      }

      await window.routematePayment.initiateWalletRecharge(
        {
          amount: finalAmount,
          user: {
            ...user,
            wallet_balance: typeof state.wallet.balance === 'number' ? state.wallet.balance : 0
          }
        },
        function onRechargeSuccess(result) {
          const newBal = result?.creditResult?.newBalance !== undefined 
            ? Number(result.creditResult.newBalance)
            : (state.wallet.balance || 0) + finalAmount;

          state.wallet.balance = newBal;
          if (result?.creditResult?.wallet_transactions) {
            state.wallet.transactions = result.creditResult.wallet_transactions;
          }

          updateWalletDisplays();
          closeDriverWalletRechargeModal();
          showToast(`🎉 ₹${finalAmount} added to wallet successfully! Balance: ₹${state.wallet.balance.toFixed(2)} (Payment ID: ${result.paymentId})`, 'success');

          if (typeof pushUserNotification === 'function') {
            pushUserNotification({
              id: 'notif_recharge_' + (result.paymentId || Date.now()),
              type: 'wallet',
              title: `💰 Wallet Recharged (+₹${finalAmount})`,
              message: `Successfully credited ₹${finalAmount} to your wallet. New balance: ₹${state.wallet.balance.toFixed(2)}.`,
              timestamp: new Date().toISOString(),
              icon: 'wallet',
              iconBg: 'bg-emerald-100 text-emerald-800',
              action: { label: 'View Wallet', tab: 'drive' }
            });
          }

          if (btn) btn.disabled = false;
          if (btnText) btnText.textContent = `Pay & Recharge ₹${selectedRechargeAmount}`;
        },
        function onRechargeFailure(err) {
          if (btn) btn.disabled = false;
          if (btnText) btnText.textContent = `Pay & Recharge ₹${selectedRechargeAmount}`;
          if (err && err.message && !err.message.includes('cancelled')) {
            showToast('Recharge failed: ' + err.message, 'danger');
          }
        }
      );
    } catch (err) {
      console.error('Wallet recharge error:', err);
      showToast('Failed to open payment gateway: ' + err.message, 'danger');
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = `Pay & Recharge ₹${selectedRechargeAmount}`;
    }
  };

  window.openUpdateUpiModal = function () {
    const modal = document.getElementById('updateUpiModal');
    const input = document.getElementById('inputUpdateUpiId');
    const resolved = (typeof getResolvedUserUpiId === 'function') ? getResolvedUserUpiId() : (state.driverUpi.upiId || state.kyc?.submission?.upi_id || '');
    if (input) input.value = resolved || '';
    if (modal) modal.classList.remove('hidden');
    if (window.lucide && typeof lucide.createIcons === 'function') {
      try { lucide.createIcons(); } catch (e) {}
    }
  };

  window.closeUpdateUpiModal = function () {
    const modal = document.getElementById('updateUpiModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleUpdateUpiSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const user = state.currentUser;
    if (!user) {
      showToast('Please sign in to update UPI ID.', 'warning');
      return;
    }

    const input = document.getElementById('inputUpdateUpiId');
    const upiId = (input?.value || '').trim();

    if (!upiId || !upiId.includes('@')) {
      showToast('Please enter a valid UPI ID (must contain @, e.g. mobile@upi).', 'warning');
      return;
    }

    const btn = document.getElementById('btnSaveUpiSubmit');
    if (btn) btn.disabled = true;

    try {
      showToast('Updating personal UPI ID across profiles & drivers...', 'info');

      if (window.db?.kyc?.updateDriverUpi) {
        await window.db.kyc.updateDriverUpi(user.id, upiId);
      }

      state.driverUpi.upiId = upiId;
      state.driverUpi.vpa = upiId;
      state.driverUpi.upiQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name || 'Driver')}&cu=INR`)}`;

      if (state.currentUser) {
        state.currentUser.upi_id = upiId;
        state.currentUser.vpa = upiId;
        state.currentUser.upiId = upiId;
        try { localStorage.setItem('routemate_user', JSON.stringify(state.currentUser)); } catch (e) {}
      }

      if (state.kyc?.submission) {
        state.kyc.submission.upi_id = upiId;
        state.kyc.submission.vpa = upiId;
        state.kyc.submission.upi_qr = state.driverUpi.upiQr;
        try { localStorage.setItem('routemate_driver_kyc', JSON.stringify(state.kyc.submission)); } catch (e) {}
      }

      try {
        localStorage.setItem('routemate_driver_upi', JSON.stringify({
          upiId: upiId,
          vpa: upiId,
          upi_id: upiId,
          upiQr: state.driverUpi.upiQr
        }));
      } catch (e) {}

      renderAllUpiDisplays();
      updateProfileUI();
      updateWalletDisplays();
      closeUpdateUpiModal();
      showToast(`✅ UPI ID updated to ${upiId}! 100% of rider payments will route directly to your account.`, 'success');
    } catch (err) {
      console.error('Update UPI ID error:', err);
      showToast('Failed to update UPI ID: ' + err.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // =========================================================================
  // RIDER POST-RIDE DIRECT P2P PAYMENT & SAFETY RATING ENGINE
  // =========================================================================

  window.showRidePaymentAndRatingModal = function (ride) {
    if (!ride) return;
    state.ratingState.activeRide = ride;
    state.ratingState.selectedStars = 5;
    state.ratingState.selectedTags = new Set(['Smooth & Safe Ride', 'Polite Driver']);
    state.ratingState.chosenPaymentMethod = ride.chosenPaymentMethod || 'upi';

    const modal = document.getElementById('riderPaymentAndRatingModal');
    if (!modal) return;

    const fare = ride.fare || 110;
    const driverName = ride.driver?.name || ride.driverName || 'Verified Driver';
    const driverVehicle = `${ride.driver?.vehicleNumber || 'TG 08 AB 1234'} • ${ride.driver?.vehicleName || ride.vehicleType || 'Corridor Commute'}`;

    // Resolve active driver's actual registered UPI VPA dynamically from database / ride records
    let upiId = ride.driver?.upiId || ride.driver?.upi_id || ride.upiId || ride.upi_id || '';
    let driverQr = ride.driver?.upiQr || ride.driver?.upi_qr || ride.upiQr || ride.upi_qr || null;

    if (!upiId && ride.driver?.phone) {
      const cleanPhone = String(ride.driver.phone).replace(/\D/g, '').slice(-10);
      if (cleanPhone.length === 10) upiId = `${cleanPhone}@upi`;
    }

    if (!upiId) upiId = 'driver@upi';

    // Populate displays
    const fareEl = document.getElementById('paymentModalFareDisplay');
    const cashAmtEl = document.getElementById('paymentModalCashAmount');
    const drvNameEl = document.getElementById('paymentModalDriverName');
    const drvVehEl = document.getElementById('paymentModalDriverVehicle');
    const drvAvatarEl = document.getElementById('paymentModalDriverAvatar');
    const upiTextEl = document.getElementById('paymentModalUpiIdText');
    const upiDeepLinkEl = document.getElementById('btnPayUpiDeepLink');
    const qrImgEl = document.getElementById('paymentModalQrImg');
    const ratingDrvNameEl = document.getElementById('ratingModalDriverName');

    if (fareEl) fareEl.textContent = `₹${fare}`;
    if (cashAmtEl) cashAmtEl.textContent = `₹${fare}`;
    if (drvNameEl) drvNameEl.textContent = driverName;
    if (ratingDrvNameEl) ratingDrvNameEl.textContent = driverName;
    if (drvVehEl) drvVehEl.textContent = driverVehicle;
    if (drvAvatarEl) {
      drvAvatarEl.innerHTML = `<img src="${getInitialsAvatarSvg(driverName, 64, '#10B981')}" alt="${driverName}" class="w-full h-full object-cover" />`;
    }
    if (upiTextEl) upiTextEl.textContent = upiId;

    // Direct UPI Deep Link URL:
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(driverName)}&am=${fare}&cu=INR&tn=${encodeURIComponent('Routemate Fuel Share')}`;
    if (upiDeepLinkEl) upiDeepLinkEl.href = upiUrl;

    // Driver's QR Code or Dynamic UPI QR code
    if (qrImgEl) {
      if (driverQr && (driverQr.startsWith('data:image') || driverQr.startsWith('http'))) {
        qrImgEl.src = driverQr;
      } else {
        qrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUrl)}`;
      }
    }

    // Dynamic database fetch fallback: check Supabase profiles for driver's registered UPI ID
    if (ride.driver?.id && window.db?.getSupabase) {
      const supa = window.db.getSupabase();
      if (supa) {
        supa.from('profiles').select('role,phone').eq('id', ride.driver.id).maybeSingle().then(({ data: pRow }) => {
          if (pRow) {
            let meta = {};
            try {
              meta = typeof pRow.role === 'string' && pRow.role.startsWith('{') ? JSON.parse(pRow.role) : (pRow.role || {});
            } catch (e) {}
            const realUpi = meta.upi_id || (pRow.phone ? `${pRow.phone.replace(/\D/g, '').slice(-10)}@upi` : null);
            const realQr = meta.upi_qr || null;
            if (realUpi && realUpi !== upiId) {
              upiId = realUpi;
              if (upiTextEl) upiTextEl.textContent = upiId;
              const newUpiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(driverName)}&am=${fare}&cu=INR&tn=${encodeURIComponent('Routemate Fuel Share')}`;
              if (upiDeepLinkEl) upiDeepLinkEl.href = newUpiUrl;
              if (qrImgEl) {
                if (realQr && (realQr.startsWith('data:image') || realQr.startsWith('http'))) {
                  qrImgEl.src = realQr;
                } else {
                  qrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(newUpiUrl)}`;
                }
              }
            }
          }
        }).catch(() => {});
      }
    }

    // Step View Selection: If payment was already settled during active trip, jump directly to Rating View
    const stepPay = document.getElementById('paymentModalStepPayment');
    const stepRate = document.getElementById('paymentModalStepRating');
    if (ride.paymentSettled && (ride.status === 'ride_completed' || ride.status === 'completed')) {
      if (stepPay) stepPay.classList.add('hidden');
      if (stepRate) stepRate.classList.remove('hidden');
    } else {
      if (stepPay) stepPay.classList.remove('hidden');
      if (stepRate) stepRate.classList.add('hidden');
    }

    switchPaymentOption(state.ratingState.chosenPaymentMethod);
    selectStarRating(5);

    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeRidePaymentAndRatingModal = function () {
    const modal = document.getElementById('riderPaymentAndRatingModal');
    if (modal) modal.classList.add('hidden');
  };

  window.switchPaymentOption = function (opt) {
    state.ratingState.chosenPaymentMethod = opt;
    const btnUpi = document.getElementById('paymentOptBtn-upi');
    const btnCash = document.getElementById('paymentOptBtn-cash');
    const upiContent = document.getElementById('paymentOptionUpiContent');
    const cashContent = document.getElementById('paymentOptionCashContent');

    if (opt === 'upi') {
      if (btnUpi) btnUpi.className = 'flex-1 py-2 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (btnCash) btnCash.className = 'flex-1 py-2 rounded-xl text-slate-500 hover:text-slate-900 transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (upiContent) upiContent.classList.remove('hidden');
      if (cashContent) cashContent.classList.add('hidden');
    } else {
      if (btnCash) btnCash.className = 'flex-1 py-2 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (btnUpi) btnUpi.className = 'flex-1 py-2 rounded-xl text-slate-500 hover:text-slate-900 transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (cashContent) cashContent.classList.remove('hidden');
      if (upiContent) upiContent.classList.add('hidden');
    }
    if (window.lucide) lucide.createIcons();
  };

  window.copyDriverUpiId = function () {
    const upiText = document.getElementById('paymentModalUpiIdText')?.textContent || '';
    if (!upiText) return;
    navigator.clipboard?.writeText(upiText).then(() => {
      const btn = document.getElementById('btnCopyDriverUpi');
      if (btn) {
        btn.textContent = 'Copied! ✓';
        setTimeout(() => { btn.textContent = 'Copy UPI'; }, 2000);
      }
      showToast('UPI ID copied to clipboard.', 'success');
    }).catch(() => {
      showToast('Failed to copy UPI ID.', 'danger');
    });
  };

  window.proceedToRatingStep = function (method) {
    state.ratingState.chosenPaymentMethod = method || 'upi';

    // If active ride is STILL OPEN (waiting for driver verification & completion):
    if (state.activeRiderRequest && state.activeRiderRequest.status !== 'ride_completed' && state.activeRiderRequest.status !== 'completed') {
      state.activeRiderRequest.paymentSettled = true;
      state.activeRiderRequest.chosenPaymentMethod = method;

      if (window.db?.matching?.notifyDriverPayment) {
        window.db.matching.notifyDriverPayment(state.activeRiderRequest.id, {
          paymentMethod: method,
          settled: true,
          fare: state.activeRiderRequest.fare
        });
      }

      closeRidePaymentAndRatingModal();
      renderRiderActiveHUD(state.activeRiderRequest);
      showToast(`✅ Payment marked settled via ${method.toUpperCase()}! The trip will close once verified by your driver.`, 'success');
      return;
    }

    const stepPay = document.getElementById('paymentModalStepPayment');
    const stepRate = document.getElementById('paymentModalStepRating');
    if (stepPay) stepPay.classList.add('hidden');
    if (stepRate) stepRate.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.selectStarRating = function (stars) {
    state.ratingState.selectedStars = stars;
    for (let i = 1; i <= 5; i++) {
      const btn = document.getElementById(`starBtn-${i}`);
      if (!btn) continue;
      if (i <= stars) {
        btn.className = 'text-2xl text-amber-400 hover:scale-110 transition cursor-pointer';
      } else {
        btn.className = 'text-2xl text-slate-200 hover:scale-110 transition cursor-pointer';
      }
    }

    const label = document.getElementById('starRatingLabel');
    const header = document.getElementById('feedbackTagsHeader');

    const labels = {
      5: '5.0 - Excellent & Safe Ride!',
      4: '4.0 - Good Experience',
      3: '3.0 - Average Ride (Needs Improvement)',
      2: '2.0 - Poor / Safety Concern Raised',
      1: '1.0 - Severe Safety Violation!'
    };
    if (label) {
      label.textContent = labels[stars] || `${stars}.0 Rating`;
      label.className = stars >= 4 ? 'text-center text-xs font-black text-emerald-600' : 'text-center text-xs font-black text-rose-600';
    }

    if (header) {
      header.textContent = stars >= 4 ? 'What went well?' : 'Safety & Ride Concerns (Select all that apply):';
    }

    renderFeedbackTags(stars);
  };

  function renderFeedbackTags(stars) {
    const container = document.getElementById('feedbackTagsContainer');
    if (!container) return;

    const positiveTags = ['Smooth & Safe Ride', 'Polite Driver', 'Clean Vehicle', 'On Time', 'Safe Driving'];
    const safetyTags = ['Rash Driving', 'Over-speeding', 'Rude Behavior', 'Asked for Extra Cash', 'Vehicle in Poor Condition', 'Delayed Pickup'];

    const tagsToShow = stars >= 4 ? positiveTags : safetyTags;
    if (stars >= 4 && state.ratingState.selectedTags.size === 0) {
      state.ratingState.selectedTags = new Set(['Smooth & Safe Ride', 'Polite Driver']);
    } else if (stars <= 3 && state.ratingState.selectedTags.has('Smooth & Safe Ride')) {
      state.ratingState.selectedTags = new Set(['Rash Driving']);
    }

    container.innerHTML = tagsToShow.map(tag => {
      const isSelected = state.ratingState.selectedTags.has(tag);
      const isSafetyIssue = safetyTags.includes(tag);
      const activeClass = isSafetyIssue
        ? 'bg-rose-100 text-rose-800 border-rose-300 font-black'
        : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-black';
      const inactiveClass = 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200';

      return `
        <button type="button" onclick="toggleFeedbackTag('${tag.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-full text-[11px] border transition cursor-pointer active:scale-95 ${isSelected ? activeClass : inactiveClass}">
          ${isSelected ? '✓ ' : ''}${tag}
        </button>
      `;
    }).join('');
  }

  window.toggleFeedbackTag = function (tag) {
    if (state.ratingState.selectedTags.has(tag)) {
      state.ratingState.selectedTags.delete(tag);
    } else {
      state.ratingState.selectedTags.add(tag);
    }
    renderFeedbackTags(state.ratingState.selectedStars);
  };

  window.handleSubmitRideFeedback = async function () {
    const user = state.currentUser;
    const activeRide = state.ratingState.activeRide;
    const stars = state.ratingState.selectedStars;
    const tags = Array.from(state.ratingState.selectedTags);
    const comment = document.getElementById('feedbackCommentInput')?.value.trim() || '';

    const btn = document.getElementById('btnSubmitRideFeedback');
    if (btn) btn.disabled = true;

    try {
      showToast('Submitting rating and feedback...', 'info');

      if (window.db?.feedbacks?.submitFeedback) {
        const targetDrvId = activeRide?.driver?.id || activeRide?.driver_id || activeRide?.driverId || 'drv_unknown';
        const targetDrvName = activeRide?.driver?.name || activeRide?.driverName || 'Verified Driver';

        const fbResp = await window.db.feedbacks.submitFeedback({
          rideId: activeRide?.id || ('RIDE-' + Date.now()),
          passengerName: user?.name || 'Verified Commuter',
          passengerPhone: user?.phone || '',
          reviewerId: user?.id || '',
          reviewerRole: 'rider',
          driverId: targetDrvId,
          driverName: targetDrvName,
          targetUserId: targetDrvId,
          targetUserRole: 'driver',
          rating: stars,
          safetyRating: stars >= 4 ? 5 : 2,
          cleanlinessRating: stars >= 4 ? 5 : 3,
          punctualityRating: stars >= 4 ? 5 : 3,
          feedbackText: comment,
          safetyTags: stars <= 3 ? tags : [],
          compliments: stars >= 4 ? tags : [],
          paymentMethod: state.ratingState.chosenPaymentMethod,
          fare: activeRide?.fare || 110
        });

        if (fbResp?.updatedRating !== undefined && activeRide?.driver) {
          activeRide.driver.rating = fbResp.updatedRating;
        }
      }

      closeRidePaymentAndRatingModal();
      showToast('🎉 Thank you! Your rating & review have been submitted.', 'success');
      if (typeof updateProfileUI === 'function') updateProfileUI();
      if (typeof revalidateUserProfileAndUpi === 'function') revalidateUserProfileAndUpi(false);

      if (typeof pushUserNotification === 'function') {
        pushUserNotification({
          id: 'notif_rider_feedback_' + Date.now(),
          type: 'trip',
          title: '🚗 Trip & Feedback Recorded',
          message: `Thank you for traveling with Routemate! Fuel split settled and ${stars}★ rating recorded for ${activeRide?.driver?.driver_name || 'Driver'}.`,
          timestamp: new Date().toISOString(),
          icon: 'star',
          iconBg: 'bg-amber-100 text-amber-800',
          action: { label: 'Book Another Ride', tab: 'rider' }
        });
      }
    } catch (err) {
      console.error('Feedback submit error:', err);
      showToast('Failed to submit feedback: ' + err.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  // =========================================================================
  // SUPER ADMIN SAFETY DASHBOARD & DRIVER RATINGS ENGINE
  // =========================================================================

  window.switchAdminSection = function (sec) {
    state.admin.activeSection = sec;
    const btnKyc = document.getElementById('adminSecBtn-kyc');
    const btnSafety = document.getElementById('adminSecBtn-safety');
    const btnBroadcast = document.getElementById('adminSecBtn-broadcast');
    const secKyc = document.getElementById('adminSectionKyc');
    const secSafety = document.getElementById('adminSectionSafety');
    const secBroadcast = document.getElementById('adminSectionBroadcast');

    const activeClasses = 'flex-1 py-2 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5';
    const inactiveClasses = 'flex-1 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition cursor-pointer text-center flex items-center justify-center gap-1.5';

    if (btnKyc) btnKyc.className = (sec === 'kyc') ? activeClasses : inactiveClasses;
    if (btnSafety) btnSafety.className = (sec === 'safety') ? activeClasses : inactiveClasses;
    if (btnBroadcast) btnBroadcast.className = (sec === 'broadcast') ? activeClasses : inactiveClasses;

    if (secKyc) secKyc.classList.toggle('hidden', sec !== 'kyc');
    if (secSafety) secSafety.classList.toggle('hidden', sec !== 'safety');
    if (secBroadcast) secBroadcast.classList.toggle('hidden', sec !== 'broadcast');

    if (sec === 'safety') {
      loadAdminSafetyData();
    } else if (sec === 'broadcast') {
      loadAdminBroadcastsHistory();
    }
    if (window.lucide) lucide.createIcons();
  };

  window.setAdminSafetyFilter = function (filter) {
    state.admin.activeSafetyFilter = filter;
    const filters = ['alerts', 'low', 'all'];
    filters.forEach(f => {
      const btn = document.getElementById(`adminSafetyFilterBtn-${f}`);
      if (!btn) return;
      if (f === filter) {
        btn.className = 'flex-1 py-1.5 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center text-[11px] font-black flex items-center justify-center gap-1';
      } else {
        btn.className = 'flex-1 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 transition cursor-pointer text-center text-[11px] font-bold';
      }
    });
    renderAdminFeedbacks();
  };

  async function loadAdminSafetyData(showToastMsg = false) {
    const user = state.currentUser;
    if (!isAuthorizedSuperAdmin(user)) return;
    const adminEmail = 'shanthankolupula123@gmail.com';

    if (showToastMsg) showToast('Refreshing passenger safety ratings...', 'info');

    try {
      let feedbacks = [];
      if (window.db?.feedbacks?.getAllFeedbacks) {
        feedbacks = await window.db.feedbacks.getAllFeedbacks();
      }

      // Strictly filter out any demo/mock entries so only real reviews appear
      feedbacks = (feedbacks || []).filter(f => !f.id?.startsWith('FB-TEST') && f.driverId !== 'drv_sample_1' && f.driverId !== 'drv_sample_2');

      state.admin.feedbacks = feedbacks;

      // Calculate unresolved safety alerts count
      const alertCount = (state.admin.feedbacks || []).filter(f => f.is_safety_flag && f.admin_action !== 'resolved').length;
      const alertBadge = document.getElementById('adminSafetyAlertBadge');
      const metricSafety = document.getElementById('adminMetricSafetyAlerts');
      if (alertBadge) {
        alertBadge.textContent = alertCount;
        alertBadge.classList.toggle('hidden', alertCount === 0);
      }
      if (metricSafety) {
        metricSafety.textContent = alertCount;
      }

      renderAdminFeedbacks();
      if (showToastMsg) showToast(`Loaded ${state.admin.feedbacks.length} safety reviews.`, 'success');
    } catch (err) {
      console.error('Failed to load admin feedbacks:', err);
      if (showToastMsg) showToast('Error loading reviews: ' + err.message, 'danger');
    }
  }
  window.loadAdminSafetyData = loadAdminSafetyData;

  function renderAdminFeedbacks() {
    const container = document.getElementById('adminFeedbackListContainer');
    if (!container) return;

    const filter = state.admin.activeSafetyFilter || 'alerts';
    const all = state.admin.feedbacks || [];

    const filtered = all.filter(f => {
      if (filter === 'all') return true;
      if (filter === 'alerts') return Boolean(f.is_safety_flag && f.admin_action !== 'resolved');
      if (filter === 'low') return Number(f.rating) <= 3;
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="routemate-card p-8 text-center bg-white border border-slate-200 rounded-3xl space-y-2 shadow-sm">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
            <i data-lucide="shield-check" class="w-6 h-6"></i>
          </div>
          <h4 class="text-xs font-black text-slate-800">No Safety Alerts or Complaints</h4>
          <p class="text-[11px] text-slate-400 max-w-xs mx-auto">
            All drivers are operating smoothly with 0 active safety warnings. Real passenger reviews will stream here as trips complete.
          </p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(fb => {
      const rating = Number(fb.rating || 5);
      const isSafetyAlert = Boolean(fb.is_safety_flag && fb.admin_action !== 'resolved');
      const timeStr = fb.submittedAt ? formatRideTimestamp(fb.submittedAt) : 'Recent';
      const starsDisplay = '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

      const tagsHtml = (fb.safetyTags || []).map(t => `
        <span class="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black">
          ⚠ ${t}
        </span>
      `).concat((fb.compliments || []).map(c => `
        <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
          ✓ ${c}
        </span>
      `)).join(' ');

      const isSuspended = fb.admin_action === 'block' || fb.admin_action === 'suspended' || fb.admin_action === 'suspend';
      const isWarning = fb.admin_action === 'warning';

      let actionBadge = '';
      if (isSuspended) {
        actionBadge = `
          <span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-wider">
            🔴 SUSPENDED
          </span>
        `;
      } else if (isWarning) {
        actionBadge = `
          <span class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider">
            ⚠️ WARNING ISSUED
          </span>
        `;
      } else if (fb.admin_action) {
        actionBadge = `
          <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[9px] font-black uppercase">
            Action Taken: ${fb.admin_action}
          </span>
        `;
      }

      return `
        <div class="routemate-card p-4 space-y-3 bg-white border ${isSafetyAlert ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'} shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-black text-slate-900">${fb.driverName || 'Driver'}</span>
                <span class="text-amber-500 font-mono text-xs font-black">${starsDisplay} (${rating.toFixed(1)})</span>
                ${isSafetyAlert ? '<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i><span>SAFETY ALERT</span></span>' : ''}
                ${actionBadge}
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">Rider: <strong class="text-slate-600">${fb.passengerName || 'Verified Commuter'}</strong> • ${timeStr}</p>
            </div>
            <span class="text-[10px] font-mono text-slate-400 font-semibold">${fb.id || ''}</span>
          </div>

          ${fb.is_safety_flag && fb.flag_reason ? `
            <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-start gap-2">
              <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5"></i>
              <div class="min-w-0 flex-1">
                <span class="font-black text-[10px] uppercase tracking-wider block text-rose-600">Smart Issue Alert:</span>
                <span class="text-[11px] leading-snug">${fb.flag_reason}</span>
              </div>
            </div>
          ` : ''}

          ${tagsHtml ? `<div class="flex flex-wrap gap-1">${tagsHtml}</div>` : ''}

          ${fb.feedbackText ? `
            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
              "${fb.feedbackText}"
            </div>
          ` : ''}

          <!-- Admin Safety Decision Actions -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <span class="text-[10px] text-slate-400 font-bold uppercase">Super Admin Actions:</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button type="button" onclick="handleAdminSafetyAction('${fb.id}', '${fb.driverId}', 'warning')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-[10px] font-black transition cursor-pointer">
                Issue Warning
              </button>
              ${isSuspended ? `
                <button type="button" onclick="handleAdminSafetyAction('${fb.id}', '${fb.driverId}', 'unsuspend')" class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-[10px] font-black transition cursor-pointer">
                  Reactivate Driver
                </button>
              ` : `
                <button type="button" onclick="handleAdminSafetyAction('${fb.id}', '${fb.driverId}', 'block')" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-black transition cursor-pointer">
                  Suspend Driver
                </button>
              `}
              ${isSafetyAlert ? `
                <button type="button" onclick="handleAdminSafetyAction('${fb.id}', '${fb.driverId}', 'resolve')" class="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 text-[10px] font-black transition cursor-pointer">
                  Mark Resolved
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  window.handleAdminSafetyAction = async function (feedbackId, driverId, actionType) {
    const user = state.currentUser;
    if (!isAuthorizedSuperAdmin(user)) {
      showToast('Unauthorized: Super Admin access required.', 'danger');
      return;
    }
    const adminEmail = 'shanthankolupula123@gmail.com';

    let notes = '';
    if (actionType === 'warning') {
      notes = prompt('Enter warning message / reason for the driver:', 'Violation of Routemate safety guidelines: Rash driving or passenger complaint.');
      if (notes === null) return;
    } else if (actionType === 'block') {
      const reason = prompt('Enter driver suspension reason:', 'Account suspended due to safety violation / passenger complaint.');
      if (reason === null) return;
      notes = reason || 'Driver account suspended due to passenger safety violation.';
    } else if (actionType === 'unsuspend') {
      const confirmUnsuspend = confirm('Reactivate this driver account and restore their KYC approval?');
      if (!confirmUnsuspend) return;
      notes = 'Driver account restored by Super Admin.';
    } else if (actionType === 'resolve') {
      notes = 'Safety alert marked resolved by Super Admin.';
    }

    try {
      showToast(`Executing safety action: ${actionType.toUpperCase()}...`, 'info');

      if (window.db?.feedbacks?.executeSafetyAction) {
        await window.db.feedbacks.executeSafetyAction({
          adminEmail: adminEmail,
          feedbackId,
          driverId,
          actionType,
          notes
        });
      }

      // Also broadcast realtime alert to active driver session if online
      if (window.supabase && driverId) {
        try {
          const client = window.supabase;
          const channel = client.channel(`driver-alerts-${driverId}`);
          await channel.send({
            type: 'broadcast',
            event: 'driver_safety_alert',
            payload: {
              actionType,
              notes,
              feedbackId,
              timestamp: new Date().toISOString()
            }
          });
        } catch (bErr) {
          console.warn('[Safety] Realtime broadcast error (non-fatal):', bErr);
        }
      }

      showToast(`Safety action '${actionType}' executed successfully.`, 'success');
      await loadAdminSafetyData(false);
      await loadAdminKycSubmissions(false);
    } catch (err) {
      console.error('Safety action error:', err);
      showToast('Failed to record safety action: ' + err.message, 'danger');
    }
  };

  window.handleRefreshAdminData = async function (showToastMsg = false) {
    await loadAdminKycSubmissions(showToastMsg);
    await loadAdminSafetyData(false);
    await loadAdminBroadcastsHistory();
  };

  // -------------------------------------------------------------------------
  // SUPER ADMIN BROADCAST DISPATCH & PROMOTIONAL NOTICE ENGINE
  // -------------------------------------------------------------------------
  window.selectBroadcastAudience = function (audience) {
    state.admin.activeBroadcastAudience = audience;
    const audiences = ['all', 'drivers', 'commuters'];
    audiences.forEach(a => {
      const btn = document.getElementById(`btnAudience-${a}`);
      if (btn) {
        if (a === audience) {
          btn.className = 'py-2.5 px-3 rounded-2xl border-2 border-purple-600 bg-purple-50 text-purple-900 text-xs font-black transition text-center cursor-pointer shadow-sm';
        } else {
          btn.className = 'py-2.5 px-3 rounded-2xl border-2 border-slate-200 bg-slate-50 text-slate-600 text-xs font-bold transition text-center cursor-pointer';
        }
      }
    });
  };

  window.handleAdminBroadcastSubmit = async function (e) {
    if (e && e.preventDefault) e.preventDefault();
    const user = state.currentUser;
    if (!isAuthorizedSuperAdmin(user)) {
      showToast('Unauthorized: Super Admin access required.', 'danger');
      return;
    }

    const titleInput = document.getElementById('broadcastTitle');
    const msgInput = document.getElementById('broadcastMessage');
    const catInput = document.getElementById('broadcastCategory');
    const actionInput = document.getElementById('broadcastActionTab');
    const btn = document.getElementById('btnSubmitBroadcast');
    const btnText = document.getElementById('btnSubmitBroadcastText');

    const title = String(titleInput?.value || '').trim();
    const message = String(msgInput?.value || '').trim();
    const audience = state.admin.activeBroadcastAudience || 'all';
    const category = catInput?.value || 'promo';
    const actionTab = actionInput?.value || null;

    if (!title || !message) {
      showToast('Please enter both title and message.', 'warning');
      return;
    }

    if (btn) btn.disabled = true;
    if (btnText) btnText.innerHTML = `<span class="animate-spin inline-block mr-2">⚙️</span> Dispatching Broadcast...`;

    try {
      showToast('Broadcasting notification & writing to database...', 'info');

      if (!window.db?.broadcast?.sendBroadcast) {
        throw new Error('Broadcast service not ready.');
      }

      const res = await window.db.broadcast.sendBroadcast({
        adminEmail: 'shanthankolupula123@gmail.com',
        title,
        message,
        audience,
        category,
        actionTab,
        actionLabel: actionTab === 'drive' ? 'Open Driver Radar' : (actionTab === 'rider' ? 'Book Ride' : 'View Details')
      });

      if (!res || !res.success) {
        throw new Error(res?.error || 'Failed to dispatch broadcast notice.');
      }

      showToast(`🎉 Notification successfully broadcasted to ${res.deliveredCount || 'all'} users!`, 'success');

      // Clear form inputs
      if (titleInput) titleInput.value = '';
      if (msgInput) msgInput.value = '';

      // Immediately display in current admin's bell notification center too
      if (typeof pushUserNotification === 'function' && res.broadcast) {
        pushUserNotification(res.broadcast);
      }

      await loadAdminBroadcastsHistory();
    } catch (err) {
      console.error('Broadcast dispatch error:', err);
      showToast('Broadcast failed: ' + err.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = 'Broadcast Notification Now';
    }
  };

  window.loadAdminBroadcastsHistory = async function () {
    const container = document.getElementById('adminBroadcastHistoryContainer');
    if (!container) return;

    try {
      if (window.db?.broadcast?.getBroadcasts) {
        const broadcasts = await window.db.broadcast.getBroadcasts();
        state.admin.broadcasts = broadcasts || [];
        renderAdminBroadcastHistory();
      }
    } catch (err) {
      console.warn('Load broadcasts error:', err);
    }
  };

  function renderAdminBroadcastHistory() {
    const container = document.getElementById('adminBroadcastHistoryContainer');
    if (!container) return;

    const list = state.admin.broadcasts || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-6 text-center text-slate-400 text-xs">
          <p class="font-bold">No broadcasts dispatched yet</p>
          <p class="text-[10px]">Send promotional notices or route updates above.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(b => {
      const timeStr = formatRelativeTime(b.sentAt);
      const audLabel = b.audience === 'drivers' ? '🛵 Drivers Only' : (b.audience === 'commuters' ? '🚗 Commuters Only' : '👥 All Users');

      return `
        <div class="p-3 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5 text-xs">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-slate-900">${b.title}</span>
                <span class="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[9px] font-black uppercase">${b.category || 'promo'}</span>
                <span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold">${audLabel}</span>
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">Dispatched: <strong class="text-slate-600">${timeStr}</strong> • Delivered to: <strong class="text-purple-700">${b.deliveredCount || 1} users</strong></p>
            </div>
            <span class="text-[9px] font-mono text-slate-400">${String(b.id || '').slice(-6).toUpperCase()}</span>
          </div>
          <p class="text-[11px] text-slate-600 italic bg-white p-2 rounded-xl border border-slate-100">"${b.message}"</p>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  // -------------------------------------------------------------------------
  // IMAGE LIGHTBOX PREVIEW HELPER
  // -------------------------------------------------------------------------
  window.openImageLightbox = function (src, caption = 'Document Preview') {
    if (!src) return;
    const modal = document.getElementById('imageLightboxModal');
    const img = document.getElementById('lightboxImage');
    const cap = document.getElementById('lightboxCaption');
    if (img) img.src = src;
    if (cap) cap.textContent = caption;
    if (modal) modal.classList.remove('hidden');
  };

  window.closeImageLightbox = function () {
    const modal = document.getElementById('imageLightboxModal');
    if (modal) modal.classList.add('hidden');
  };

  // =========================================================================
  // TOP HEADER NOTIFICATION BELL & MULTI-CHANNEL ALERT SYSTEM
  // =========================================================================

  function getStoredReadNotifIds(userId) {
    try {
      const raw = localStorage.getItem('routemate_read_notifs_' + (userId || 'guest'));
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveStoredReadNotifIds(userId, readSet) {
    try {
      localStorage.setItem('routemate_read_notifs_' + (userId || 'guest'), JSON.stringify(Array.from(readSet)));
    } catch (e) {}
  }

  function getStoredCustomNotifs(userId) {
    try {
      const raw = localStorage.getItem('routemate_custom_notifs_' + (userId || 'guest'));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveStoredCustomNotifs(userId, list) {
    try {
      localStorage.setItem('routemate_custom_notifs_' + (userId || 'guest'), JSON.stringify(list.slice(0, 50)));
    } catch (e) {}
  }

  function formatRelativeTime(isoStr) {
    if (!isoStr) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(isoStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(isoStr).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch (e) {
      return 'Recent';
    }
  }

  function initNotificationSystem(user) {
    const userId = user?.id || 'guest';
    const readSet = getStoredReadNotifIds(userId);
    state.notifications.readIds = readSet;

    const clearedAtStr = localStorage.getItem('routemate_notifs_cleared_' + userId);
    const clearedAt = clearedAtStr ? parseInt(clearedAtStr, 10) : 0;

    let items = [];

    // 1. Admin Safety Alerts & Warnings (Auto-expires after 48 hours)
    if (user?.warning_alert && user.warning_alert.notes) {
      const w = user.warning_alert;
      const issued = w.issuedAt || w.timestamp || w.created_at;
      const expires = w.expires_at || w.expiresAt || (issued ? new Date(new Date(issued).getTime() + 48 * 60 * 60 * 1000).toISOString() : null);
      const isExpired = expires ? (new Date(expires).getTime() <= Date.now()) : false;
      if (!isExpired) {
        items.push({
          id: 'notif_warn_active',
          type: 'safety',
          title: '⚠️ Safety & Compliance Notice',
          message: user.warning_alert.notes,
          timestamp: user.warning_alert.issuedAt || new Date().toISOString(),
          icon: 'shield-alert',
          iconBg: 'bg-amber-100 text-amber-800',
          action: { label: 'Acknowledge', type: 'dismiss_warning' }
        });
      }
    }

    if (Array.isArray(user?.role?.warnings)) {
      user.role.warnings.forEach((w, i) => {
        items.push({
          id: `notif_warn_${w.id || i}`,
          type: 'safety',
          title: 'Community Safety Warning',
          message: w.notes || 'Violation of Routemate safety guidelines was reported.',
          timestamp: w.issuedAt || new Date().toISOString(),
          icon: 'shield-alert',
          iconBg: 'bg-amber-100 text-amber-800',
          action: { label: 'Review Guidelines', tab: 'profile' }
        });
      });
    }

    if (user?.kyc_status === 'suspended' || user?.is_suspended) {
      items.push({
        id: 'notif_acc_suspended',
        type: 'safety',
        title: '🚫 Driver Account Suspended',
        message: user.suspension_reason || 'Your driver account has been suspended by Super Admin due to passenger complaints or safety guidelines.',
        timestamp: new Date().toISOString(),
        icon: 'alert-triangle',
        iconBg: 'bg-rose-100 text-rose-800',
        action: { label: 'Contact Support', email: 'routmatesupport@gmail.com' }
      });
    }

    // 2. Account & KYC Status Updates
    if (user?.kyc_status === 'approved') {
      items.push({
        id: 'notif_kyc_approved',
        type: 'account',
        title: '🎉 Driver KYC Approved',
        message: 'Your Driving License, Aadhaar, and Vehicle RC have been verified. You can now accept rides and earn 100% fuel split via Direct UPI.',
        timestamp: user.submitted_at || new Date().toISOString(),
        icon: 'check-circle-2',
        iconBg: 'bg-emerald-100 text-emerald-800',
        action: { label: 'Go Online', tab: 'drive' }
      });
    } else if (user?.kyc_status === 'pending') {
      items.push({
        id: 'notif_kyc_pending',
        type: 'account',
        title: '📄 Driver Documents Under Review',
        message: 'Your KYC submission is in the Super Admin verification queue. Verification typically completes within a few minutes to hours.',
        timestamp: user.submitted_at || new Date().toISOString(),
        icon: 'clock',
        iconBg: 'bg-blue-100 text-blue-800',
        action: { label: 'Check Status', tab: 'drive' }
      });
    } else if (user?.kyc_status === 'rejected') {
      items.push({
        id: 'notif_kyc_rejected',
        type: 'account',
        title: '⚠️ KYC Revision Required',
        message: user.rejection_reason || 'One of your uploaded documents could not be verified. Please review and re-upload valid documents.',
        timestamp: new Date().toISOString(),
        icon: 'alert-circle',
        iconBg: 'bg-rose-100 text-rose-800',
        action: { label: 'Re-submit KYC', tab: 'drive' }
      });
    }

    // 3. Wallet & Promotional Bonus
    if (state.wallet?.balance >= 100 || user?.role?.welcome_bonus_credited !== false) {
      items.push({
        id: 'notif_wallet_welcome_bonus',
        type: 'wallet',
        title: '🎁 ₹100 Welcome Bonus Credited',
        message: '₹100 promotional balance has been deposited to your in-app driver wallet to offset platform fees.',
        timestamp: '2026-11-01T00:00:00.000Z',
        icon: 'sparkles',
        iconBg: 'bg-emerald-100 text-emerald-800',
        action: { label: 'View Wallet', tab: 'drive' }
      });
    }

    // Wallet Transactions
    if (Array.isArray(state.wallet?.transactions)) {
      state.wallet.transactions.slice(0, 5).forEach((tx) => {
        const isCredit = tx.type === 'credit';
        items.push({
          id: `notif_tx_${tx.id}`,
          type: 'wallet',
          title: isCredit ? `+₹${tx.amount} Wallet Top-Up` : `-₹${tx.amount} Platform Commission`,
          message: tx.description || (isCredit ? 'Wallet recharge successful.' : 'Platform fee deducted upon verified ride completion.'),
          timestamp: tx.timestamp || new Date().toISOString(),
          icon: isCredit ? 'wallet' : 'receipt',
          iconBg: isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800',
          action: { label: 'Open Wallet', tab: 'drive' }
        });
      });
    }

    // 4. Platform & Corridor Announcements
    items.push({
      id: 'notif_corridor_hyderabad_warangal',
      type: 'promo',
      title: '🚀 Hyderabad – Warangal Corridor Active',
      message: 'Verified carpool trips between Uppal, Ghatkesar, Bhongir, Aler, and Jangaon are now active. Save fuel, avoid bus queues, and travel safely!',
      timestamp: '2026-11-01T06:00:00.000Z',
      icon: 'map-pin',
      iconBg: 'bg-indigo-100 text-indigo-800',
      action: { label: 'Search Rides', tab: 'rider' }
    });

    items.push({
      id: 'notif_direct_p2p_upi',
      type: 'promo',
      title: '⚡ 100% Direct P2P UPI Payouts',
      message: 'Commuters settle payments straight to your personal UPI ID (GPay, PhonePe, Paytm). Zero payout delays and zero intermediary holding.',
      timestamp: '2026-11-05T08:00:00.000Z',
      icon: 'smartphone',
      iconBg: 'bg-cyan-100 text-cyan-800',
      action: { label: 'Verify UPI ID', tab: 'profile' }
    });

    // 5. Database Fan-Out Broadcast Notifications (from User Profile role JSON)
    let profileBroadcasts = [];
    try {
      if (user?.role && typeof user.role === 'string' && user.role.includes('{')) {
        const parsed = JSON.parse(user.role);
        if (Array.isArray(parsed.broadcast_notifications)) profileBroadcasts = parsed.broadcast_notifications;
      } else if (user?.role && typeof user.role === 'object' && Array.isArray(user.role.broadcast_notifications)) {
        profileBroadcasts = user.role.broadcast_notifications;
      }
    } catch (e) {}

    profileBroadcasts.forEach(bn => {
      if (!items.some(it => it.id === bn.id)) {
        items.push({
          ...bn,
          read: readSet.has(bn.id)
        });
      }
    });

    // Merge any stored custom notifications
    const customNotifs = getStoredCustomNotifs(userId);
    customNotifs.forEach(c => {
      if (!items.some(it => it.id === c.id)) {
        items.push(c);
      }
    });

    // Mark read states
    items.forEach(it => {
      it.read = readSet.has(it.id);
    });

    // Filter out notifications cleared previously by the user
    if (clearedAt > 0) {
      items = items.filter(it => {
        const t = new Date(it.timestamp || 0).getTime();
        return t > clearedAt;
      });
    }

    // Sort: unread first, then by timestamp descending
    items.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
    });

    state.notifications.items = items;
    updateNotificationBadge();
    renderNotifications();

    // 6a. Background Async Fetch of Active Broadcasts
    if (window.db?.broadcast?.getBroadcasts) {
      window.db.broadcast.getBroadcasts().then(bcs => {
        if (Array.isArray(bcs) && bcs.length > 0) {
          let updated = false;
          bcs.forEach(b => {
            const isDriver = state.currentUser?.kyc_status === 'approved' || !!state.currentUser?.vehicleNumber;
            if (b.audience === 'drivers' && !isDriver) return;
            if (b.audience === 'commuters' && isDriver && state.activeTab === 'drive') return;

            const itemTime = new Date(b.sentAt || 0).getTime();
            if (clearedAt > 0 && itemTime <= clearedAt) return;

            if (!state.notifications.items.some(it => it.id === b.id)) {
              state.notifications.items.unshift({
                id: b.id,
                type: b.category || 'promo',
                title: b.title,
                message: b.message,
                timestamp: b.sentAt,
                icon: b.icon || 'megaphone',
                iconBg: b.iconBg || 'bg-purple-100 text-purple-800',
                action: b.actionTab ? { label: b.actionLabel || 'View Details', tab: b.actionTab } : null,
                read: state.notifications.readIds.has(b.id)
              });
              updated = true;
            }
          });
          if (updated) {
            updateNotificationBadge();
            renderNotifications();
          }
        }
      }).catch(() => {});
    }

    // 6b. Background Async Fetch of Database Notifications from Supabase `notifications` table
    if (window.db?.notifications?.getNotifications) {
      const isDriver = state.currentUser?.kyc_status === 'approved' || !!state.currentUser?.vehicleNumber;
      window.db.notifications.getNotifications({
        userId: userId,
        userRole: isDriver ? 'driver' : 'commuter'
      }).then(dbNotifs => {
        if (Array.isArray(dbNotifs) && dbNotifs.length > 0) {
          let updated = false;
          dbNotifs.forEach(dbn => {
            const itemTime = new Date(dbn.created_at || 0).getTime();
            if (clearedAt > 0 && itemTime <= clearedAt) return;

            const notifId = dbn.id;
            if (!state.notifications.items.some(it => it.id === notifId)) {
              state.notifications.items.unshift({
                id: notifId,
                type: dbn.type || 'info',
                title: dbn.title,
                message: dbn.message,
                timestamp: dbn.created_at,
                icon: dbn.data?.icon || (dbn.type === 'safety' ? 'shield-alert' : 'bell'),
                iconBg: dbn.data?.iconBg || (dbn.type === 'safety' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'),
                action: dbn.data?.actionTab ? { label: dbn.data?.actionLabel || 'View Details', tab: dbn.data?.actionTab } : null,
                read: dbn.is_read || state.notifications.readIds.has(notifId)
              });
              updated = true;
            }
          });
          if (updated) {
            updateNotificationBadge();
            renderNotifications();
          }
        }
      }).catch(() => {});
    }

    // 7. Subscribe to Supabase Realtime Broadcast Channel for Live Updates
    const client = window.db?.getSupabase?.();
    if (client && !window._routemateBroadcastSubscribed) {
      window._routemateBroadcastSubscribed = true;
      try {
        const bcChannel = client.channel('routemate-broadcasts');
        bcChannel.on('broadcast', { event: 'new_broadcast' }, (msg) => {
          const p = msg.payload || {};
          console.log('⚡ [REALTIME BROADCAST RECEIVED]', p);
          if (p && p.id) {
            const isDriver = state.currentUser?.kyc_status === 'approved' || !!state.currentUser?.vehicleNumber;
            if (p.audience === 'drivers' && !isDriver) return;
            if (p.audience === 'commuters' && isDriver && state.activeTab === 'drive') return;

            pushUserNotification({
              id: p.id,
              type: p.category || 'promo',
              title: p.title,
              message: p.message,
              timestamp: p.sentAt || new Date().toISOString(),
              icon: p.icon || 'megaphone',
              iconBg: p.iconBg || 'bg-purple-100 text-purple-800',
              action: p.actionTab ? { label: p.actionLabel || 'View Details', tab: p.actionTab } : null
            });
          }
        }).subscribe();
      } catch (rtErr) {
        console.warn('Realtime broadcast subscribe notice:', rtErr);
      }
    }
  }
  window.initNotificationSystem = initNotificationSystem;

  function updateNotificationBadge() {
    const unreadCount = state.notifications.items.filter(n => !n.read).length;
    const headerBadge = document.getElementById('headerNotificationBadge');
    const drawerBadge = document.getElementById('notifDrawerUnreadBadge');

    if (headerBadge) {
      if (unreadCount > 0) {
        headerBadge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        headerBadge.classList.remove('hidden');
      } else {
        headerBadge.classList.add('hidden');
      }
    }

    if (drawerBadge) {
      if (unreadCount > 0) {
        drawerBadge.textContent = `${unreadCount} New`;
        drawerBadge.classList.remove('hidden');
      } else {
        drawerBadge.classList.add('hidden');
      }
    }
  }

  window.openNotificationDrawer = function () {
    const modal = document.getElementById('notificationDrawerModal');
    if (!modal) return;
    renderNotifications();
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeNotificationDrawer = function () {
    const modal = document.getElementById('notificationDrawerModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleNotificationBackdropClick = function (e) {
    if (e.target.id === 'notificationDrawerModal') {
      closeNotificationDrawer();
    }
  };

  window.filterNotifications = function (category) {
    state.notifications.filter = category;
    const tabs = ['all', 'safety', 'account', 'wallet'];
    tabs.forEach(t => {
      const btn = document.getElementById(`notifFilterBtn-${t}`);
      if (btn) {
        if (t === category) {
          btn.className = 'px-3 py-1 rounded-full bg-slate-900 text-white font-bold transition cursor-pointer';
        } else {
          btn.className = 'px-3 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold transition cursor-pointer';
        }
      }
    });
    renderNotifications();
  };

  function renderNotifications() {
    const container = document.getElementById('notificationListContainer');
    if (!container) return;

    let list = state.notifications.items || [];
    const filter = state.notifications.filter;

    if (filter === 'safety') {
      list = list.filter(n => n.type === 'safety');
    } else if (filter === 'account') {
      list = list.filter(n => n.type === 'account');
    } else if (filter === 'wallet') {
      list = list.filter(n => n.type === 'wallet' || n.type === 'trip');
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="py-10 text-center text-slate-400 space-y-2">
          <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
            <i data-lucide="bell-off" class="w-6 h-6"></i>
          </div>
          <div>
            <h5 class="text-xs font-bold text-slate-600">No Notifications</h5>
            <p class="text-[10px] text-slate-400">You are completely up to date.</p>
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    container.innerHTML = list.map(n => {
      const timeStr = formatRelativeTime(n.timestamp);
      const isUnread = !n.read;
      const borderClass = isUnread ? 'border-l-4 border-l-blue-600 bg-blue-50/20' : 'border-slate-100 bg-white';

      return `
        <div onclick="openNotificationDetail('${n.id}')" class="notification-card p-3 rounded-2xl border ${borderClass} hover:border-slate-300 transition cursor-pointer flex items-start gap-3">
          <div class="w-9 h-9 rounded-xl ${n.iconBg || 'bg-slate-100 text-slate-700'} flex items-center justify-center flex-shrink-0 font-bold">
            <i data-lucide="${n.icon || 'bell'}" class="w-4 h-4"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1">
              <h4 class="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                ${n.title}
                ${isUnread ? '<span class="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0"></span>' : ''}
              </h4>
              <span class="text-[10px] text-slate-400 flex-shrink-0">${timeStr}</span>
            </div>
            <p class="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">${n.message}</p>
          </div>
        </div>
      `;
    }).join('');

    if (window.lucide) lucide.createIcons();
  }

  window.openNotificationDetail = function (notifId) {
    const notif = state.notifications.items.find(n => n.id === notifId);
    if (!notif) return;

    markNotificationAsRead(notifId);
    state.notifications.activeDetail = notif;

    const modal = document.getElementById('notificationDetailModal');
    const titleEl = document.getElementById('notifDetailTitle');
    const timeEl = document.getElementById('notifDetailTime');
    const msgEl = document.getElementById('notifDetailMessage');
    const iconContainer = document.getElementById('notifDetailIconContainer');
    const iconEl = document.getElementById('notifDetailIcon');
    const actionBtn = document.getElementById('notifDetailActionBtn');

    if (titleEl) titleEl.textContent = notif.title;
    if (timeEl) timeEl.textContent = formatRelativeTime(notif.timestamp);
    if (msgEl) msgEl.textContent = notif.message;

    if (iconContainer) iconContainer.className = `w-9 h-9 rounded-2xl flex items-center justify-center font-black ${notif.iconBg || 'bg-blue-50 text-blue-600'}`;
    if (iconEl) iconEl.setAttribute('data-lucide', notif.icon || 'bell');

    if (actionBtn) {
      if (notif.action && notif.action.label) {
        actionBtn.textContent = notif.action.label;
        actionBtn.classList.remove('hidden');
      } else {
        actionBtn.classList.add('hidden');
      }
    }

    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  };

  window.closeNotificationDetailModal = function () {
    const modal = document.getElementById('notificationDetailModal');
    if (modal) modal.classList.add('hidden');
    state.notifications.activeDetail = null;
  };

  window.handleNotificationActionClick = function () {
    const notif = state.notifications.activeDetail;
    closeNotificationDetailModal();
    closeNotificationDrawer();

    if (!notif || !notif.action) return;

    if (notif.action.tab) {
      navigateToTab(notif.action.tab);
    } else if (notif.action.email) {
      window.location.href = `mailto:${notif.action.email}?subject=Routemate Support Inquiry`;
    } else if (notif.action.type === 'dismiss_warning') {
      dismissDriverWarningAlert();
    }
  };

  window.markNotificationAsRead = function (notifId) {
    const notif = state.notifications.items.find(n => n.id === notifId);
    if (notif) {
      notif.read = true;
      state.notifications.readIds.add(notifId);
      saveStoredReadNotifIds(state.currentUser?.id, state.notifications.readIds);
      updateNotificationBadge();
      renderNotifications();
    }
  };

  window.markAllNotificationsAsRead = function () {
    state.notifications.items.forEach(n => {
      n.read = true;
      state.notifications.readIds.add(n.id);
    });
    saveStoredReadNotifIds(state.currentUser?.id, state.notifications.readIds);
    updateNotificationBadge();
    renderNotifications();
    showToast('All notifications marked as read ✓', 'info');
  };

  window.clearAllNotifications = async function () {
    const userId = state.currentUser?.id || 'guest';
    state.notifications.items = [];
    state.notifications.activeDetail = null;

    // Save cleared timestamp locally so cleared state persists cleanly across reloads
    try {
      localStorage.setItem('routemate_notifs_cleared_' + userId, Date.now().toString());
      localStorage.removeItem('routemate_custom_notifs_' + userId);
    } catch (e) {}

    renderNotifications();
    updateNotificationBadge();

    // Securely trigger database delete & profile purge in Supabase
    try {
      if (window.db?.notifications?.clearNotifications) {
        await window.db.notifications.clearNotifications(userId);
      }
    } catch (e) {
      console.warn('clearAllNotifications warning:', e);
    }

    showToast('All notifications cleared ✓', 'info');
  };

  window.clearAllReadNotifications = function () {
    window.clearAllNotifications();
  };

  window.pushUserNotification = function (notif) {
    if (!notif || !notif.id) return;
    const userId = state.currentUser?.id || 'guest';
    const clearedAtStr = localStorage.getItem('routemate_notifs_cleared_' + userId);
    const clearedAt = clearedAtStr ? parseInt(clearedAtStr, 10) : 0;
    const itemTime = new Date(notif.timestamp || 0).getTime();
    if (clearedAt > 0 && itemTime <= clearedAt) return;

    const exists = state.notifications.items.findIndex(n => n.id === notif.id);
    if (exists !== -1) {
      state.notifications.items[exists] = { ...state.notifications.items[exists], ...notif };
    } else {
      state.notifications.items.unshift(notif);
    }

    // Save to custom notifs storage
    const list = getStoredCustomNotifs(userId);
    const cIdx = list.findIndex(c => c.id === notif.id);
    if (cIdx !== -1) list[cIdx] = notif;
    else list.unshift(notif);
    saveStoredCustomNotifs(userId, list);

    updateNotificationBadge();
    renderNotifications();
  };

  // =========================================================================
  // BOOTSTRAP ON LOAD & REAL-TIME REVALIDATION
  // =========================================================================
  document.addEventListener('DOMContentLoaded', async () => {
    initGoogleIdentityServices();
    loadLocationPreferences();
    calculateDistanceAndFare();
    initLiveGPS();
    setupLocationAutocomplete();
    if (window.lucide) lucide.createIcons();

    initMapWidget('riderInteractiveMap', 'rider');
    await checkAuthSession();

    if (typeof renderAllUpiDisplays === 'function') {
      renderAllUpiDisplays();
    }

    // Real-time automatic revalidation on tab focus and app visibility
    window.addEventListener('focus', () => {
      if (typeof revalidateUserProfileAndUpi === 'function') {
        revalidateUserProfileAndUpi(true);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && typeof revalidateUserProfileAndUpi === 'function') {
        revalidateUserProfileAndUpi(true);
      }
    });

    console.log('✨ [ROUTEMATE] Commuter & Driver Maps Live with Real-time Profile & UPI Synchronization.');
  });

})();
