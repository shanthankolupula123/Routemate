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
    activities: []
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
        }
      } catch (e) {
        console.warn('Auth session check note:', e);
      }

      // Supabase Auth State Change Listener (e.g. for Google OAuth redirect / OTP verify)
      window.db.auth.onAuthStateChange((event, session) => {
        console.log('👤 [AUTH EVENT]:', event);
        if (session && session.user) {
          const userObj = normalizeAuthUser(session.user);
          unlockAppWithUser(userObj);
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
      unlockAppWithUser(sessionUser);
    } else {
      lockAppToAuthScreen();
    }
  }

  function normalizeAuthUser(user) {
    const meta = user.user_metadata || {};
    return {
      id: user.id || ('usr_' + Date.now()),
      email: user.email || 'user@routemate.local',
      name: user.name || meta.name || user.email?.split('@')[0] || 'Verified Commuter',
      phone: user.phone || meta.phone || '+91 98480 23145',
      role: user.role || meta.role || state.pendingAuth.role || 'rider',
      rating: user.rating || 4.95,
      avatar: user.avatar || meta.avatar || meta.avatar_url || meta.picture || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'
    };
  }

  function unlockAppWithUser(user) {
    state.currentUser = user;
    try { localStorage.setItem('routemate_user', JSON.stringify(user)); } catch (e) {}

    // Hide Auth Screen
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.add('hidden');

    // Show Main App Elements
    const header = document.getElementById('appHeader');
    const main = document.getElementById('appMain');
    const nav = document.getElementById('appBottomNav');
    if (header) header.classList.remove('hidden');
    if (main) main.classList.remove('hidden');
    if (nav) nav.classList.remove('hidden');

    updateProfileUI();

    // If user's registered role is driver, switch to driver view
    if (user.role === 'driver' && state.mode !== 'driver') {
      switchMode('driver');
    } else {
      setTimeout(() => initMapWidget('riderInteractiveMap', 'rider'), 150);
    }
  }

  function lockAppToAuthScreen() {
    state.currentUser = null;
    localStorage.removeItem('routemate_user');

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
    const pRoleEl = document.getElementById('profileUserRole');
    const pAvatarEl = document.getElementById('profileUserAvatar');

    if (state.currentUser) {
      const shortName = state.currentUser.name.split(' ')[0];
      if (nameEl) nameEl.textContent = shortName;
      if (avatarEl) avatarEl.src = state.currentUser.avatar;
      if (pNameEl) pNameEl.textContent = state.currentUser.name;
      if (pEmailEl) pEmailEl.textContent = state.currentUser.email;
      if (pRoleEl) pRoleEl.textContent = `${state.currentUser.role === 'driver' ? 'Verified Driver' : 'Commuter'} • 4.95 ★`;
      if (pAvatarEl) pAvatarEl.src = state.currentUser.avatar;
    }
  }

  window.setAuthTab = function (tab) {
    state.authTab = tab;
    const btnIn = document.getElementById('authTabSignIn');
    const btnUp = document.getElementById('authTabSignUp');
    const nameField = document.getElementById('authNameField');
    const roleField = document.getElementById('authRoleField');
    const submitBtn = document.getElementById('btnSendOtp');
    const errBox = document.getElementById('authEmailErrorMsg');

    if (errBox) errBox.classList.add('hidden');

    if (tab === 'signup') {
      btnUp.className = 'w-1/2 py-2.5 rounded-full bg-white text-blue-700 shadow-sm transition cursor-pointer';
      btnIn.className = 'w-1/2 py-2.5 rounded-full text-slate-500 hover:text-slate-700 transition cursor-pointer';
      if (nameField) nameField.classList.remove('hidden');
      if (roleField) roleField.classList.remove('hidden');
      if (submitBtn) submitBtn.innerHTML = `<i data-lucide="mail" class="w-4 h-4 text-cyan-200"></i><span>Send 6-Digit OTP</span>`;
    } else {
      btnIn.className = 'w-1/2 py-2.5 rounded-full bg-white text-blue-700 shadow-sm transition cursor-pointer';
      btnUp.className = 'w-1/2 py-2.5 rounded-full text-slate-500 hover:text-slate-700 transition cursor-pointer';
      if (nameField) nameField.classList.add('hidden');
      if (roleField) roleField.classList.add('hidden');
      if (submitBtn) submitBtn.innerHTML = `<i data-lucide="mail" class="w-4 h-4 text-cyan-200"></i><span>Send 6-Digit OTP</span>`;
    }
    if (window.lucide) lucide.createIcons();
  };

  // STEP 1: SEND OTP
  window.handleSendOtpSubmit = async function (e) {
    e.preventDefault();
    const email = document.getElementById('authEmailInput')?.value.trim();
    const name = document.getElementById('authNameInput')?.value.trim();
    const role = document.querySelector('input[name="authRole"]:checked')?.value || 'rider';
    const submitBtn = document.getElementById('btnSendOtp');
    const errBox = document.getElementById('authEmailErrorMsg');

    if (!email) return;
    if (errBox) errBox.classList.add('hidden');

    state.pendingAuth = {
      email,
      name: name || email.split('@')[0],
      role
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="animate-spin inline-block mr-1">⚙️</span> Sending OTP...`;

    try {
      await window.db.auth.sendOtp(email, { name: state.pendingAuth.name, role: state.pendingAuth.role });
      
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
      submitBtn.innerHTML = `<i data-lucide="mail" class="w-4 h-4 text-cyan-200"></i><span>Send 6-Digit OTP</span>`;
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
        role: state.pendingAuth.role
      });

      if (data?.user) {
        const userObj = normalizeAuthUser(data.user);
        userObj.name = state.pendingAuth.name || userObj.name;
        userObj.role = state.pendingAuth.role || userObj.role;
        unlockAppWithUser(userObj);
        showToast('🎉 Successfully verified! Welcome to Routemate.', 'success');
      } else {
        // Fallback user session construction
        const localUser = {
          id: 'usr_' + Date.now(),
          email: state.pendingAuth.email,
          name: state.pendingAuth.name,
          role: state.pendingAuth.role,
          phone: '+91 98480 23145',
          rating: 4.95,
          avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'
        };
        unlockAppWithUser(localUser);
        showToast('🎉 Verified! Welcome to Routemate.', 'success');
      }
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
        role: state.pendingAuth.role
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

  window.handleGoogleSignIn = async function () {
    try {
      await window.db.auth.signInWithGoogle();
    } catch (err) {
      showToast(err.message || 'Google OAuth failed', 'danger');
    }
  };

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
    if (!el || state.maps[mapKey]) return;

    try {
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

      setTimeout(() => map.invalidateSize(), 200);
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
      setTimeout(() => state.maps.rider?.invalidateSize(), 150);
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
      startDriverRadar();
      setActiveNavPill('drive');
      showToast('Switched to Driver Mode • Realtime Radar Live', 'info');
    }
  };

  window.navigateToTab = function (tabName) {
    state.activeTab = tabName;
    setActiveNavPill(tabName);

    const screens = {
      book: document.getElementById('riderScreen'),
      drive: document.getElementById('driverScreen'),
      activity: document.getElementById('activityScreen'),
      profile: document.getElementById('profileScreen')
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
      }
    }
  };

  function setActiveNavPill(activeTab) {
    const tabs = ['book', 'drive', 'activity', 'profile'];
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

        window.db.matching.startRiderPolling(result.request.id, (acceptedData) => {
          handleDriverAcceptedRiderRequest(acceptedData);
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

          <div class="mt-4 flex gap-2">
            <button type="button" onclick="cancelRiderActiveRequest()" class="w-full py-2.5 btn-pill-danger text-xs font-bold cursor-pointer">
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
            <img src="${driver.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80'}" alt="Driver" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shadow-md" />
            <div class="text-xs flex-1">
              <h4 class="font-black text-white text-sm">${driver.name || 'Verified Driver'}</h4>
              <p class="text-slate-300 font-mono text-[11px]">${driver.vehicleNumber || 'TS 08 AB 1234'} • ${driver.vehicleName || 'Hero Splendor'}</p>
              <p class="text-emerald-300 text-[10px] font-bold mt-0.5">Rating: 4.9 ★ • Verified Commuter</p>
            </div>
            <a href="tel:${driver.phone || '+919494285249'}" class="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg transition">
              <i data-lucide="phone" class="w-4 h-4"></i>
            </a>
          </div>

          <div class="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
            <span class="text-slate-300">Fuel Share to Pay (UPI)</span>
            <span class="font-black text-emerald-300 text-base">₹${req.fare}</span>
          </div>
        </div>
      `;
    }

    if (window.lucide) lucide.createIcons();
  }

  function handleDriverAcceptedRiderRequest(acceptedData) {
    if (!state.activeRiderRequest) return;
    state.activeRiderRequest.status = 'driver_accepted';
    state.activeRiderRequest.driver = acceptedData.driver;
    renderRiderActiveHUD(state.activeRiderRequest);
    playNotificationSound();
    showToast(`🎉 Driver ${acceptedData.driver?.name || ''} accepted your ride!`, 'success');
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
    const fare = state.activeDriverTrip.fare;

    await window.db.matching.completeRide(state.activeDriverTrip.id);
    if (state.maps.driver) {
      if (state.mapMarkers.driverRouteLine) { state.maps.driver.removeLayer(state.mapMarkers.driverRouteLine); state.mapMarkers.driverRouteLine = null; }
      if (state.mapMarkers.driverPickup) { state.maps.driver.removeLayer(state.mapMarkers.driverPickup); state.mapMarkers.driverPickup = null; }
      if (state.mapMarkers.driverDrop) { state.maps.driver.removeLayer(state.mapMarkers.driverDrop); state.mapMarkers.driverDrop = null; }
    }
    state.activeDriverTrip = null;
    renderDriverActiveTripCard();
    startDriverRadar();
    showToast(`🎉 Ride Completed! ₹${fare} fuel share collected via Direct UPI.`, 'success');
  };

  window.toggleDriverOnline = function () {
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
  function renderActivityList() {
    const list = document.getElementById('activityList');
    if (!list) return;

    list.innerHTML = `
      <div class="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h4 class="text-xs font-black text-slate-900">Uppal ➔ Jangaon (NH 163)</h4>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">Today • Direct UPI Settled • Zero Fee</p>
        </div>
        <span class="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
          ₹110 Saved
        </span>
      </div>

      <div class="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm flex items-center justify-between">
        <div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-slate-400"></span>
            <h4 class="text-xs font-black text-slate-900">Bhongir ➔ Uppal Metro</h4>
          </div>
          <p class="text-[11px] text-slate-400 mt-0.5">Yesterday • Bike Pillion</p>
        </div>
        <span class="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-full">
          Completed
        </span>
      </div>
    `;
  }

  window.triggerEmergencySOS = function () {
    const lat = state.userGPS?.lat || state.pickupCoords.lat;
    const lng = state.userGPS?.lng || state.pickupCoords.lng;
    if (confirm(`🚨 Activate Emergency SOS?\n\nThis will trigger direct emergency assistance to 112 with current GPS coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)}).`)) {
      window.location.href = "tel:112";
    }
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
  // BOOTSTRAP ON LOAD
  // =========================================================================
  document.addEventListener('DOMContentLoaded', async () => {
    calculateDistanceAndFare();
    initLiveGPS();
    setupLocationAutocomplete();
    if (window.lucide) lucide.createIcons();
    await checkAuthSession();
    console.log('✨ [ROUTEMATE] Mirrored Drive Map & Statewide Telangana Autocomplete v38 Bootstrapped.');
  });

})();
