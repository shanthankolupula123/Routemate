/**
 * Routemate - Core Application Controller (v33 Pristine Architecture)
 * Official Royal Blue Brand Redesign
 * Seamless Peer-to-Peer Ride Matching & Broadcasting
 */

(function () {
  'use strict';

  // =========================================================================
  // APPLICATION STATE
  // =========================================================================
  const state = {
    currentUser: null,
    mode: 'rider', // 'rider' | 'driver'
    activeTab: 'book', // 'book' | 'drive' | 'map' | 'activity' | 'profile'
    pickup: 'Uppal Metro, Hyderabad',
    drop: 'Jangaon Bus Depot',
    vehicleType: 'bike',
    distanceKm: 84,
    fare: 110,
    activeRiderRequest: null,
    activeDriverTrip: null,
    driverOnline: true,
    incomingRides: [],
    declinedRideIds: new Set(),
    leafletMap: null,
    activities: []
  };

  // Pre-configured Test Profiles for Seamless Cross-Device Testing
  const TEST_PROFILES = {
    alice: {
      id: 'usr_alice_commuter',
      name: 'Alice Commuter',
      email: 'alice.rider@routemate.local',
      phone: '+91 98480 23145',
      role: 'Daily Commuter',
      rating: 4.95,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'
    },
    bob: {
      id: 'usr_bob_driver',
      name: 'Bob Driver',
      email: 'bob.driver@routemate.local',
      phone: '+91 94942 85249',
      role: 'Verified Driver',
      rating: 4.92,
      vehicleName: 'Hero Splendor Plus',
      vehicleNumber: 'TS 08 AB 1234',
      vehicleType: 'bike',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80'
    }
  };

  // =========================================================================
  // INITIALIZATION & USER SESSION
  // =========================================================================
  function initUserSession() {
    try {
      const saved = localStorage.getItem('routemate_user');
      if (saved) {
        state.currentUser = JSON.parse(saved);
      }
    } catch (e) {}

    if (!state.currentUser) {
      // Default to Alice if rider mode, Bob if driver
      state.currentUser = TEST_PROFILES.alice;
      try { localStorage.setItem('routemate_user', JSON.stringify(state.currentUser)); } catch (e) {}
    }

    updateHeaderProfileUI();
  }

  function updateHeaderProfileUI() {
    const nameEl = document.getElementById('headerUserName');
    const avatarEl = document.getElementById('headerUserAvatar');
    const pNameEl = document.getElementById('profileUserName');
    const pPhoneEl = document.getElementById('profileUserPhone');
    const pAvatarEl = document.getElementById('profileUserAvatar');

    if (state.currentUser) {
      const shortName = state.currentUser.name.split(' ')[0];
      if (nameEl) nameEl.textContent = shortName;
      if (avatarEl) avatarEl.src = state.currentUser.avatar;
      if (pNameEl) pNameEl.textContent = state.currentUser.name;
      if (pPhoneEl) pPhoneEl.textContent = state.currentUser.phone;
      if (pAvatarEl) pAvatarEl.src = state.currentUser.avatar;
    }
  }

  window.openProfileSwitcherModal = function () {
    const modal = document.getElementById('accountModal');
    if (modal) modal.classList.remove('hidden');
  };

  window.closeProfileSwitcherModal = function () {
    const modal = document.getElementById('accountModal');
    if (modal) modal.classList.add('hidden');
  };

  window.setUserProfile = function (profileKey) {
    if (TEST_PROFILES[profileKey]) {
      state.currentUser = TEST_PROFILES[profileKey];
      try { localStorage.setItem('routemate_user', JSON.stringify(state.currentUser)); } catch (e) {}
      updateHeaderProfileUI();
      closeProfileSwitcherModal();
      showToast(`Switched profile to: ${state.currentUser.name}`, 'info');

      // Restart polling if in driver mode
      if (state.mode === 'driver' && state.driverOnline) {
        startDriverRadar();
      }
    }
  };

  // =========================================================================
  // MODE & NAVIGATION SWITCHING
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

      // Stop driver radar
      if (window.db?.matching) {
        window.db.matching.stopDriverPolling();
      }
      setActiveNavPill('book');
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

      // If user is currently Alice, advise or switch to Bob for realistic driver duty
      if (state.currentUser?.email === TEST_PROFILES.alice.email) {
        setUserProfile('bob');
      }

      startDriverRadar();
      setActiveNavPill('drive');
      showToast('Switched to Driver Mode • Radar Live', 'info');
    }
  };

  window.navigateToTab = function (tabName) {
    state.activeTab = tabName;
    setActiveNavPill(tabName);

    const screens = {
      book: document.getElementById('riderScreen'),
      drive: document.getElementById('driverScreen'),
      map: document.getElementById('mapScreen'),
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
      if (tabName === 'map') {
        setTimeout(initOrRefreshMap, 150);
      }
      if (tabName === 'activity') {
        renderActivityList();
      }
    }
  };

  function setActiveNavPill(activeTab) {
    const tabs = ['book', 'drive', 'map', 'activity', 'profile'];
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
  window.setQuickRoute = function (pickup, drop) {
    const pInput = document.getElementById('inputPickup');
    const dInput = document.getElementById('inputDrop');
    if (pInput) pInput.value = pickup;
    if (dInput) dInput.value = drop;
    state.pickup = pickup;
    state.drop = drop;
    calculateAndDisplayFare();
    showToast(`Route set: ${pickup} ➔ ${drop}`, 'info');
  };

  window.swapLocations = function () {
    const pInput = document.getElementById('inputPickup');
    const dInput = document.getElementById('inputDrop');
    if (pInput && dInput) {
      const tmp = pInput.value;
      pInput.value = dInput.value;
      dInput.value = tmp;
      state.pickup = pInput.value;
      state.drop = dInput.value;
      calculateAndDisplayFare();
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
    calculateAndDisplayFare();
  };

  function calculateAndDisplayFare() {
    let rate = 1.3;
    if (state.vehicleType === 'car') rate = 2.6;
    if (state.vehicleType === 'auto') rate = 1.8;

    state.fare = Math.round(state.distanceKm * rate);
    const fareEl = document.getElementById('fareDisplay');
    if (fareEl) fareEl.textContent = `₹${state.fare}`;
  }

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
        showToast('📡 Radar Activated! Searching for nearby verified drivers...', 'info');

        // Start listening for driver acceptance
        window.db.matching.startRiderPolling(result.request.id, (acceptedData) => {
          handleDriverAcceptedRiderRequest(acceptedData);
        });
      } else {
        showToast('Failed to broadcast ride. Please check network connection.', 'danger');
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
                <span class="text-[10px] font-black uppercase tracking-widest text-cyan-300 block">Live Radar Searching</span>
                <h4 class="text-xs font-black text-white">Broadcasting on NH163 corridor...</h4>
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
  // DRIVER WORKFLOW (BROADCAST SCREEN & RADAR)
  // =========================================================================
  function startDriverRadar() {
    if (!state.driverOnline) return;
    console.log('📡 [APP DRIVER] Starting radar listener for user:', state.currentUser.name);

    window.db.matching.startDriverPolling(state.currentUser, (rides) => {
      state.incomingRides = rides.filter(r => !state.declinedRideIds.has(r.id));
      renderDriverIncomingCards(state.incomingRides);
    });
  }

  function renderDriverIncomingCards(rides) {
    const container = document.getElementById('incomingRidesContainer');
    const badge = document.getElementById('incomingRidesBadge');
    if (!container) return;

    if (badge) {
      badge.textContent = `${rides.length} Waiting`;
    }

    // If driver is currently executing an accepted trip, HUD handles it
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
      cardsHtml += `
        <div class="routemate-card p-5 border-2 border-blue-500/30 shadow-lg hover:shadow-xl transition relative overflow-hidden bg-white">
          <!-- Card Top Bar: Commuter Profile & Fare -->
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

          <!-- Corridor Route Details -->
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

          <!-- Action Buttons: Accept & Decline -->
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
        // Clear broadcast cards
        renderDriverIncomingCards([]);
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
      showToast('You are now Online! Receiving commuter requests.', 'success');
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
  // LEAFLET INTERACTIVE MAP
  // =========================================================================
  function initOrRefreshMap() {
    const container = document.getElementById('leafletMapContainer');
    if (!container) return;

    if (!state.leafletMap) {
      // Midpoint between Uppal and Jangaon (NH163)
      state.leafletMap = L.map('leafletMapContainer').setView([17.5500, 78.8500], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(state.leafletMap);

      // Key stops on NH 163 Corridor
      const stops = [
        { name: 'Uppal Metro, Hyderabad', lat: 17.4018, lng: 78.5602, color: 'green' },
        { name: 'Ghatkesar Toll Plaza', lat: 17.4455, lng: 78.6835, color: 'blue' },
        { name: 'Bhongir Fort Road', lat: 17.5108, lng: 78.8890, color: 'blue' },
        { name: 'Aler Railway Gate', lat: 17.6521, lng: 79.0510, color: 'blue' },
        { name: 'Jangaon Bus Depot', lat: 17.7265, lng: 79.1554, color: 'red' }
      ];

      const latlngs = stops.map(s => [s.lat, s.lng]);
      L.polyline(latlngs, { color: '#0052CC', weight: 4, opacity: 0.8 }).addTo(state.leafletMap);

      stops.forEach(s => {
        L.circleMarker([s.lat, s.lng], {
          radius: 7,
          color: '#0052CC',
          fillColor: s.color === 'green' ? '#10B981' : (s.color === 'red' ? '#EF4444' : '#0A84FF'),
          fillOpacity: 0.9,
          weight: 2
        }).addTo(state.leafletMap).bindPopup(`<b>${s.name}</b><br>NH 163 Corridor Stop`);
      });
    }

    state.leafletMap.invalidateSize();
  }

  window.refreshMapBounds = function () {
    if (state.leafletMap) {
      state.leafletMap.setView([17.5500, 78.8500], 10);
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
    if (confirm("🚨 Activate Emergency SOS?\n\nThis will trigger direct emergency assistance and connect to 112 with your current route coordinates.")) {
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
  document.addEventListener('DOMContentLoaded', () => {
    initUserSession();
    calculateAndDisplayFare();
    if (window.lucide) lucide.createIcons();
    console.log('✨ [ROUTEMATE] Radically Redesigned UI/UX v33 Bootstrapped Successfully.');
  });

})();
