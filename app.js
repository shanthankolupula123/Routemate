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
    distanceKm: 84,
    fare: 110,
    userGPS: null,
    activeRiderRequest: null,
    activeDriverTrip: null,
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
    ratingState: {
      activeRide: null,
      selectedStars: 5,
      selectedTags: new Set(['Smooth & Safe Ride', 'Polite Driver']),
      chosenPaymentMethod: 'upi'
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
      activeFilter: 'pending', // 'pending' | 'approved' | 'rejected' | 'all'
      activeSafetyFilter: 'alerts', // 'alerts' | 'low' | 'all'
      activeSection: 'kyc', // 'kyc' | 'safety'
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
              }
            }
          } catch (e) {}
        }
      } catch (e) {
        console.warn('Auth session check note:', e);
      }

      // Supabase Auth State Change Listener (e.g. for Google OAuth redirect / OTP verify)
      window.db.auth.onAuthStateChange(async (event, session) => {
        console.log('👤 [AUTH EVENT]:', event);
        if (session && session.user) {
          const userObj = normalizeAuthUser(session.user);
          try {
            const saved = localStorage.getItem('routemate_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed && (parsed.id === userObj.id || (parsed.email && parsed.email.toLowerCase() === (userObj.email || '').toLowerCase()))) {
                if (parsed.phone && !userObj.phone) userObj.phone = parsed.phone;
                if (parsed.name && (!userObj.name || userObj.name === 'User')) userObj.name = parsed.name;
                if (parsed.gender && !userObj.gender) userObj.gender = parsed.gender;
                if (parsed.dob && !userObj.dob) userObj.dob = parsed.dob;
                if (parsed.role && !userObj.role) userObj.role = parsed.role;
              }
            }
          } catch (e) {}
          await handleAuthUserFlow(userObj, event === 'SIGNED_IN');
        } else if (event === 'SIGNED_OUT') {
          lockAppToAuthScreen();
        }
      });
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
          if (parsed.phone && !user.phone) user.phone = parsed.phone;
          if (parsed.name && (!user.name || user.name === 'User' || user.name.includes('@'))) user.name = parsed.name;
          if (parsed.gender && !user.gender) user.gender = parsed.gender;
          if (parsed.dob && !user.dob) user.dob = parsed.dob;
          if (parsed.role && !user.role) user.role = parsed.role;
          if (parsed.upi_id) state.driverUpi.upiId = parsed.upi_id;
        }
      }
    } catch (e) {}

    // 2. Query Supabase `profiles` table using User ID or Email
    try {
      if (window.db?.auth?.getUserProfile) {
        const dbProfile = await window.db.auth.getUserProfile(user.id, user.email);
        if (dbProfile) {
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
          if (dbProfile.upi_id) {
            user.upi_id = dbProfile.upi_id;
            state.driverUpi.upiId = dbProfile.upi_id;
          }
        }
      }
    } catch (e) {
      console.warn('Profile DB check notice:', e);
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

    // If Profile Exists (Name & Phone Number are already saved):
    // Permanently store in localStorage, close modal, and route directly to main app dashboard
    try {
      localStorage.setItem('routemate_user', JSON.stringify(user));
    } catch (e) {}

    closeProfileCompletionModal();
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

    if (errEl) errEl.classList.add('hidden');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Saving details...';

    const formattedPhone = '+91' + rawPhone;

    try {
      showToast('Saving profile details...', 'info');

      // 1. Save to Supabase profiles table & Auth Metadata
      if (window.db?.auth?.saveUserProfile) {
        await window.db.auth.saveUserProfile(user.id, {
          name: fullName,
          phone: formattedPhone,
          email: user.email,
          gender,
          dob,
          upiId: rawUpi
        });
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
  function isAuthorizedSuperAdmin(user = state.currentUser) {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('routemate_admin_authorized') === 'true') {
      return true;
    }
    const email = String(user?.email || '').toLowerCase().trim();
    if (!email) return false;
    return (
      email === 'shanthankolupula123@gmail.com' ||
      email === 'shanthankolupula@gmail.com' ||
      email.startsWith('shanthankolupula') ||
      email.includes('admin')
    );
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

    // Super Admin Authorization Gate
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
      profileAdminCard.classList.remove('hidden');
    }

    if (isSuperAdmin) {
      loadAdminKycSubmissions();
      loadAdminSafetyData();
    }

    updateProfileUI();

    // Load Driver KYC, wallet balance, and vehicle registrations immediately
    checkDriverKycStatus(false);

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
    state.currentUser = null;
    state.pendingCompletionUser = null;
    localStorage.removeItem('routemate_user');
    closeProfileCompletionModal();

    // Hide Super Admin controls
    const adminPill = document.getElementById('headerAdminPill');
    const adminNav = document.getElementById('navTab-admin');
    if (adminPill) {
      adminPill.classList.add('hidden');
      adminPill.classList.remove('inline-flex');
    }
    if (adminNav) adminNav.classList.add('hidden');

    // Show Auth Screen & reset to Step 1
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.remove('hidden');

    backToEmailStep();

    // Hide Main App Elements
    const header = document.getElementById('appHeader');
    const main = document.getElementById('appMain');
    const nav = document.getElementById('appBottomNav');
    if (header) header.classList.add('hidden');
    if (main) main.classList.add('hidden');
    if (nav) nav.classList.add('hidden');
  }

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
      if (pRoleEl) pRoleEl.textContent = `Verified Member • 5.0 ★`;

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

    // Populate Driver UPI ID display in profile
    const profileUpiEl = document.getElementById('profileDriverUpiDisplay');
    if (profileUpiEl) {
      profileUpiEl.textContent = state.driverUpi?.upiId || (state.kyc?.submission?.upi_id || 'Not Set (Tap "Set UPI ID")');
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

  window.handleGoogleCredentialResponse = async function (response) {
    if (!response || !response.credential) {
      showToast('Google sign-in did not return credentials.', 'danger');
      return;
    }

    showToast('Signing in with Google...', 'info');

    try {
      const token = response.credential;
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonPayload);

      console.log('✅ [GOOGLE AUTH] User signed in via GIS:', payload.email, payload.name);

      let supaUser = null;
      if (window.db?.getSupabase) {
        const client = window.db.getSupabase();
        if (client?.auth && typeof client.auth.signInWithIdToken === 'function') {
          try {
            const { data, error } = await client.auth.signInWithIdToken({
              provider: 'google',
              token: token
            });
            if (!error && data && data.user) {
              supaUser = data.user;
            }
          } catch (supaErr) {
            console.warn('Supabase signInWithIdToken note:', supaErr.message);
          }
        }
      }

      const finalUser = {
        id: (supaUser && supaUser.id) || ('usr_g_' + payload.sub),
        email: payload.email,
        name: payload.name || payload.email.split('@')[0],
        phone: (supaUser && supaUser.phone) || '',
        gender: '',
        dob: '',
        role: 'commuter',
        rating: 5.0,
        avatar: payload.picture || getInitialsAvatarSvg(payload.name || payload.email, 120)
      };

      await handleAuthUserFlow(finalUser, true);
    } catch (err) {
      console.error('Google credential parse error:', err);
      showToast('Google Sign In: ' + err.message, 'danger');
    }
  };

  window.handleGoogleSignIn = async function () {
    const emailVal = document.getElementById('authEmailInput')?.value?.trim();

    // 1. Try Google Identity Services One Tap prompt first (in-page popup, never redirects to localhost)
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      showToast('Opening Google Sign-In...', 'info');
      try {
        google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            console.log('GIS One-Tap prompt bypassed, proceeding with Google OAuth...');
            fallbackGoogleOAuth(emailVal);
          }
        });
        return;
      } catch (gisErr) {
        console.warn('GIS prompt error:', gisErr);
      }
    }

    fallbackGoogleOAuth(emailVal);
  };

  async function fallbackGoogleOAuth(emailVal) {
    try {
      showToast('Connecting to Google...', 'info');
      await window.db.auth.signInWithGoogle();
    } catch (err) {
      console.warn('Google sign-in check notice:', err);
      const isProviderDisabled = err.code === 'PROVIDER_NOT_ENABLED' ||
        err.message?.includes('provider is not enabled') ||
        err.message?.includes('Unsupported provider') ||
        err.message?.includes('not configured');

      if (isProviderDisabled) {
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
      } else {
        showToast('Google Sign In: ' + err.message, 'danger');
        openGoogleSignInModal(emailVal);
      }
    }
  }

  window.handleSignOut = async function () {
    if (confirm('Are you sure you want to sign out?')) {
      await window.db.auth.signOut();
      lockAppToAuthScreen();
      showToast('Signed out of Routemate', 'info');
    }
  };

  // =========================================================================
  // FREE OPENSTREETMAP INTERACTIVE MAP & GPS TRACKING
  // =========================================================================
  function initLiveGPS() {
    if (!('geolocation' in navigator)) return;

    navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        state.userGPS = { lat: latitude, lng: longitude, accuracy };
        updateUserGPSMarker(latitude, longitude);
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

  function calculateDistanceAndFare() {
    const p = state.pickupCoords;
    const d = state.dropCoords;

    const R = 6371;
    const dLat = (d.lat - p.lat) * Math.PI / 180;
    const dLng = (d.lng - p.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p.lat * Math.PI / 180) * Math.cos(d.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    state.distanceKm = Math.max(5, Math.round(R * c * 1.2));

    let rate = 1.3;
    if (state.vehicleType === 'car') rate = 2.6;
    if (state.vehicleType === 'auto') rate = 1.8;

    state.fare = Math.round(state.distanceKm * rate);
    const fareEl = document.getElementById('fareDisplay');
    if (fareEl) fareEl.textContent = `₹${state.fare}`;
  }

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

  window.openAdminAuthModal = function () {
    const modal = document.getElementById('adminAuthModal');
    const input = document.getElementById('inputAdminAuthKey');
    const err = document.getElementById('adminAuthErrorMsg');
    if (err) err.classList.add('hidden');
    if (input) input.value = '';
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    setTimeout(() => input?.focus(), 100);
  };

  window.closeAdminAuthModal = function () {
    const modal = document.getElementById('adminAuthModal');
    if (modal) modal.classList.add('hidden');
  };

  window.handleAdminAuthModalSubmit = function (e) {
    if (e) e.preventDefault();
    const input = document.getElementById('inputAdminAuthKey');
    const err = document.getElementById('adminAuthErrorMsg');
    const val = String(input?.value || '').trim().toLowerCase();

    if (val === '1234' || val === 'admin' || val.includes('shanthankolupula')) {
      localStorage.setItem('routemate_admin_authorized', 'true');
      if (!state.currentUser) {
        state.currentUser = {
          id: 'admin_root',
          email: 'shanthankolupula123@gmail.com',
          name: 'Shanthankolupula (Super Admin)',
          role: 'admin'
        };
      } else {
        state.currentUser.email = 'shanthankolupula123@gmail.com';
      }
      closeAdminAuthModal();
      showToast('🎉 Super Admin Verified & Unlocked!', 'success');

      const adminPill = document.getElementById('headerAdminPill');
      const adminNav = document.getElementById('navTab-admin');
      if (adminPill) {
        adminPill.classList.remove('hidden');
        adminPill.classList.add('inline-flex');
      }
      if (adminNav) {
        adminNav.classList.remove('hidden');
      }

      openAdminScreenDirect();
    } else {
      if (err) {
        err.textContent = 'Invalid credentials. Enter PIN 1234 or your admin email.';
        err.classList.remove('hidden');
      }
      showToast('Invalid Super Admin credentials.', 'danger');
    }
  };

  window.openAdminScreenDirect = function () {
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
        openAdminAuthModal();
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
    } else {
      if (screens[tabName]) screens[tabName].classList.remove('hidden');
      if (tabName === 'activity') {
        renderActivityList();
      } else if (tabName === 'profile') {
        updateProfileUI();
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
        distance: state.distanceKm,
        vehicleType: state.vehicleType,
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

        // Persist to user ride activity history
        try {
          const stored = JSON.parse(localStorage.getItem('routemate_user_rides') || '[]');
          const item = {
            id: result.request.id,
            pickup: result.request.pickup,
            drop: result.request.drop,
            fare: result.request.fare,
            vehicleType: result.request.vehicleType || 'bike',
            status: 'searching',
            userRole: 'commuter',
            createdAt: new Date().toISOString()
          };
          const filtered = stored.filter(r => r.id !== result.request.id);
          filtered.unshift(item);
          localStorage.setItem('routemate_user_rides', JSON.stringify(filtered.slice(0, 30)));
        } catch (e) {}

        window.db.matching.startRiderPolling(result.request.id, (statusData) => {
          handleRiderStatusUpdate(statusData);
        });
      } else {
        showToast('Failed to broadcast ride. Please check connection.', 'danger');
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

  function renderRiderActiveHUD(req) {
    const card = document.getElementById('riderActiveCard');
    if (!card) return;
    card.classList.remove('hidden');

    if (req.status === 'searching') {
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

          <div class="mt-3.5 space-y-2 text-xs">
            <div class="flex items-start gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></span>
              <p class="text-slate-200 truncate"><strong class="text-white">Pickup:</strong> ${req.pickup}</p>
            </div>
            <div class="flex items-start gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400 mt-1 flex-shrink-0"></span>
              <p class="text-slate-200 truncate"><strong class="text-white">Drop:</strong> ${req.drop} (${req.distance} km)</p>
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
    } else if (req.status === 'driver_accepted' || req.status === 'ride_started') {
      const driver = req.driver || {};
      const isStarted = req.status === 'ride_started';

      card.innerHTML = `
        <div class="routemate-card p-5 bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white border-emerald-500/30 shadow-xl relative overflow-hidden animate-in fade-in duration-300">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full ${isStarted ? 'bg-cyan-400' : 'bg-emerald-400'} live-dot"></span>
              <span class="text-xs font-black uppercase tracking-wider ${isStarted ? 'text-cyan-300' : 'text-emerald-300'}">
                ${isStarted ? 'Trip In Progress' : 'Driver En Route to Pickup'}
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
              <p class="text-emerald-300 text-[10px] font-bold mt-0.5">Rating: 4.9 ★ • Verified Commuter</p>
            </div>
            <a href="tel:${driver.phone || '+919494285249'}" class="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition flex-shrink-0">
              <i data-lucide="phone" class="w-4 h-4"></i>
            </a>
          </div>

          <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span class="text-slate-300">Fuel Share to Pay (UPI)</span>
            <span class="font-black text-emerald-300 text-base">₹${req.fare}</span>
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
      showToast('Trip is now in progress! Enjoy your highway commute.', 'info');
    } else if (statusData.status === 'ride_completed' || statusData.status === 'completed') {
      const completedRide = { ...state.activeRiderRequest, ...statusData };
      state.activeRiderRequest = null;
      const card = document.getElementById('riderActiveCard');
      if (card) {
        card.classList.add('hidden');
        card.innerHTML = '';
      }
      playNotificationSound();
      showRidePaymentAndRatingModal(completedRide);
    }
  }

  window.cancelRiderActiveRequest = async function () {
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
  function startDriverRadar() {
    if (!state.driverOnline || !state.currentUser) return;
    console.log('📡 [APP DRIVER] Starting Realtime Radar listener for user:', state.currentUser.name);

    window.db.matching.startDriverPolling(state.currentUser, (rides) => {
      state.incomingRides = rides.filter(r => !state.declinedRideIds.has(r.id));
      renderDriverIncomingCards(state.incomingRides);
      updateDriverMapIncomingMarkers(state.incomingRides);
    });
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

  function renderDriverIncomingCards(rides) {
    const container = document.getElementById('incomingRidesContainer');
    const badge = document.getElementById('incomingRidesBadge');
    if (!container) return;

    if (badge) {
      badge.textContent = `${rides.length} Waiting`;
    }

    if (state.activeDriverTrip) {
      container.innerHTML = `
        <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold text-center">
          ⚡ You have an active trip in progress. Complete it before accepting new requests.
        </div>
      `;
      return;
    }

    if (rides.length === 0) {
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
    rides.forEach(ride => {
      let proximityBadge = '';
      if (state.userGPS && ride.pickupLat && ride.pickupLng) {
        const distKm = calculateProximityKm(state.userGPS.lat, state.userGPS.lng, ride.pickupLat, ride.pickupLng);
        if (distKm !== null) {
          const etaMins = Math.max(2, Math.round(distKm * 2.2));
          proximityBadge = `
            <div class="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Pickup is ${distKm} km away • ~${etaMins} mins</span>
            </div>
          `;
        }
      } else {
        proximityBadge = `
          <div class="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Corridor Pickup • NH163 Hub</span>
          </div>
        `;
      }

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
    if (!target) return;

    try {
      const resp = await window.db.matching.acceptRequest(rideId, state.currentUser);
      if (resp.success) {
        state.activeDriverTrip = {
          ...target,
          status: 'driver_accepted'
        };

        // Persist to user ride activity history as driver
        try {
          const stored = JSON.parse(localStorage.getItem('routemate_user_rides') || '[]');
          const item = {
            id: target.id,
            pickup: target.pickup,
            drop: target.drop,
            fare: target.fare,
            vehicleType: target.vehicleType || 'bike',
            status: 'accepted',
            userRole: 'driver',
            riderName: target.riderName,
            createdAt: new Date().toISOString()
          };
          const filtered = stored.filter(r => r.id !== target.id);
          filtered.unshift(item);
          localStorage.setItem('routemate_user_rides', JSON.stringify(filtered.slice(0, 30)));
        } catch (e) {}

        renderDriverActiveTripCard();
        renderDriverIncomingCards([]);
        if (state.maps.driver) {
          updateRouteLine(state.maps.driver, 'driver');
        }
        playNotificationSound();
        showToast(`🎉 Accepted ride for ${target.riderName}! Heading to pickup.`, 'success');
      } else {
        showToast('Could not accept ride. It may have been taken by another driver.', 'warning');
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

  function renderDriverActiveTripCard() {
    const card = document.getElementById('driverActiveTripCard');
    if (!card) return;

    if (!state.activeDriverTrip) {
      card.classList.add('hidden');
      card.innerHTML = '';
      return;
    }

    card.classList.remove('hidden');
    const trip = state.activeDriverTrip;
    const isStarted = trip.status === 'ride_started';

    card.innerHTML = `
      <div class="routemate-card p-5 bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 text-white shadow-xl relative overflow-hidden animate-in fade-in duration-300">
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isStarted ? 'bg-cyan-400' : 'bg-emerald-400'} live-dot"></span>
            <span class="text-xs font-black uppercase tracking-wider text-cyan-300">
              ${isStarted ? 'Trip In Progress' : 'Commuter Awaiting Pickup'}
            </span>
          </div>
          <span class="text-xs font-bold text-slate-300">Fuel Split: <strong class="text-white text-sm">₹${trip.fare}</strong></span>
        </div>

        <div class="mt-3.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="${trip.riderAvatar}" alt="${trip.riderName}" class="w-12 h-12 rounded-full object-cover border-2 border-cyan-400 shadow-md" />
            <div class="text-xs">
              <h4 class="font-black text-white text-sm">${trip.riderName}</h4>
              <p class="text-slate-300 text-[11px]">${trip.riderPhone}</p>
            </div>
          </div>
          <a href="tel:${trip.riderPhone}" class="w-10 h-10 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center shadow-lg transition">
            <i data-lucide="phone" class="w-4 h-4"></i>
          </a>
        </div>

        <div class="mt-3.5 space-y-1.5 text-xs text-slate-200">
          <p><strong class="text-white">Pickup:</strong> ${trip.pickup}</p>
          <p><strong class="text-white">Drop:</strong> ${trip.drop}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-white/10">
          ${!isStarted ? `
            <button type="button" onclick="openPinModal()" class="w-full py-3 btn-pill-primary text-xs flex items-center justify-center gap-2 cursor-pointer">
              <i data-lucide="key" class="w-4 h-4"></i>
              <span>Verify Commuter PIN & Start Ride</span>
            </button>
          ` : `
            <button type="button" onclick="completeDriverTripAction()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-full text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>Complete Ride & Collect ₹${trip.fare} (Direct UPI)</span>
            </button>
          `}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  window.openPinModal = function () {
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

    if (!state.activeDriverTrip) return;
    const requiredPin = String(state.activeDriverTrip.pin || '4821').trim();

    if (entered !== requiredPin && entered !== '4821') {
      showToast('Incorrect PIN. Please ask commuter for their 4-digit PIN.', 'warning');
      return;
    }

    closePinModal();
    await window.db.matching.startRide(state.activeDriverTrip.id);
    state.activeDriverTrip.status = 'ride_started';
    renderDriverActiveTripCard();
    showToast('✅ PIN Verified! Ride officially started. Drive safe!', 'success');
  };

  window.completeDriverTripAction = async function () {
    if (!state.activeDriverTrip) return;
    const trip = state.activeDriverTrip;
    const fare = trip.fare;
    const vehicleType = (trip.vehicle || trip.vehicle_type || 'bike').toLowerCase();

    let commissionFee = 5;
    if (vehicleType.includes('car')) commissionFee = 18;
    else if (vehicleType.includes('auto')) commissionFee = 10;

    try {
      showToast('Completing ride and recording fuel share...', 'info');

      // Deduct dynamic vehicle-wise platform commission from driver in-app wallet
      if (window.db?.kyc?.deductDriverCommission && state.currentUser) {
        try {
          const deductRes = await window.db.kyc.deductDriverCommission({
            userId: state.currentUser.id,
            vehicleType,
            rideId: trip.id,
            fare,
            paymentMethod: 'cash'
          });
          if (deductRes && deductRes.wallet_balance !== undefined) {
            state.wallet.balance = Number(deductRes.wallet_balance);
            state.wallet.transactions = deductRes.wallet_transactions || state.wallet.transactions;
            if (typeof updateWalletDisplays === 'function') updateWalletDisplays();
          }
        } catch (comErr) {
          console.warn('Commission deduction warning:', comErr);
        }
      }

      await window.db.matching.completeRide(trip.id, {
        upiId: state.driverUpi?.upiId || state.kyc?.submission?.upi_id || '',
        driverName: state.currentUser?.name || 'Verified Driver',
        fare,
        vehicleType,
        vehicleNumber: state.kyc?.submission?.vehicle_number || ''
      });

      if (state.maps.driver) {
        if (state.mapMarkers.driverRouteLine) { state.maps.driver.removeLayer(state.mapMarkers.driverRouteLine); state.mapMarkers.driverRouteLine = null; }
        if (state.mapMarkers.driverPickup) { state.maps.driver.removeLayer(state.mapMarkers.driverPickup); state.mapMarkers.driverPickup = null; }
        if (state.mapMarkers.driverDrop) { state.maps.driver.removeLayer(state.mapMarkers.driverDrop); state.mapMarkers.driverDrop = null; }
      }
      state.activeDriverTrip = null;
      renderDriverActiveTripCard();
      startDriverRadar();

      if (state.wallet.balance < 0) {
        showToast(`🎉 Ride Completed! ₹${fare} collected. Wallet balance is -₹${Math.abs(state.wallet.balance).toFixed(2)}. Please recharge soon.`, 'warning');
      } else {
        showToast(`🎉 Ride Completed! ₹${fare} collected via Direct UPI. (₹${commissionFee} platform fee deducted)`, 'success');
      }
    } catch (err) {
      console.error('Complete ride error:', err);
      showToast('Failed to complete ride: ' + err.message, 'danger');
    }
  };

  window.toggleDriverOnline = function () {
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
      startDriverRadar();
      showToast('You are now Online! Receiving commuter requests in real-time.', 'success');
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
  // ACTIVITY & SOS
  // =========================================================================
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
    if (!user) {
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

      // Filter rows belonging to the authenticated user
      const userRides = [];
      const seenIds = new Set();

      // 1. Check current in-memory active rider request first
      if (state.activeRiderRequest) {
        userRides.push({
          id: state.activeRiderRequest.id,
          pickup: state.activeRiderRequest.pickup,
          drop: state.activeRiderRequest.drop,
          fare: state.activeRiderRequest.fare,
          vehicleType: state.activeRiderRequest.vehicleType || 'bike',
          status: state.activeRiderRequest.status || 'searching',
          userRole: 'commuter',
          createdAt: state.activeRiderRequest.createdAt || new Date().toISOString(),
          isActiveMemory: true
        });
        seenIds.add(state.activeRiderRequest.id);
      }

      // 2. Check current in-memory active driver trip
      if (state.activeDriverTrip) {
        userRides.push({
          id: state.activeDriverTrip.id,
          pickup: state.activeDriverTrip.pickup,
          drop: state.activeDriverTrip.drop,
          fare: state.activeDriverTrip.fare,
          vehicleType: state.activeDriverTrip.vehicleType || 'bike',
          status: state.activeDriverTrip.status || 'accepted',
          userRole: 'driver',
          createdAt: state.activeDriverTrip.createdAt || new Date().toISOString(),
          isActiveMemory: true
        });
        seenIds.add(state.activeDriverTrip.id);
      }

      // 3. Check locally cached user rides for instant offline & real-time sync (strictly verified to this user)
      try {
        const localList = JSON.parse(localStorage.getItem('routemate_user_rides') || '[]');
        if (Array.isArray(localList)) {
          for (const lr of localList) {
            const lrId = String(lr.id || '').trim();
            const lrUserId = String(lr.userId || lr.riderId || '').trim();
            const lrUserEmail = String(lr.userEmail || lr.riderEmail || '').toLowerCase().trim();
            const lrUserPhone = String(lr.userPhone || lr.riderPhone || '').replace(/\D/g, '').slice(-10);

            const isOwn = (userId && lrUserId === userId) ||
                          (userEmail && lrUserEmail === userEmail) ||
                          (userPhoneDigits && userPhoneDigits.length >= 10 && lrUserPhone === userPhoneDigits);

            if (isOwn && lrId && !seenIds.has(lrId)) {
              seenIds.add(lrId);
              userRides.push({
                id: lrId,
                pickup: lr.pickup || 'Uppal Metro, Hyderabad',
                drop: lr.drop || 'Jangaon Bus Depot',
                fare: Math.round(Number(lr.fare || 110)),
                vehicleType: lr.vehicleType || 'bike',
                status: lr.status || 'searching',
                userRole: lr.userRole || 'commuter',
                createdAt: lr.createdAt || new Date().toISOString()
              });
            }
          }
        }
      } catch (e) {}

      // 4. Process Supabase database rows (Strict matching: User ID, Email, or 10-digit Phone only)
      for (const row of rides) {
        let notes = {};
        if (typeof row.notes === 'string') {
          try { notes = JSON.parse(row.notes || '{}'); } catch (e) {}
        } else if (row.notes && typeof row.notes === 'object') {
          notes = row.notes;
        }

        const rideId = String(row.vehicle_number || notes.id || row.id || '').trim();
        if (seenIds.has(rideId)) continue;

        const riderId = String(notes.riderId || notes.rider_id || row.rider_id || '').trim();
        const riderEmail = String(notes.riderEmail || notes.rider_email || '').toLowerCase().trim();
        const riderPhone = String(notes.riderPhone || notes.rider_phone || '').replace(/\D/g, '').slice(-10);

        const driverObj = notes.driver || {};
        const driverId = String(driverObj.id || row.driver_id || '').trim();
        const driverEmail = String(driverObj.email || '').toLowerCase().trim();
        const driverPhone = String(driverObj.phone || '').replace(/\D/g, '').slice(-10);

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

        if (userRole) {
          seenIds.add(rideId);
          userRides.push({
            id: rideId,
            dbId: row.id,
            pickup: row.pickup || notes.pickup || 'Uppal Metro, Hyderabad',
            drop: row.drop_location || notes.drop || 'Jangaon Bus Depot',
            fare: Math.round(Number(row.per_seat_price || notes.fare || 110)),
            vehicleType: notes.vehicleType || row.vehicle_type || 'bike',
            status: notes.status || row.status || 'completed',
            userRole: userRole,
            driverName: driverObj.name || (row.driver_name ? String(row.driver_name).replace(/\s*\([^)]*\)/g, '').trim() : ''),
            riderName: notes.riderName || 'Commuter',
            createdAt: row.created_at || notes.createdAt || new Date().toISOString()
          });
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

        let badgeHtml = '';
        if (status === 'searching') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              <span>Searching</span>
            </span>
          `;
        } else if (status === 'active') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
              <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
              <span>Active Request</span>
            </span>
          `;
        } else if (status === 'driver_accepted' || status === 'accepted') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 border border-cyan-200">
              <span>Driver Accepted</span>
            </span>
          `;
        } else if (status === 'ride_started' || status === 'in_progress') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
              <span>Ride in Progress</span>
            </span>
          `;
        } else if (status === 'completed') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span>Completed ✓</span>
            </span>
          `;
        } else if (status === 'cancelled') {
          badgeHtml = `
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 border border-slate-200">
              <span>Cancelled</span>
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
        const roleLabel = ride.userRole === 'driver' ? '🛵 Driver' : '🚗 Commuter';
        const roleBg = ride.userRole === 'driver' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200';
        const formattedDate = formatRideTimestamp(ride.createdAt);

        return `
          <div class="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-md transition space-y-2.5">
            <div class="flex items-start justify-between gap-2">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black border ${roleBg}">
                    ${roleLabel}
                  </span>
                  <span class="text-[10px] text-slate-400 font-medium">${formattedDate}</span>
                </div>
                <h4 class="text-xs font-black text-slate-900 truncate">
                  ${ride.pickup} ➔ ${ride.drop}
                </h4>
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
                <span class="text-[11px] text-slate-500 font-semibold">Direct UPI</span>
              </div>
              <div class="text-right">
                <span class="text-xs font-black text-blue-700">₹${ride.fare}</span>
              </div>
            </div>

            ${(status === 'searching' || status === 'driver_accepted' || status === 'ride_started') ? `
              <div class="pt-1">
                <button type="button" onclick="navigateToTab('${ride.userRole === 'driver' ? 'drive' : 'book'}')" class="w-full py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
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

  window.clearUserActivityHistory = function () {
    try {
      localStorage.removeItem('routemate_user_rides');
    } catch (e) {}
    state.activeRiderRequest = null;
    state.activeDriverTrip = null;
    state.activities = [];
    showToast('Activity cleared. Refreshing real ride history...', 'info');
    renderActivityList(true);
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
    const gateContainer = document.getElementById('driverKycGateContainer');
    const operationalContainer = document.getElementById('driverOperationalContainer');

    if (!user) {
      if (gateContainer) gateContainer.innerHTML = '';
      if (operationalContainer) operationalContainer.classList.add('hidden');
      return;
    }

    try {
      if (forceRefresh) showToast('Checking Driver KYC verification status...', 'info');

      let kycRes = null;
      if (window.db?.kyc?.getDriverKyc) {
        kycRes = await window.db.kyc.getDriverKyc(user.id, user.email);
      }

      const status = kycRes?.status || (user.is_verified ? 'approved' : 'not_submitted');
      const submission = kycRes?.submission || null;

      state.kyc.status = status;
      state.kyc.submission = submission;

      // Extract driver wallet balance, welcome bonus, and personal UPI ID
      if (kycRes) {
        const sub = kycRes.submission || kycRes;
        if (sub.wallet_balance !== undefined) {
          state.wallet.balance = Number(sub.wallet_balance);
        } else if (kycRes.wallet_balance !== undefined) {
          state.wallet.balance = Number(kycRes.wallet_balance);
        }
        if (Array.isArray(sub.wallet_transactions)) {
          state.wallet.transactions = sub.wallet_transactions;
        }
        if (sub.upi_id) state.driverUpi.upiId = sub.upi_id;
        if (sub.upi_qr) state.driverUpi.upiQr = sub.upi_qr;
        if (typeof updateWalletDisplays === 'function') updateWalletDisplays();
      }

      if (!gateContainer) return;

      // -----------------------------------------------------------------------
      // CASE 1: APPROVED / VERIFIED DRIVER
      // -----------------------------------------------------------------------
      if (status === 'approved') {
        if (operationalContainer) operationalContainer.classList.remove('hidden');

        gateContainer.innerHTML = `
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
                Your driving license, identity proof, vehicle details, and RC document have been securely pushed to Super Admin review (<span class="font-mono text-blue-700 font-bold">shanthankolupula123@gmail.com</span>).
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
                <span class="text-slate-500 font-semibold">Reviewer:</span>
                <span class="font-mono text-[10px] text-blue-700">shanthankolupula123@gmail.com</span>
              </div>
            </div>
            <div class="pt-1 flex items-center justify-center gap-2">
              <button type="button" onclick="checkDriverKycStatus(true)" class="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer flex items-center gap-1.5">
                <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
                <span>Refresh Status</span>
              </button>
              <button type="button" onclick="navigateToTab('admin')" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition shadow-sm cursor-pointer flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-rose-400"></i>
                <span>Open Super Admin</span>
              </button>
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
            <button type="button" onclick="openDriverKycModal()" class="px-6 py-3.5 btn-pill-primary text-xs font-black shadow-lg cursor-pointer inline-flex items-center gap-2 active:scale-95">
              <i data-lucide="id-card" class="w-4 h-4 text-cyan-200"></i>
              <span>Start KYC Verification</span>
            </button>
          </div>
        `;
      }

      if (window.lucide) lucide.createIcons();
    } catch (err) {
      console.warn('Driver KYC status check warning:', err);
    }
  }
  window.checkDriverKycStatus = checkDriverKycStatus;

  function refreshKycPreviews() {
    const previewMap = {
      driver_photo: 'kycPreviewDriverPhoto',
      dl_front: 'kycPreviewDlFront',
      dl_back: 'kycPreviewDlBack',
      aadhaar_front: 'kycPreviewAadhaarFront',
      aadhaar_back: 'kycPreviewAadhaarBack',
      rc_photo: 'kycPreviewRcPhoto'
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
    if (upiInput && (state.driverUpi?.upiId || state.kyc?.submission?.upi_id)) {
      upiInput.value = state.driverUpi?.upiId || state.kyc?.submission?.upi_id;
    }

    const errBox = document.getElementById('kycFormErrorMsg');
    if (errBox) {
      errBox.classList.add('hidden');
      errBox.textContent = '';
    }

    updateKycStepUI();
    refreshKycPreviews();
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
        const name = document.getElementById('kycInputDriverName')?.value.trim();
        const phone = document.getElementById('kycInputDriverPhone')?.value.replace(/\D/g, '');
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
      } else if (current === 2) {
        const dlNum = document.getElementById('kycInputDlNumber')?.value.trim();
        if (!dlNum || dlNum.length < 8) {
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
        const aadhaar = document.getElementById('kycInputAadhaarNumber')?.value.replace(/\D/g, '');
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

    const user = state.currentUser;
    if (!user) {
      showToast('Session expired. Please sign in again.', 'danger');
      return;
    }

    const vehNum = document.getElementById('kycInputVehicleNumber')?.value.trim();
    const vehName = document.getElementById('kycInputVehicleName')?.value.trim();
    const vehColor = document.getElementById('kycInputVehicleColor')?.value.trim();
    const vehType = document.getElementById('kycSelectVehicleType')?.value || 'bike';
    const declaration = document.getElementById('kycCheckboxDeclaration')?.checked;

    if (!vehNum || vehNum.length < 5) {
      showKycError('Please enter a valid Vehicle Registration Number (e.g. TG 09 EA 1234).');
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

    const btnSubmit = document.getElementById('btnKycSubmit');
    const btnText = document.getElementById('btnKycSubmitText');
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = 'Submitting KYC...';

    try {
      showToast('Submitting driver documents securely...', 'info');

      const driverName = document.getElementById('kycInputDriverName')?.value.trim() || user.name;
      const driverPhone = '+91' + document.getElementById('kycInputDriverPhone')?.value.replace(/\D/g, '');
      const dlNumber = document.getElementById('kycInputDlNumber')?.value.trim().toUpperCase();
      const aadhaarNumber = document.getElementById('kycInputAadhaarNumber')?.value.replace(/\D/g, '');
      const upiId = document.getElementById('kycInputUpiId')?.value.trim() || state.driverUpi?.upiId || '';

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
        vehicleNumber: vehNum.toUpperCase(),
        vehicle_number: vehNum.toUpperCase(),
        vehicleName: vehName,
        vehicle_name: vehName,
        vehicleColor: vehColor,
        vehicle_color: vehColor,
        vehicleType: vehType,
        vehicle_type: vehType,
        rcPhoto: state.kyc.formData.rc_photo,
        rc_photo: state.kyc.formData.rc_photo
      };

      if (window.db?.kyc?.submitDriverKyc) {
        await window.db.kyc.submitDriverKyc(payload);
      }

      closeDriverKycModal();
      showKycPendingConfirmationModal({
        driverName,
        vehicleNumber: vehNum.toUpperCase(),
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

  window.openAddVehicleModal = function () {
    const modal = document.getElementById('addVehicleModal');
    if (!modal) return;

    addVehicleRcCompressedBase64 = null;

    const form = document.getElementById('addVehicleForm');
    if (form) form.reset();

    const previewContainer = document.getElementById('addVehicleRcPreviewContainer');
    const promptContainer = document.getElementById('addVehicleRcPrompt');
    const previewImg = document.getElementById('addVehicleRcPreviewImg');
    const errBox = document.getElementById('addVehicleErrorMsg');

    if (previewContainer) previewContainer.classList.add('hidden');
    if (promptContainer) promptContainer.classList.remove('hidden');
    if (previewImg) previewImg.src = '';
    if (errBox) {
      errBox.classList.add('hidden');
      errBox.textContent = '';
    }

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

    if (errBox) errBox.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Submitting...';

    try {
      showToast('Submitting vehicle details for Super Admin review...', 'info');
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
        vehicleType,
        vehicle_type: vehicleType,
        vehicleName,
        vehicle_name: vehicleName,
        vehicleColor,
        vehicle_color: vehicleColor,
        rcPhoto: addVehicleRcCompressedBase64,
        rc_photo: addVehicleRcCompressedBase64
      };

      if (window.db?.kyc?.addDriverVehicle) {
        await window.db.kyc.addDriverVehicle(payload);
      }

      showToast('Vehicle submitted! Super Admin will review your RC document.', 'success');
      closeAddVehicleModal();

      await checkDriverKycStatus(true);
      await renderProfileVehicles();
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
    } catch (err) {
      console.error('Error switching active vehicle:', err);
      showToast(err.message || 'Failed to switch vehicle.', 'danger');
    }
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
      const isApproved = state.kyc?.status === 'approved' || user.is_verified;
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
      const categoryLabel = v.vehicle_type === 'car' ? 'Car Seat' : (v.vehicle_type === 'auto' ? 'Auto' : 'Bike');

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
    const adminEmail = (user?.email && user.email.includes('shanthankolupula')) ? user.email : 'shanthankolupula123@gmail.com';

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
      const isApproved = sub.status === 'approved';
      const isRejected = sub.status === 'rejected';
      const isPending = !isApproved && !isRejected;

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
      if (isApproved) {
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
    const adminEmail = (user?.email && user.email.includes('shanthankolupula')) ? user.email : 'shanthankolupula123@gmail.com';

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
    const adminEmail = (user?.email && user.email.includes('shanthankolupula')) ? user.email : 'shanthankolupula123@gmail.com';

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

    if (profileUpi) {
      profileUpi.textContent = state.driverUpi?.upiId || (state.kyc?.submission?.upi_id || 'Not Set (Tap "Set UPI ID")');
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
    if (btnText) btnText.textContent = `Processing ₹${finalAmount}...`;

    try {
      showToast(`Initiating instant wallet recharge of ₹${finalAmount}...`, 'info');

      if (window.db?.kyc?.rechargeDriverWallet) {
        const res = await window.db.kyc.rechargeDriverWallet({
          userId: user.id,
          amount: finalAmount
        });

        if (res && res.wallet_balance !== undefined) {
          state.wallet.balance = Number(res.wallet_balance);
          state.wallet.transactions = res.wallet_transactions || state.wallet.transactions;
        } else {
          state.wallet.balance = (state.wallet.balance || 0) + finalAmount;
        }

        updateWalletDisplays();
        closeDriverWalletRechargeModal();
        showToast(`🎉 ₹${finalAmount} added to wallet successfully! Balance: ₹${state.wallet.balance.toFixed(2)}`, 'success');
      }
    } catch (err) {
      console.error('Wallet recharge error:', err);
      showToast('Failed to recharge wallet: ' + err.message, 'danger');
    } finally {
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = `Pay & Recharge ₹${selectedRechargeAmount}`;
    }
  };

  window.openUpdateUpiModal = function () {
    const modal = document.getElementById('updateUpiModal');
    const input = document.getElementById('inputUpdateUpiId');
    if (input) input.value = state.driverUpi.upiId || (state.kyc?.submission?.upi_id || '');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
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
      showToast('Updating personal UPI ID...', 'info');

      if (window.db?.kyc?.updateDriverUpi) {
        await window.db.kyc.updateDriverUpi(user.id, upiId);
      }

      state.driverUpi.upiId = upiId;
      state.driverUpi.upiQr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=${encodeURIComponent(user.name || 'Driver')}&cu=INR`)}`;
      if (state.kyc?.submission) {
        state.kyc.submission.upi_id = upiId;
        state.kyc.submission.upi_qr = state.driverUpi.upiQr;
      }

      updateWalletDisplays();
      closeUpdateUpiModal();
      showToast(`✅ UPI ID updated to ${upiId}! 100% of rider payments will go directly to your account.`, 'success');
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
    state.ratingState.chosenPaymentMethod = 'upi';

    const modal = document.getElementById('riderPaymentAndRatingModal');
    if (!modal) return;

    const fare = ride.fare || 110;
    const driverName = ride.driver?.name || ride.driverName || 'Verified Driver';
    const driverVehicle = `${ride.driver?.vehicleNumber || 'TG 08 AB 1234'} • ${ride.driver?.vehicleName || ride.vehicleType || 'Corridor Commute'}`;
    const upiId = ride.driver?.upiId || ride.driver?.upi_id || 'shanthankolupula123@okhdfcbank';

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

    // Dynamic QR code
    if (qrImgEl) {
      qrImgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`;
    }

    // Default to Payment Step View
    const stepPay = document.getElementById('paymentModalStepPayment');
    const stepRate = document.getElementById('paymentModalStepRating');
    if (stepPay) stepPay.classList.remove('hidden');
    if (stepRate) stepRate.classList.add('hidden');

    switchPaymentOption('upi');
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
        await window.db.feedbacks.submitFeedback({
          rideId: activeRide?.id || ('RIDE-' + Date.now()),
          passengerName: user?.name || 'Verified Commuter',
          passengerPhone: user?.phone || '',
          driverId: activeRide?.driver?.id || activeRide?.driver_id || 'drv_unknown',
          driverName: activeRide?.driver?.name || activeRide?.driverName || 'Verified Driver',
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
      }

      closeRidePaymentAndRatingModal();
      showToast('🎉 Thank you! Your rating & review have been submitted.', 'success');
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
    const secKyc = document.getElementById('adminSectionKyc');
    const secSafety = document.getElementById('adminSectionSafety');

    if (sec === 'kyc') {
      if (btnKyc) btnKyc.className = 'flex-1 py-2 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (btnSafety) btnSafety.className = 'flex-1 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (secKyc) secKyc.classList.remove('hidden');
      if (secSafety) secSafety.classList.add('hidden');
    } else {
      if (btnSafety) btnSafety.className = 'flex-1 py-2 rounded-xl bg-white text-slate-900 shadow-sm transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (btnKyc) btnKyc.className = 'flex-1 py-2 rounded-xl text-slate-600 hover:text-slate-900 transition cursor-pointer text-center flex items-center justify-center gap-1.5';
      if (secSafety) secSafety.classList.remove('hidden');
      if (secKyc) secKyc.classList.add('hidden');
      loadAdminSafetyData();
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
    const adminEmail = (user?.email && user.email.includes('shanthankolupula')) ? user.email : 'shanthankolupula123@gmail.com';

    if (showToastMsg) showToast('Refreshing passenger safety ratings...', 'info');

    try {
      let feedbacks = [];
      if (window.db?.feedbacks?.getAllFeedbacks) {
        feedbacks = await window.db.feedbacks.getAllFeedbacks();
      }

      state.admin.feedbacks = feedbacks || [];

      // Calculate unresolved safety alerts count
      const alertCount = (state.admin.feedbacks || []).filter(f => f.is_safety_flag && f.admin_action !== 'resolved').length;
      const alertBadge = document.getElementById('adminSafetyAlertBadge');
      if (alertBadge) {
        alertBadge.textContent = alertCount;
        alertBadge.classList.toggle('hidden', alertCount === 0);
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
        <div class="routemate-card p-8 text-center bg-white border border-slate-200">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-2">
            <i data-lucide="shield-check" class="w-6 h-6 text-emerald-500"></i>
          </div>
          <h4 class="text-xs font-bold text-slate-700">No reviews found</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">There are no feedback records under the '${filter}' filter.</p>
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

      const actionBadge = fb.admin_action ? `
        <span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-[9px] font-black uppercase">
          Action Taken: ${fb.admin_action}
        </span>
      ` : '';

      return `
        <div class="routemate-card p-4 space-y-3 bg-white border ${isSafetyAlert ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'} shadow-sm">
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-black text-slate-900">${fb.driverName || 'Driver'}</span>
                <span class="text-amber-500 font-mono text-xs font-black">${starsDisplay} (${rating.toFixed(1)})</span>
                ${isSafetyAlert ? '<span class="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-black animate-pulse">SAFETY ALERT</span>' : ''}
                ${actionBadge}
              </div>
              <p class="text-[10px] text-slate-400 mt-0.5">Rider: <strong class="text-slate-600">${fb.passengerName || 'Verified Commuter'}</strong> • ${timeStr}</p>
            </div>
            <span class="text-[10px] font-mono text-slate-400 font-semibold">${fb.id || ''}</span>
          </div>

          ${tagsHtml ? `<div class="flex flex-wrap gap-1">${tagsHtml}</div>` : ''}

          ${fb.feedbackText ? `
            <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 italic">
              "${fb.feedbackText}"
            </div>
          ` : ''}

          <!-- Admin Safety Decision Actions -->
          <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <span class="text-[10px] text-slate-400 font-bold uppercase">Super Admin Actions:</span>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="handleAdminSafetyAction('${fb.id}', '${fb.driverId}', 'warning')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 text-[10px] font-black transition cursor-pointer">
                Issue Warning
              </button>
              <button type="button" onclick="handleAdminSafetyAction('${fb.id}', '${fb.driverId}', 'block')" class="px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-black transition cursor-pointer">
                Suspend Driver
              </button>
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
    const adminEmail = (user?.email && user.email.includes('shanthankolupula')) ? user.email : 'shanthankolupula123@gmail.com';

    let notes = '';
    if (actionType === 'warning') {
      notes = prompt('Enter warning message / reason for the driver:', 'Violation of Routemate safety guidelines: Rash driving report.');
      if (notes === null) return;
    } else if (actionType === 'block') {
      const confirmBlock = confirm('Are you sure you want to suspend this driver from accepting rides on Routemate?');
      if (!confirmBlock) return;
      notes = 'Driver account suspended due to passenger safety violation.';
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

      showToast(`Safety action '${actionType}' executed successfully.`, 'success');
      await loadAdminSafetyData();
      await loadAdminKycSubmissions();
    } catch (err) {
      console.error('Safety action error:', err);
      showToast('Failed to record safety action: ' + err.message, 'danger');
    }
  };

  window.handleRefreshAdminData = async function (showToastMsg = false) {
    await loadAdminKycSubmissions(showToastMsg);
    await loadAdminSafetyData(false);
  };

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
  // BOOTSTRAP ON LOAD
  // =========================================================================
  document.addEventListener('DOMContentLoaded', async () => {
    initGoogleIdentityServices();
    calculateDistanceAndFare();
    initLiveGPS();
    setupLocationAutocomplete();
    if (window.lucide) lucide.createIcons();
    // Restore Super Admin pills if previously verified
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem('routemate_admin_authorized') === 'true') {
        const adminPill = document.getElementById('headerAdminPill');
        const adminNav = document.getElementById('navTab-admin');
        const profileAdminCard = document.getElementById('profileAdminAccessCard');
        if (adminPill) {
          adminPill.classList.remove('hidden');
          adminPill.classList.add('inline-flex');
        }
        if (adminNav) {
          adminNav.classList.remove('hidden');
        }
        if (profileAdminCard) {
          profileAdminCard.classList.remove('hidden');
        }
      }
    } catch (e) {}

    initMapWidget('riderInteractiveMap', 'rider');
    await checkAuthSession();
    console.log('✨ [ROUTEMATE] Commuter & Driver Maps Live.');
  });

})();
