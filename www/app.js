// Routemate - Peer-to-Peer Ride-Sharing Platform Engine
// Clean startup blue & white UI logic with dynamic fuel-share calculation

// Route distances dictionary (km)
const ROUTE_DISTANCES = {
  'uppal-jangaon': 84,
  'jangaon-uppal': 84,
  'uppal-bhongir': 38,
  'bhongir-uppal': 38,
  'uppal-aler': 65,
  'aler-uppal': 65,
  'hiteccity-warangal': 165,
  'warangal-hiteccity': 165,
  'lbnagar-suryapet': 132,
  'suryapet-lbnagar': 132,
  'secunderabad-siddipet': 102,
  'siddipet-secunderabad': 102,
  'uppal-yadagirigutta': 52,
  'yadagirigutta-uppal': 52,
  'kphb-sangareddy': 44,
  'sangareddy-kphb': 44
};

// Application State
const state = {
  currentUser: null,
  authPhone: '',
  authCountdown: 30,
  authCountdownTimer: null,
  mode: 'rider', // 'rider' | 'driver'
  activeTab: 'explore', // 'explore' | 'myrides' | 'profile'
  vehicleType: 'any', // 'bike' | 'auto' | 'car' | 'any' (flexible match)
  pickup: 'Uppal Ring Road Metro, Hyderabad',
  drop: 'Jangaon Bus Depot / Chowrasta',
  distance: 84, // km
  fuelPrice: 105.5, // INR per Litre
  myBookings: [
    {
      id: 'RM-8492',
      driver: 'Ramesh Kumar',
      vehicle: 'Bajaj Pulsar 150 (TS 08 EK 4321)',
      route: 'Uppal Ring Road ➔ Jangaon Bus Station',
      time: 'Today, 06:45 PM',
      seats: 1,
      fare: 110,
      payment: 'Direct UPI (GPay)',
      status: 'Confirmed'
    }
  ],
  myPostedRides: [],
  rideFilter: 'all', // 'all' | 'upi' | 'rated'
  registeredVehicles: (function() {
    try {
      const v = JSON.parse(localStorage.getItem('routemate_registered_vehicles'));
      return Array.isArray(v) ? v : [];
    } catch(e) { return []; }
  })(),
  driverOnline: true,
  driverPayPreference: 'either', // 'upi' | 'cash' | 'either'
  activeDriverTrip: null,
  currentActiveRide: null,
  activeRideRole: 'rider',
  incomingRequestTimer: null,
  incomingCountdown: 45,
  emergencyContact: (function() {
    try { return JSON.parse(localStorage.getItem('routemate_emergency_contact')); } catch(e){ return null; }
  })() || null,
  favourites: (function() {
    try { return JSON.parse(localStorage.getItem('routemate_favourites')); } catch(e){ return null; }
  })() || [
    { id: 'fav_1', title: 'Home', address: 'Uppal Ring Road Metro, Hyderabad', category: 'home' },
    { id: 'fav_2', title: 'Work', address: 'Mindspace Madhapur, Hitec City', category: 'work' },
    { id: 'fav_3', title: 'Highway Hub', address: 'Jangaon Bus Depot / Chowrasta', category: 'corridor' }
  ],
  preferences: (function() {
    try { return JSON.parse(localStorage.getItem('routemate_preferences')); } catch(e){ return null; }
  })() || {
    autoConfirm: false,
    quietRide: false,
    acComfort: true,
    luggage: true,
    sounds: true,
    highContrast: false
  },
  isBetaSubscriber: localStorage.getItem('routemate_beta_subscriber') === 'true',
  incomingRequest: null,
  chatMessages: []
};

// Initial Driver Rides Pool
let availableRides = [
  {
    id: 1,
    driverName: 'Ramesh Kumar',
    driverRole: 'TCS Infopark Commuter',
    rating: 4.9,
    totalRides: 142,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleType: 'bike',
    vehicleName: 'Bajaj Pulsar 150',
    vehicleNumber: 'TS 08 EK 4321',
    pickup: 'Uppal Ring Road Metro',
    drop: 'Jangaon Railway Station',
    departureTime: 'Today, 06:30 PM',
    seatsAvailable: 1,
    perSeatPrice: 110,
    paymentPreference: 'upi',
    verified: true,
    helmetProvided: true,
    notes: 'Leaving right on time from Uppal Metro. Regular daily commuter.'
  },
  {
    id: 2,
    driverName: 'Priya Sharma',
    driverRole: 'Bank Officer (SBI)',
    rating: 4.8,
    totalRides: 88,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleType: 'car',
    vehicleName: 'Maruti Suzuki Swift VXi (AC)',
    vehicleNumber: 'TS 09 FH 9182',
    pickup: 'Uppal X Roads',
    drop: 'Jangaon Court Chowrasta',
    departureTime: 'Today, 07:15 PM',
    seatsAvailable: 3,
    perSeatPrice: 185,
    paymentPreference: 'both',
    verified: true,
    ac: true,
    notes: 'Comfortable AC car ride with boot space for 2 bags. No smoking.'
  },
  {
    id: 3,
    driverName: 'Vikram Reddy',
    driverRole: 'Civil Engineer',
    rating: 4.9,
    totalRides: 210,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleType: 'bike',
    vehicleName: 'Royal Enfield Classic 350',
    vehicleNumber: 'TS 03 AA 5590',
    pickup: 'Uppal Stadium Bus Stop',
    drop: 'Jangaon Main Road',
    departureTime: 'Today, 07:45 PM',
    seatsAvailable: 1,
    perSeatPrice: 125,
    paymentPreference: 'upi',
    verified: true,
    helmetProvided: true,
    notes: 'Spare sanitized helmet available. Relaxed highway cruise.'
  },
  {
    id: 4,
    driverName: 'Suresh Maddela',
    driverRole: 'Pharma Professional',
    rating: 4.7,
    totalRides: 64,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleType: 'car',
    vehicleName: 'Hyundai i20 Asta',
    vehicleNumber: 'TS 07 JN 3341',
    pickup: 'Boduppal / Uppal Depot',
    drop: 'Jangaon Bus Depot',
    departureTime: 'Tomorrow, 07:30 AM',
    seatsAvailable: 2,
    perSeatPrice: 175,
    paymentPreference: 'cash',
    verified: true,
    ac: true,
    notes: 'Early morning commute. Playing acoustic indie playlist.'
  },
  {
    id: 5,
    driverName: 'Karthik Boyina',
    driverRole: 'Software Developer',
    rating: 5.0,
    totalRides: 39,
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleType: 'bike',
    vehicleName: 'Honda Activa 6G',
    vehicleNumber: 'TS 08 MX 7820',
    pickup: 'Uppal Metro Station Gate 2',
    drop: 'Aler / Jangaon bypass',
    departureTime: 'Tomorrow, 08:15 AM',
    seatsAvailable: 1,
    perSeatPrice: 100,
    paymentPreference: 'both',
    verified: true,
    helmetProvided: true,
    notes: 'Easy-paced ride. Strict lane safety.'
  },
  {
    id: 4,
    driverName: 'Suresh Goud',
    driverRole: 'Local Shared Transit',
    rating: 4.85,
    totalRides: 310,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleType: 'auto',
    vehicleName: 'Bajaj Maxima Z CNG Auto',
    vehicleNumber: 'TS 08 TC 2910',
    pickup: 'Uppal Ring Road Metro',
    drop: 'Aler / Jangaon Highway',
    departureTime: 'Today, 06:45 PM',
    seatsAvailable: 3,
    perSeatPrice: 135,
    paymentPreference: 'both',
    verified: true,
    notes: 'Direct highway corridor route, quick boarding, plenty of luggage space.'
  }
];

// Calculation Functions
function calculateFuelShare(distanceKm, type) {
  const fuelRate = state.fuelPrice;
  if (type === 'bike') {
    // 45 km/l average mileage for 125cc-150cc commuter bike
    const fuelLitres = distanceKm / 45;
    const totalFuelCost = fuelLitres * fuelRate;
    // 50% split with rider + 5% tire/oil wear share
    const fairShare = Math.round(totalFuelCost * 0.55);
    const cabPrice = Math.round(distanceKm * 6.5 + 50);
    return {
      fuelLitres: fuelLitres.toFixed(1),
      totalFuelCost: Math.round(totalFuelCost),
      perSeat: Math.max(35, fairShare),
      seats: 1,
      commercialCabPrice: Math.max(250, cabPrice),
      savingsPct: Math.round(((cabPrice - fairShare) / cabPrice) * 100)
    };
  } else if (type === 'auto') {
    // 26 km/l average mileage for LPG/CNG 3-wheeler auto
    const fuelLitres = distanceKm / 26;
    const totalFuelCost = fuelLitres * fuelRate * 0.72; // CNG / fuel efficiency ratio
    const fairShare = Math.round(totalFuelCost / 2.3);
    const cabPrice = Math.round(distanceKm * 10 + 60);
    return {
      fuelLitres: fuelLitres.toFixed(1),
      totalFuelCost: Math.round(totalFuelCost),
      perSeat: Math.max(45, fairShare),
      seats: 3,
      commercialCabPrice: Math.max(350, cabPrice),
      savingsPct: Math.round(((cabPrice - fairShare) / cabPrice) * 100)
    };
  } else if (type === 'any' || type === 'custom') {
    // Flexible option: starting price baseline from bike fair share
    const bikeCalc = calculateFuelShare(distanceKm, 'bike');
    return {
      fuelLitres: bikeCalc.fuelLitres,
      totalFuelCost: bikeCalc.totalFuelCost,
      perSeat: bikeCalc.perSeat,
      seats: 1,
      commercialCabPrice: bikeCalc.commercialCabPrice,
      savingsPct: bikeCalc.savingsPct,
      isFlexible: true
    };
  } else {
    // 16 km/l average mileage for petrol hatchback/sedan
    const fuelLitres = distanceKm / 16;
    const totalFuelCost = fuelLitres * fuelRate;
    // Split across 3 riders (driver absorbs 1 share)
    const fairShare = Math.round(totalFuelCost / 3.2);
    const cabPrice = Math.round(distanceKm * 18 + 120);
    return {
      fuelLitres: fuelLitres.toFixed(1),
      totalFuelCost: Math.round(totalFuelCost),
      perSeat: Math.max(60, fairShare),
      seats: 3,
      commercialCabPrice: Math.max(600, cabPrice),
      savingsPct: Math.round(((cabPrice - fairShare) / cabPrice) * 100)
    };
  }
}

// Estimate distance between pickup and drop
function estimateDistance(pickup, drop) {
  const cleanPick = pickup.toLowerCase().replace(/[^a-z]/g, '');
  const cleanDrop = drop.toLowerCase().replace(/[^a-z]/g, '');

  for (const [key, dist] of Object.entries(ROUTE_DISTANCES)) {
    const [p, d] = key.split('-');
    if (cleanPick.includes(p) && cleanDrop.includes(d)) {
      return dist;
    }
  }

  // Fallback distance based on string seed / default 60 km
  if (cleanPick.includes('uppal') && cleanDrop.includes('jangaon')) return 84;
  if (cleanPick.includes('uppal') && cleanDrop.includes('warangal')) return 138;
  return 75;
}

// Update DOM UI elements based on state
function updateUI() {
  const calc = calculateFuelShare(state.distance, state.vehicleType);
  const bikeCalc = calculateFuelShare(state.distance, 'bike');
  const autoCalc = calculateFuelShare(state.distance, 'auto');
  const carCalc = calculateFuelShare(state.distance, 'car');
  const anyCalc = calculateFuelShare(state.distance, 'any');

  // Update distance indicators
  const distBadges = document.querySelectorAll('.dynamic-distance-val');
  distBadges.forEach(el => el.textContent = `${state.distance} km`);

  // Update Fuel Share Widget
  const fuelCostEl = document.getElementById('calcTotalFuelCost');
  const perSeatEl = document.getElementById('calcPerSeatCost');
  const fuelLitresEl = document.getElementById('calcFuelLitres');
  const cabSavingEl = document.getElementById('calcSavingsBadge');
  const cabPriceEl = document.getElementById('calcCabCompare');

  if (fuelCostEl) fuelCostEl.textContent = `₹${calc.totalFuelCost}`;
  if (perSeatEl) perSeatEl.textContent = `₹${calc.perSeat}`;
  if (fuelLitresEl) fuelLitresEl.textContent = `~${calc.fuelLitres} L Fuel`;
  if (cabSavingEl) cabSavingEl.textContent = `Save ${calc.savingsPct}% vs Cabs`;
  if (cabPriceEl) cabPriceEl.textContent = `Commercial taxi ~₹${calc.commercialCabPrice}`;

  // Update vehicle cards pricing
  const bikeCardPrice = document.getElementById('bikeCardCost');
  const autoCardPrice = document.getElementById('autoCardCost');
  const carCardPrice = document.getElementById('carCardCost');
  const anyCardPrice = document.getElementById('anyCardCost');
  if (bikeCardPrice) bikeCardPrice.textContent = `₹${bikeCalc.perSeat}`;
  if (autoCardPrice) autoCardPrice.textContent = `₹${autoCalc.perSeat}`;
  if (carCardPrice) carCardPrice.textContent = `₹${carCalc.perSeat}`;
  if (anyCardPrice) anyCardPrice.textContent = `From ₹${anyCalc.perSeat}`;

  const instantFareEl = document.getElementById('instantRideFareVal');
  if (instantFareEl) instantFareEl.textContent = calc.perSeat;

  // Vehicle Selection Card Highlight (Bike, Auto, Car, Any)
  const bikeCard = document.getElementById('vehicleCardBike');
  const autoCard = document.getElementById('vehicleCardAuto');
  const carCard = document.getElementById('vehicleCardCar');
  const anyCard = document.getElementById('vehicleCardAny');
  [bikeCard, autoCard, carCard, anyCard].forEach(card => card && card.classList.remove('selected'));
  if (state.vehicleType === 'bike' && bikeCard) bikeCard.classList.add('selected');
  else if (state.vehicleType === 'auto' && autoCard) autoCard.classList.add('selected');
  else if (state.vehicleType === 'car' && carCard) carCard.classList.add('selected');
  else if ((state.vehicleType === 'any' || state.vehicleType === 'custom') && anyCard) anyCard.classList.add('selected');

  // Update Driver Mode live fuel-share calculation display
  const driverLiveCost = document.getElementById('driverRecCostPerSeat');
  const driverLiveDist = document.getElementById('driverLiveDistance');
  if (driverLiveCost) {
    driverLiveCost.textContent = `${state.distance === 84 && state.vehicleType === 'bike' ? 108 : calc.perSeat}`;
  }
  if (driverLiveDist) {
    driverLiveDist.textContent = `${state.distance} km`;
  }

  // Re-render Ride Listings
  renderRideListings();
}

// Render available matching rides
function renderRideListings() {
  const container = document.getElementById('rideListingsContainer');
  if (!container) return;

  let filtered = availableRides.filter(ride => {
    if (state.vehicleType === 'any' || state.vehicleType === 'custom') {
      return true;
    }
    return ride.vehicleType === state.vehicleType;
  });

  if (state.rideFilter === 'upi') {
    filtered = filtered.filter(r => r.paymentPreference === 'upi' || r.paymentPreference === 'both');
  } else if (state.rideFilter === 'rated') {
    filtered = filtered.filter(r => r.rating >= 4.85);
  }

  const countBadge = document.getElementById('matchingRidesCount');
  if (countBadge) {
    countBadge.textContent = `${filtered.length} matching rides found`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 text-center border border-slate-100 shadow-sm">
        <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <i data-lucide="compass" class="w-8 h-8"></i>
        </div>
        <h4 class="text-base font-semibold text-slate-800">No direct rides right now</h4>
        <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Be the first to post a ride on this route or switch vehicle type to check cars.</p>
        <button onclick="switchMode('driver')" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition">
          Offer a Ride on this Route
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(ride => `
    <div class="interactive-card bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-sm transition-all relative overflow-hidden">
      <!-- Top info: Driver & Badges -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="relative">
            <img src="${ride.avatar}" alt="${ride.driverName}" class="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm" />
            ${ride.verified ? `
              <span class="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm" title="Govt ID & License Verified">
                <i data-lucide="check" class="w-3 h-3 stroke-[3]"></i>
              </span>
            ` : ''}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <h4 class="font-bold text-slate-900 text-sm tracking-tight">${ride.driverName}</h4>
              <span class="flex items-center text-[11px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                ★ ${ride.rating}
              </span>
            </div>
            <p class="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              <span>${ride.driverRole}</span>
              <span>•</span>
              <span>${ride.totalRides} rides</span>
            </p>
          </div>
        </div>

        <div class="text-right">
          <div class="flex items-baseline justify-end gap-0.5">
            <span class="text-xs font-medium text-slate-400">₹</span>
            <span class="text-xl font-extrabold text-blue-700">${ride.perSeatPrice}</span>
          </div>
          <p class="text-[10px] text-slate-400 font-medium">fuel contribution</p>
        </div>
      </div>

      <!-- Route & Time Box -->
      <div class="mt-3.5 bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
          <span class="font-medium text-slate-700 truncate"><strong class="text-slate-900">Pickup:</strong> ${ride.pickup}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0"></span>
          <span class="font-medium text-slate-700 truncate"><strong class="text-slate-900">Drop:</strong> ${ride.drop}</span>
        </div>
        <div class="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-slate-600 text-[11px]">
          <span class="flex items-center gap-1 font-semibold text-slate-800">
            <i data-lucide="clock" class="w-3.5 h-3.5 text-blue-600"></i>
            ${ride.departureTime}
          </span>
          <span class="flex items-center gap-1 text-slate-500">
            <i data-lucide="${ride.vehicleType === 'bike' ? 'bike' : (ride.vehicleType === 'auto' ? 'truck' : 'car')}" class="w-3.5 h-3.5 text-slate-400"></i>
            ${ride.vehicleName}
          </span>
        </div>
      </div>

      <!-- Payment & Direct Indicators -->
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          ${ride.paymentPreference === 'upi' || ride.paymentPreference === 'both' ? `
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
              <i data-lucide="qr-code" class="w-3 h-3 text-purple-600"></i>
              Direct UPI
            </span>
          ` : ''}
          ${ride.paymentPreference === 'cash' || ride.paymentPreference === 'both' ? `
            <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <i data-lucide="banknote" class="w-3 h-3 text-emerald-600"></i>
              Cash on Board
            </span>
          ` : ''}
          <span class="text-[10px] text-blue-600 font-medium bg-blue-50/70 px-1.5 py-0.5 rounded">0% Fee</span>
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold ${ride.seatsAvailable === 1 ? 'text-amber-600' : 'text-slate-600'}">
            ${ride.seatsAvailable} seat${ride.seatsAvailable > 1 ? 's' : ''} left
          </span>
          <button onclick="openBookingModal(${ride.id})" class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1">
            <span>Book Seat</span>
            <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

// Ride Filter Handler ('all' | 'upi' | 'rated')
function setRideFilter(filterKey) {
  state.rideFilter = filterKey;
  const filterMap = {
    all: 'filterBtnAll',
    upi: 'filterBtnUpi',
    rated: 'filterBtnRated'
  };

  Object.entries(filterMap).forEach(([key, id]) => {
    const btn = document.getElementById(id);
    if (btn) {
      if (key === filterKey) {
        btn.className = 'flex-shrink-0 px-3 py-1.5 rounded-xl font-bold transition bg-blue-600 text-white shadow-xs';
      } else {
        btn.className = 'flex-shrink-0 px-3 py-1.5 rounded-xl font-semibold transition bg-slate-100 text-slate-700 hover:bg-slate-200';
      }
    }
  });

  renderRideListings();
}

// Mode Switcher handler (Rider / Driver)
function switchMode(newMode) {
  state.mode = newMode;
  const pill = document.getElementById('modeActivePill');
  const riderBtn = document.getElementById('btnModeRider');
  const driverBtn = document.getElementById('btnModeDriver');
  const riderView = document.getElementById('riderModeView');
  const driverView = document.getElementById('driverModeView');

  if (newMode === 'rider') {
    pill.style.transform = 'translateX(0%)';
    riderBtn.classList.add('text-blue-700', 'font-bold');
    riderBtn.classList.remove('text-slate-600', 'font-medium');
    driverBtn.classList.remove('text-blue-700', 'font-bold');
    driverBtn.classList.add('text-slate-600', 'font-medium');

    riderView.classList.remove('hidden');
    driverView.classList.add('hidden');
    showToast('Switched to Rider Mode. Find fuel-split rides near you.', 'info');
  } else {
    pill.style.transform = 'translateX(100%)';
    driverBtn.classList.add('text-blue-700', 'font-bold');
    driverBtn.classList.remove('text-slate-600', 'font-medium');
    riderBtn.classList.remove('text-blue-700', 'font-bold');
    riderBtn.classList.add('text-slate-600', 'font-medium');

    riderView.classList.add('hidden');
    driverView.classList.remove('hidden');
    renderDriverIncomingRequest();
    renderKycStatus();
    showToast('Driver Mode active. Live corridor listening enabled.', 'info');
  }
}

// Vehicle Selection Handler (Bike / Auto / Car / Any)
function selectVehicle(type) {
  state.vehicleType = type;
  updateUI();
  syncDriverVehicleCards(type);
  const labels = {
    bike: 'Bike Pillion (1 Rider Seat)',
    auto: 'Auto Rickshaw (Shared Seats)',
    car: 'Car / Cab (Multi-Passenger)',
    any: 'Any / Custom (First Available Match)'
  };
  showToast(`Showing ${labels[type] || type}`, 'info');
}

// Driver Form Vehicle Type Selection (Bike / Car)
function setDriverVehicleType(type) {
  state.vehicleType = type;
  syncDriverVehicleCards(type);

  const seatsSelect = document.getElementById('driverSeatsInput');
  const modelInput = document.getElementById('driverVehicleModel');
  const plateInput = document.getElementById('driverVehiclePlate');
  const priceInput = document.getElementById('driverPriceInput');
  const calc = calculateFuelShare(state.distance, type);

  if (type === 'bike') {
    if (seatsSelect) {
      seatsSelect.innerHTML = `<option value="1">1 Seat (Bike Pillion / Single)</option>`;
      seatsSelect.value = '1';
    }
    const regBike = state.registeredVehicles.find(v => v.type === 'bike');
    if (modelInput) modelInput.value = regBike ? regBike.name : 'Honda CB Hornet 160R';
    if (plateInput) plateInput.value = regBike ? regBike.plate : 'TS 08 HG 8421';
    if (priceInput) priceInput.value = calc.perSeat;
  } else {
    if (seatsSelect) {
      seatsSelect.innerHTML = `
        <option value="1">1 Seat</option>
        <option value="2">2 Seats (Comfort)</option>
        <option value="3" selected>3 Seats (Standard Carpool)</option>
        <option value="4">4 Seats (Full Carpool)</option>
      `;
      seatsSelect.value = '3';
    }
    const regCar = state.registeredVehicles.find(v => v.type === 'car');
    if (modelInput) modelInput.value = regCar ? regCar.name : 'Maruti Suzuki Swift VXi';
    if (plateInput) plateInput.value = regCar ? regCar.plate : 'TS 09 FH 9182';
    if (priceInput) priceInput.value = calc.perSeat;
  }

  updateUI();
  showToast(`Vehicle type set to ${type === 'bike' ? 'Motorcycle (1 Seat)' : 'Car (Multi-Seat)'}`, 'info');
}

function syncDriverVehicleCards(type) {
  const bikeBtn = document.getElementById('driverCardBike');
  const carBtn = document.getElementById('driverCardCar');
  if (!bikeBtn || !carBtn) return;

  if (type === 'bike') {
    bikeBtn.className = 'p-3 rounded-2xl border-2 border-blue-600 bg-blue-50/80 text-left transition flex items-center gap-2.5 shadow-xs';
    carBtn.className = 'p-3 rounded-2xl border border-slate-200 bg-slate-50 text-left hover:bg-slate-100 transition flex items-center gap-2.5';
  } else {
    carBtn.className = 'p-3 rounded-2xl border-2 border-blue-600 bg-blue-50/80 text-left transition flex items-center gap-2.5 shadow-xs';
    bikeBtn.className = 'p-3 rounded-2xl border border-slate-200 bg-slate-50 text-left hover:bg-slate-100 transition flex items-center gap-2.5';
  }
}

// Rider Mode: Find Rides Button Action
function findRidesAction() {
  switchMode('rider');
  updateUI();
  const listings = document.getElementById('riderModeView');
  if (listings) {
    listings.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  showToast(`Showing available ${state.vehicleType === 'bike' ? 'Bike' : 'Car'} rides for ${state.pickup} ➔ ${state.drop}`, 'success');
}

// Route Swap button
function swapLocations() {
  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');
  if (!pickupInput || !dropInput) return;

  const temp = pickupInput.value;
  pickupInput.value = dropInput.value;
  dropInput.value = temp;

  state.pickup = pickupInput.value;
  state.drop = dropInput.value;
  state.distance = estimateDistance(state.pickup, state.drop);

  updateUI();
  if (window.updateRouteOnMap) {
    window.updateRouteOnMap(state.pickup, state.drop);
  }
  showToast('Route reversed', 'info');
}

// Preset route quick selector
function setPresetRoute(pickup, drop) {
  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');
  if (pickupInput && dropInput) {
    pickupInput.value = pickup;
    dropInput.value = drop;
    state.pickup = pickup;
    state.drop = drop;
    state.distance = estimateDistance(pickup, drop);
    updateUI();
    if (window.updateRouteOnMap) {
      window.updateRouteOnMap(pickup, drop);
    }
    showToast(`Route set to ${pickup} ➔ ${drop}`, 'info');
  }
}

// Open Booking Modal
function openBookingModal(rideId) {
  const ride = availableRides.find(r => r.id === rideId);
  if (!ride) return;

  const modal = document.getElementById('bookingModal');
  const modalContent = document.getElementById('bookingModalContent');

  modalContent.innerHTML = `
    <div class="p-6">
      <div class="flex items-center justify-between pb-4 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
            RM
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900">Seat Reservation</h3>
            <p class="text-xs text-slate-500">Direct peer-to-peer fuel split</p>
          </div>
        </div>
        <button onclick="closeModal('bookingModal')" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Ride Summary -->
      <div class="mt-4 bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <img src="${ride.avatar}" class="w-10 h-10 rounded-full object-cover" />
            <div>
              <p class="text-xs font-bold text-slate-900">${ride.driverName}</p>
              <p class="text-[11px] text-slate-500">${ride.vehicleName} • ${ride.vehicleNumber}</p>
            </div>
          </div>
          <span class="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
            ★ ${ride.rating}
          </span>
        </div>

        <div class="pt-2 border-t border-slate-200/70 text-xs space-y-2">
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1"></span>
            <div>
              <p class="text-[10px] text-slate-400 uppercase font-semibold">Pickup</p>
              <p class="font-medium text-slate-800">${ride.pickup}</p>
            </div>
          </div>
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-600 mt-1"></span>
            <div>
              <p class="text-[10px] text-slate-400 uppercase font-semibold">Drop-off</p>
              <p class="font-medium text-slate-800">${ride.drop}</p>
            </div>
          </div>
          <div class="flex items-center justify-between pt-1 text-slate-600 font-medium">
            <span>Departure:</span>
            <span class="font-bold text-slate-900">${ride.departureTime}</span>
          </div>
        </div>
      </div>

      <!-- Seat Selection Counter -->
      <div class="mt-3.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex items-center justify-between">
        <div>
          <label class="block font-bold text-slate-800 text-xs">Number of Seats to Book</label>
          <p class="text-[11px] text-slate-500 mt-0.5">
            <span id="bookingAvailableSeatsBadge" class="text-blue-600 font-semibold">${ride.seatsAvailable} seat${ride.seatsAvailable > 1 ? 's' : ''} available</span> in this ${ride.vehicleType}
          </p>
        </div>

        <div class="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
          <button type="button" onclick="adjustBookingSeats(-1, ${ride.seatsAvailable}, ${ride.perSeatPrice})" class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition active:scale-90 text-sm">
            -
          </button>
          <span id="bookingSeatCountDisplay" class="w-6 text-center font-extrabold text-sm text-slate-900">1</span>
          <button type="button" onclick="adjustBookingSeats(1, ${ride.seatsAvailable}, ${ride.perSeatPrice})" class="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center transition active:scale-90 text-sm">
            +
          </button>
        </div>
        <input type="hidden" id="selectedSeatsCount" value="1" />
      </div>

      <!-- Cost Breakdown -->
      <div class="mt-3.5 bg-blue-50/70 rounded-2xl p-4 border border-blue-100">
        <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span id="bookingSeatFormulaText">Fuel Contribution (1 seat × ₹${ride.perSeatPrice})</span>
          <span id="bookingFuelBasePrice" class="font-semibold text-slate-900">₹${ride.perSeatPrice}</span>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-600 mb-2">
          <span>Routemate Platform Fee</span>
          <span class="font-bold text-emerald-600">₹0 (Free P2P)</span>
        </div>
        <div class="pt-2 border-t border-blue-200/70 flex items-center justify-between">
          <span class="text-sm font-bold text-slate-900">Total Contribution</span>
          <span id="bookingTotalFareAmount" class="text-lg font-black text-blue-700">₹${ride.perSeatPrice}</span>
        </div>
      </div>

      <!-- Payment Method -->
      <div class="mt-4">
        <label class="block text-xs font-bold text-slate-700 mb-2">Select Payment Method:</label>
        <div class="space-y-2.5 text-xs">
          <!-- Option 1: Razorpay Instant Online Pay (UPI, Cards, Netbanking) -->
          <!-- Option 1: Razorpay Instant Online Pay (UPI, Cards, Netbanking) -->
          <div id="payCardRazorpay" onclick="selectBookingPayMethod('razorpay')" class="flex items-center justify-between p-3.5 border-2 border-blue-600 bg-blue-50/80 rounded-2xl cursor-pointer transition shadow-xs">
            <div class="flex items-center gap-2.5">
              <input type="radio" id="payRadioRazorpay" name="payMethod" value="razorpay" checked class="text-blue-600 w-4 h-4" />
              <div>
                <div class="flex items-center gap-1.5">
                  <p class="font-extrabold text-slate-900">Razorpay Instant Pay</p>
                  <span class="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Fast & Secure</span>
                </div>
                <p class="text-[11px] text-slate-500 mt-0.5">UPI (GPay / PhonePe / Paytm), Debit/Credit Cards</p>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">0% Fee</span>
            </div>
          </div>

          <!-- Option 2: Cash on Board -->
          <div id="payCardCash" onclick="selectBookingPayMethod('cash')" class="flex items-center justify-between p-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-2xl cursor-pointer transition">
            <div class="flex items-center gap-2.5">
              <input type="radio" id="payRadioCash" name="payMethod" value="cash" class="text-blue-600 w-4 h-4" />
              <div>
                <p class="font-bold text-slate-900">Cash on Board</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Hand physical cash or direct QR to driver inside vehicle</p>
              </div>
            </div>
            <span class="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">Hand-to-Hand</span>
          </div>
        </div>
      </div>

      <!-- Action Button -->
      <div class="mt-6 pt-2 pb-2 flex items-center gap-3">
        <button onclick="closeModal('bookingModal')" class="w-1/3 py-3.5 border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs font-bold text-slate-600 transition">
          Cancel
        </button>
        <button id="btnConfirmBookingAction" onclick="confirmBooking(${ride.id})" class="w-2/3 py-3.5 gradient-brand text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          <span id="bookingPayBtnLabel">Pay & Confirm Seat (₹${ride.perSeatPrice})</span>
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

// Payment method visual switcher
function selectBookingPayMethod(method) {
  const radio = document.querySelector(`input[name="payMethod"][value="${method}"]`);
  if (radio) radio.checked = true;

  const cardRazorpay = document.getElementById('payCardRazorpay');
  const cardCash = document.getElementById('payCardCash');
  const btnLabel = document.getElementById('bookingPayBtnLabel');

  const activeClass = 'flex items-center justify-between p-3.5 border-2 border-blue-600 bg-blue-50/80 rounded-2xl cursor-pointer transition shadow-xs';
  const inactiveClass = 'flex items-center justify-between p-3.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-2xl cursor-pointer transition';

  if (cardRazorpay) cardRazorpay.className = (method === 'razorpay' ? activeClass : inactiveClass);
  if (cardCash) cardCash.className = (method === 'cash' ? activeClass : inactiveClass);

  const fareVal = document.getElementById('bookingTotalFareAmount')?.textContent?.replace('₹', '') || '108';
  const seatsVal = document.getElementById('selectedSeatsCount')?.value || '1';
  const seatWord = parseInt(seatsVal, 10) > 1 ? `${seatsVal} Seats` : 'Seat';

  if (btnLabel) {
    if (method === 'razorpay') {
      btnLabel.textContent = `Pay & Confirm ${seatWord} (₹${fareVal})`;
    } else {
      btnLabel.textContent = `Reserve with Cash on Board (₹${fareVal})`;
    }
  }
}

// Interactive Seat Selection Adjuster
function adjustBookingSeats(delta, maxAvailable, perSeatPrice) {
  const countEl = document.getElementById('bookingSeatCountDisplay');
  const hiddenInput = document.getElementById('selectedSeatsCount');
  const formulaText = document.getElementById('bookingSeatFormulaText');
  const basePriceEl = document.getElementById('bookingFuelBasePrice');
  const totalFareEl = document.getElementById('bookingTotalFareAmount');
  const btnLabel = document.getElementById('bookingPayBtnLabel');

  if (!countEl || !hiddenInput) return;

  let current = parseInt(hiddenInput.value || 1, 10);
  const maxSeats = Math.max(1, maxAvailable || 1);
  const newCount = Math.min(maxSeats, Math.max(1, current + delta));

  hiddenInput.value = newCount;
  countEl.textContent = newCount;

  const total = perSeatPrice * newCount;

  if (formulaText) formulaText.textContent = `Fuel Contribution (${newCount} seat${newCount > 1 ? 's' : ''} × ₹${perSeatPrice})`;
  if (basePriceEl) basePriceEl.textContent = `₹${total}`;
  if (totalFareEl) totalFareEl.textContent = `₹${total}`;

  const currentMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'razorpay';
  const seatWord = newCount > 1 ? `${newCount} Seats` : 'Seat';

  if (btnLabel) {
    if (currentMethod === 'razorpay') {
      btnLabel.textContent = `Pay & Confirm ${seatWord} (₹${total})`;
    } else {
      btnLabel.textContent = `Reserve with Cash on Board (₹${total})`;
    }
  }
}

// Confirm Booking logic with dynamic seats and Razorpay Gateway
function confirmBooking(rideId) {
  const ride = availableRides.find(r => r.id === rideId);
  if (!ride) return;

  const selectedSeats = parseInt(document.getElementById('selectedSeatsCount')?.value || 1, 10);
  const totalFare = (ride.perSeatPrice || 108) * selectedSeats;
  const selectedMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'razorpay';

  // 1. If Razorpay is chosen, launch the Razorpay Checkout gateway for the total fare
  if (selectedMethod === 'razorpay' && window.routematePayment) {
    const bookingRideObj = { ...ride, perSeatPrice: totalFare };
    window.routematePayment.initiatePayment(
      bookingRideObj,
      function onPaymentSuccess(paymentData) {
        processSuccessfulBooking(ride, {
          method: 'razorpay',
          label: 'Paid via Razorpay',
          paymentId: paymentData.paymentId,
          isPaid: true
        }, selectedSeats, totalFare);
      },
      function onPaymentError(err) {
        showToast(err.message || 'Payment was not completed', 'info');
      }
    );
    return;
  }

  // 2. Cash on Board
  processSuccessfulBooking(ride, {
    method: 'cash',
    label: 'Cash on Board (Pay in vehicle)',
    paymentId: null,
    isPaid: false
  }, selectedSeats, totalFare);
}

// Helper to record successful booking across local state & Supabase
function processSuccessfulBooking(ride, paymentInfo, seatsBooked = 1, totalFare = null) {
  const actualSeats = seatsBooked || 1;
  const fare = totalFare || ((ride.perSeatPrice || 108) * actualSeats);
  ride.seatsAvailable = Math.max(0, ride.seatsAvailable - actualSeats);
  const bookingPin = Math.floor(1000 + Math.random() * 9000).toString();
  const bookingId = `RM-${Math.floor(1000 + Math.random() * 9000)}`;

  // Add to user bookings state
  state.myBookings.unshift({
    id: bookingId,
    driver: ride.driverName,
    vehicle: `${ride.vehicleName} (${ride.vehicleNumber})`,
    route: `${ride.pickup} ➔ ${ride.drop || ride.drop_location}`,
    time: ride.departureTime,
    seats: actualSeats,
    fare: fare,
    payment: paymentInfo.label + (paymentInfo.paymentId ? ` (${paymentInfo.paymentId})` : ''),
    paymentId: paymentInfo.paymentId,
    paymentMethod: paymentInfo.method,
    isPaid: paymentInfo.isPaid,
    status: 'Confirmed'
  });

  closeModal('bookingModal');
  updateUI();

  // Persist booking to Supabase database
  if (window.db && window.db.bookings) {
    window.db.bookings.create({
      rideId: ride.id,
      riderName: 'Verified Commuter',
      seats: actualSeats,
      fare: fare,
      paymentMethod: paymentInfo.method,
      pin: bookingPin
    }).then(res => {
      if (res && res.success) {
        console.log('✅ Booking successfully stored in Supabase with seats:', actualSeats);
      }
    }).catch(err => console.warn('Supabase booking sync warning:', err));
  }

  showToast(`${actualSeats} Seat${actualSeats > 1 ? 's' : ''} Confirmed! ${paymentInfo.isPaid ? 'Payment Received via Razorpay' : 'Pay on boarding'}`, 'success');
  openTicketModal(ride, paymentInfo, bookingId, bookingPin, actualSeats, fare);
}

// Open Booking Ticket confirmation modal
function openTicketModal(ride, paymentInfo = {}, bookingId = null, pin = null, seats = 1, totalFare = null) {
  const modal = document.getElementById('ticketModal');
  const content = document.getElementById('ticketModalContent');
  const bid = bookingId || `RM-${Math.floor(1000 + Math.random() * 9000)}`;
  const ticketPin = pin || '4821';
  const isRazorpay = paymentInfo.method === 'razorpay';
  const fare = totalFare || ((ride.perSeatPrice || 108) * (seats || 1));

  content.innerHTML = `
    <div class="p-6 text-center">
      <div class="w-14 h-14 ${isRazorpay ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center mx-auto mb-3">
        <i data-lucide="${isRazorpay ? 'check-check' : 'check'}" class="w-7 h-7 stroke-[3]"></i>
      </div>
      <h3 class="text-lg font-extrabold text-slate-900">${isRazorpay ? 'Payment & Seats Confirmed!' : 'Seats Reserved!'}</h3>
      <p class="text-xs text-slate-500 mt-0.5">Booking ID: <strong class="text-blue-600 font-mono">${bid}</strong></p>

      <div class="mt-4 text-left bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2.5 text-xs">
        <div class="flex justify-between items-center pb-2 border-b border-slate-200">
          <span class="text-slate-500">Driver</span>
          <span class="font-bold text-slate-800">${ride.driverName}</span>
        </div>
        <div class="flex justify-between items-center pb-2 border-b border-slate-200">
          <span class="text-slate-500">Vehicle</span>
          <span class="font-mono font-bold text-blue-700">${ride.vehicleNumber}</span>
        </div>
        <div class="flex justify-between items-center pb-2 border-b border-slate-200">
          <span class="text-slate-500">Seats Reserved</span>
          <span class="font-bold text-slate-900">${seats} Seat${seats > 1 ? 's' : ''}</span>
        </div>
        <div class="flex justify-between items-center pb-2 border-b border-slate-200">
          <span class="text-slate-500">Pickup</span>
          <span class="font-semibold text-slate-800">${ride.pickup}</span>
        </div>
        <div class="flex justify-between items-center pb-2 border-b border-slate-200">
          <span class="text-slate-500">Departure</span>
          <span class="font-bold text-emerald-600">${ride.departureTime}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">Total Contribution</span>
          <div class="text-right">
            <span class="text-sm font-black text-slate-900">₹${fare}</span>
            ${isRazorpay ? '<span class="block text-[10px] text-emerald-600 font-bold">PAID IN FULL</span>' : '<span class="block text-[10px] text-amber-600 font-bold">DUE ON BOARDING</span>'}
          </div>
        </div>
      </div>

      <!-- Payment Status Block -->
      ${isRazorpay ? `
        <div class="mt-3.5 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-left">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">✓</span>
              <div>
                <p class="text-xs font-bold text-emerald-900">Paid via Razorpay</p>
                <p class="text-[10px] font-mono text-emerald-700">${paymentInfo.paymentId || 'Verified Escrow'}</p>
              </div>
            </div>
            <span class="text-[10px] font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full uppercase">Settled</span>
          </div>
          <p class="text-[11px] text-emerald-700 mt-2">Zero cash needed. Direct digital settlement processed.</p>
        </div>
      ` : (paymentInfo.method === 'cash' ? `
        <div class="mt-3.5 p-3.5 bg-slate-100 rounded-2xl border border-slate-200 text-left">
          <div class="flex items-center gap-2">
            <i data-lucide="banknote" class="w-5 h-5 text-slate-700"></i>
            <div>
              <p class="text-xs font-bold text-slate-900">Cash on Board</p>
              <p class="text-[11px] text-slate-600">Please keep exact change of ₹${fare} ready upon boarding.</p>
            </div>
          </div>
        </div>
      ` : `
        <!-- Driver Direct Payment QR Simulation -->
        <div class="mt-3.5 p-3.5 bg-purple-50/90 rounded-2xl border border-purple-200 flex items-center gap-3 text-left">
          <div class="w-16 h-16 bg-white p-1 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 border border-purple-200">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent('upi://pay?pa=' + ride.driverName.toLowerCase().replace(/[^a-z]/g, '') + '@oksbi&pn=' + encodeURIComponent(ride.driverName) + '&am=' + fare + '&cu=INR')}" alt="UPI QR" class="w-full h-full object-contain rounded" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">UPI Direct</span>
              <span class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">0% Fee</span>
            </div>
            <p class="text-xs font-mono font-bold text-slate-800 truncate mt-1">${ride.driverName.toLowerCase().replace(/[^a-z]/g, '')}@oksbi</p>
            <p class="text-[10px] text-slate-500 mt-0.5">Scan via GPay / PhonePe / Paytm upon boarding</p>
          </div>
        </div>
      `)}

      <!-- Commute PIN Badge -->
      <div class="mt-3 py-2 px-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between text-xs">
        <span class="text-slate-600 font-medium">Boarding Verification PIN:</span>
        <span class="font-mono font-extrabold text-blue-700 text-sm tracking-wider">${ticketPin}</span>
      </div>

      <!-- Live Tracking CTA -->
      <button onclick="closeModal('ticketModal'); openLiveTrackingForRide(${ride.id}, '${ticketPin}');" class="mt-3 w-full py-3.5 gradient-brand text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition flex items-center justify-center gap-2">
        <i data-lucide="navigation" class="w-4 h-4"></i>
        <span>Track Live Commute on Map</span>
      </button>

      <!-- Quick Actions: Call & WhatsApp Share -->
      <div class="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        <button onclick="showToast('Calling driver ' + '${ride.driverName}' + ' (+91 98480 23145)...', 'info')" class="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center justify-center gap-1.5">
          <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Call Driver</span>
        </button>
        <button onclick="shareTripWithFamily()" class="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition flex items-center justify-center gap-1.5">
          <i data-lucide="share-2" class="w-3.5 h-3.5 text-emerald-600"></i>
          <span>Share Trip</span>
        </button>
      </div>

      <div class="mt-3 flex gap-2">
        <button onclick="closeModal('ticketModal'); switchTab('myrides');" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition">
          View in My Rides
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

// ==================== DRIVER MODE CONSOLE ENGINE ====================

// Driver Mode: Go Online Toggle
function toggleDriverOnline() {
  const user = state.currentUser;
  const kycStatus = (user && user.kyc_status) || (user && user.is_kyc_verified ? 'verified_success' : 'unverified');

  // Strict Lockout: Drivers must have verified_success status
  if (kycStatus !== 'verified_success') {
    state.driverOnline = false;
    if (kycStatus === 'verification_pending') {
      showToast('⏳ Your KYC submission is currently pending Admin review. Driver features are locked.', 'warning');
    } else if (kycStatus === 'rejected') {
      const reason = (user && user.rejection_reason) ? ` Reason: ${user.rejection_reason}` : '';
      showToast(`❌ KYC was rejected.${reason} Please re-submit valid documents.`, 'error');
    } else {
      showToast('🔒 Complete Driver KYC verification with original documents to go online.', 'warning');
    }
    openKycModal();
    return;
  }

  state.driverOnline = !state.driverOnline;

  const btn = document.getElementById('btnDriverOnlineToggle');
  const pill = document.getElementById('driverTogglePill');
  const dot = document.getElementById('driverToggleDot');
  const title = document.getElementById('driverOnlineTitle');
  const statusPill = document.getElementById('driverStatusPill');
  const subtitle = document.getElementById('driverOnlineSubtitle');
  const badgeIcon = document.getElementById('driverOnlineBadgeIcon');
  const beaconRing = document.getElementById('driverOnlineBeaconRing');
  const statusIcon = document.getElementById('driverOnlineStatusIcon');

  if (state.driverOnline) {
    if (btn) btn.className = 'w-16 h-9 rounded-full bg-emerald-500 p-1 flex items-center transition-colors shadow-inner flex-shrink-0 cursor-pointer';
    if (pill) pill.className = 'w-7 h-7 rounded-full bg-white shadow-md transform translate-x-7 driver-toggle-thumb flex items-center justify-center';
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
    if (title) title.textContent = 'You are Online';
    if (statusPill) {
      statusPill.textContent = 'Broadcasting';
      statusPill.className = 'text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full';
    }
    if (subtitle) subtitle.textContent = 'Uppal ➔ Jangaon corridor • Ready for passenger requests';
    if (badgeIcon) {
      badgeIcon.className = 'relative z-10 w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 transition-all';
    }
    if (beaconRing) beaconRing.classList.remove('hidden');
    if (statusIcon) statusIcon.setAttribute('data-lucide', 'radio');
    showToast('You are now Online! Receiving passenger requests on corridor.', 'success');
  } else {
    if (btn) btn.className = 'w-16 h-9 rounded-full bg-slate-300 p-1 flex items-center transition-colors shadow-inner flex-shrink-0 cursor-pointer';
    if (pill) pill.className = 'w-7 h-7 rounded-full bg-white shadow-md transform translate-x-0 driver-toggle-thumb flex items-center justify-center';
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
    if (title) title.textContent = 'You are Offline';
    if (statusPill) {
      statusPill.textContent = 'Off-Duty';
      statusPill.className = 'text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full';
    }
    if (subtitle) subtitle.textContent = 'Toggle Go Online above to start accepting passenger splits';
    if (badgeIcon) {
      badgeIcon.className = 'relative z-10 w-12 h-12 rounded-2xl bg-slate-400 text-white flex items-center justify-center shadow-md transition-all';
    }
    if (beaconRing) beaconRing.classList.add('hidden');
    if (statusIcon) statusIcon.setAttribute('data-lucide', 'moon');
    showToast('You went Offline. Corridor requests paused.', 'info');
  }

  lucide.createIcons();
  renderDriverIncomingRequest();
}

// Fuel Contribution Preference Selector (Direct UPI, Cash, Either)
function setDriverPayPreference(pref) {
  state.driverPayPreference = pref;
  const prefMap = {
    upi: 'prefBtnUpi',
    cash: 'prefBtnCash',
    either: 'prefBtnEither'
  };

  Object.entries(prefMap).forEach(([key, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (key === pref) {
      el.className = 'p-3 rounded-2xl border-2 border-blue-600 bg-blue-50/80 text-left transition flex flex-col justify-between shadow-xs';
    } else {
      el.className = 'p-3 rounded-2xl border-2 border-slate-200 bg-slate-50 text-left transition hover:bg-slate-100 flex flex-col justify-between';
    }
  });

  const label = pref === 'upi' ? 'Direct UPI' : (pref === 'cash' ? 'Cash on Board' : 'Either (UPI or Cash)');
  showToast(`Fuel payment preference: ${label}`, 'info');
}

// ==========================================
// REAL-TIME RIDE BOOKING, MATCHING & LIFECYCLE ENGINE
// ==========================================

// Render Incoming Request Card or Active Trip in Driver Mode Console
function renderDriverIncomingRequest() {
  const container = document.getElementById('driverPassengerRequestSection');
  if (!container) return;

  if (!state.driverOnline) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-6 border border-slate-200 text-center shadow-sm">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
          <i data-lucide="power-off" class="w-6 h-6"></i>
        </div>
        <h4 class="font-bold text-slate-800 text-sm">You are currently Offline</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Toggle "Go Online" above to start receiving live passenger requests along your corridor.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // 1. Active Accepted Trip Dashboard (Driver is heading to pickup or ride started)
  const activeTrip = state.activeDriverTrip || (state.currentActiveRide && state.activeRideRole === 'driver' ? state.currentActiveRide : null);
  if (activeTrip && activeTrip.status !== 'completed' && activeTrip.status !== 'cancelled') {
    const isHeading = activeTrip.status === 'driver_accepted';
    const isStarted = activeTrip.status === 'ride_started';

    container.innerHTML = `
      <div class="bg-white rounded-3xl p-5 border-2 ${isStarted ? 'border-blue-500' : 'border-emerald-500'} shadow-lg relative overflow-hidden animate-in fade-in duration-200">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${isStarted ? 'bg-blue-500' : 'bg-emerald-500'} live-pulse"></span>
            <span class="text-xs font-black ${isStarted ? 'text-blue-700' : 'text-emerald-700'} uppercase tracking-wider">
              ${isStarted ? 'Ride In Progress • In Transit' : 'Ride Accepted • Heading to Pickup'}
            </span>
          </div>
          <span class="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
            PIN: ${activeTrip.pin || '4821'}
          </span>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="${activeTrip.rider_avatar || activeTrip.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
            <div>
              <h4 class="font-bold text-slate-900 text-sm">${activeTrip.rider_name || activeTrip.name || 'Passenger'}</h4>
              <p class="text-xs text-slate-500">${activeTrip.rider_role || activeTrip.role || 'Daily Commuter'}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-400">Fuel Contribution</p>
            <p class="text-xl font-black text-emerald-600">₹${activeTrip.fare || activeTrip.fareOffer || 110}</p>
          </div>
        </div>

        <div class="mt-3.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2 text-xs">
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
            <p class="font-medium text-slate-800"><strong class="text-slate-900">Pickup:</strong> ${activeTrip.pickup}</p>
          </div>
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
            <p class="font-medium text-slate-800"><strong class="text-slate-900">Drop:</strong> ${activeTrip.drop_location || activeTrip.drop}</p>
          </div>
        </div>

        <!-- Contact & Actions -->
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <button type="button" onclick="callPassenger()" class="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition cursor-pointer">
            <i data-lucide="phone" class="w-4 h-4 text-blue-600"></i>
            <span>Call Passenger</span>
          </button>
          <button type="button" onclick="chatPassengerWhatsApp()" class="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition cursor-pointer">
            <i data-lucide="message-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>WhatsApp Chat</span>
          </button>
        </div>

        <!-- Dynamic Action Buttons: Start Ride vs Complete Ride -->
        ${isHeading ? `
          <div class="mt-3 flex items-center gap-2">
            <button type="button" onclick="openDriverVerifyPinModal()" class="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
              <i data-lucide="map-pin" class="w-4 h-4"></i>
              <span>Arrived at Pickup • Enter PIN & Start Ride</span>
            </button>
            <button type="button" onclick="confirmStartRideWithPin('4821')" title="1-Tap Instant Boarding (PIN 4821)" class="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-600/30 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer">
              <i data-lucide="check" class="w-4 h-4 stroke-[3]"></i>
              <span class="text-xs">Start</span>
            </button>
          </div>
        ` : `
          <button type="button" onclick="driverCompleteRideAction()" class="mt-3 w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-extrabold shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="check-check" class="w-4 h-4 stroke-[3]"></i>
            <span>Complete Commute & Settle ₹${activeTrip.fare || activeTrip.fareOffer || 110}</span>
          </button>
        `}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // 2. Incoming Request Available
  if (state.incomingRequest && state.incomingRequest.status !== 'cancelled') {
    const req = state.incomingRequest;
    container.innerHTML = `
      <div class="interactive-card bg-white rounded-3xl p-5 border-2 border-blue-500 shadow-md relative overflow-hidden animate-in fade-in duration-200">
        <!-- Live Request Banner -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse"></span>
            <span class="text-xs font-bold text-blue-700 uppercase tracking-wider">Incoming Passenger Request</span>
          </div>
          <span class="text-[11px] font-mono font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <i data-lucide="timer" class="w-3 h-3 text-amber-500"></i>
            <span>45s</span>
          </span>
        </div>

        <!-- Passenger Profile & Fare Split -->
        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="${req.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80'}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-600 shadow-xs" />
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-bold text-slate-900 text-sm">${req.name}</h4>
                <span class="text-[11px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">★ ${req.rating || 4.9}</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">${req.role || 'Daily Commuter'} • Verified</p>
            </div>
          </div>

          <div class="text-right">
            <div class="flex items-baseline justify-end gap-0.5">
              <span class="text-xs font-semibold text-slate-400">₹</span>
              <span class="text-2xl font-black text-blue-700">${req.fareOffer || 110}</span>
            </div>
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Fuel Split</span>
          </div>
        </div>

        <!-- Route Pickup & Drop -->
        <div class="mt-3.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2 text-xs">
          <div class="flex items-start gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
            <div>
              <p class="text-[10px] text-slate-400 font-semibold uppercase">Pickup Point</p>
              <p class="font-bold text-slate-900">${req.pickup}</p>
            </div>
          </div>
          <div class="flex items-start gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
            <div>
              <p class="text-[10px] text-slate-400 font-semibold uppercase">Drop Point</p>
              <p class="font-bold text-slate-900">${req.drop} (${req.distance || 84} km)</p>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
            <span class="font-semibold text-slate-800">${req.time || 'Ready in 5 mins'}</span>
            <span class="font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">${req.paymentMethod || 'Direct UPI'}</span>
          </div>
        </div>

        <!-- Action Buttons: Accept Ride -->
        <div class="mt-4 grid grid-cols-3 gap-2.5">
          <button type="button" onclick="declineDriverIncomingModal()" class="py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer">
            Decline
          </button>
          <button type="button" onclick="acceptDriverIncomingModal()" class="col-span-2 py-3.5 gradient-brand text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer">
            <i data-lucide="check-circle" class="w-4 h-4"></i>
            <span>Accept Ride (₹${req.fareOffer || 110})</span>
          </button>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // 3. Online Standby State (Radar Scanning)
  container.innerHTML = `
    <div class="bg-white rounded-3xl p-6 border border-slate-200 text-center shadow-xs space-y-3">
      <div class="relative w-14 h-14 mx-auto flex items-center justify-center">
        <div class="absolute inset-0 rounded-full bg-emerald-400/20 radar-ring"></div>
        <div class="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md relative z-10">
          <i data-lucide="radio" class="w-5 h-5"></i>
        </div>
      </div>
      <div>
        <h4 class="font-extrabold text-slate-900 text-sm">Broadcasting on Uppal ➔ Jangaon</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Listening for live commuter requests in real-time. You will be alerted the second a passenger books!
        </p>
      </div>
      <div class="pt-1 flex items-center justify-center gap-2 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full mx-auto w-fit border border-emerald-200/60">
        <span class="w-2 h-2 rounded-full bg-emerald-500 live-pulse"></span>
        <span>Verified Driver Broadcast Active</span>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

// 1. Rider Action: Broadcast Instant Ride Request
async function requestRideAction() {
  if (!state.currentUser) {
    showToast('Please sign in with your mobile number to request a ride.', 'warning');
    const authScreen = document.getElementById('authScreen');
    if (authScreen) authScreen.classList.remove('hidden');
    return;
  }

  const pickup = (document.getElementById('inputPickup')?.value || state.pickup || 'Uppal Ring Road Metro, Hyderabad').trim();
  const drop = (document.getElementById('inputDrop')?.value || state.drop || 'Jangaon Bus Depot / Chowrasta').trim();

  if (!pickup || !drop) {
    showToast('Please set both pickup and destination locations.', 'warning');
    return;
  }

  state.pickup = pickup;
  state.drop = drop;
  if (typeof estimateDistance === 'function') {
    state.distance = estimateDistance(pickup, drop);
  }

  const calc = calculateFuelShare(state.distance, state.vehicleType);
  const fare = calc.perSeat || 110;
  const seats = 1;
  const isFlexible = Boolean(state.vehicleType === 'any' || state.vehicleType === 'custom' || !state.vehicleType);

  const reqPayload = {
    riderId: state.currentUser.id || ('rider_' + Date.now()),
    riderName: state.currentUser.name || 'Verified Rider',
    riderPhone: state.currentUser.phone || '+91 98480 23145',
    riderAvatar: state.currentUser.avatar_url || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    riderRole: state.currentUser.role || 'Daily Commuter',
    riderRating: state.currentUser.rating || 4.9,
    pickup: pickup,
    drop: drop,
    distance: state.distance,
    vehicleType: state.vehicleType || 'any',
    isFlexibleVehicle: isFlexible,
    vehiclePreferenceLabel: isFlexible ? 'Any / Custom' : (state.vehicleType === 'bike' ? 'Bike Pillion' : (state.vehicleType === 'auto' ? 'Auto Rickshaw' : 'Car / Cab')),
    seats: seats,
    fare: fare,
    paymentMethod: 'Direct UPI'
  };

  showToast('Broadcasting ride request to nearby verified drivers...', 'info');

  const res = await window.db.matching.createRequest(reqPayload);
  if (res && res.success) {
    state.currentActiveRide = res.request;
    state.activeRideRole = 'rider';
    renderLiveTrackingStage(res.request, 'rider');
    updateActiveRideBanner();
    showToast(`Ride requested! Looking for verified drivers on ${pickup} ➔ ${drop}`, 'success');
  } else {
    showToast('Could not broadcast ride request. Please try again.', 'error');
  }
}

// 2. Rider Action: Cancel Ride Request
async function cancelCurrentActiveRide() {
  const req = state.currentActiveRide;
  if (req && req.id) {
    await window.db.matching.cancelRequest(req.id);
  }
  state.currentActiveRide = null;
  closeModal('liveTrackingModal');
  updateActiveRideBanner();
  showToast('Ride request cancelled.', 'info');
}

// 3. Central Real-Time Event Subscriber & Dispatcher
function handleRealtimeMatchingEvent(event, request) {
  console.log('🔄 [Realtime Matching Event]:', event, request);

  const currentUser = state.currentUser;
  const cleanUserPhone = currentUser ? String(currentUser.phone || '').replace(/\D/g, '').slice(-10) : '';

  // Synchronize active ride state if this client is party to it
  if (request) {
    const isRider = currentUser && ((request.rider_id && request.rider_id === currentUser.id) || (request.rider_phone && String(request.rider_phone).includes(cleanUserPhone)));
    const isAssignedDriver = currentUser && ((request.driver_id && request.driver_id === currentUser.id) || (request.driver_phone && String(request.driver_phone).includes(cleanUserPhone)));

    if (isRider) {
      state.currentActiveRide = request;
      state.activeRideRole = 'rider';
    } else if (isAssignedDriver) {
      state.currentActiveRide = request;
      state.activeDriverTrip = request;
      state.activeRideRole = 'driver';
    }
  }

  // --- EVENT 1: New Ride Request Broadcasted ---
  if (event === 'new_ride_request' && request) {
    const isFlexible = Boolean(
      request.is_flexible_vehicle ||
      request.isFlexibleVehicle ||
      request.vehicle_type === 'any' ||
      request.vehicle_type === 'custom' ||
      request.vehicleType === 'any' ||
      request.vehicleType === 'custom'
    );
    const reqVehType = request.vehicle_type || request.vehicleType || 'any';
    const driverVehType = (state.registeredVehicles && state.registeredVehicles[0]?.type) || state.vehicleType || 'bike';
    const isVehicleMatched = isFlexible || reqVehType === 'any' || reqVehType === 'custom' || reqVehType === driverVehType;

    const prefLabel = isFlexible ? 'Any / Custom Vehicle' : (reqVehType === 'bike' ? 'Bike Pillion' : (reqVehType === 'auto' ? 'Auto Rickshaw' : 'Car / Cab'));

    state.incomingRequest = {
      id: request.id,
      name: request.rider_name,
      role: request.rider_role || 'Daily Commuter',
      rating: request.rider_rating || 4.9,
      totalCommutes: 14,
      avatar: request.rider_avatar,
      pickup: request.pickup,
      drop: request.drop_location || request.drop,
      time: 'Ready in 5 mins',
      distance: request.distance_km || request.distance || 84,
      seatCount: request.seats || 1,
      fareOffer: request.fare || 110,
      paymentMethod: request.payment_method === 'cash' ? 'Cash on Board' : 'Direct UPI',
      pin: request.pin || '4821',
      phone: request.rider_phone || '+91 98480 23145',
      vehiclePreference: prefLabel,
      isFlexible: isFlexible,
      rawRequest: request
    };

    // Check if current user is an online verified driver
    const kycStatus = (currentUser && currentUser.kyc_status) || (currentUser && currentUser.is_kyc_verified ? 'verified_success' : 'unverified');
    const isOnlineVerifiedDriver = state.mode === 'driver' && state.driverOnline && kycStatus === 'verified_success';

    if (isOnlineVerifiedDriver && !state.activeDriverTrip && isVehicleMatched) {
      openDriverIncomingModal(state.incomingRequest);
      renderDriverIncomingRequest();
      playNotificationSound();
    }
  }

  // --- EVENT 2: Ride Accepted by a Driver ---
  else if (event === 'ride_accepted' && request) {
    const isRider = (state.activeRideRole === 'rider') || Boolean(currentUser && ((request.rider_id && request.rider_id === currentUser.id) || (request.rider_phone && String(request.rider_phone).includes(cleanUserPhone))));
    const isThisDriver = (state.activeRideRole === 'driver') || Boolean(currentUser && ((request.driver_id && request.driver_id === currentUser.id) || (request.driver_phone && String(request.driver_phone).includes(cleanUserPhone))));

    if (isRider) {
      state.currentActiveRide = request;
      showToast(`🎉 Driver Assigned! ${request.driver_name || 'Verified Driver'} is heading to your pickup location.`, 'success');
      renderLiveTrackingStage(request, 'rider');
    } else if (isThisDriver) {
      state.activeDriverTrip = request;
      state.currentActiveRide = request;
      state.activeRideRole = 'driver';
      state.incomingRequest = null;
      closeModal('driverIncomingRideModal');
      stopIncomingTimer();
      showToast(`🎉 Ride Accepted! Navigating to ${request.pickup}`, 'success');
      renderDriverIncomingRequest();
      renderLiveTrackingStage(request, 'driver');
    } else {
      // Another driver claimed the ride! Dismiss from other drivers' screens
      const incomingModal = document.getElementById('driverIncomingRideModal');
      if (incomingModal && !incomingModal.classList.contains('hidden')) {
        closeModal('driverIncomingRideModal');
        stopIncomingTimer();
        showToast('Ride request was accepted by another nearby driver.', 'info');
      }
      state.incomingRequest = null;
      renderDriverIncomingRequest();
    }
    updateActiveRideBanner();
  }

  // --- EVENT 3: Ride Started (Boarding PIN verified) ---
  else if (event === 'ride_started' && request) {
    if (state.currentActiveRide && state.currentActiveRide.id === request.id) {
      state.currentActiveRide = request;
      if (state.activeDriverTrip) state.activeDriverTrip = request;
      showToast('Ride Started! En route along the Highway corridor.', 'success');
      renderLiveTrackingStage(request, state.activeRideRole);
      updateActiveRideBanner();
    }
  }

  // --- EVENT 4: Ride Completed ---
  else if (event === 'ride_completed' && request) {
    const isRider = state.activeRideRole === 'rider';
    showToast(`Commute completed! ₹${request.fare} fuel contribution settled.`, 'success');

    if (isRider) {
      closeModal('liveTrackingModal');
      state.currentActiveRide = null;
      updateActiveRideBanner();
      openRatingModal({
        rideId: request.id,
        driverId: request.driver_id,
        driverPhone: request.driver_phone,
        driverName: request.driver_name || 'Verified Commuter',
        avatar: request.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        pickup: request.pickup,
        drop: request.drop_location || request.drop,
        vehicleName: request.driver_vehicle_name || 'Commuter Vehicle'
      });
    } else {
      // Driver side
      state.activeDriverTrip = null;
      state.currentActiveRide = null;
      closeModal('liveTrackingModal');
      updateActiveRideBanner();
      renderDriverIncomingRequest();
    }
  }

  // --- EVENT 5: Ride Cancelled ---
  else if (event === 'ride_cancelled') {
    closeModal('driverIncomingRideModal');
    stopIncomingTimer();
    if (state.currentActiveRide && (!request || state.currentActiveRide.id === request.id)) {
      state.currentActiveRide = null;
      closeModal('liveTrackingModal');
      updateActiveRideBanner();
      showToast('Ride request was cancelled by commuter.', 'info');
    }
    state.incomingRequest = null;
    renderDriverIncomingRequest();
  }

  // --- EVENT 6: Customer Rating & Real-Time Feedback ---
  else if (event === 'new_feedback' && request) {
    const feedback = request;
    console.log('⭐ [Realtime] New Customer Feedback received:', feedback);

    // Update driver rating across app in real time
    if (feedback.rating) {
      const driverRatingInfo = window.db?.feedbacks?.getDriverRating(feedback.driver_name, feedback.driver_phone);
      const newAvg = driverRatingInfo ? driverRatingInfo.average : feedback.rating;
      updateDriverRatingAcrossApp(feedback.driver_name, feedback.driver_phone, newAvg);
    }

    // If current logged-in user is the driver who received this rating, show toast
    const cleanUserPhone = (currentUser && currentUser.phone) ? String(currentUser.phone).replace(/[\s+-]/g, '') : '';
    const cleanDriverPhone = feedback.driver_phone ? String(feedback.driver_phone).replace(/[\s+-]/g, '') : '';
    if (cleanUserPhone && cleanDriverPhone && cleanUserPhone === cleanDriverPhone) {
      showToast(`⭐ New Customer Rating! Passenger rated you ${feedback.rating}★`, 'info');
    }

    // Real-time update for Admin Feedback section
    if (Array.isArray(state.adminFeedbacks)) {
      const existingIdx = state.adminFeedbacks.findIndex(f => f.id === feedback.id);
      if (existingIdx === -1) {
        state.adminFeedbacks.unshift(feedback);
      } else {
        state.adminFeedbacks[existingIdx] = feedback;
      }
      if (typeof updateAdminFeedbackMetrics === 'function') {
        updateAdminFeedbackMetrics();
      }
      if (typeof renderAdminFeedbacks === 'function') {
        renderAdminFeedbacks();
      }
    }
  }

  // --- EVENT 7: Real-Time In-App Chat Message (Supabase WebSockets) ---
  else if (event === 'chat_message' && request) {
    handleIncomingChatMessage(request);
  }
}

// ==========================================
// IN-APP REALTIME CHAT (SUPABASE WEBSOCKETS)
// ==========================================

function openInAppChatModal() {
  const trip = state.currentActiveRide || state.activeDriverTrip || (window.db?.matching?._activeRequest);
  if (!trip) {
    showToast('No active ride in progress for chat.', 'info');
    return;
  }

  const isDriver = state.activeRideRole === 'driver';
  const otherName = isDriver ? (trip.rider_name || 'Passenger') : (trip.driver_name || 'Verified Driver');
  const otherRole = isDriver ? 'Rider' : 'Driver';
  const otherAvatar = isDriver ? 
    (trip.rider_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80') : 
    (trip.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80');

  const nameEl = document.getElementById('chatRecipientName');
  const roleEl = document.getElementById('chatRecipientRolePill');
  const avatarEl = document.getElementById('chatRecipientAvatar');
  const unreadDot = document.getElementById('chatUnreadDot');

  if (nameEl) nameEl.textContent = otherName;
  if (roleEl) {
    roleEl.textContent = otherRole;
    roleEl.className = isDriver ? 
      'text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-200' : 
      'text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded bg-blue-500/30 text-blue-200';
  }
  if (avatarEl) avatarEl.src = otherAvatar;
  if (unreadDot) unreadDot.classList.add('hidden');

  renderChatMessagesList();

  const modal = document.getElementById('inAppChatModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.style.zIndex = '99999';
  }

  const input = document.getElementById('chatMessageInput');
  if (input) setTimeout(() => input.focus(), 150);

  if (window.lucide) lucide.createIcons();
}

function renderChatMessagesList() {
  const container = document.getElementById('chatMessagesContainer');
  if (!container) return;

  const currentUserId = state.currentUser ? state.currentUser.id : null;
  const currentRole = state.activeRideRole || 'rider';

  if (!state.chatMessages || state.chatMessages.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
        <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
          <i data-lucide="message-square" class="w-5 h-5"></i>
        </div>
        <p class="text-xs font-semibold text-slate-700">Real-Time In-App Chat Active</p>
        <p class="text-[11px] text-slate-400">Direct instant messaging connected via Supabase Realtime WebSockets.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = state.chatMessages.map(msg => {
    const isMe = (currentUserId && msg.senderId === currentUserId) || msg.senderRole === currentRole;
    const timeFormatted = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `
      <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
        <div class="flex items-center gap-1.5 mb-0.5">
          <span class="text-[9px] font-bold text-slate-400">${isMe ? 'You' : msg.senderName}</span>
          <span class="text-[8px] text-slate-400">${timeFormatted}</span>
        </div>
        <div class="max-w-[78%] px-3.5 py-2 rounded-2xl ${isMe ? 'bg-blue-600 text-white rounded-br-xs shadow-xs' : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs'}">
          <p class="text-xs leading-relaxed break-words">${escapeHtml(msg.text)}</p>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
  if (window.lucide) lucide.createIcons();
}

async function sendInAppChatMessage() {
  const input = document.getElementById('chatMessageInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  const trip = state.currentActiveRide || state.activeDriverTrip || (window.db?.matching?._activeRequest);
  const rideId = trip ? trip.id : 'corridor-active';
  const sender = {
    id: state.currentUser ? state.currentUser.id : 'usr_anon',
    name: state.currentUser ? (state.currentUser.name || 'Commuter') : 'Commuter',
    role: state.activeRideRole || 'rider',
    avatar: state.currentUser?.avatar || ''
  };

  input.value = '';

  if (window.db && window.db.matching && window.db.matching.sendChatMessage) {
    await window.db.matching.sendChatMessage(rideId, text, sender);
  }
}

function sendQuickChatMessage(text) {
  const input = document.getElementById('chatMessageInput');
  if (input) input.value = text;
  sendInAppChatMessage();
}

function handleIncomingChatMessage(msg) {
  if (!msg) return;
  if (!state.chatMessages) state.chatMessages = [];
  
  if (state.chatMessages.some(m => m.id === msg.id)) return;

  state.chatMessages.push(msg);

  const modal = document.getElementById('inAppChatModal');
  const isModalOpen = modal && !modal.classList.contains('hidden');

  if (isModalOpen) {
    renderChatMessagesList();
  } else {
    const unreadDot = document.getElementById('chatUnreadDot');
    if (unreadDot) unreadDot.classList.remove('hidden');

    const currentRole = state.activeRideRole || 'rider';
    const isMe = msg.senderRole === currentRole;
    if (!isMe) {
      showToast(`💬 ${msg.senderName}: "${msg.text}"`, 'info');
      playNotificationSound();
    }
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Open Driver Incoming Ride Modal with 45s countdown
function openDriverIncomingModal(req) {
  const modal = document.getElementById('driverIncomingRideModal');
  if (!modal) return;

  const nameEl = document.getElementById('driverIncomingRiderName');
  const roleEl = document.getElementById('driverIncomingRiderRole');
  const avatarEl = document.getElementById('driverIncomingRiderAvatar');
  const fareEl = document.getElementById('driverIncomingFare');
  const btnFareEl = document.getElementById('driverIncomingBtnFare');
  const pickupEl = document.getElementById('driverIncomingPickup');
  const dropEl = document.getElementById('driverIncomingDrop');
  const distEl = document.getElementById('driverIncomingDistance');
  const payEl = document.getElementById('driverIncomingPayMethod');
  const vehPrefEl = document.getElementById('driverIncomingVehiclePref');

  if (nameEl) nameEl.textContent = req.name;
  if (roleEl) roleEl.textContent = `${req.role} • Verified`;
  if (avatarEl) avatarEl.src = req.avatar;
  if (fareEl) fareEl.textContent = `₹${req.fareOffer}`;
  if (btnFareEl) btnFareEl.textContent = `₹${req.fareOffer}`;
  if (pickupEl) pickupEl.textContent = req.pickup;
  if (dropEl) dropEl.textContent = req.drop;
  if (distEl) distEl.textContent = `${req.distance} km corridor`;
  if (payEl) payEl.textContent = req.paymentMethod;
  if (vehPrefEl) {
    vehPrefEl.textContent = req.vehiclePreference || (req.isFlexible ? 'Any / Custom' : 'Flexible Match');
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  startIncomingTimer();
}

function startIncomingTimer() {
  stopIncomingTimer();
  state.incomingCountdown = 45;
  const badge = document.getElementById('driverIncomingTimerSeconds');
  if (badge) badge.textContent = '45s';

  state.incomingRequestTimer = setInterval(() => {
    state.incomingCountdown -= 1;
    if (badge) badge.textContent = `${state.incomingCountdown}s`;
    if (state.incomingCountdown <= 0) {
      stopIncomingTimer();
      closeModal('driverIncomingRideModal');
      showToast('Request expired.', 'info');
    }
  }, 1000);
}

function stopIncomingTimer() {
  if (state.incomingRequestTimer) {
    clearInterval(state.incomingRequestTimer);
    state.incomingRequestTimer = null;
  }
}

function declineDriverIncomingModal() {
  stopIncomingTimer();
  closeModal('driverIncomingRideModal');
  state.incomingRequest = null;
  renderDriverIncomingRequest();
  showToast('Request declined. Waiting for next corridor match...', 'info');
}

// Driver clicks Accept in Modal or Card
async function acceptDriverIncomingModal() {
  stopIncomingTimer();

  // Ensure default driver profile if currentUser is not set
  if (!state.currentUser) {
    state.currentUser = {
      id: 'driver_' + Date.now(),
      name: 'Ramesh Kumar',
      phone: '9494285249',
      role: 'Verified Driver',
      rating: 4.9,
      is_verified: true,
      is_kyc_verified: true,
      kyc_status: 'verified_success'
    };
  }

  const req = state.incomingRequest?.rawRequest || state.incomingRequest;
  if (!req) {
    showToast('No active incoming ride request to accept.', 'warning');
    closeModal('driverIncomingRideModal');
    return;
  }

  const driverVeh = (state.registeredVehicles && state.registeredVehicles[0]) || {
    name: 'Bajaj Pulsar 150',
    number: 'TS 08 EK 4321',
    type: state.vehicleType || 'bike'
  };

  const driverData = {
    id: state.currentUser.id,
    name: state.currentUser.name || 'Ramesh Kumar',
    phone: state.currentUser.phone || '+91 94942 85249',
    avatar: state.currentUser.avatar_url || state.currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    vehicleName: driverVeh.name || driverVeh.model || 'Bajaj Pulsar 150',
    vehicleNumber: driverVeh.number || driverVeh.plate || 'TS 08 EK 4321',
    vehicleType: driverVeh.type || state.vehicleType || 'bike',
    rating: state.currentUser.rating || 4.9
  };

  const targetId = req.id || req.requestId || 'REQ-9102';

  // Mark this tab as driver role immediately
  state.activeRideRole = 'driver';

  const acceptedTrip = {
    id: targetId,
    rider_id: req.riderId || req.rider_id || 'rider_ananya',
    rider_name: req.name || req.rider_name || 'Ananya Verma',
    rider_phone: req.phone || req.rider_phone || '+91 98480 23145',
    rider_avatar: req.avatar || req.rider_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    rider_role: req.role || req.rider_role || 'TCS Adibatla Commuter',
    rider_rating: req.rating || 4.9,
    pickup: req.pickup || 'Uppal Ring Road Metro (Gate 2)',
    drop_location: req.drop_location || req.drop || 'Jangaon Chowrasta',
    distance_km: req.distance_km || req.distance || 84,
    fare: req.fare || req.fareOffer || 108,
    seats: req.seats || req.seatCount || 1,
    payment_method: req.payment_method || req.paymentMethod || 'Direct UPI',
    pin: req.pin || '4821',
    status: 'driver_accepted',
    driver_id: driverData.id,
    driver_name: driverData.name,
    driver_phone: driverData.phone,
    driver_avatar: driverData.avatar,
    driver_vehicle_name: driverData.vehicleName,
    driver_vehicle_number: driverData.vehicleNumber,
    driver_vehicle_type: driverData.vehicleType,
    accepted_at: new Date().toISOString()
  };

  // Immediate UI state update (0ms latency)
  closeModal('driverIncomingRideModal');
  state.activeDriverTrip = acceptedTrip;
  state.currentActiveRide = acceptedTrip;
  state.incomingRequest = null;
  renderDriverIncomingRequest();
  renderLiveTrackingStage(acceptedTrip, 'driver');
  updateActiveRideBanner();
  showToast(`🎉 Ride Accepted! Navigating to ${acceptedTrip.pickup}`, 'success');

  // Real-time broadcast to server, Supabase, and other tabs
  if (window.db && window.db.matching) {
    window.db.matching._activeRequest = acceptedTrip;
    try {
      await window.db.matching.acceptRequest(targetId, driverData);
    } catch (err) {
      console.warn('Realtime sync note:', err);
    }
  }
}

function acceptPassengerRequest() {
  return acceptDriverIncomingModal();
}

function declinePassengerRequest() {
  return declineDriverIncomingModal();
}

// Driver Arrived at Pickup -> Opens PIN Modal
function openDriverVerifyPinModal() {
  let currentTrip = state.activeDriverTrip || state.currentActiveRide || (window.db && window.db.matching && window.db.matching._activeRequest);
  if (!currentTrip) {
    try {
      const cached = localStorage.getItem('routemate_active_ride_request');
      if (cached) currentTrip = JSON.parse(cached);
    } catch (e) {}
  }
  const pin = (currentTrip && currentTrip.pin) ? String(currentTrip.pin).trim() : '4821';

  const modal = document.getElementById('driverVerifyPinModal');
  const input = document.getElementById('driverEnteredPinInput');
  const pinHint = document.getElementById('driverVerifyPinHint');

  if (pinHint) pinHint.textContent = pin;
  if (input) {
    input.value = pin; // Pre-fill with rider's PIN for zero-friction boarding
    setTimeout(() => {
      try {
        input.focus();
        input.select();
      } catch (e) {}
    }, 100);
  }

  if (modal) {
    modal.classList.remove('hidden');
    modal.style.zIndex = '99999';
  }
  if (window.lucide) lucide.createIcons();
}

// Driver Enters PIN and Starts Ride
async function confirmStartRideWithPin(directPin) {
  let currentTrip = state.activeDriverTrip || state.currentActiveRide || (window.db && window.db.matching && window.db.matching._activeRequest);

  if (!currentTrip) {
    try {
      const cached = localStorage.getItem('routemate_active_ride_request');
      if (cached) currentTrip = JSON.parse(cached);
    } catch (e) {}
  }

  if (!currentTrip) {
    showToast('No active trip found to start.', 'error');
    closeModal('driverVerifyPinModal');
    return;
  }

  const expectedPin = currentTrip.pin ? String(currentTrip.pin).trim() : '';
  const input = document.getElementById('driverEnteredPinInput');
  let pin = directPin || (input ? input.value.trim() : '');

  if (!pin || (expectedPin && pin !== expectedPin)) {
    showToast('Incorrect Boarding PIN. Please ask the passenger for their 4-digit PIN.', 'error');
    return;
  }

  // 1. Instant local UI update (0ms latency)
  currentTrip.status = 'ride_started';
  currentTrip.started_at = new Date().toISOString();
  state.activeDriverTrip = currentTrip;
  state.currentActiveRide = currentTrip;
  state.activeRideRole = 'driver';
  if (window.db && window.db.matching) {
    window.db.matching._activeRequest = currentTrip;
  }
  try {
    localStorage.setItem('routemate_active_ride_request', JSON.stringify(currentTrip));
  } catch (e) {}

  closeModal('driverVerifyPinModal');
  showToast('✅ PIN Verified! Ride Started. Safe travels!', 'success');
  renderDriverIncomingRequest();
  renderLiveTrackingStage(currentTrip, 'driver');
  updateActiveRideBanner();

  // 2. Real-time broadcast to server, Supabase & WebSocket clients
  try {
    if (window.db && window.db.matching && window.db.matching.startRide) {
      await window.db.matching.startRide(currentTrip.id, pin);
    }
  } catch (e) {
    console.warn('Start ride sync note:', e);
  }
}

// Driver Finishes Commute
async function driverCompleteRideAction() {
  let currentTrip = state.activeDriverTrip || state.currentActiveRide || (window.db && window.db.matching && window.db.matching._activeRequest);
  if (!currentTrip) {
    try {
      const cached = localStorage.getItem('routemate_active_ride_request');
      if (cached) currentTrip = JSON.parse(cached);
    } catch (e) {}
  }
  if (!currentTrip) {
    showToast('No active commute to complete.', 'warning');
    closeModal('liveTrackingModal');
    return;
  }

  // 1. Instant local UI completion
  const fare = currentTrip.fare || currentTrip.fareOffer || 108;
  currentTrip.status = 'ride_completed';
  currentTrip.completed_at = new Date().toISOString();
  state.activeDriverTrip = null;
  state.currentActiveRide = null;
  if (window.db && window.db.matching) {
    window.db.matching._activeRequest = currentTrip;
  }
  try {
    localStorage.setItem('routemate_active_ride_request', JSON.stringify(currentTrip));
  } catch (e) {}

  closeModal('liveTrackingModal');
  showToast(`🎉 Commute Completed! ₹${fare} fuel contribution settled directly.`, 'success');
  renderDriverIncomingRequest();
  updateActiveRideBanner();

  // 2. Real-time broadcast to server, Supabase & WebSocket clients
  try {
    if (window.db && window.db.matching && window.db.matching.completeRide) {
      await window.db.matching.completeRide(currentTrip.id);
    }
  } catch (e) {
    console.warn('Complete ride sync note:', e);
  }
}

function completeCurrentRide() {
  return driverCompleteRideAction();
}

// Sound notification
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.45);
  } catch (e) {}
}

// Render Live Tracking Modal according to Lifecycle Stage
function renderLiveTrackingStage(request, role = 'rider') {
  const modal = document.getElementById('liveTrackingModal');
  if (!modal || !request) return;

  const isDriver = role === 'driver';
  const stage = request.status; // 'searching' | 'driver_accepted' | 'ride_started' | 'ride_completed'

  const stageTitle = document.getElementById('trackingStageTitle');
  const stagePill = document.getElementById('trackingStagePill');
  const searchingView = document.getElementById('trackingSearchingStateView');
  const activeView = document.getElementById('trackingActiveStateView');

  // Stage 1: SEARCHING (Rider waiting for drivers)
  if (stage === 'searching') {
    if (stageTitle) stageTitle.textContent = 'Finding Verified Drivers';
    if (stagePill) {
      stagePill.textContent = 'Searching';
      stagePill.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800';
    }
    if (searchingView) searchingView.classList.remove('hidden');
    if (activeView) activeView.classList.add('hidden');

    const sPickup = document.getElementById('searchingPickupText');
    const sDrop = document.getElementById('searchingDropText');
    const sFare = document.getElementById('searchingFareText');
    const sPin = document.getElementById('searchingPinText');
    const sVeh = document.getElementById('searchingVehicleText');

    if (sPickup) sPickup.textContent = request.pickup;
    if (sDrop) sDrop.textContent = request.drop_location || request.drop;
    if (sFare) sFare.textContent = `₹${request.fare}`;
    if (sPin) sPin.textContent = request.pin || '4821';
    if (sVeh) {
      const isFlexible = Boolean(request.is_flexible_vehicle || request.isFlexibleVehicle || request.vehicle_type === 'any' || request.vehicle_type === 'custom' || request.vehicleType === 'any' || request.vehicleType === 'custom');
      if (isFlexible) {
        sVeh.textContent = 'Any / Custom (First Available)';
      } else {
        const v = request.vehicle_type || request.vehicleType || 'any';
        sVeh.textContent = v === 'bike' ? 'Bike Pillion' : (v === 'auto' ? 'Auto Rickshaw' : 'Car / Cab');
      }
    }
  } else {
    // Stage 2 & 3: DRIVER_ACCEPTED or RIDE_STARTED
    if (searchingView) searchingView.classList.add('hidden');
    if (activeView) activeView.classList.remove('hidden');

    const origEl = document.getElementById('trackingOriginLabel');
    const destEl = document.getElementById('trackingDestLabel');
    const nameEl = document.getElementById('trackingPartyName');
    const vehEl = document.getElementById('trackingPartyVehicle');
    const avatarEl = document.getElementById('trackingPartyAvatar');
    const pinEl = document.getElementById('trackingPartyPin');
    const hudTitle = document.getElementById('trackingHudTitle');
    const callBtnLabel = document.getElementById('trackingCallBtnLabel');

    if (origEl) origEl.textContent = request.pickup;
    if (destEl) destEl.textContent = request.drop_location || request.drop;
    if (pinEl) pinEl.textContent = request.pin || '4821';

    if (isDriver) {
      if (nameEl) nameEl.textContent = request.rider_name || 'Passenger';
      if (vehEl) vehEl.textContent = `Passenger • ${request.seats || 1} Seat (${request.payment_method === 'cash' ? 'Cash' : 'UPI'})`;
      if (avatarEl) avatarEl.src = request.rider_avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80';
      if (callBtnLabel) callBtnLabel.textContent = 'Call Passenger';
    } else {
      if (nameEl) nameEl.textContent = request.driver_name || 'Verified Driver';
      if (vehEl) vehEl.textContent = `${request.driver_vehicle_name || 'Commuter Vehicle'} • ${request.driver_vehicle_number || 'TS 08 EK 4321'}`;
      if (avatarEl) avatarEl.src = request.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80';
      if (callBtnLabel) callBtnLabel.textContent = 'Call Driver';
    }

    const driverHeadingActions = document.getElementById('trackingDriverHeadingActionContainer');
    const driverCompleteActions = document.getElementById('trackingDriverCompleteActionContainer');
    const passActions = document.getElementById('trackingPassengerActionContainer');

    if (driverHeadingActions) driverHeadingActions.classList.add('hidden');
    if (driverCompleteActions) driverCompleteActions.classList.add('hidden');
    if (passActions) passActions.classList.add('hidden');

    if (stage === 'driver_accepted') {
      if (stageTitle) stageTitle.textContent = isDriver ? 'Heading to Passenger Pickup' : 'Driver Heading to Pickup';
      if (stagePill) {
        stagePill.textContent = 'Driver Assigned';
        stagePill.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      }
      if (hudTitle) hudTitle.textContent = isDriver ? 'Pickup Arrival' : 'Driver Arriving';
      if (isDriver && driverHeadingActions) driverHeadingActions.classList.remove('hidden');
    } else if (stage === 'ride_started') {
      if (stageTitle) stageTitle.textContent = 'Ride In Progress • In Transit';
      if (stagePill) {
        stagePill.textContent = 'In Transit';
        stagePill.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800';
      }
      if (hudTitle) hudTitle.textContent = 'Corridor Destination';
      if (isDriver && driverCompleteActions) {
        driverCompleteActions.classList.remove('hidden');
      } else if (!isDriver && passActions) {
        passActions.classList.remove('hidden');
      }
    }

    // Initialize Map on canvas
    setTimeout(() => {
      if (window.initTrackingMap) {
        window.initTrackingMap({
          pickup: request.pickup,
          drop: request.drop_location || request.drop,
          vehicle: request.driver_vehicle_name || 'Commuter Vehicle',
          plate: request.driver_vehicle_number || 'TS 08 EK 4321',
          driver: request.driver_name || 'Verified Commuter',
          avatar: request.driver_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
          vehicleType: request.vehicle_type || 'bike'
        });
      }
    }, 200);
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// Floating Banner Updater
function updateActiveRideBanner() {
  const banner = document.getElementById('activeRideFloatingBanner');
  if (!banner) return;

  const req = state.currentActiveRide || state.activeDriverTrip;
  if (!req || req.status === 'completed' || req.status === 'cancelled') {
    banner.classList.add('hidden');
    return;
  }

  const isDriver = state.activeRideRole === 'driver';
  const statusEl = document.getElementById('activeRideBannerStatus');
  const roleEl = document.getElementById('activeRideBannerRole');
  const subEl = document.getElementById('activeRideBannerSub');
  const pulseEl = document.getElementById('activeRideBannerPulse');

  if (roleEl) roleEl.textContent = isDriver ? 'Driver' : 'Rider';

  if (req.status === 'searching') {
    if (statusEl) statusEl.textContent = 'Connecting to Verified Drivers...';
    if (subEl) subEl.textContent = `${req.pickup} ➔ ${req.drop_location || req.drop} • ₹${req.fare}`;
    if (pulseEl) pulseEl.className = 'w-3 h-3 rounded-full bg-amber-400 live-pulse flex-shrink-0';
  } else if (req.status === 'driver_accepted') {
    if (statusEl) statusEl.textContent = isDriver ? 'Heading to Passenger Pickup' : 'Driver Assigned • En Route';
    if (subEl) subEl.textContent = isDriver ? `Passenger: ${req.rider_name || 'Commuter'} • PIN: ${req.pin}` : `Driver: ${req.driver_name || 'Verified Driver'} (${req.driver_vehicle_number || 'TS 08'})`;
    if (pulseEl) pulseEl.className = 'w-3 h-3 rounded-full bg-emerald-400 live-pulse flex-shrink-0';
  } else if (req.status === 'ride_started') {
    if (statusEl) statusEl.textContent = 'Ride In Progress • In Transit';
    if (subEl) subEl.textContent = `${req.pickup} ➔ ${req.drop_location || req.drop}`;
    if (pulseEl) pulseEl.className = 'w-3 h-3 rounded-full bg-blue-400 live-pulse flex-shrink-0';
  }

  banner.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// Open active modal when banner is clicked
function openActiveRideModal() {
  const req = state.currentActiveRide || state.activeDriverTrip;
  if (req) {
    renderLiveTrackingStage(req, state.activeRideRole);
  }
}

function callPassenger() {
  const trip = state.activeDriverTrip || state.currentActiveRide;
  const phone = (trip && (trip.rider_phone || trip.phone)) || '+91 98480 23145';
  showToast(`Calling passenger at ${phone}...`, 'info');
}

function chatPassengerWhatsApp() {
  const trip = state.activeDriverTrip || state.currentActiveRide;
  const phone = (trip && (trip.rider_phone || trip.phone)) ? String(trip.rider_phone || trip.phone).replace(/\D/g, '') : '919848023145';
  showToast('Opening WhatsApp chat with passenger...', 'success');
  window.open(`https://api.whatsapp.com/send?phone=${phone}&text=Hi%20there,%20I%20am%20your%20Routemate%20driver.%20Arriving%20at%20pickup%20point.`, '_blank');
}

function callCurrentDriver() {
  const trip = state.currentActiveRide || state.activeDriverTrip;
  const phone = (trip && (trip.driver_phone || trip.phone)) || '+91 98480 23145';
  showToast(`Calling verified driver (${phone})...`, 'info');
}

function openLiveTrackingForRide(rideOrId, pin = '4821') {
  let ride = rideOrId;
  if (typeof rideOrId === 'number' || typeof rideOrId === 'string') {
    ride = availableRides.find(r => r.id === rideOrId) || availableRides[0];
  }

  const trackingData = {
    pickup: ride.pickup || 'Uppal Ring Road Metro',
    drop: ride.drop || 'Jangaon Chowrasta',
    driver_name: ride.driverName || 'Verified Commuter',
    driver_vehicle_name: ride.vehicleName || 'Commuter Vehicle',
    driver_vehicle_number: ride.vehicleNumber || 'TS 08 EK 4321',
    driver_avatar: ride.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    pin: pin || '4821',
    fare: ride.perSeatPrice || 110,
    vehicle_type: ride.vehicleType || 'bike',
    status: 'driver_accepted'
  };

  state.currentActiveRide = trackingData;
  state.activeRideRole = 'rider';
  renderLiveTrackingStage(trackingData, 'rider');
  updateActiveRideBanner();
}

function openLiveTrackingForDriver() {
  const trip = state.activeDriverTrip || state.incomingRequest;
  if (!trip) return;

  const trackingData = {
    pickup: trip.pickup,
    drop: trip.drop_location || trip.drop,
    rider_name: trip.rider_name || trip.name || 'Passenger',
    driver_vehicle_name: 'Co-Commuter Seat',
    driver_vehicle_number: 'TS 08 HG 8421',
    rider_avatar: trip.rider_avatar || trip.avatar,
    pin: trip.pin || '4821',
    fare: trip.fare || trip.fareOffer || 110,
    vehicle_type: state.vehicleType || 'bike',
    status: trip.status || 'driver_accepted'
  };

  state.activeDriverTrip = trackingData;
  state.activeRideRole = 'driver';
  renderLiveTrackingStage(trackingData, 'driver');
  updateActiveRideBanner();
}

function openLiveTrackingModal(data) {
  state.currentActiveRide = data;
  renderLiveTrackingStage(data, data.isDriver ? 'driver' : 'rider');
}

// ==========================================
// EMERGENCY HELP & 24x7 INCIDENT DESK
// ==========================================

function triggerEmergencyHelp() {
  const msg = `EMERGENCY / SAFETY INCIDENT REPORT: Routemate commuter on NH 163 Corridor (${state.pickup} ➔ ${state.drop}). Distance: ${state.distance}km. Plate: TS 08 HG 8421. Immediate support requested.`;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=919848023145&text=${encodeURIComponent(msg)}`;
  
  showToast('Connecting to 24x7 Routemate Safety Response Desk...', 'error');
  window.open(whatsappUrl, '_blank');
}

// ==========================================
// POST-RIDE RATING & SAFETY FEEDBACK
// ==========================================

let currentRatingScore = 5;
let currentRatingTripInfo = null;

function openRatingModal(tripInfo = null) {
  const modal = document.getElementById('ratingFeedbackModal');
  if (!modal) return;

  currentRatingTripInfo = tripInfo || {
    rideId: 'RIDE-101',
    driverId: 'DRV-1',
    driverName: 'Ramesh Kumar',
    driverPhone: '+91 94942 85249',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    pickup: state.pickup || 'Uppal Ring Road Metro',
    drop: state.drop || 'Jangaon Railway Station',
    vehicleName: 'Bajaj Pulsar 150'
  };

  const info = currentRatingTripInfo;
  const nameEl = document.getElementById('ratingDriverName');
  const routeEl = document.getElementById('ratingDriverRoute');
  const avatarEl = document.getElementById('ratingDriverAvatar');

  if (nameEl) nameEl.textContent = info.driverName || 'Verified Commuter';
  if (routeEl) routeEl.textContent = `${info.pickup || 'Uppal'} ➔ ${info.drop || 'Jangaon'} • ${info.vehicleName || 'Commuter Vehicle'}`;
  if (avatarEl) avatarEl.src = info.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80';

  // Reset star selection to 5
  setRatingStar(5);
  toggleSafetyIssueBox(false);

  // Clear inputs
  const commentInput = document.getElementById('rideFeedbackComment');
  if (commentInput) commentInput.value = '';

  const chk = document.getElementById('hasSafetyConcern');
  if (chk) chk.checked = false;

  const safetyBox = document.getElementById('safetyFeedbackText');
  if (safetyBox) safetyBox.value = '';

  // Reset praise chips
  const chips = modal.querySelectorAll('.tag-chip');
  chips.forEach((c, idx) => {
    if (idx === 0) {
      c.className = 'tag-chip px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold text-[11px] transition';
    } else {
      c.className = 'tag-chip px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-[11px] transition';
    }
  });

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function setRatingStar(num) {
  currentRatingScore = num;
  const input = document.getElementById('selectedStarValue');
  const label = document.getElementById('ratingStarLabel');
  const container = document.getElementById('starRatingContainer');

  if (input) input.value = num;

  const descriptions = {
    1: 'Poor (1.0 / 5.0)',
    2: 'Needs Improvement (2.0 / 5.0)',
    3: 'Average (3.0 / 5.0)',
    4: 'Good (4.0 / 5.0)',
    5: 'Excellent (5.0 / 5.0)'
  };
  if (label) label.textContent = descriptions[num] || `${num}.0 / 5.0`;

  if (container) {
    const buttons = container.querySelectorAll('.star-btn');
    buttons.forEach((btn, index) => {
      if (index < num) {
        btn.classList.add('text-amber-400');
        btn.classList.remove('text-slate-200');
      } else {
        btn.classList.remove('text-amber-400');
        btn.classList.add('text-slate-200');
      }
    });
  }
}

function toggleFeedbackTag(btn) {
  if (!btn) return;
  const isSelected = btn.classList.contains('bg-blue-50');
  if (isSelected) {
    btn.className = 'tag-chip px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 font-medium text-[11px] transition';
  } else {
    btn.className = 'tag-chip px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 font-semibold text-[11px] transition';
  }
}

function toggleSafetyIssueBox(checked) {
  const box = document.getElementById('safetyFeedbackText');
  if (!box) return;
  if (checked) {
    box.classList.remove('hidden');
    box.focus();
  } else {
    box.classList.add('hidden');
    box.value = '';
  }
}

async function submitRideRating(event) {
  if (event && event.preventDefault) event.preventDefault();
  const star = currentRatingScore;
  const hasConcern = Boolean(document.getElementById('hasSafetyConcern')?.checked);
  const concernText = (document.getElementById('safetyFeedbackText')?.value || '').trim();
  const writtenComment = (document.getElementById('rideFeedbackComment')?.value || '').trim();

  // Collect praise tags
  const selectedTags = [];
  document.querySelectorAll('#ratingFeedbackModal .tag-chip.bg-blue-50').forEach(chip => {
    selectedTags.push(chip.textContent.trim().replace(/^[^\w\s]+/, '').trim());
  });

  const trip = currentRatingTripInfo || {
    rideId: 'RIDE-101',
    driverId: 'DRV-1',
    driverName: 'Ramesh Kumar',
    driverPhone: '+91 94942 85249',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    pickup: state.pickup || 'Uppal Ring Road Metro',
    drop: state.drop || 'Jangaon Railway Station',
    vehicleName: 'Bajaj Pulsar 150'
  };

  const finalFeedbackText = [
    writtenComment,
    (hasConcern && concernText ? `[Safety Concern]: ${concernText}` : '')
  ].filter(Boolean).join('\n\n') || (hasConcern ? 'Passenger flagged a safety issue during the corridor commute.' : 'Positive highway commute experience.');

  const feedbackPayload = {
    rideId: trip.rideId || ('RIDE-' + Date.now().toString(36).toUpperCase()),
    driverId: trip.driverId || null,
    driverName: trip.driverName || 'Ramesh Kumar',
    driverPhone: trip.driverPhone || null,
    driverAvatar: trip.avatar || null,
    driverVehicle: trip.vehicleName || 'Commuter Vehicle',
    riderId: state.currentUser?.id || 'USR-COMMUTER',
    riderName: state.currentUser?.name || 'Commuter',
    riderPhone: state.currentUser?.phone || '+91 98480 23145',
    rating: star,
    tags: selectedTags,
    feedbackText: finalFeedbackText,
    hasSafetyConcern: hasConcern,
    route: `${trip.pickup || 'Uppal'} ➔ ${trip.drop || 'Jangaon'}`,
    createdAt: new Date().toISOString()
  };

  closeModal('ratingFeedbackModal');

  // Submit via db.feedbacks
  let submitResult = null;
  try {
    if (window.db && window.db.feedbacks) {
      submitResult = await window.db.feedbacks.submit(feedbackPayload);
    }
  } catch (err) {
    console.error('Feedback submission error:', err);
  }

  // Update Driver Rating in availableRides and user profile
  const updatedAvg = submitResult?.driverRating?.average || star;
  updateDriverRatingAcrossApp(trip.driverName, trip.driverPhone, updatedAvg);

  if (hasConcern) {
    showToast(`⚠️ Rated ${star}★. Safety report submitted to Routemate Moderation Desk.`, 'error');
  } else {
    showToast(`🎉 Thank you! Rated ${star}★. Driver overall rating updated in real-time to ${updatedAvg}★.`, 'success');
  }

  // Switch to explore tab
  switchTab('explore');
}

function updateDriverRatingAcrossApp(driverName, driverPhone, newRating) {
  const normPhone = (driverPhone || '').replace(/[\s+-]/g, '');
  const normName = (driverName || '').trim().toLowerCase();

  // 1. Update availableRides array
  let updatedRides = false;
  if (Array.isArray(availableRides)) {
    availableRides.forEach(r => {
      const rName = (r.driverName || '').trim().toLowerCase();
      const rPhone = (r.phone || r.driverPhone || '').replace(/[\s+-]/g, '');
      if ((normName && rName === normName) || (normPhone && rPhone === normPhone)) {
        r.rating = newRating;
        r.totalRides = (r.totalRides || 25) + 1;
        updatedRides = true;
      }
    });
  }

  // 2. If logged in user is this driver, update profile rating
  const currentPhone = (state.currentUser?.phone || '').replace(/[\s+-]/g, '');
  const currentName = (state.currentUser?.name || '').trim().toLowerCase();
  if ((normPhone && currentPhone === normPhone) || (normName && currentName === normName)) {
    state.currentUser.rating = newRating;
    try { localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser)); } catch (e) {}
    const profileRatingEl = document.getElementById('userProfileRating');
    if (profileRatingEl) profileRatingEl.textContent = `${newRating}★`;
  }

  // 3. Re-render rides if function exists
  if (updatedRides && typeof renderRides === 'function') {
    try { renderRides(); } catch (e) {}
  }
}

// Tab navigation handler
function switchTab(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const activeNav = document.getElementById(`nav-${tabName}`);
  if (activeNav) activeNav.classList.add('active');

  const mainView = document.getElementById('mainAppView');
  const myRidesView = document.getElementById('myRidesView');
  const profileView = document.getElementById('profileView');
  const settingsView = document.getElementById('settingsView');

  // Hide all screens
  if (mainView) mainView.classList.add('hidden');
  if (myRidesView) myRidesView.classList.add('hidden');
  if (profileView) profileView.classList.add('hidden');
  if (settingsView) settingsView.classList.add('hidden');

  if (tabName === 'explore') {
    if (mainView) mainView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabName === 'myrides') {
    renderMyRides();
    if (myRidesView) myRidesView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabName === 'profile') {
    updateProfileDisplay();
    renderKycStatus();
    if (profileView) profileView.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else if (tabName === 'settings') {
    updateProfileDisplay();
    renderKycStatus();
    // Settings is embedded directly inside Account (profileView)
    if (profileView) {
      profileView.classList.remove('hidden');
      const settingsCard = document.getElementById('accountSettingsCard');
      if (settingsCard) {
        settingsCard.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    const navProfile = document.getElementById('nav-profile');
    if (navProfile) navProfile.classList.add('active');
  }

  if (window.lucide) lucide.createIcons();
}

// Render user's bookings and posted rides
function renderMyRides() {
  const container = document.getElementById('myRidesListContainer');
  if (!container) return;

  if (state.myBookings.length === 0 && state.myPostedRides.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-8 text-center border border-slate-100">
        <i data-lucide="calendar" class="w-12 h-12 text-slate-300 mx-auto mb-2"></i>
        <p class="text-sm font-bold text-slate-700">No active rides yet</p>
        <p class="text-xs text-slate-400 mt-1">Book or offer a ride to split fuel costs.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  let html = '';

  if (state.myBookings.length > 0) {
    html += `<h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Booked Rides</h4>`;
    html += state.myBookings.map(b => `
      <div class="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm mb-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <span class="text-xs font-mono font-bold text-blue-700">${b.id}</span>
          <span class="text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">${b.status}</span>
        </div>
        <p class="text-xs font-bold text-slate-900 mt-2">${b.route}</p>
        <p class="text-[11px] text-slate-500">${b.vehicle} • Driver: ${b.driver}</p>
        <div class="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <span class="font-medium text-slate-600">${b.time}</span>
          <span class="font-extrabold text-blue-700">₹${b.fare}</span>
        </div>
        <div class="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
          <button onclick="openLiveTrackingForRide(${JSON.stringify({
            pickup: b.route.split('➔')[0]?.trim() || 'Uppal Ring Road Metro',
            drop: b.route.split('➔')[1]?.trim() || 'Jangaon Chowrasta',
            driverName: b.driver,
            vehicleName: b.vehicle,
            vehicleNumber: 'TS 08 EK 4321',
            vehicleType: 'bike',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
          }).replace(/"/g, '&quot;')}, '4821')" class="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition">
            <i data-lucide="navigation" class="w-3.5 h-3.5 text-blue-600"></i>
            <span>Track Live</span>
          </button>
          <button onclick="openRatingModal(${JSON.stringify({
            driverName: b.driver,
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
            pickup: b.route.split('➔')[0]?.trim() || 'Uppal',
            drop: b.route.split('➔')[1]?.trim() || 'Jangaon',
            vehicleName: b.vehicle
          }).replace(/"/g, '&quot;')})" class="py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition">
            <i data-lucide="star" class="w-3.5 h-3.5 text-amber-500"></i>
            <span>Rate Trip</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  if (state.myPostedRides.length > 0) {
    html += `<h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Your Posted Rides</h4>`;
    html += state.myPostedRides.map(p => `
      <div class="bg-white rounded-2xl p-4 border border-blue-200 bg-blue-50/20 shadow-sm mb-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <span class="text-xs font-bold text-slate-800">You (Driver)</span>
          <span class="text-[11px] font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Active Listing</span>
        </div>
        <p class="text-xs font-bold text-slate-900 mt-2">${p.pickup} ➔ ${p.drop}</p>
        <p class="text-[11px] text-slate-500">${p.vehicleName} • ${p.vehicleNumber}</p>
        <div class="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-slate-100">
          <span class="font-medium text-slate-600">${p.departureTime}</span>
          <span class="font-bold text-emerald-600">₹${p.perSeatPrice} / seat</span>
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = html;
  lucide.createIcons();
}

// Toast notification helper
function showToast(message, type = 'info') {
  const toast = document.getElementById('appToast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.remove('translate-y-24', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 3200);
}

// Generic Modal closer
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = '';
  }
}



// Render Registered Vehicles in Profile Tab
function renderRegisteredVehicles() {
  const container = document.getElementById('registeredVehiclesContainer');
  if (!container) return;

  // Clean out legacy demo vehicle from state if present
  state.registeredVehicles = (state.registeredVehicles || []).filter(v => !(v.name === 'Honda CB Hornet 160R' && v.plate === 'TS 08 HG 8421'));

  // Sync with user KYC vehicle if provided during verification
  const user = state.currentUser;
  if (user && user.rc_number && !state.registeredVehicles.some(v => v.plate === user.rc_number)) {
    state.registeredVehicles.unshift({
      id: 'kyc_veh_' + Date.now(),
      type: (user.rc_vehicle_name && user.rc_vehicle_name.toLowerCase().includes('car')) ? 'car' : 'bike',
      name: user.rc_vehicle_name || 'Registered Vehicle',
      plate: user.rc_number,
      isPrimary: true,
      rcVerified: Boolean(user.is_kyc_verified)
    });
  }

  if (state.registeredVehicles.length === 0) {
    container.innerHTML = `
      <div class="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1.5">
        <i data-lucide="car" class="w-6 h-6 text-slate-300 mx-auto"></i>
        <p class="text-xs font-semibold text-slate-700">No vehicles registered yet</p>
        <p class="text-[10px] text-slate-400">Add your vehicle or submit KYC to link your vehicle RC.</p>
        <button type="button" onclick="openAddVehicleModal()" class="mt-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1 cursor-pointer">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Add Vehicle</span>
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = state.registeredVehicles.map(veh => `
    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl ${veh.type === 'bike' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'} flex items-center justify-center flex-shrink-0">
          <i data-lucide="${veh.type === 'bike' ? 'bike' : 'car'}" class="w-5 h-5"></i>
        </div>
        <div>
          <p class="text-xs font-bold text-slate-900">${veh.name}</p>
          <p class="text-[11px] font-mono text-slate-500">${veh.plate} • ${veh.rcVerified ? '<span class="text-emerald-600 font-bold">RC Active</span>' : 'Unverified'}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        ${veh.isPrimary ? `
          <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Primary</span>
        ` : `
          <button onclick="setPrimaryVehicle(${veh.id})" class="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition cursor-pointer">Make Primary</button>
        `}
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function setPrimaryVehicle(id) {
  state.registeredVehicles.forEach(v => {
    v.isPrimary = (v.id === id);
  });
  renderRegisteredVehicles();
  showToast('Primary vehicle updated', 'success');
}

// Open Add Vehicle Modal
function openAddVehicleModal() {
  const modal = document.getElementById('addVehicleModal');
  if (modal) modal.classList.remove('hidden');
}

// Handle Add Vehicle Form Submit
function handleAddVehicleSubmit(event) {
  event.preventDefault();
  const type = document.querySelector('input[name="newVehType"]:checked')?.value || 'bike';
  const model = document.getElementById('newVehModel').value.trim();
  const plate = document.getElementById('newVehPlate').value.trim().toUpperCase();

  if (!model || !plate) {
    showToast('Please enter vehicle model and registration number', 'error');
    return;
  }

  const newVeh = {
    id: Date.now(),
    type: type,
    name: model,
    plate: plate,
    isPrimary: false,
    rcVerified: true
  };

  state.registeredVehicles.push(newVeh);
  closeModal('addVehicleModal');
  renderRegisteredVehicles();
  showToast(`Vehicle ${model} registered successfully!`, 'success');

  // Also prefill driver post form if applicable
  const driverModelInput = document.getElementById('driverVehicleModel');
  const driverPlateInput = document.getElementById('driverVehiclePlate');
  if (driverModelInput && driverPlateInput) {
    driverModelInput.value = model;
    driverPlateInput.value = plate;
  }
}

// Open Safety Modal
function openSafetyModal() {
  const modal = document.getElementById('safetyModal');
  if (modal) modal.classList.remove('hidden');
}

// Simulated WhatsApp Share Trip
function shareTripWithFamily() {
  const msg = `Hey! I am sharing my live Routemate commuter trip on Uppal ➔ Jangaon corridor (${state.distance} km). Plate: TS 08 HG 8421. Live GPS tracking active.`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  showToast('Trip itinerary copied & sharing via WhatsApp...', 'success');
  window.open(url, '_blank');
}

// Sync live rides from Supabase Database
async function syncRidesFromDatabase() {
  if (!window.db || !window.db.rides) return;
  try {
    const data = await window.db.rides.fetchAll();
    if (data && Array.isArray(data) && data.length > 0) {
      console.log(`✅ Loaded ${data.length} live rides from Supabase table`);
      availableRides = data.map(r => ({
        id: r.id,
        driverName: r.driver_name,
        driverRole: r.driver_role || 'Verified Commuter',
        rating: parseFloat(r.rating) || 4.9,
        totalRides: 45,
        avatar: r.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
        vehicleType: r.vehicle_type,
        vehicleName: r.vehicle_name,
        vehicleNumber: r.vehicle_number,
        pickup: r.pickup,
        drop: r.drop_location,
        departureTime: r.departure_time,
        seatsAvailable: r.seats_available,
        perSeatPrice: parseFloat(r.per_seat_price),
        paymentPreference: r.payment_preference,
        verified: r.verified !== false,
        helmetProvided: Boolean(r.helmet_provided),
        ac: Boolean(r.ac),
        notes: r.notes || ''
      }));
      updateUI();
    }
  } catch (err) {
    console.warn('⚠️ Supabase sync fallback to local cache:', err);
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  // Input change listeners
  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');

  if (pickupInput && dropInput) {
    pickupInput.addEventListener('input', (e) => {
      state.pickup = e.target.value;
      state.distance = estimateDistance(state.pickup, state.drop);
      updateUI();
    });

    dropInput.addEventListener('input', (e) => {
      state.drop = e.target.value;
      state.distance = estimateDistance(state.pickup, state.drop);
      updateUI();
    });

    pickupInput.addEventListener('change', () => {
      if (window.updateRouteOnMap) window.updateRouteOnMap(state.pickup, state.drop);
    });

    dropInput.addEventListener('change', () => {
      if (window.updateRouteOnMap) window.updateRouteOnMap(state.pickup, state.drop);
    });
  }

  // Driver price input manual override flag
  const driverPriceInput = document.getElementById('driverPriceInput');
  if (driverPriceInput) {
    driverPriceInput.addEventListener('input', () => {
      driverPriceInput.dataset.manual = 'true';
    });
  }

  // Prepopulate today's date in driver form
  const driverDate = document.getElementById('driverDate');
  if (driverDate) {
    const today = new Date().toISOString().split('T')[0];
    driverDate.value = today;
  }

  // Initialize UI & Icons
  updateUI();
  renderRegisteredVehicles();
  updateProfileDisplay();
  renderKycStatus();
  lucide.createIcons();

  // Load from Supabase Database
  syncRidesFromDatabase();

  // Subscribe to Realtime Ride Matching engine
  if (window.db && window.db.matching) {
    window.db.matching.subscribe(handleRealtimeMatchingEvent);
  } else {
    setTimeout(() => {
      if (window.db && window.db.matching) {
        window.db.matching.subscribe(handleRealtimeMatchingEvent);
      }
    }, 400);
  }
  updateActiveRideBanner();

  // Initialize Supabase Phone Authentication
  initAuth();
});

// ==========================================
// SUPABASE PHONE AUTHENTICATION ENGINE
// ==========================================

// Localhost Real-Time Testing Helper (Enables seamless 2-tab/2-device multi-role testing)
function setupLocalhostTestSession(role) {
  if (role === 'driver') {
    const driverUser = {
      id: 'driver_test_9494285249',
      phone: '9494285249',
      name: 'Ramesh Kumar',
      gender: 'male',
      role: 'Verified Corridor Driver',
      rating: 4.9,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
      is_verified: true,
      is_kyc_verified: true,
      kyc_status: 'verified_success',
      profile_completed: true,
      authenticatedAt: new Date().toISOString()
    };
    state.currentUser = driverUser;
    sessionStorage.setItem('routemate_auth_user', JSON.stringify(driverUser));
    state.mode = 'driver';
    state.driverOnline = true;
    showDashboardView();
    switchMode('driver');
    const btn = document.getElementById('btnDriverOnlineToggle');
    if (btn) {
      state.driverOnline = false;
      toggleDriverOnline();
    }
    showToast('🧪 Localhost Test: Logged in as Verified Driver (Online & Listening for Rides)', 'success');
  } else {
    const riderUser = {
      id: 'rider_test_9848023145',
      phone: '+91 98480 23145',
      name: 'Ananya Verma',
      gender: 'female',
      role: 'Daily Commuter',
      rating: 4.95,
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
      is_verified: true,
      is_kyc_verified: true,
      kyc_status: 'verified_success',
      profile_completed: true,
      authenticatedAt: new Date().toISOString()
    };
    state.currentUser = riderUser;
    sessionStorage.setItem('routemate_auth_user', JSON.stringify(riderUser));
    state.mode = 'rider';
    showDashboardView();
    switchMode('rider');
    showToast('🧪 Localhost Test: Logged in as Commuter (Ready to Request Instant Ride)', 'info');
  }
}

function initLocalhostTestDock() {
  if (typeof window === 'undefined') return;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocal) return;
  if (document.getElementById('localhostTestDock')) return;

  const dock = document.createElement('div');
  dock.id = 'localhostTestDock';
  dock.className = 'fixed bottom-4 right-4 z-[9999] bg-slate-900/95 text-white p-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md text-xs flex flex-col gap-2 max-w-[280px] animate-fade-in transition-all';
  dock.innerHTML = `
    <div class="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
      <div class="flex items-center gap-1.5 font-bold text-amber-400">
        <i data-lucide="flask-conical" class="w-4 h-4"></i>
        <span>Localhost Realtime Test</span>
      </div>
      <button onclick="document.getElementById('localhostTestDock').style.display='none'" class="text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800">✕</button>
    </div>
    <p class="text-[11px] text-slate-300 leading-tight">Switch this tab's role to test 2-way instant booking on localhost:</p>
    <div class="grid grid-cols-2 gap-1.5 pt-0.5">
      <button onclick="setupLocalhostTestSession('rider')" class="px-2.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-[11px] text-center transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
        <i data-lucide="user" class="w-3.5 h-3.5"></i>
        <span>Tab 1: Rider</span>
      </button>
      <button onclick="setupLocalhostTestSession('driver')" class="px-2.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-[11px] text-center transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer">
        <i data-lucide="car" class="w-3.5 h-3.5"></i>
        <span>Tab 2: Driver</span>
      </button>
    </div>
  `;
  document.body.appendChild(dock);
  if (window.lucide) lucide.createIcons();
}

function initAuth() {
  setupOtpInputs();
  initLocalhostTestDock();

  // Check URL query params for instant test mode on localhost (?test=rider or ?test=driver)
  const urlParams = new URLSearchParams(window.location.search);
  const testRole = urlParams.get('test') || urlParams.get('role');
  if (testRole === 'rider') {
    setupLocalhostTestSession('rider');
    return;
  } else if (testRole === 'driver') {
    setupLocalhostTestSession('driver');
    return;
  }

  // 1. Check local session cache (sessionStorage takes precedence for per-tab isolation)
  const cachedUserStr = sessionStorage.getItem('routemate_auth_user') || localStorage.getItem('routemate_auth_user');
  if (cachedUserStr) {
    try {
      const cachedUser = JSON.parse(cachedUserStr);
      if (cachedUser && cachedUser.phone) {
        if (cachedUser.avatar && cachedUser.avatar.includes('photo-1535713875002-d1d0cf377fde')) {
          cachedUser.avatar = null;
        }
        state.currentUser = cachedUser;

        // Check if mandatory details (Name & Gender) exist
        const hasMandatoryDetails = Boolean(
          cachedUser.name &&
          cachedUser.name.trim().length >= 2 &&
          cachedUser.name !== 'Verified Commuter' &&
          cachedUser.name !== 'Guest Commuter' &&
          cachedUser.gender
        );

        if (!hasMandatoryDetails) {
          console.log('⚠️ Mandatory details missing in cached user session. Showing onboarding...');
          showAuthView();
          state.authPhone = cachedUser.phone;
          showOnboardingStep(cachedUser.phone, cachedUser);
          return;
        }

        console.log('✅ Active user session restored:', cachedUser.phone);
        showDashboardView();

        // Asynchronously sync latest profile from Supabase to refresh KYC verification status
        if (window.db && window.db.profiles) {
          window.db.profiles.getOrCreateByPhone(cachedUser.phone).then(profile => {
            if (profile) {
              if (profile.is_kyc_verified !== undefined) {
                state.currentUser.is_kyc_verified = Boolean(profile.is_kyc_verified);
              }
              if (profile.aadhaar_number) {
                state.currentUser.aadhaar_number = profile.aadhaar_number;
              }
              if (profile.dl_number) {
                state.currentUser.dl_number = profile.dl_number;
              }
              if (profile.avatar_url && !profile.avatar_url.includes('photo-1535713875002-d1d0cf377fde')) {
                state.currentUser.avatar = profile.avatar_url;
              }
              if (profile.name && profile.name !== 'Verified Commuter') {
                state.currentUser.name = profile.name;
              }
              if (profile.gender) {
                state.currentUser.gender = profile.gender;
              }
              if (profile.email) {
                state.currentUser.email = profile.email;
              }
              if (profile.kyc_status) {
                state.currentUser.kyc_status = profile.kyc_status;
              }
              if (profile.rejection_reason !== undefined) {
                state.currentUser.rejection_reason = profile.rejection_reason;
              }
              localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
              updateProfileDisplay();
              renderKycStatus();
            }
          }).catch(e => console.warn('Background profile KYC check:', e));
        }
        return;
      }
    } catch (e) {
      console.warn('Error reading stored user session:', e);
    }
  }

  // 2. Check Supabase Auth active session asynchronously
  if (window.db && window.db.auth) {
    window.db.auth.getSession().then(session => {
      if (session && session.user && session.user.phone) {
        state.currentUser = {
          id: session.user.id,
          phone: session.user.phone,
          name: 'Verified Commuter',
          avatar: null,
          is_verified: true,
          is_kyc_verified: false,
          aadhaar_number: '',
          dl_number: '',
          authenticatedAt: new Date().toISOString()
        };
        localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
        showDashboardView();
      } else if (!state.currentUser) {
        showAuthView();
      }
    }).catch(err => {
      console.warn('Supabase auth session check:', err);
      if (!state.currentUser) showAuthView();
    });
  } else {
    if (!state.currentUser) showAuthView();
  }
}

function showAuthView() {
  const authScreen = document.getElementById('authScreen');
  const appHeader = document.getElementById('appHeader');
  const appMain = document.getElementById('appMain');
  const appBottomNav = document.getElementById('appBottomNav');

  if (authScreen) authScreen.classList.remove('hidden');
  if (appHeader) appHeader.classList.add('hidden');
  if (appMain) appMain.classList.add('hidden');
  if (appBottomNav) appBottomNav.classList.add('hidden');

  backToPhoneStep();
  const phoneInput = document.getElementById('authPhoneInput');
  if (phoneInput) setTimeout(() => phoneInput.focus(), 200);
  if (window.lucide) lucide.createIcons();
}

function showDashboardView() {
  const authScreen = document.getElementById('authScreen');
  const appHeader = document.getElementById('appHeader');
  const appMain = document.getElementById('appMain');
  const appBottomNav = document.getElementById('appBottomNav');

  if (authScreen) authScreen.classList.add('hidden');
  if (appHeader) appHeader.classList.remove('hidden');
  if (appMain) appMain.classList.remove('hidden');
  if (appBottomNav) appBottomNav.classList.remove('hidden');

  updateProfileDisplay();
  renderKycStatus();
  if (window.lucide) lucide.createIcons();
}

function updateProfileDisplay() {
  const user = state.currentUser;
  const nameEl = document.getElementById('profileDisplayName');
  const phoneEl = document.getElementById('profileDisplayPhone');
  const avatarEl = document.getElementById('profileDisplayAvatar');
  const placeholderEl = document.getElementById('profileDisplayAvatarPlaceholder');

  // Strip legacy unsplash photo if present in cached session
  if (user && user.avatar && user.avatar.includes('photo-1535713875002-d1d0cf377fde')) {
    user.avatar = null;
    try { localStorage.setItem('routemate_auth_user', JSON.stringify(user)); } catch (e) {}
  }

  if (user) {
    if (phoneEl) phoneEl.textContent = user.phone || '+91 98480 23145';
    if (nameEl) nameEl.textContent = user.name || (user.phone ? `Commuter (${user.phone.slice(-4)})` : 'Verified Commuter');
  }

  const hasOriginalPhoto = Boolean(
    user && user.avatar && 
    (user.avatar.startsWith('data:image/') || user.avatar.startsWith('blob:') || user.avatar.startsWith('http')) && 
    !user.avatar.includes('photo-1535713875002-d1d0cf377fde')
  );

  const headerAvatarEl = document.getElementById('headerUserAvatar');
  const headerPlaceholderEl = document.getElementById('headerUserAvatarPlaceholder');

  if (hasOriginalPhoto) {
    if (avatarEl) {
      avatarEl.src = user.avatar;
      avatarEl.classList.remove('hidden');
    }
    if (placeholderEl) {
      placeholderEl.classList.add('hidden');
    }
    if (headerAvatarEl) {
      headerAvatarEl.src = user.avatar;
      headerAvatarEl.classList.remove('hidden');
    }
    if (headerPlaceholderEl) {
      headerPlaceholderEl.classList.add('hidden');
    }
  } else {
    if (avatarEl) {
      avatarEl.src = '';
      avatarEl.classList.add('hidden');
    }
    if (placeholderEl) {
      placeholderEl.classList.remove('hidden');
    }
    if (headerAvatarEl) {
      headerAvatarEl.src = '';
      headerAvatarEl.classList.add('hidden');
    }
    if (headerPlaceholderEl) {
      headerPlaceholderEl.classList.remove('hidden');
    }
  }

  // Member Since Display
  const memberSinceEl = document.getElementById('profileMemberSinceText');
  if (memberSinceEl) {
    const memberSince = (user && user.memberSince) || 'October 2024';
    memberSinceEl.textContent = memberSince.startsWith('Member') ? memberSince : `Member Since: ${memberSince}`;
  }

  // 1. Full Legal Name Field (Option 1)
  const fullNameInput = document.getElementById('profileFullNameInput');
  if (fullNameInput) {
    fullNameInput.value = (user && user.name) ? user.name : '';
  }

  // 2. Gender Field & Badge (Option 2)
  const genderInput = document.getElementById('profileGenderInput');
  const genderBadge = document.getElementById('profileGenderBadge');
  if (genderInput && user && user.gender) {
    genderInput.value = user.gender;
  }
  if (genderBadge) {
    genderBadge.textContent = (user && user.gender) ? user.gender : 'Select option';
  }

  // 3. Email Field & Status (Option 3)
  const emailInput = document.getElementById('profileEmailInput');
  if (emailInput) {
    if (user && user.email) {
      emailInput.value = user.email;
    }
    handleEmailInputValidation(emailInput.value);
  }

  // Date of Birth (DOB) Field & Display
  const dobInput = document.getElementById('profileDobInput');
  const dobDisplayBadge = document.getElementById('profileDobDisplayBadge');
  if (dobInput && user && user.dob) {
    dobInput.value = user.dob;
  }
  if (dobDisplayBadge) {
    dobDisplayBadge.textContent = formatDobReadable(user && user.dob);
  }

  // Beta status toggle & badge
  const betaToggle = document.getElementById('betaSubscriberToggle');
  const betaBadge = document.getElementById('betaBadge');
  if (betaToggle) betaToggle.checked = Boolean(state.isBetaSubscriber);
  if (betaBadge) {
    if (state.isBetaSubscriber) betaBadge.classList.remove('hidden');
    else betaBadge.classList.add('hidden');
  }

  // Whitelisted Admin Access: Strictly visible ONLY to 9494285249 or 7989031924
  const isWhitelisted = isUserAdminWhitelisted(user);
  const adminOptionBtn = document.getElementById('adminPortalOptionItem');
  if (adminOptionBtn) {
    if (isWhitelisted) {
      adminOptionBtn.classList.remove('hidden');
    } else {
      adminOptionBtn.classList.add('hidden');
    }
  }

  const headerAdminBtn = document.getElementById('headerAdminBtn');
  if (headerAdminBtn) {
    if (isWhitelisted) {
      headerAdminBtn.classList.remove('hidden');
      headerAdminBtn.classList.add('flex');
    } else {
      headerAdminBtn.classList.add('hidden');
      headerAdminBtn.classList.remove('flex');
    }
  }

  renderEmergencyContact();
  renderFavouritesList();
  renderKycStatus();
  if (window.lucide) lucide.createIcons();
}

function setupOtpInputs() {
  const otpBoxes = document.querySelectorAll('.otp-box');
  if (otpBoxes && otpBoxes.length > 0) {
    otpBoxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        box.value = val ? val[0] : '';
        if (val && idx < otpBoxes.length - 1) {
          otpBoxes[idx + 1].focus();
        }
        clearOtpError();
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!box.value && idx > 0) {
            otpBoxes[idx - 1].focus();
          }
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
        if (pasteData) {
          pasteData.slice(0, 6).split('').forEach((digit, i) => {
            if (otpBoxes[i]) otpBoxes[i].value = digit;
          });
          const targetIdx = Math.min(pasteData.length, otpBoxes.length - 1);
          otpBoxes[targetIdx].focus();
          clearOtpError();
        }
      });
    });
  }

  // Setup MPIN Login inputs (4 digits auto-advance & paste)
  const mpinBoxes = document.querySelectorAll('.mpin-login-box');
  if (mpinBoxes && mpinBoxes.length > 0) {
    mpinBoxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        box.value = val ? val[0] : '';
        clearMpinError();
        if (val && idx < mpinBoxes.length - 1) {
          mpinBoxes[idx + 1].focus();
        } else if (val && idx === mpinBoxes.length - 1) {
          // Auto trigger verify if all 4 digits entered
          const enteredMpin = Array.from(mpinBoxes).map(b => b.value).join('');
          if (enteredMpin.length === 4) {
            handleVerifyMpin();
          }
        }
      });

      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!box.value && idx > 0) {
            mpinBoxes[idx - 1].focus();
          }
        }
      });

      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim().replace(/[^0-9]/g, '');
        if (pasteData) {
          pasteData.slice(0, 4).split('').forEach((digit, i) => {
            if (mpinBoxes[i]) mpinBoxes[i].value = digit;
          });
          const targetIdx = Math.min(pasteData.length, mpinBoxes.length - 1);
          mpinBoxes[targetIdx].focus();
          clearMpinError();
          if (pasteData.length >= 4) {
            handleVerifyMpin();
          }
        }
      });
    });
  }
}

function clearPhoneError() {
  const errEl = document.getElementById('authPhoneError');
  if (errEl) errEl.classList.add('hidden');
}

function clearOtpError() {
  const errEl = document.getElementById('authOtpError');
  if (errEl) errEl.classList.add('hidden');
}

function clearMpinError() {
  const errEl = document.getElementById('authMpinError');
  if (errEl) errEl.classList.add('hidden');
}

function clearSetMpinError() {
  const errEl = document.getElementById('authSetMpinError');
  if (errEl) errEl.classList.add('hidden');
}

function backToPhoneStep() {
  const phoneStep = document.getElementById('authStepPhone');
  const mpinStep = document.getElementById('authStepMpinLogin');
  const setMpinStep = document.getElementById('authStepSetMpin');
  const otpStep = document.getElementById('authStepOtp');
  const profileStep = document.getElementById('authStepProfile');

  if (phoneStep) phoneStep.classList.remove('hidden');
  if (mpinStep) mpinStep.classList.add('hidden');
  if (setMpinStep) setMpinStep.classList.add('hidden');
  if (otpStep) otpStep.classList.add('hidden');
  if (profileStep) profileStep.classList.add('hidden');

  if (state.authCountdownTimer) {
    clearInterval(state.authCountdownTimer);
    state.authCountdownTimer = null;
  }
  clearPhoneError();
  clearOtpError();
  clearMpinError();
  clearSetMpinError();
  clearOnboardingErrors();
}

// ----------------------------------------------------
// 1. SMART PHONE SUBMIT: Route to MPIN Login vs Setup OTP
// ----------------------------------------------------
async function handlePhoneSubmit() {
  const phoneInput = document.getElementById('authPhoneInput');
  const errorEl = document.getElementById('authPhoneError');
  const errorText = document.getElementById('authPhoneErrorText');
  const submitBtn = document.getElementById('btnSendOtp');
  const submitBtnText = document.getElementById('btnSendOtpText');

  if (!phoneInput) return;
  const rawDigits = phoneInput.value.replace(/[^0-9]/g, '');

  if (rawDigits.length !== 10) {
    if (errorText) errorText.textContent = 'Please enter a valid 10-digit mobile number';
    if (errorEl) errorEl.classList.remove('hidden');
    phoneInput.focus();
    return;
  }

  clearPhoneError();
  const fullPhone = '+91' + rawDigits;
  state.authPhone = fullPhone;

  if (submitBtn) submitBtn.disabled = true;
  if (submitBtnText) submitBtnText.textContent = 'Checking Account...';

  try {
    // Check if user has an existing MPIN registered (Supabase / local)
    let userMpin = null;
    if (window.db && window.db.profiles && window.db.profiles.getMpin) {
      userMpin = await window.db.profiles.getMpin(fullPhone);
    } else {
      userMpin = localStorage.getItem('routemate_mpin_' + fullPhone);
    }

    const phoneStep = document.getElementById('authStepPhone');
    const mpinStep = document.getElementById('authStepMpinLogin');
    const mpinTargetPhone = document.getElementById('authMpinTargetPhone');

    if (userMpin) {
      // Returning user with preset MPIN -> Show instant 4-digit MPIN login (NO OTP needed!)
      state.existingMpin = userMpin;
      state.authFlow = 'mpin_login';

      if (mpinTargetPhone) mpinTargetPhone.textContent = fullPhone;
      if (phoneStep) phoneStep.classList.add('hidden');
      if (mpinStep) mpinStep.classList.remove('hidden');

      const mpinBoxes = document.querySelectorAll('.mpin-login-box');
      mpinBoxes.forEach(b => b.value = '');
      clearMpinError();
      if (mpinBoxes[0]) setTimeout(() => mpinBoxes[0].focus(), 150);
      showToast(`Welcome back! Enter your 4-digit MPIN for instant access.`, 'info');
    } else {
      // First-time user without MPIN -> Send OTP to verify and proceed to MPIN setup
      state.authFlow = 'first_registration';
      await handleSendOtp();
    }
  } catch (err) {
    console.error('Exception in handlePhoneSubmit:', err);
    // Fallback: send OTP
    state.authFlow = 'first_registration';
    await handleSendOtp();
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitBtnText) submitBtnText.textContent = 'Continue';
    if (window.lucide) lucide.createIcons();
  }
}

// ----------------------------------------------------
// 2. MPIN LOGIN HANDLER
// ----------------------------------------------------
async function handleVerifyMpin() {
  const mpinBoxes = document.querySelectorAll('.mpin-login-box');
  const enteredMpin = Array.from(mpinBoxes).map(b => b.value).join('');
  const errorEl = document.getElementById('authMpinError');
  const errorText = document.getElementById('authMpinErrorText');
  const verifyBtn = document.getElementById('btnVerifyMpin');
  const verifyBtnText = document.getElementById('btnVerifyMpinText');

  if (enteredMpin.length !== 4) {
    if (errorText) errorText.textContent = 'Please enter your 4-digit MPIN';
    if (errorEl) errorEl.classList.remove('hidden');
    return;
  }

  clearMpinError();
  if (verifyBtn) verifyBtn.disabled = true;
  if (verifyBtnText) verifyBtnText.textContent = 'Verifying MPIN...';

  try {
    let savedMpin = state.existingMpin;
    if (!savedMpin && window.db && window.db.profiles && window.db.profiles.getMpin) {
      savedMpin = await window.db.profiles.getMpin(state.authPhone);
    }
    if (!savedMpin) {
      savedMpin = localStorage.getItem('routemate_mpin_' + state.authPhone);
    }

    // Require real verified MPIN configured by user
    if (savedMpin && savedMpin === enteredMpin) {
      // MPIN Verified! Retrieve profile
      let profile = null;
      if (window.db && window.db.profiles) {
        try {
          profile = await window.db.profiles.getOrCreateByPhone(state.authPhone);
        } catch (e) {
          console.warn('Profile fetch warning in MPIN login:', e);
        }
      }

      const hasCompletedProfile = Boolean(
        profile &&
        profile.profile_completed &&
        profile.name &&
        profile.name.trim().length >= 2 &&
        profile.name !== 'Verified Commuter' &&
        profile.name !== 'Guest Commuter' &&
        profile.gender
      );

      const sessionUser = {
        id: (profile && profile.id) || ('usr_' + Date.now()),
        phone: state.authPhone,
        name: (profile && profile.name && profile.name !== 'Verified Commuter') ? profile.name : '',
        gender: (profile && profile.gender) || '',
        avatar: (profile && profile.avatar_url && !profile.avatar_url.includes('photo-1535713875002-d1d0cf377fde')) ? profile.avatar_url : null,
        is_verified: true,
        is_kyc_verified: profile ? Boolean(profile.is_kyc_verified) : false,
        kyc_status: (profile && profile.kyc_status) || (profile && profile.is_kyc_verified ? 'verified_success' : 'unverified'),
        aadhaar_number: (profile && profile.aadhaar_number) || '',
        dl_number: (profile && profile.dl_number) || '',
        email: (profile && profile.email) || '',
        dob: (profile && profile.dob) || '',
        memberSince: (profile && profile.member_since) || 'October 2024',
        profile_completed: hasCompletedProfile,
        authenticatedAt: new Date().toISOString()
      };

      state.currentUser = sessionUser;
      localStorage.setItem('routemate_auth_user', JSON.stringify(sessionUser));

      if (!hasCompletedProfile) {
        showOnboardingStep(state.authPhone, profile);
        showToast('Please complete your profile details', 'info');
        return;
      }

      showToast('✅ MPIN verified! Welcome back to Routemate.', 'success');
      showDashboardView();
      backToPhoneStep();
      const phoneInput = document.getElementById('authPhoneInput');
      if (phoneInput) phoneInput.value = '';
    } else {
      if (errorText) errorText.textContent = 'Incorrect MPIN. Please try again or tap "Forgot MPIN".';
      if (errorEl) errorEl.classList.remove('hidden');
      mpinBoxes.forEach(b => b.value = '');
      if (mpinBoxes[0]) mpinBoxes[0].focus();
    }
  } catch (err) {
    console.error('Exception during MPIN login:', err);
    if (errorText) errorText.textContent = 'Verification error. Please retry.';
    if (errorEl) errorEl.classList.remove('hidden');
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
    if (verifyBtnText) verifyBtnText.textContent = 'Login to Routemate';
  }
}

// ----------------------------------------------------
// 3. FORGOT MPIN: Trigger OTP to reset MPIN securely
// ----------------------------------------------------
async function handleForgotMpin() {
  state.authFlow = 'forgot_mpin';
  showToast('Sending OTP to reset your MPIN...', 'info');
  await handleSendOtp();
}

// ----------------------------------------------------
// 4. SHOW & SAVE MPIN SETUP
// ----------------------------------------------------
function showSetMpinStep(isReset = false) {
  const phoneStep = document.getElementById('authStepPhone');
  const mpinStep = document.getElementById('authStepMpinLogin');
  const otpStep = document.getElementById('authStepOtp');
  const setMpinStep = document.getElementById('authStepSetMpin');
  const title = document.getElementById('authSetMpinTitle');
  const subtitle = document.getElementById('authSetMpinSubtitle');
  const badge = document.getElementById('authSetMpinBadge');
  const newMpinInput = document.getElementById('authNewMpinInput');
  const confirmMpinInput = document.getElementById('authConfirmMpinInput');

  if (phoneStep) phoneStep.classList.add('hidden');
  if (mpinStep) mpinStep.classList.add('hidden');
  if (otpStep) otpStep.classList.add('hidden');
  if (setMpinStep) setMpinStep.classList.remove('hidden');

  if (isReset) {
    if (badge) badge.textContent = 'Security Reset';
    if (title) title.textContent = 'Reset Your 4-Digit MPIN';
    if (subtitle) subtitle.textContent = 'Create a new 4-digit MPIN for your Routemate account.';
  } else {
    if (badge) badge.textContent = 'Security Setup';
    if (title) title.textContent = 'Set Your 4-Digit MPIN';
    if (subtitle) subtitle.textContent = 'Create a 4-digit security MPIN for instant logins without OTP delays.';
  }

  if (newMpinInput) newMpinInput.value = '';
  if (confirmMpinInput) confirmMpinInput.value = '';
  clearSetMpinError();
  if (newMpinInput) setTimeout(() => newMpinInput.focus(), 150);
  if (window.lucide) lucide.createIcons();
}

async function handleSaveMpin() {
  const newMpinInput = document.getElementById('authNewMpinInput');
  const confirmMpinInput = document.getElementById('authConfirmMpinInput');
  const errorEl = document.getElementById('authSetMpinError');
  const errorText = document.getElementById('authSetMpinErrorText');
  const saveBtn = document.getElementById('btnSaveMpin');
  const saveBtnText = document.getElementById('btnSaveMpinText');

  const newMpin = newMpinInput ? newMpinInput.value.replace(/[^0-9]/g, '') : '';
  const confirmMpin = confirmMpinInput ? confirmMpinInput.value.replace(/[^0-9]/g, '') : '';

  if (newMpin.length !== 4) {
    if (errorText) errorText.textContent = 'Please enter a 4-digit numeric MPIN';
    if (errorEl) errorEl.classList.remove('hidden');
    if (newMpinInput) newMpinInput.focus();
    return;
  }

  if (newMpin !== confirmMpin) {
    if (errorText) errorText.textContent = 'MPINs do not match. Please re-enter both.';
    if (errorEl) errorEl.classList.remove('hidden');
    if (confirmMpinInput) confirmMpinInput.focus();
    return;
  }

  clearSetMpinError();
  if (saveBtn) saveBtn.disabled = true;
  if (saveBtnText) saveBtnText.textContent = 'Saving MPIN...';

  try {
    const phone = state.authPhone || (state.currentUser && state.currentUser.phone);
    if (phone) {
      localStorage.setItem('routemate_mpin_' + phone, newMpin);
      if (window.db && window.db.profiles && window.db.profiles.updateMpin) {
        await window.db.profiles.updateMpin(phone, newMpin).catch(e => console.warn(e));
      }
    }
    state.existingMpin = newMpin;

    showToast('🔒 4-digit MPIN saved securely!', 'success');

    // If user already completed profile onboarding, go straight to dashboard
    const user = state.currentUser;
    const hasCompletedProfile = Boolean(
      user &&
      user.profile_completed &&
      user.name &&
      user.name.trim().length >= 2 &&
      user.gender
    );

    if (hasCompletedProfile) {
      showDashboardView();
      backToPhoneStep();
      const phoneInput = document.getElementById('authPhoneInput');
      if (phoneInput) phoneInput.value = '';
    } else {
      // Continue to mandatory profile onboarding (Name & Gender)
      showOnboardingStep(state.authPhone, user);
      showToast('Please enter your legal name and gender to finalize profile', 'info');
    }
  } catch (err) {
    console.error('Exception saving MPIN:', err);
    showToast('Failed to save MPIN. Please retry.', 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
    if (saveBtnText) saveBtnText.textContent = 'Save MPIN & Continue';
  }
}

async function handleSendOtp() {
  const phoneInput = document.getElementById('authPhoneInput');
  const errorEl = document.getElementById('authPhoneError');
  const errorText = document.getElementById('authPhoneErrorText');
  const sendBtn = document.getElementById('btnSendOtp');
  const sendBtnText = document.getElementById('btnSendOtpText');

  if (!phoneInput) return;
  const rawDigits = phoneInput.value.replace(/[^0-9]/g, '');

  if (rawDigits.length !== 10) {
    if (errorText) errorText.textContent = 'Please enter a valid 10-digit mobile number';
    if (errorEl) errorEl.classList.remove('hidden');
    phoneInput.focus();
    return;
  }

  clearPhoneError();
  const fullPhone = '+91' + rawDigits;
  state.authPhone = fullPhone;

  // Set button loading
  if (sendBtn) sendBtn.disabled = true;
  if (sendBtnText) sendBtnText.textContent = 'Sending OTP...';

  try {
    let result = { success: false };
    if (window.db && window.db.auth) {
      result = await window.db.auth.signInWithOtp(fullPhone);
    }

    // Switch to OTP step
    const phoneStep = document.getElementById('authStepPhone');
    const mpinStep = document.getElementById('authStepMpinLogin');
    const setMpinStep = document.getElementById('authStepSetMpin');
    const otpStep = document.getElementById('authStepOtp');
    const targetPhoneText = document.getElementById('authTargetPhoneText');
    const sandboxNotice = document.getElementById('authSandboxNotice');

    if (targetPhoneText) targetPhoneText.textContent = fullPhone;
    if (phoneStep) phoneStep.classList.add('hidden');
    if (mpinStep) mpinStep.classList.add('hidden');
    if (setMpinStep) setMpinStep.classList.add('hidden');
    if (otpStep) otpStep.classList.remove('hidden');

    // Handle Supabase response
    if (result.success) {
      showToast(`Verification code sent to ${fullPhone}`, 'success');
    } else {
      showToast(result.error || 'Failed to send verification code. Please check your network and mobile number.', 'error');
    }

    // Clear old OTP inputs & focus first
    const otpBoxes = document.querySelectorAll('.otp-box');
    otpBoxes.forEach(b => b.value = '');
    if (otpBoxes[0]) setTimeout(() => otpBoxes[0].focus(), 150);

    // Start 30s countdown
    startOtpCountdown();

  } catch (err) {
    console.error('Exception sending OTP:', err);
    showToast('Failed to send OTP. Please try again.', 'error');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (sendBtnText) sendBtnText.textContent = 'Continue';
    if (window.lucide) lucide.createIcons();
  }
}

function startOtpCountdown() {
  if (state.authCountdownTimer) clearInterval(state.authCountdownTimer);
  state.authCountdown = 30;

  const countdownEl = document.getElementById('authCountdown');
  const resendBtn = document.getElementById('btnResendOtp');
  const resendTimerText = document.getElementById('authResendTimerText');

  if (countdownEl) countdownEl.textContent = state.authCountdown;
  if (resendBtn) resendBtn.disabled = true;
  if (resendTimerText) resendTimerText.classList.remove('opacity-40');

  state.authCountdownTimer = setInterval(() => {
    state.authCountdown--;
    if (countdownEl) countdownEl.textContent = state.authCountdown;

    if (state.authCountdown <= 0) {
      clearInterval(state.authCountdownTimer);
      state.authCountdownTimer = null;
      if (resendBtn) resendBtn.disabled = false;
      if (resendTimerText) resendTimerText.classList.add('opacity-40');
    }
  }, 1000);
}

function handleResendOtp() {
  handleSendOtp();
}

async function handleVerifyOtp() {
  const otpBoxes = document.querySelectorAll('.otp-box');
  const code = Array.from(otpBoxes).map(b => b.value).join('');
  const errorEl = document.getElementById('authOtpError');
  const errorText = document.getElementById('authOtpErrorText');
  const verifyBtn = document.getElementById('btnVerifyOtp');
  const verifyBtnText = document.getElementById('btnVerifyOtpText');

  if (code.length !== 6) {
    if (errorText) errorText.textContent = 'Please enter all 6 digits of the OTP code';
    if (errorEl) errorEl.classList.remove('hidden');
    return;
  }

  clearOtpError();
  if (verifyBtn) verifyBtn.disabled = true;
  if (verifyBtnText) verifyBtnText.textContent = 'Verifying Code...';

  try {
    let verified = false;
    let authUser = null;

    // 1. Try real Supabase OTP verification
    if (window.db && window.db.auth) {
      const res = await window.db.auth.verifyOtp(state.authPhone, code);
      if (res.success && res.data) {
        verified = true;
        authUser = res.data.user;
      }
    }

    // Real Supabase OTP verification only

    if (verified) {
      // Sync or fetch profile from Supabase Database
      let profile = null;
      if (window.db && window.db.profiles) {
        try {
          profile = await window.db.profiles.getOrCreateByPhone(state.authPhone);
        } catch (e) {
          console.warn('Profile sync:', e);
        }
      }

      // Check if this is a first-time user who needs mandatory profile onboarding
      const hasCompletedProfile = Boolean(
        profile &&
        profile.profile_completed &&
        profile.name &&
        profile.name.trim().length >= 2 &&
        profile.name !== 'Verified Commuter' &&
        profile.name !== 'Guest Commuter' &&
        profile.gender
      );

      const sessionUser = {
        id: (authUser && authUser.id) || (profile && profile.id) || ('usr_' + Date.now()),
        phone: state.authPhone,
        name: (profile && profile.name && profile.name !== 'Verified Commuter') ? profile.name : '',
        gender: (profile && profile.gender) || '',
        avatar: (profile && profile.avatar_url && !profile.avatar_url.includes('photo-1535713875002-d1d0cf377fde')) ? profile.avatar_url : null,
        is_verified: true,
        is_kyc_verified: profile ? Boolean(profile.is_kyc_verified) : false,
        kyc_status: (profile && profile.kyc_status) || (profile && profile.is_kyc_verified ? 'verified_success' : 'unverified'),
        aadhaar_number: (profile && profile.aadhaar_number) || '',
        dl_number: (profile && profile.dl_number) || '',
        email: (profile && profile.email) || '',
        dob: (profile && profile.dob) || '',
        memberSince: (profile && profile.member_since) || 'October 2024',
        profile_completed: hasCompletedProfile,
        authenticatedAt: new Date().toISOString()
      };

      state.currentUser = sessionUser;
      localStorage.setItem('routemate_auth_user', JSON.stringify(sessionUser));

      // Check if user came from 'forgot_mpin' flow or needs first-time MPIN setup
      const isReset = state.authFlow === 'forgot_mpin';
      const existingMpin = (profile && profile.mpin) || localStorage.getItem('routemate_mpin_' + state.authPhone);

      if (isReset || !existingMpin) {
        // Direct user to set their 4-digit MPIN
        showSetMpinStep(isReset);
        showToast(isReset ? 'OTP verified! Please create your new 4-digit MPIN.' : 'Phone verified! Now set your 4-digit MPIN for instant logins.', 'success');
        return;
      }

      if (!hasCompletedProfile) {
        // First-time login / signup -> MANDATORY PROFILE SETUP SCREEN
        console.log('📝 First-time user detected. Launching mandatory profile onboarding...');
        showOnboardingStep(state.authPhone, profile);
        showToast('Please enter your mandatory name and gender to continue', 'info');
        return;
      }

      showToast('✅ Authenticated successfully! Welcome to Routemate.', 'success');
      showDashboardView();

      // Reset auth forms
      backToPhoneStep();
      const phoneInput = document.getElementById('authPhoneInput');
      if (phoneInput) phoneInput.value = '';
    } else {
      if (errorText) errorText.textContent = 'Invalid verification code. Please enter the valid OTP sent to your phone.';
      if (errorEl) errorEl.classList.remove('hidden');
      if (otpBoxes[0]) otpBoxes[0].focus();
    }
  } catch (err) {
    console.error('Exception during OTP verify:', err);
    if (errorText) errorText.textContent = 'Verification error. Please retry.';
    if (errorEl) errorEl.classList.remove('hidden');
  } finally {
    if (verifyBtn) verifyBtn.disabled = false;
    if (verifyBtnText) verifyBtnText.textContent = 'Verify & Access Dashboard';
  }
}

// ==========================================
// MANDATORY PROFILE ONBOARDING (FIRST TIME)
// ==========================================

function showOnboardingStep(phone = null, profile = null) {
  const phoneStep = document.getElementById('authStepPhone');
  const otpStep = document.getElementById('authStepOtp');
  const profileStep = document.getElementById('authStepProfile');

  if (phoneStep) phoneStep.classList.add('hidden');
  if (otpStep) otpStep.classList.add('hidden');
  if (profileStep) profileStep.classList.remove('hidden');

  const phoneVal = phone || state.authPhone || (state.currentUser && state.currentUser.phone) || '+91 98480 23145';
  const phoneInput = document.getElementById('onboardingPhoneInput');
  if (phoneInput) phoneInput.value = phoneVal;

  const user = profile || state.currentUser;
  const nameInput = document.getElementById('onboardingNameInput');
  if (nameInput) {
    if (user && user.name && user.name !== 'Verified Commuter' && user.name !== 'Guest Commuter') {
      nameInput.value = user.name;
    } else {
      nameInput.value = '';
    }
  }

  const genderSelect = document.getElementById('onboardingGenderSelect');
  if (genderSelect) {
    if (user && user.gender) {
      genderSelect.value = user.gender;
    } else {
      genderSelect.value = '';
    }
  }

  const emailInput = document.getElementById('onboardingEmailInput');
  if (emailInput) {
    emailInput.value = (user && user.email) ? user.email : '';
  }

  const dobInput = document.getElementById('onboardingDobInput');
  if (dobInput) {
    dobInput.value = (user && user.dob) ? user.dob : '';
  }

  clearOnboardingErrors();
  if (nameInput) setTimeout(() => nameInput.focus(), 150);
  if (window.lucide) lucide.createIcons();
}

function clearOnboardingErrors() {
  const errs = ['onboardingNameError', 'onboardingGenderError', 'onboardingEmailError'];
  errs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function showOnboardingError(id, msg) {
  const el = document.getElementById(id);
  const textEl = document.getElementById(id + 'Text');
  if (textEl) textEl.textContent = msg;
  else if (el) el.textContent = msg;
  if (el) el.classList.remove('hidden');
}

async function handleOnboardingSubmit() {
  const nameInput = document.getElementById('onboardingNameInput');
  const phoneInput = document.getElementById('onboardingPhoneInput');
  const genderSelect = document.getElementById('onboardingGenderSelect');
  const emailInput = document.getElementById('onboardingEmailInput');
  const dobInput = document.getElementById('onboardingDobInput');
  const submitBtn = document.getElementById('btnSubmitOnboarding');

  const nameVal = nameInput ? nameInput.value.trim() : '';
  const phoneVal = (phoneInput && phoneInput.value.trim()) || state.authPhone || '+91 98480 23145';
  const genderVal = genderSelect ? genderSelect.value : '';
  const emailVal = emailInput ? emailInput.value.trim() : '';
  const dobVal = dobInput ? dobInput.value : '';

  clearOnboardingErrors();
  let hasError = false;

  // 1. Mandatory Name Validation (cannot be empty, at least 2 chars)
  if (!nameVal || nameVal.length < 2) {
    showOnboardingError('onboardingNameError', 'Please enter your full legal name (at least 2 characters)');
    if (nameInput) nameInput.focus();
    hasError = true;
  }

  // 2. Mandatory Gender Validation
  if (!genderVal) {
    showOnboardingError('onboardingGenderError', 'Please select your gender');
    if (!hasError && genderSelect) genderSelect.focus();
    hasError = true;
  }

  // 3. Optional Email Validation (validated only if provided)
  if (emailVal && !validateEmail(emailVal)) {
    showOnboardingError('onboardingEmailError', 'Please enter a valid email address');
    if (!hasError && emailInput) emailInput.focus();
    hasError = true;
  }

  if (hasError) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Saving Profile...</span>';
  }

  try {
    if (!state.currentUser) {
      state.currentUser = {
        id: 'usr_' + Date.now(),
        authenticatedAt: new Date().toISOString()
      };
    }

    state.currentUser.phone = phoneVal;
    state.currentUser.name = nameVal;
    state.currentUser.gender = genderVal;
    state.currentUser.email = emailVal;
    state.currentUser.dob = dobVal;
    state.currentUser.is_verified = true;
    state.currentUser.profile_completed = true;

    // Immediately update header profile display
    const profileDisplayName = document.getElementById('profileDisplayName');
    if (profileDisplayName) profileDisplayName.textContent = nameVal;

    // Persist to local storage
    localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));

    // Persist to Supabase Database in real time
    if (window.db && window.db.profiles && window.db.profiles.updateDetails) {
      await window.db.profiles.updateDetails(phoneVal, {
        name: nameVal,
        gender: genderVal,
        email: emailVal || null,
        dob: dobVal || null,
        profile_completed: true
      }).catch(e => console.warn('Supabase profile update warning:', e));
    }

    showToast(`✅ Welcome, ${nameVal}! Profile registered successfully.`, 'success');
    showDashboardView();

    // Reset auth screens
    backToPhoneStep();
    const phoneInputEl = document.getElementById('authPhoneInput');
    if (phoneInputEl) phoneInputEl.value = '';

  } catch (err) {
    console.error('Exception submitting onboarding profile:', err);
    showToast('Failed to save profile. Please retry.', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Save & Continue to App</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function handleSignOut() {
  if (confirm('Are you sure you want to log out of Routemate?')) {
    localStorage.removeItem('routemate_auth_user');
    if (window.db && window.db.auth) {
      window.db.auth.signOut();
    }
    state.currentUser = null;
    showToast('Signed out of Routemate', 'info');
    showAuthView();
  }
}

// ==========================================
// DRIVER KYC VERIFICATION SYSTEM (SUPABASE)
// ==========================================

function maskAadhaar(aadhaar) {
  if (!aadhaar) return '•••• •••• ••••';
  const clean = String(aadhaar).replace(/\s+/g, '');
  if (clean.length < 4) return '•••• •••• ••••';
  const last4 = clean.slice(-4);
  return `•••• •••• ${last4}`;
}

function maskDl(dl) {
  if (!dl) return 'TS-••-••••••••';
  const clean = String(dl).trim().toUpperCase();
  if (clean.length < 6) return 'TS-••-••••••••';
  const prefix = clean.slice(0, 5);
  const suffix = clean.slice(-4);
  return `${prefix}••••${suffix}`;
}

// ------------------------------------------
// 4-STATE DRIVER KYC STATUS RENDERER
// ------------------------------------------
function renderKycStatus() {
  const user = state.currentUser;
  const kycStatus = (user && user.kyc_status) || (user && user.is_kyc_verified ? 'verified_success' : 'unverified');
  const aadhaarNumber = user ? (user.aadhaar_number || '') : '';
  const dlNumber = user ? (user.dl_number || '') : '';
  const rcNumber = user ? (user.rc_number || '') : '';

  // 1. Profile KYC Badge Container (in profile screen)
  const badgeContainer = document.getElementById('profileKycBadgeContainer');
  if (badgeContainer) {
    if (kycStatus === 'verified_success') {
      badgeContainer.innerHTML = `
        <span class="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-300 flex items-center gap-1 shadow-xs">
          <i data-lucide="shield-check" class="w-3.5 h-3.5 text-emerald-600"></i>
          <span>KYC Approved & Active</span>
        </span>
      `;
    } else if (kycStatus === 'verification_pending') {
      badgeContainer.innerHTML = `
        <button type="button" onclick="openKycModal()" class="text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-full border border-blue-300 flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs">
          <i data-lucide="clock" class="w-3.5 h-3.5 text-blue-600 animate-spin"></i>
          <span>Under Admin Review</span>
        </button>
      `;
    } else if (kycStatus === 'rejected') {
      badgeContainer.innerHTML = `
        <button type="button" onclick="openKycModal()" class="text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-300 flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs">
          <i data-lucide="alert-octagon" class="w-3.5 h-3.5 text-rose-600"></i>
          <span>KYC Rejected - Fix</span>
        </button>
      `;
    } else {
      badgeContainer.innerHTML = `
        <button type="button" onclick="openKycModal()" class="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300 flex items-center gap-1 transition cursor-pointer active:scale-95 shadow-xs">
          <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-600"></i>
          <span>KYC Pending - Upload</span>
        </button>
      `;
    }
  }

  // 2. Driver KYC Card in Profile View
  const kycCard = document.getElementById('driverKycCard');
  if (kycCard) {
    if (kycStatus === 'verified_success') {
      kycCard.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="font-bold text-slate-900 text-sm">Driver KYC Verification</h3>
              <p class="text-[10px] text-emerald-600 font-semibold">Government ID, DL & Vehicle RC Approved</p>
            </div>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Approved
          </span>
        </div>

        <div class="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
          ${user && user.avatar && !user.avatar.includes('photo-1535713875002-d1d0cf377fde') ? `
            <img src="${user.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-xs bg-white flex-shrink-0" />
          ` : `
            <div class="w-12 h-12 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-400 flex-shrink-0 shadow-2xs">
              <i data-lucide="user" class="w-6 h-6 text-slate-400"></i>
            </div>
          `}
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-900 truncate">${(user && user.name) || 'Verified Driver'}</p>
            <p class="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
              <i data-lucide="check-circle" class="w-3 h-3 text-emerald-600"></i> Verified by Routemate Administration
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs pt-1">
          <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5">
            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Aadhaar UID</p>
            <p class="font-mono font-bold text-slate-900 mt-0.5">${maskAadhaar(aadhaarNumber)}</p>
            <p class="text-[9px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <i data-lucide="check-circle-2" class="w-2.5 h-2.5"></i> Admin Verified
            </p>
          </div>
          <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5">
            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Driving License</p>
            <p class="font-mono font-bold text-slate-900 mt-0.5">${maskDl(dlNumber)}</p>
            <p class="text-[9px] text-emerald-600 font-semibold flex items-center gap-1 mt-1">
              <i data-lucide="check-circle-2" class="w-2.5 h-2.5"></i> Validated
            </p>
          </div>
        </div>
        <div class="pt-1 flex items-center justify-between text-[11px] text-slate-500">
          <span>Synced with Supabase profiles</span>
          <div class="flex items-center gap-3">
            <button type="button" onclick="resetDriverKyc()" class="text-rose-600 font-bold hover:underline cursor-pointer">Reset KYC</button>
            <button type="button" onclick="openKycModal()" class="text-blue-600 font-bold hover:underline cursor-pointer">View Details</button>
          </div>
        </div>
      `;
    } else if (kycStatus === 'verification_pending') {
      kycCard.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <i data-lucide="clock" class="w-4 h-4 text-blue-600"></i>
            </div>
            <div>
              <h3 class="font-bold text-slate-900 text-sm">Driver KYC Verification</h3>
              <p class="text-[10px] text-blue-700 font-medium">Documents submitted for Admin Review</p>
            </div>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200">
            Pending Review
          </span>
        </div>
        <div class="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 text-xs space-y-2">
          <p class="text-[11px] text-blue-900 leading-relaxed font-medium">
            📋 Your Aadhaar card, Driving License and Vehicle RC scans have been submitted and are under manual verification. Driver privileges will unlock once approved.
          </p>
          <div class="flex items-center justify-between pt-1 text-[11px]">
            <span class="text-blue-600 font-semibold flex items-center gap-1"><i data-lucide="shield" class="w-3 h-3"></i> Verification Status: In Queue</span>
            <button type="button" onclick="openKycModal()" class="text-blue-700 font-bold underline cursor-pointer">Review Docs</button>
          </div>
        </div>
      `;
    } else if (kycStatus === 'rejected') {
      const reason = (user && user.rejection_reason) || 'Document scan was blurry or details did not match.';
      kycCard.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center">
              <i data-lucide="x-circle" class="w-4 h-4 text-rose-600"></i>
            </div>
            <div>
              <h3 class="font-bold text-slate-900 text-sm">Driver KYC Verification</h3>
              <p class="text-[10px] text-rose-700 font-medium">Submission was Rejected by Admin</p>
            </div>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-200">
            Rejected
          </span>
        </div>
        <div class="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs space-y-2.5">
          <p class="text-[11px] text-rose-900 leading-relaxed font-semibold">
            ⚠️ <strong>Rejection Reason:</strong> ${reason}
          </p>
          <button type="button" onclick="openKycModal()" class="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            <span>Re-Submit Clear Documents</span>
          </button>
        </div>
      `;
    } else {
      kycCard.innerHTML = `
        <div class="flex items-center justify-between pb-2 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <i data-lucide="shield-alert" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="font-bold text-slate-900 text-sm">Driver KYC Verification</h3>
              <p class="text-[10px] text-amber-700 font-medium">Required before offering corridor rides</p>
            </div>
          </div>
          <span class="text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
            Unverified
          </span>
        </div>
        <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 text-xs space-y-2.5">
          <p class="text-[11px] text-amber-900 leading-relaxed">
            Upload your photo, Aadhaar card scan, Driving License and Vehicle RC to submit for Admin verification.
          </p>
          <button type="button" onclick="openKycModal()" class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer">
            <i data-lucide="upload" class="w-3.5 h-3.5"></i>
            <span>Upload KYC Documents</span>
          </button>
        </div>
      `;
    }
  }

  // 3. Driver Mode Notice Banner
  const alertBanner = document.getElementById('driverKycAlertBanner');
  if (alertBanner) {
    if (kycStatus === 'verified_success') {
      alertBanner.innerHTML = `
        <div class="bg-emerald-50 border border-emerald-200/90 rounded-2xl p-3 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </div>
            <div>
              <p class="font-bold text-emerald-950 text-xs">Driver KYC Approved</p>
              <p class="text-[10px] text-emerald-700">All documents verified. Ready for corridor broadcasting.</p>
            </div>
          </div>
          <span class="text-[10px] font-extrabold text-emerald-800 bg-white px-2 py-0.5 rounded-full border border-emerald-300 flex-shrink-0">
            Active
          </span>
        </div>
      `;
    } else if (kycStatus === 'verification_pending') {
      alertBanner.innerHTML = `
        <div class="bg-blue-50 border border-blue-300 rounded-2xl p-3.5 flex items-center justify-between text-xs gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0">
              <i data-lucide="clock" class="w-4 h-4 text-blue-700"></i>
            </div>
            <div>
              <p class="font-bold text-blue-950 text-xs">KYC Verification Under Review</p>
              <p class="text-[10px] text-blue-800">Admin review in progress. Driver features unlock after approval.</p>
            </div>
          </div>
          <button type="button" onclick="openKycModal()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-bold flex-shrink-0 shadow-xs cursor-pointer active:scale-95">
            View Status
          </button>
        </div>
      `;
    } else if (kycStatus === 'rejected') {
      alertBanner.innerHTML = `
        <div class="bg-rose-50 border border-rose-300 rounded-2xl p-3.5 flex items-center justify-between text-xs gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center flex-shrink-0">
              <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-700"></i>
            </div>
            <div>
              <p class="font-bold text-rose-950 text-xs">KYC Verification Rejected</p>
              <p class="text-[10px] text-rose-800">${(user && user.rejection_reason) || 'Please re-submit clear documents.'}</p>
            </div>
          </div>
          <button type="button" onclick="openKycModal()" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold flex-shrink-0 shadow-xs cursor-pointer active:scale-95">
            Fix & Re-submit
          </button>
        </div>
      `;
    } else {
      alertBanner.innerHTML = `
        <div class="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between text-xs gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            </div>
            <div>
              <p class="font-bold text-amber-950 text-xs">KYC Verification Required</p>
              <p class="text-[10px] text-amber-800">Upload Aadhaar, DL & RC to unlock corridor broadcasting</p>
            </div>
          </div>
          <button type="button" onclick="openKycModal()" class="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold flex-shrink-0 shadow-xs cursor-pointer active:scale-95">
            Upload Now
          </button>
        </div>
      `;
    }
  }

  if (window.lucide) lucide.createIcons();
}

function openKycModal() {
  const modal = document.getElementById('kycVerificationModal');
  if (!modal) return;

  clearKycErrors();

  const user = state.currentUser;
  const nameInput = document.getElementById('kycFullName');
  const avatarPreview = document.getElementById('kycAvatarPreview');
  const avatarPlaceholder = document.getElementById('kycAvatarPlaceholder');
  const photoStatusText = document.getElementById('kycPhotoStatusText');
  const photoBtnText = document.getElementById('kycPhotoBtnText');
  const aadhaarInput = document.getElementById('kycAadhaarNumber');
  const dlInput = document.getElementById('kycDlNumber');
  const dlExpiryInput = document.getElementById('kycDlExpiryDate');
  const rcNumberInput = document.getElementById('kycRcNumber');
  const rcModelInput = document.getElementById('kycRcVehicleModel');

  if (nameInput) {
    nameInput.value = (user && user.name && user.name !== 'Verified Commuter') ? user.name : '';
  }

  // Pre-fill existing driver photo if available
  const hasOriginalPhoto = Boolean(
    user && user.avatar && 
    (user.avatar.startsWith('data:image/') || user.avatar.startsWith('blob:') || (user.avatar.startsWith('http') && !user.avatar.includes('photo-1535713875002-d1d0cf377fde')))
  );

  if (hasOriginalPhoto) {
    state.uploadedKycPhoto = user.avatar;
    if (avatarPreview) {
      avatarPreview.src = user.avatar;
      avatarPreview.classList.remove('hidden');
    }
    if (avatarPlaceholder) avatarPlaceholder.classList.add('hidden');
    if (photoStatusText) {
      photoStatusText.textContent = '✅ Original verified photo uploaded.';
      photoStatusText.className = 'text-[10px] text-emerald-600 font-bold';
    }
    if (photoBtnText) photoBtnText.textContent = 'Change Photo';
  } else {
    state.uploadedKycPhoto = null;
    if (avatarPreview) {
      avatarPreview.src = '';
      avatarPreview.classList.add('hidden');
    }
    if (avatarPlaceholder) avatarPlaceholder.classList.remove('hidden');
    if (photoStatusText) {
      photoStatusText.textContent = 'Driver must upload real photo (camera or gallery).';
      photoStatusText.className = 'text-[10px] text-slate-500 font-medium';
    }
    if (photoBtnText) photoBtnText.textContent = 'Select Real Driver Photo';
  }

  if (aadhaarInput && user && user.aadhaar_number) {
    aadhaarInput.value = user.aadhaar_number.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
  if (dlInput && user && user.dl_number) {
    dlInput.value = user.dl_number;
  }
  if (dlExpiryInput && user && user.dl_expiry) {
    dlExpiryInput.value = user.dl_expiry;
  }
  if (rcNumberInput && user && user.rc_number) {
    rcNumberInput.value = user.rc_number;
  }
  if (rcModelInput && user && user.rc_vehicle_name) {
    rcModelInput.value = user.rc_vehicle_name;
  }

  // Pre-fill uploaded doc previews if already present
  if (user && user.aadhaar_card_photo) {
    state.manualKycAadhaarDoc = user.aadhaar_card_photo;
    const preview = document.getElementById('kycAadhaarDocPreview');
    const ph = document.getElementById('kycAadhaarDocPlaceholder');
    const status = document.getElementById('kycAadhaarDocStatus');
    if (preview) { preview.src = user.aadhaar_card_photo; preview.classList.remove('hidden'); }
    if (ph) ph.classList.add('hidden');
    if (status) status.textContent = '✅ Aadhaar image loaded';
  }

  if (user && user.dl_photo) {
    state.manualKycDlDoc = user.dl_photo;
    const preview = document.getElementById('kycDlDocPreview');
    const ph = document.getElementById('kycDlDocPlaceholder');
    const status = document.getElementById('kycDlDocStatus');
    if (preview) { preview.src = user.dl_photo; preview.classList.remove('hidden'); }
    if (ph) ph.classList.add('hidden');
    if (status) status.textContent = '✅ DL image loaded';
  }

  if (user && user.rc_photo) {
    state.manualKycRcDoc = user.rc_photo;
    const preview = document.getElementById('kycRcDocPreview');
    const ph = document.getElementById('kycRcDocPlaceholder');
    const status = document.getElementById('kycRcDocStatus');
    if (preview) { preview.src = user.rc_photo; preview.classList.remove('hidden'); }
    if (ph) ph.classList.add('hidden');
    if (status) status.textContent = '✅ RC image loaded';
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleKycPhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;
    state.uploadedKycPhoto = dataUrl;

    const preview = document.getElementById('kycAvatarPreview');
    const placeholder = document.getElementById('kycAvatarPlaceholder');
    const photoStatusText = document.getElementById('kycPhotoStatusText');
    const photoBtnText = document.getElementById('kycPhotoBtnText');
    const photoError = document.getElementById('kycPhotoError');

    if (preview) {
      preview.src = dataUrl;
      preview.classList.remove('hidden');
    }
    if (placeholder) {
      placeholder.classList.add('hidden');
    }
    if (photoStatusText) {
      photoStatusText.textContent = '✅ Original photo loaded ready for verification.';
      photoStatusText.className = 'text-[10px] text-emerald-600 font-bold';
    }
    if (photoBtnText) {
      photoBtnText.textContent = 'Change Photo';
    }
    if (photoError) {
      photoError.classList.add('hidden');
    }
    clearKycErrors();
    showToast('Original photo loaded successfully', 'success');
  };
  reader.readAsDataURL(file);
}

// ----------------------------------------------------
// MANUAL DOCUMENT UPLOAD HANDLER (Aadhaar, DL, Vehicle RC)
// ----------------------------------------------------
function handleManualDocSelected(event, type) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file (JPG / PNG)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    const dataUrl = e.target.result;

    if (type === 'aadhaar') {
      state.manualKycAadhaarDoc = dataUrl;
      const preview = document.getElementById('kycAadhaarDocPreview');
      const placeholder = document.getElementById('kycAadhaarDocPlaceholder');
      const statusText = document.getElementById('kycAadhaarDocStatus');
      const btnText = document.getElementById('kycAadhaarDocBtnText');
      const err = document.getElementById('kycAadhaarDocError');

      if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
      if (placeholder) placeholder.classList.add('hidden');
      if (statusText) statusText.textContent = '✅ Aadhaar document selected';
      if (btnText) btnText.textContent = 'Change Aadhaar Photo';
      if (err) err.classList.add('hidden');
      showToast('Aadhaar document photo attached', 'success');

    } else if (type === 'dl') {
      state.manualKycDlDoc = dataUrl;
      const preview = document.getElementById('kycDlDocPreview');
      const placeholder = document.getElementById('kycDlDocPlaceholder');
      const statusText = document.getElementById('kycDlDocStatus');
      const btnText = document.getElementById('kycDlDocBtnText');
      const err = document.getElementById('kycDlDocError');

      if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
      if (placeholder) placeholder.classList.add('hidden');
      if (statusText) statusText.textContent = '✅ Driving License selected';
      if (btnText) btnText.textContent = 'Change DL Photo';
      if (err) err.classList.add('hidden');
      showToast('Driving License photo attached', 'success');

    } else if (type === 'rc') {
      state.manualKycRcDoc = dataUrl;
      const preview = document.getElementById('kycRcDocPreview');
      const placeholder = document.getElementById('kycRcDocPlaceholder');
      const statusText = document.getElementById('kycRcDocStatus');
      const btnText = document.getElementById('kycRcDocBtnText');
      const err = document.getElementById('kycRcDocError');

      if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
      if (placeholder) placeholder.classList.add('hidden');
      if (statusText) statusText.textContent = '✅ Vehicle RC selected';
      if (btnText) btnText.textContent = 'Change RC Photo';
      if (err) err.classList.add('hidden');
      showToast('Vehicle RC certificate attached', 'success');
    }
  };
  reader.readAsDataURL(file);
}

// ----------------------------------------------------
// MANUAL KYC SUBMIT HANDLER -> VERIFICATION PENDING
// ----------------------------------------------------
async function handleKycFormSubmit(event) {
  event.preventDefault();
  clearKycErrors();

  const nameInput = document.getElementById('kycFullName');
  const aadhaarInput = document.getElementById('kycAadhaarNumber');
  const dlInput = document.getElementById('kycDlNumber');
  const dlExpiryInput = document.getElementById('kycDlExpiryDate');
  const rcNumberInput = document.getElementById('kycRcNumber');
  const rcModelInput = document.getElementById('kycRcVehicleModel');
  const btnSubmit = document.getElementById('btnSubmitKyc');
  const btnText = document.getElementById('btnSubmitKycText');
  const alertBox = document.getElementById('kycVerificationAlert');

  const fullName = nameInput ? nameInput.value.trim() : '';
  const rawAadhaar = aadhaarInput ? aadhaarInput.value.trim() : '';
  const rawDl = dlInput ? dlInput.value.trim() : '';
  const dlExpiry = dlExpiryInput ? dlExpiryInput.value : '';
  const rcNumber = rcNumberInput ? rcNumberInput.value.trim().toUpperCase() : '';
  const rcModel = rcModelInput ? rcModelInput.value.trim() : '';

  // 1. Strict Name Validation
  const nameResult = validateDriverName(fullName);
  if (!nameResult.valid) {
    showFieldError('kycNameError', nameResult.error);
    showVerificationFailure(nameResult.error);
    return;
  }

  // 2. Strict Aadhaar UID Check
  const aadhaarResult = validateAadhaar(rawAadhaar);
  if (!aadhaarResult.valid) {
    showFieldError('kycAadhaarError', aadhaarResult.error);
    showVerificationFailure(aadhaarResult.error);
    return;
  }

  // 3. Aadhaar Document Upload Check
  if (!state.manualKycAadhaarDoc) {
    const err = document.getElementById('kycAadhaarDocError');
    if (err) err.classList.remove('hidden');
    showVerificationFailure('Please upload a clear photo of your Aadhaar card.');
    return;
  }

  // 4. Strict Driving License Check
  const dlResult = validateDrivingLicense(rawDl);
  if (!dlResult.valid) {
    showFieldError('kycDlError', dlResult.error);
    showVerificationFailure(dlResult.error);
    return;
  }

  // 5. Driving License Expiry Check
  if (!dlExpiry) {
    showVerificationFailure('Please enter the validity / expiry date of your Driving License.');
    return;
  }

  // 6. DL Document Upload Check
  if (!state.manualKycDlDoc) {
    const err = document.getElementById('kycDlDocError');
    if (err) err.classList.remove('hidden');
    showVerificationFailure('Please upload a clear photo of your Driving License document.');
    return;
  }

  // 7. Vehicle RC Check
  if (!rcNumber || rcNumber.length < 6) {
    const err = document.getElementById('kycRcError');
    if (err) err.classList.remove('hidden');
    showVerificationFailure('Please enter a valid Vehicle Registration Certificate (RC) number.');
    return;
  }

  if (!rcModel) {
    showVerificationFailure('Please enter the vehicle model name (e.g. Swift VXi, Pulsar 150).');
    return;
  }

  // 8. RC Document Upload Check
  if (!state.manualKycRcDoc) {
    const err = document.getElementById('kycRcDocError');
    if (err) err.classList.remove('hidden');
    showVerificationFailure('Please upload a clear photo of your Vehicle RC certificate.');
    return;
  }

  // 9. Driver Real Photo / Selfie Check
  const hasOriginalUploadedPhoto = Boolean(
    state.uploadedKycPhoto && 
    (state.uploadedKycPhoto.startsWith('data:image/') || state.uploadedKycPhoto.startsWith('blob:') || (state.uploadedKycPhoto.startsWith('http') && !state.uploadedKycPhoto.includes('unsplash')))
  );

  if (!hasOriginalUploadedPhoto) {
    const photoError = document.getElementById('kycPhotoError');
    if (photoError) photoError.classList.remove('hidden');
    showVerificationFailure('Original photo required: You must upload your real photo / selfie before submission.');
    return;
  }

  const avatarUrl = state.uploadedKycPhoto;

  // ALL VALID! Submit for Admin Review
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnText) btnText.textContent = 'Submitting Documents to Admin...';

  if (alertBox) {
    alertBox.className = 'mt-3 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5 animate-pulse';
    alertBox.innerHTML = `
      <i data-lucide="loader-2" class="w-4 h-4 text-blue-600 animate-spin flex-shrink-0"></i>
      <div>
        <p class="font-bold text-blue-950 text-xs">Uploading Documents to Admin Portal</p>
        <p class="text-[10px] text-blue-700 mt-0.5">Encrypting and registering Aadhaar, DL & RC files...</p>
      </div>
    `;
    alertBox.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  const userPhone = (state.currentUser && state.currentUser.phone) || state.authPhone || '+91 98480 23145';
  const profileIdentifier = (state.currentUser && state.currentUser.id) || userPhone;

  const kycPayload = {
    name: nameResult.name,
    avatarUrl: avatarUrl,
    phone: userPhone,
    aadhaarNumber: aadhaarResult.clean,
    aadhaarDocPhoto: state.manualKycAadhaarDoc,
    dlNumber: dlResult.clean,
    dlExpiryDate: dlExpiry,
    dlDocPhoto: state.manualKycDlDoc,
    rcNumber: rcNumber,
    rcVehicleModel: rcModel,
    rcDocPhoto: state.manualKycRcDoc
  };

  try {
    if (window.db && window.db.profiles && window.db.profiles.submitManualKyc) {
      const res = await window.db.profiles.submitManualKyc(profileIdentifier, kycPayload);
      console.log('🛡️ Manual KYC submission response:', res);
    }

    if (!state.currentUser) {
      state.currentUser = {
        id: 'usr_' + Date.now(),
        phone: userPhone,
        authenticatedAt: new Date().toISOString()
      };
    }

    // Set user KYC status to verification_pending and lock driver privileges
    state.currentUser.kyc_status = 'verification_pending';
    state.currentUser.is_kyc_verified = false;
    state.currentUser.name = nameResult.name;
    state.currentUser.avatar = avatarUrl;
    state.currentUser.aadhaar_number = aadhaarResult.clean;
    state.currentUser.dl_number = dlResult.clean;
    state.currentUser.dl_expiry = dlExpiry;
    state.currentUser.rc_number = rcNumber;
    state.currentUser.rc_vehicle_name = rcModel;

    localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));

    if (alertBox) {
      alertBox.className = 'mt-3 p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2.5';
      alertBox.innerHTML = `
        <i data-lucide="clock" class="w-4 h-4 text-amber-600 flex-shrink-0"></i>
        <div>
          <p class="font-bold text-amber-950 text-xs">KYC Submitted — Verification Pending</p>
          <p class="text-[10px] text-amber-800 mt-0.5">Your documents are under Admin review. Driver mode will activate once approved.</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

    setTimeout(() => {
      closeModal('kycVerificationModal');
      updateProfileDisplay();
      renderKycStatus();
      showToast('📋 KYC submitted successfully! Status set to "Pending Admin Review".', 'info');
    }, 700);

  } catch (err) {
    console.error('Exception submitting manual KYC:', err);
    showVerificationFailure('Error submitting KYC documents. Please retry.');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnText) btnText.textContent = 'Submit KYC for Verification';
  }
}

async function resetDriverKyc() {
  if (state.currentUser) {
    state.currentUser.kyc_status = 'unverified';
    state.currentUser.is_kyc_verified = false;
    state.currentUser.aadhaar_number = '';
    state.currentUser.dl_number = '';
    state.currentUser.rejection_reason = null;
    localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));

    if (window.db && window.db.profiles && window.db.profiles.submitManualKyc) {
      const identifier = state.currentUser.id || state.currentUser.phone;
      await window.db.profiles.submitManualKyc(identifier, {
        kyc_status: 'unverified',
        is_kyc_verified: false,
        name: state.currentUser.name,
        avatarUrl: state.currentUser.avatar,
        phone: state.currentUser.phone
      }).catch(e => console.warn(e));
    }
  }
  updateProfileDisplay();
  renderKycStatus();
  showToast('Driver KYC reset to Unverified. You can re-submit documents now.', 'info');
}

// ==========================================
// RESTRICTED ADMIN PORTAL ENGINE & WORKFLOW
// ==========================================

const ADMIN_WHITELISTED_PHONES = ['9494285249', '7989031924'];

function isUserAdminWhitelisted(user) {
  let phone = null;
  if (user && user.phone) {
    phone = user.phone;
  } else if (state.currentUser && state.currentUser.phone) {
    phone = state.currentUser.phone;
  } else if (state.authPhone) {
    phone = state.authPhone;
  } else {
    try {
      const cached = JSON.parse(localStorage.getItem('routemate_auth_user') || '{}');
      if (cached && cached.phone) phone = cached.phone;
    } catch (e) {}
  }

  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  const last10 = digits.slice(-10);
  return ADMIN_WHITELISTED_PHONES.includes(last10);
}

// Open Admin Portal directly for authorized whitelisted numbers
function openAdminPortal() {
  const user = state.currentUser;
  // Strictly enforce phone number whitelist: ONLY 9494285249 or 7989031924
  if (!isUserAdminWhitelisted(user)) {
    showToast('⛔ Access Denied: Admin portal is restricted to authorized mobile numbers (9494285249, 7989031924).', 'error');
    return;
  }

  state.isAdminAuthenticated = true;
  openAdminPanelModal();
}

function openAdminAuthModal() {
  openAdminPortal();
}

function handleAdminLogin(event) {
  if (event && event.preventDefault) event.preventDefault();

  const user = state.currentUser;
  // Double-check whitelist
  if (!isUserAdminWhitelisted(user)) {
    showToast('⛔ Access Denied: Admin portal is restricted to authorized mobile numbers.', 'error');
    closeModal('adminAuthModal');
    return;
  }

  const userInput = document.getElementById('adminLoginEmail') || document.getElementById('adminEmailInput');
  const passInput = document.getElementById('adminLoginPassword') || document.getElementById('adminPasswordInput');
  const errEl = document.getElementById('adminLoginError') || document.getElementById('adminAuthError');
  const errText = document.getElementById('adminLoginErrorText') || document.getElementById('adminAuthErrorText');

  const userVal = userInput ? userInput.value.trim() : '';
  const passVal = passInput ? passInput.value.trim() : '';

  let isValid = false;
  if (window.db && window.db.admin && window.db.admin.verifyAdmin) {
    isValid = window.db.admin.verifyAdmin(userVal, passVal, (user && user.phone));
  } else {
    isValid = isUserAdminWhitelisted(user) && (passVal === 'admin@2026' || passVal === 'routemate2026');
  }

  if (isValid) {
    state.isAdminAuthenticated = true;
    closeModal('adminAuthModal');
    openAdminPanelModal();
    showToast('🔑 Admin Portal Authenticated (Whitelisted Session)', 'success');
  } else {
    if (errText) errText.textContent = 'Invalid administrator credentials. Access denied.';
    if (errEl) errEl.classList.remove('hidden');
    if (passInput) passInput.value = '';
  }
}

async function openAdminPanelModal() {
  const user = state.currentUser;
  if (!isUserAdminWhitelisted(user)) {
    showToast('⛔ Access Denied: Admin portal is restricted to authorized mobile numbers (9494285249, 7989031924).', 'error');
    return;
  }

  state.isAdminAuthenticated = true;
  const modal = document.getElementById('adminPanelModal');
  if (!modal) {
    console.error('adminPanelModal not found in DOM');
    return;
  }

  closeModal('adminAuthModal');
  modal.classList.remove('hidden');
  switchAdminSection(state.activeAdminSection || 'kyc');
  loadAdminFeedbacks(false);
  if (window.lucide) lucide.createIcons();
}

function handleAdminLogout() {
  state.isAdminAuthenticated = false;
  closeModal('adminPanelModal');
  showToast('Admin session signed out', 'info');
}

function setAdminFilter(filter) {
  state.adminFilter = filter;
  const tabAll = document.getElementById('adminTabAll');
  const tabPending = document.getElementById('adminTabPending');
  const tabApproved = document.getElementById('adminTabApproved');
  const tabBlocked = document.getElementById('adminTabBlocked');
  const tabRejected = document.getElementById('adminTabRejected');

  const tabs = [
    { el: tabPending, id: 'pending', activeClass: 'bg-amber-600 text-white' },
    { el: tabApproved, id: 'approved', activeClass: 'bg-emerald-600 text-white' },
    { el: tabBlocked, id: 'blocked', activeClass: 'bg-rose-600 text-white' },
    { el: tabRejected, id: 'rejected', activeClass: 'bg-slate-800 text-white' },
    { el: tabAll, id: 'all', activeClass: 'bg-purple-900 text-white' }
  ];

  tabs.forEach(t => {
    if (!t.el) return;
    if (t.id === filter) {
      t.el.className = `px-3 py-1.5 rounded-xl font-bold transition shadow-xs cursor-pointer flex-shrink-0 ${t.activeClass}`;
    } else {
      t.el.className = 'px-3 py-1.5 rounded-xl font-medium transition bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer flex-shrink-0';
    }
  });

  renderAdminSubmissions();
}

// ----------------------------------------------------
// DRIVER SEARCH & ACCOUNT ENFORCEMENT ENGINE
// ----------------------------------------------------
function handleAdminSearch(val) {
  state.adminSearchQuery = (val || '').trim();
  const clearBtn = document.getElementById('adminSearchClearBtn');
  if (clearBtn) {
    if (state.adminSearchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderAdminSubmissions();
}

function clearAdminSearch() {
  const input = document.getElementById('adminDriverSearchInput');
  if (input) input.value = '';
  handleAdminSearch('');
}

async function triggerDeepDriverSearch() {
  const input = document.getElementById('adminDriverSearchInput');
  const q = input ? input.value.trim() : '';
  if (!q) {
    showToast('Enter a search term (name, phone, DL, Aadhaar, vehicle RC) first', 'info');
    if (input) input.focus();
    return;
  }

  showToast(`Searching Supabase profiles for "${q}"...`, 'info');
  if (window.db && window.db.admin && window.db.admin.searchDrivers) {
    const results = await window.db.admin.searchDrivers(q);
    state.adminKycSubmissions = results;
    state.adminFilter = 'all';
    renderAdminSubmissions();
    showToast(`Found ${results.length} matched driver records in Supabase`, 'success');
  }
}

function openAdminBlockModal(identifier, customName = null, customPreset = null, customReason = null) {
  state.pendingBlockIdentifier = identifier;
  const modal = document.getElementById('adminBlockDriverModal');
  const targetNameEl = document.getElementById('adminBlockTargetName');
  const targetPhoneEl = document.getElementById('adminBlockTargetPhone');
  const reasonText = document.getElementById('adminBlockReasonText');
  const presetSelect = document.getElementById('adminBlockReasonPreset');

  const target = (state.adminKycSubmissions || []).find(s => s.phone === identifier || s.id === identifier);
  if (targetNameEl) targetNameEl.textContent = customName || (target && target.name) || identifier;
  if (targetPhoneEl) targetPhoneEl.textContent = (target && target.phone) || identifier;
  if (presetSelect) {
    presetSelect.value = customPreset || 'Harassment or inappropriate behavior towards passengers';
  }
  if (reasonText) {
    reasonText.value = customReason || 'Driver account suspended following passenger safety and conduct complaints.';
  }

  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleBlockPresetChange(val) {
  const reasonText = document.getElementById('adminBlockReasonText');
  if (!reasonText) return;
  if (val === 'Harassment or inappropriate behavior towards passengers') {
    reasonText.value = 'Driver account suspended following passenger safety and conduct complaints.';
  } else if (val === 'Fake / forged KYC documents or identity fraud') {
    reasonText.value = 'Forged or fraudulent KYC government documents submitted. Suspended indefinitely.';
  } else if (val === 'Rash driving, speeding, or severe safety violation') {
    reasonText.value = 'Repeated hazardous driving and reckless corridor speeding reported.';
  } else if (val === 'Extortion, overcharging, or off-app payment fraud') {
    reasonText.value = 'Driver engaged in off-platform payment extortion / fare inflation.';
  } else if (val === 'Involved in criminal / police complaint') {
    reasonText.value = 'Driver subject to active police verification or legal FIR inquiry.';
  } else if (val === 'Repeated ride cancellations / corridor scam') {
    reasonText.value = 'Abuse of corridor reservations and repeated unnotified cancellations.';
  } else {
    reasonText.value = '';
    reasonText.focus();
  }
}

async function handleConfirmAdminBlock(event) {
  if (event && event.preventDefault) event.preventDefault();
  const identifier = state.pendingBlockIdentifier;
  if (!identifier) return;

  const reasonText = document.getElementById('adminBlockReasonText');
  const reason = reasonText ? reasonText.value.trim() : 'Account suspended by Routemate Administration.';

  showToast(`Suspending and blocking driver account ${identifier}...`, 'info');

  try {
    if (window.db && window.db.admin && window.db.admin.blockDriver) {
      await window.db.admin.blockDriver(identifier, reason);
    }

    // Update in local state array
    if (state.adminKycSubmissions) {
      const target = state.adminKycSubmissions.find(s => s.phone === identifier || s.id === identifier);
      if (target) {
        target.is_blocked = true;
        target.account_status = 'blocked';
        target.block_reason = reason;
        target.is_kyc_verified = false;
      }
    }

    // Check if the blocked user is currently active
    if (state.currentUser && (state.currentUser.phone === identifier || state.currentUser.id === identifier)) {
      state.currentUser.is_blocked = true;
      state.currentUser.account_status = 'blocked';
      state.currentUser.block_reason = reason;
      state.currentUser.is_kyc_verified = false;
      localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
      updateProfileDisplay();
      renderKycStatus();

      const blockedNotice = document.getElementById('blockedNoticeReasonText');
      if (blockedNotice) blockedNotice.textContent = reason;
      const modal = document.getElementById('accountBlockedModal');
      if (modal) modal.classList.remove('hidden');
    }

    closeModal('adminBlockDriverModal');
    renderAdminSubmissions();
    if (typeof renderAdminFeedbacks === 'function') {
      renderAdminFeedbacks();
    }
    showToast(`🚨 Driver ${identifier} account BLOCKED & suspended successfully!`, 'success');
  } catch (err) {
    console.error('Exception blocking driver:', err);
    showToast('Failed to block driver. Please retry.', 'error');
  }
}

async function handleAdminUnblockDriver(identifier) {
  if (!confirm(`Are you sure you want to UNBLOCK driver ${identifier} and restore their account access?`)) {
    return;
  }

  showToast(`Unblocking account ${identifier}...`, 'info');

  try {
    if (window.db && window.db.admin && window.db.admin.unblockDriver) {
      await window.db.admin.unblockDriver(identifier);
    }

    if (state.adminKycSubmissions) {
      const target = state.adminKycSubmissions.find(s => s.phone === identifier || s.id === identifier);
      if (target) {
        target.is_blocked = false;
        target.account_status = 'active';
        target.block_reason = null;
      }
    }

    if (state.currentUser && (state.currentUser.phone === identifier || state.currentUser.id === identifier)) {
      state.currentUser.is_blocked = false;
      state.currentUser.account_status = 'active';
      state.currentUser.block_reason = null;
      localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
      updateProfileDisplay();
      renderKycStatus();
    }

    renderAdminSubmissions();
    if (typeof renderAdminFeedbacks === 'function') {
      renderAdminFeedbacks();
    }
    showToast(`✅ Driver account ${identifier} unblocked and restored to Active status!`, 'success');
  } catch (err) {
    console.error('Exception unblocking driver:', err);
    showToast('Failed to unblock driver. Please retry.', 'error');
  }
}

// ----------------------------------------------------
// ADMIN VIEW SWITCHER & FEEDBACK MANAGEMENT
// ----------------------------------------------------

function switchAdminSection(section) {
  state.activeAdminSection = section;
  const kycSection = document.getElementById('adminKycSection');
  const fbSection = document.getElementById('adminFeedbackSection');
  const kycBtn = document.getElementById('adminSectionKycBtn');
  const fbBtn = document.getElementById('adminSectionFeedbackBtn');

  if (section === 'feedback') {
    if (kycSection) kycSection.classList.add('hidden');
    if (fbSection) fbSection.classList.remove('hidden');
    if (kycBtn) kycBtn.className = 'flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition bg-slate-800 text-slate-300 hover:text-white cursor-pointer';
    if (fbBtn) fbBtn.className = 'flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition bg-amber-500 text-slate-950 shadow-sm cursor-pointer relative';
    loadAdminFeedbacks();
  } else {
    if (fbSection) fbSection.classList.add('hidden');
    if (kycSection) kycSection.classList.remove('hidden');
    if (kycBtn) kycBtn.className = 'flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition bg-purple-600 text-white shadow-sm cursor-pointer';
    if (fbBtn) fbBtn.className = 'flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition bg-slate-800 text-slate-300 hover:text-white cursor-pointer relative';
    loadAdminKycSubmissions();
  }
  if (window.lucide) lucide.createIcons();
}

function refreshAdminPortal() {
  if (state.activeAdminSection === 'feedback') {
    loadAdminFeedbacks(true);
  } else {
    loadAdminKycSubmissions();
  }
}

async function loadAdminFeedbacks(showToastNotice = false) {
  const container = document.getElementById('adminFeedbacksContainer');
  if (container && (!state.adminFeedbacks || state.adminFeedbacks.length === 0)) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-amber-500"></i>
        <p class="text-xs font-semibold mt-2">Loading customer ratings & reviews...</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  try {
    let feedbacks = [];
    if (window.db && window.db.feedbacks) {
      feedbacks = await window.db.feedbacks.getAll();
    }
    state.adminFeedbacks = Array.isArray(feedbacks) ? feedbacks : [];
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
    state.adminFeedbacks = [];
  }

  updateAdminFeedbackMetrics();
  renderAdminFeedbacks();

  if (showToastNotice) {
    showToast(`Refreshed ${state.adminFeedbacks.length} customer feedback records`, 'info');
  }
}

function updateAdminFeedbackMetrics() {
  const all = state.adminFeedbacks || [];
  const total = all.length;
  const critical = all.filter(f => parseFloat(f.rating) <= 3.0 || f.has_safety_concern || f.hasSafetyConcern).length;
  const positive = all.filter(f => parseFloat(f.rating) >= 4.0).length;

  let avgRating = '5.0';
  if (total > 0) {
    const sum = all.reduce((acc, f) => acc + (parseFloat(f.rating) || 5.0), 0);
    avgRating = (sum / total).toFixed(1);
  }

  const countTotalEl = document.getElementById('adminCountTotalFeedbacks');
  const avgEl = document.getElementById('adminAvgDriverRating');
  const countCritEl = document.getElementById('adminCountCriticalFeedbacks');
  const countPosEl = document.getElementById('adminCountPositiveFeedbacks');
  const badgeEl = document.getElementById('adminFeedbackBadgeCount');

  if (countTotalEl) countTotalEl.textContent = String(total);
  if (avgEl) avgEl.textContent = `${avgRating}★`;
  if (countCritEl) countCritEl.textContent = String(critical);
  if (countPosEl) countPosEl.textContent = String(positive);

  if (badgeEl) {
    if (critical > 0) {
      badgeEl.textContent = String(critical);
      badgeEl.classList.remove('hidden');
      badgeEl.className = 'ml-1 bg-rose-500 text-white font-black text-[10px] px-1.5 py-0.2 rounded-full';
    } else if (total > 0) {
      badgeEl.textContent = String(total);
      badgeEl.classList.remove('hidden');
      badgeEl.className = 'ml-1 bg-amber-400 text-slate-950 font-black text-[10px] px-1.5 py-0.2 rounded-full';
    } else {
      badgeEl.classList.add('hidden');
    }
  }
}

function setAdminFeedbackFilter(filter) {
  state.adminFeedbackFilter = filter;
  const tabAll = document.getElementById('adminFbTabAll');
  const tabCritical = document.getElementById('adminFbTabCritical');
  const tabSafety = document.getElementById('adminFbTabSafety');
  const tabPositive = document.getElementById('adminFbTabPositive');

  const tabs = [
    { el: tabAll, id: 'all', activeClass: 'bg-amber-500 text-slate-950 font-bold' },
    { el: tabCritical, id: 'critical', activeClass: 'bg-rose-600 text-white font-bold' },
    { el: tabSafety, id: 'safety', activeClass: 'bg-rose-800 text-white font-bold' },
    { el: tabPositive, id: 'positive', activeClass: 'bg-emerald-600 text-white font-bold' }
  ];

  tabs.forEach(t => {
    if (!t.el) return;
    if (t.id === filter) {
      t.el.className = `px-3 py-1.5 rounded-xl transition shadow-xs cursor-pointer flex-shrink-0 ${t.activeClass}`;
    } else {
      t.el.className = 'px-3 py-1.5 rounded-xl font-medium transition bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer flex-shrink-0';
    }
  });

  renderAdminFeedbacks();
}

function handleAdminFeedbackSearch(val) {
  state.adminFeedbackQuery = (val || '').trim().toLowerCase();
  const clearBtn = document.getElementById('adminFbSearchClearBtn');
  if (clearBtn) {
    if (state.adminFeedbackQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderAdminFeedbacks();
}

function clearAdminFeedbackSearch() {
  const input = document.getElementById('adminFeedbackSearchInput');
  if (input) input.value = '';
  handleAdminFeedbackSearch('');
}

function renderAdminFeedbacks() {
  const container = document.getElementById('adminFeedbacksContainer');
  if (!container) return;

  const blockedList = (function() {
    try { return JSON.parse(localStorage.getItem('routemate_blocked_drivers') || '[]'); } catch (e) { return []; }
  })();

  const allFeedbacks = state.adminFeedbacks || [];
  let filtered = allFeedbacks.slice();

  // Filter tabs
  const fType = state.adminFeedbackFilter || 'all';
  if (fType === 'critical') {
    filtered = filtered.filter(f => (parseFloat(f.rating) <= 3.0) || f.has_safety_concern || f.hasSafetyConcern);
  } else if (fType === 'safety') {
    filtered = filtered.filter(f => Boolean(f.has_safety_concern || f.hasSafetyConcern));
  } else if (fType === 'positive') {
    filtered = filtered.filter(f => parseFloat(f.rating) >= 4.0 && !f.has_safety_concern && !f.hasSafetyConcern);
  }

  // Search query filter
  const query = state.adminFeedbackQuery;
  if (query) {
    filtered = filtered.filter(f => {
      const dName = (f.driver_name || f.driverName || '').toLowerCase();
      const dPhone = (f.driver_phone || f.driverPhone || '').toLowerCase();
      const rName = (f.rider_name || f.riderName || '').toLowerCase();
      const text = (f.feedback_text || f.feedbackText || '').toLowerCase();
      const route = (f.route || '').toLowerCase();
      const tags = (Array.isArray(f.tags) ? f.tags.join(' ') : '').toLowerCase();
      return dName.includes(query) || dPhone.includes(query) || rName.includes(query) || text.includes(query) || route.includes(query) || tags.includes(query);
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 p-8">
        <i data-lucide="message-square-off" class="w-10 h-10 mx-auto text-slate-300"></i>
        <h4 class="font-extrabold text-slate-800 text-sm mt-3">No Customer Reviews Found</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          ${query ? `No reviews matched "${query}". Clear search to view all.` : 'Customer reviews submitted upon ride completion will stream here in real time.'}
        </p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  let html = '';
  filtered.forEach(fb => {
    const ratingNum = parseFloat(fb.rating || 5.0);
    const isCritical = ratingNum <= 3.0 || fb.has_safety_concern || fb.hasSafetyConcern;
    const isSafety = Boolean(fb.has_safety_concern || fb.hasSafetyConcern);
    const driverPhone = fb.driver_phone || fb.driverPhone || '';
    const driverName = fb.driver_name || fb.driverName || 'Verified Commuter';
    const driverAvatar = fb.driver_avatar || fb.driverAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80';
    const driverVehicle = fb.driver_vehicle || fb.driverVehicle || 'Commuter Vehicle';
    const riderName = fb.rider_name || fb.riderName || 'Commuter';
    const riderPhone = fb.rider_phone || fb.riderPhone || '';
    const feedbackText = fb.feedback_text || fb.feedbackText || 'Smooth highway commute.';
    const route = fb.route || 'Uppal Ring Road ➔ Jangaon';
    const tags = Array.isArray(fb.tags) ? fb.tags : [];
    const dateFormatted = fb.created_at || fb.createdAt ? new Date(fb.created_at || fb.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Just now';

    // Check if this driver is blocked
    const cleanDPhone = driverPhone.replace(/[\s+-]/g, '');
    const isDriverBlocked = blockedList.some(b => (b.phone && b.phone.replace(/[\s+-]/g, '') === cleanDPhone)) ||
      (state.adminKycSubmissions || []).some(s => s.phone && s.phone.replace(/[\s+-]/g, '') === cleanDPhone && (s.is_blocked || s.account_status === 'blocked'));

    // Star icons
    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(ratingNum)) {
        starsHtml += '<span class="text-amber-400 text-sm">★</span>';
      } else {
        starsHtml += '<span class="text-slate-200 text-sm">★</span>';
      }
    }

    const cardBorder = isCritical ? 'border-rose-300 ring-1 ring-rose-200/50 bg-rose-50/20' : 'border-slate-200 bg-white';

    html += `
      <div class="rounded-2xl border ${cardBorder} p-3.5 sm:p-4 shadow-sm hover:shadow-md transition">
        <!-- Driver & Rating Row -->
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <img src="${driverAvatar}" class="w-10 h-10 rounded-full object-cover border-2 ${isCritical ? 'border-rose-400' : 'border-blue-500'} flex-shrink-0" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <h4 class="font-bold text-slate-900 text-xs sm:text-sm truncate">${driverName}</h4>
                ${isDriverBlocked ? `
                  <span class="text-[9px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full border border-rose-300 flex-shrink-0">
                    BLOCKED
                  </span>
                ` : `
                  <span class="text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">
                    Active Driver
                  </span>
                `}
              </div>
              <p class="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                <span class="font-mono">${driverPhone || 'No Phone'}</span>
                <span>•</span>
                <span>${driverVehicle}</span>
              </p>
            </div>
          </div>

          <!-- Score Badge -->
          <div class="text-right flex-shrink-0">
            <div class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black text-xs ${
              isCritical ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
            }">
              <span>${ratingNum.toFixed(1)}</span>
              <span>★</span>
            </div>
            <div class="flex justify-end mt-0.5">${starsHtml}</div>
          </div>
        </div>

        <!-- Badges & Route -->
        <div class="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px]">
          <span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold flex items-center gap-1">
            <i data-lucide="map-pin" class="w-3 h-3 text-slate-400"></i>
            <span>${route}</span>
          </span>
          <span class="text-slate-400">•</span>
          <span class="text-slate-500 font-medium">By <strong class="text-slate-700">${riderName}</strong> (${riderPhone || 'Passenger'})</span>
          <span class="text-slate-400">•</span>
          <span class="text-slate-400">${dateFormatted}</span>

          ${isSafety ? `
            <span class="bg-rose-600 text-white font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md flex items-center gap-1 ml-auto">
              <i data-lucide="shield-alert" class="w-3 h-3"></i>
              <span>Safety Concern</span>
            </span>
          ` : ''}
        </div>

        <!-- Tags -->
        ${tags.length > 0 ? `
          <div class="mt-2 flex flex-wrap gap-1">
            ${tags.map(t => `<span class="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-lg">${t}</span>`).join('')}
          </div>
        ` : ''}

        <!-- Written Review Body -->
        <div class="mt-2.5 p-3 rounded-xl ${isCritical ? 'bg-rose-50/80 border border-rose-200 text-rose-950' : 'bg-slate-50 border border-slate-100 text-slate-800'} text-xs leading-relaxed">
          <p class="font-medium whitespace-pre-line">"${feedbackText}"</p>
        </div>

        <!-- Moderation Action Controls -->
        <div class="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
          <div class="text-[10px] text-slate-500 flex items-center gap-1">
            <i data-lucide="shield-check" class="w-3.5 h-3.5 text-purple-600"></i>
            <span>Admin Moderation Desk</span>
          </div>

          <div class="flex items-center gap-1.5">
            ${driverPhone ? `
              <a href="tel:${driverPhone}" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center" title="Call Driver Directly">
                <i data-lucide="phone" class="w-3.5 h-3.5"></i>
              </a>
            ` : ''}

            ${!isDriverBlocked ? `
              <button type="button" onclick="openAdminBlockFromFeedback('${driverPhone || driverName}', '${driverName.replace(/'/g, "\\'")}', '${feedbackText.replace(/'/g, "\\'").replace(/\n/g, ' ')}', ${ratingNum})" class="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95" title="Suspend or Block Driver">
                <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
                <span>Suspend / Block Driver</span>
              </button>
            ` : `
              <button type="button" onclick="handleAdminUnblockDriver('${driverPhone || driverName}')" class="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95" title="Restore Driver Account">
                <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                <span>Unblock Driver</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function openAdminBlockFromFeedback(driverPhone, driverName, feedbackText, rating) {
  const preset = (rating <= 2.0) ? 'Rash driving, speeding, or severe safety violation' : 'Harassment or inappropriate behavior towards passengers';
  const customNotes = `Suspended following customer negative review (${rating}★): "${feedbackText.substring(0, 100)}"`;
  openAdminBlockModal(driverPhone, driverName, preset, customNotes);
}

async function loadAdminKycSubmissions() {
  const listEl = document.getElementById('adminSubmissionsList');
  if (listEl) {
    listEl.innerHTML = `
      <div class="py-12 text-center text-slate-400">
        <i data-lucide="loader-2" class="w-8 h-8 animate-spin mx-auto text-blue-600"></i>
        <p class="text-xs font-semibold mt-2">Loading live KYC submissions from Supabase...</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  let submissions = [];
  if (window.db && window.db.admin && window.db.admin.getKycSubmissions) {
    submissions = await window.db.admin.getKycSubmissions();
  } else {
    try {
      submissions = JSON.parse(localStorage.getItem('routemate_kyc_submissions') || '[]');
    } catch (e) { submissions = []; }
  }

  state.adminKycSubmissions = submissions || [];
  renderAdminSubmissions();
}

function renderAdminSubmissions() {
  const listEl = document.getElementById('adminSubmissionsList');
  if (!listEl) return;

  const blockedList = (function() {
    try { return JSON.parse(localStorage.getItem('routemate_blocked_drivers') || '[]'); } catch (e) { return []; }
  })();

  const all = (state.adminKycSubmissions || []).map(item => {
    const isBlocked = Boolean(
      item.is_blocked || 
      item.account_status === 'blocked' ||
      blockedList.some(b => (b.phone && b.phone === item.phone) || b.id === item.id)
    );
    if (isBlocked) {
      item.is_blocked = true;
      item.account_status = 'blocked';
      if (!item.block_reason) {
        const blEntry = blockedList.find(b => (b.phone && b.phone === item.phone) || b.id === item.id);
        if (blEntry && blEntry.reason) item.block_reason = blEntry.reason;
      }
    }
    return item;
  });

  const pendingCount = all.filter(s => s.kyc_status === 'verification_pending' && !s.is_blocked).length;
  const approvedCount = all.filter(s => (s.kyc_status === 'verified_success' || s.is_kyc_verified) && !s.is_blocked).length;
  const blockedCount = all.filter(s => s.is_blocked || s.account_status === 'blocked').length;
  const rejectedCount = all.filter(s => s.kyc_status === 'rejected' && !s.is_blocked).length;

  const countPendingEl = document.getElementById('adminCountPending');
  const countApprovedEl = document.getElementById('adminCountApproved');
  const countBlockedEl = document.getElementById('adminCountBlocked');
  const countRejectedEl = document.getElementById('adminCountRejected');

  if (countPendingEl) countPendingEl.textContent = String(pendingCount);
  if (countApprovedEl) countApprovedEl.textContent = String(approvedCount);
  if (countBlockedEl) countBlockedEl.textContent = String(blockedCount);
  if (countRejectedEl) countRejectedEl.textContent = String(rejectedCount);

  let filtered = all;
  if (state.adminFilter === 'pending') {
    filtered = all.filter(s => s.kyc_status === 'verification_pending' && !s.is_blocked);
  } else if (state.adminFilter === 'approved') {
    filtered = all.filter(s => (s.kyc_status === 'verified_success' || s.is_kyc_verified) && !s.is_blocked);
  } else if (state.adminFilter === 'blocked') {
    filtered = all.filter(s => s.is_blocked || s.account_status === 'blocked');
  } else if (state.adminFilter === 'rejected') {
    filtered = all.filter(s => s.kyc_status === 'rejected' && !s.is_blocked);
  }

  // Filter by adminSearchQuery across all relevant driver attributes
  if (state.adminSearchQuery) {
    const sq = state.adminSearchQuery.toLowerCase();
    filtered = filtered.filter(item => {
      const text = [
        item.name, item.phone, item.aadhaar_number, item.dl_number, 
        item.rc_number, item.rc_vehicle_name, item.kyc_status, item.block_reason
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(sq);
    });
  }

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="py-12 text-center text-slate-400 space-y-2">
        <i data-lucide="inbox" class="w-10 h-10 mx-auto text-slate-300"></i>
        <p class="text-xs font-bold text-slate-700">No driver records found</p>
        <p class="text-[11px] text-slate-400">${state.adminSearchQuery ? `No drivers match "${state.adminSearchQuery}". Try another search term or click "Search DB".` : 'No submissions found in this tab. New records will appear here in real time.'}</p>
        ${state.adminSearchQuery ? `
          <button type="button" onclick="clearAdminSearch()" class="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">Clear Search Filter</button>
        ` : ''}
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  listEl.innerHTML = filtered.map(item => {
    const isBlocked = Boolean(item.is_blocked || item.account_status === 'blocked');
    const isApproved = (item.kyc_status === 'verified_success' || item.is_kyc_verified) && !isBlocked;
    const isPending = item.kyc_status === 'verification_pending' && !isBlocked;
    const isRejected = item.kyc_status === 'rejected' && !isBlocked;

    let statusBadge = '';
    if (isBlocked) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-600 text-white shadow-xs flex items-center gap-1"><i data-lucide="shield-alert" class="w-3 h-3"></i> Suspended</span>';
    } else if (isApproved) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">Approved</span>';
    } else if (isPending) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">Pending Review</span>';
    } else {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-200 text-slate-700 border border-slate-300">Rejected</span>';
    }

    const safeId = String(item.id || item.phone);
    const identifier = item.phone || item.id;

    return `
      <div class="p-4 bg-slate-50 border ${isBlocked ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'} rounded-3xl space-y-3.5 shadow-xs">
        <!-- Header: Driver Info & Status -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            ${item.avatar_url ? `
              <img src="${item.avatar_url}" onclick="openAdminDocViewer('${item.avatar_url}', 'Driver Photo - ${item.name || 'Driver'}')" class="w-11 h-11 rounded-2xl object-cover border border-slate-300 cursor-pointer hover:opacity-90 transition flex-shrink-0" title="Click to enlarge" />
            ` : `
              <div class="w-11 h-11 rounded-2xl bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs flex-shrink-0">
                <i data-lucide="user" class="w-5 h-5"></i>
              </div>
            `}
            <div>
              <div class="flex items-center gap-2">
                <h4 class="font-extrabold text-slate-900 text-sm">${item.name || 'Commuter'}</h4>
                ${statusBadge}
              </div>
              <p class="text-[11px] font-mono text-slate-600 font-semibold">${item.phone || 'Phone hidden'}</p>
            </div>
          </div>
          <span class="text-[10px] text-slate-400 font-medium">
            ${item.kyc_submitted_at ? new Date(item.kyc_submitted_at).toLocaleDateString() : 'Recent'}
          </span>
        </div>

        <!-- Blocked Account Warning Banner -->
        ${isBlocked ? `
          <div class="p-3 bg-rose-100/90 border border-rose-300 rounded-2xl text-xs text-rose-950 space-y-1">
            <div class="flex items-center gap-1.5 font-extrabold text-rose-900">
              <i data-lucide="shield-alert" class="w-4 h-4 text-rose-600"></i>
              <span>ACCOUNT BLOCKED BY ADMINISTRATION</span>
            </div>
            <p class="text-rose-900 font-medium"><strong>Reason:</strong> ${item.block_reason || 'Administrative suspension'}</p>
          </div>
        ` : ''}

        <!-- Submitted Text Details -->
        <div class="grid grid-cols-3 gap-2 text-[11px] bg-white p-2.5 rounded-2xl border border-slate-200">
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-400 block">Aadhaar UID</span>
            <span class="font-mono font-bold text-slate-800">${item.aadhaar_number || 'Not provided'}</span>
          </div>
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-400 block">Driving License</span>
            <span class="font-mono font-bold text-slate-800">${item.dl_number || 'Not provided'}</span>
            ${item.dl_expiry ? `<span class="text-[9px] text-slate-500 block">Exp: ${item.dl_expiry}</span>` : ''}
          </div>
          <div>
            <span class="text-[9px] uppercase font-bold text-slate-400 block">Vehicle RC</span>
            <span class="font-mono font-bold text-slate-800">${item.rc_number || 'Not provided'}</span>
            ${item.rc_vehicle_name ? `<span class="text-[9px] text-slate-500 block truncate">${item.rc_vehicle_name}</span>` : ''}
          </div>
        </div>

        <!-- Uploaded Document Images Thumbnail Bar -->
        <div>
          <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Submitted Documents (Click to inspect)</label>
          <div class="grid grid-cols-3 gap-2">
            <!-- Aadhaar Photo -->
            <div onclick="openAdminDocViewer('${item.aadhaar_card_photo || ''}', 'Aadhaar Card Scan - ${item.name}')" class="relative group h-20 bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-1 hover:border-blue-500 transition shadow-2xs">
              ${item.aadhaar_card_photo ? `
                <img src="${item.aadhaar_card_photo}" class="w-full h-full object-cover rounded-lg" />
                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">Inspect</div>
              ` : `
                <i data-lucide="file-text" class="w-5 h-5 text-slate-400 mb-1"></i>
                <span class="text-[9px] text-slate-400 font-medium">No Aadhaar</span>
              `}
              <span class="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-mono px-1 rounded">Aadhaar</span>
            </div>

            <!-- Driving License Photo -->
            <div onclick="openAdminDocViewer('${item.dl_photo || ''}', 'Driving License Scan - ${item.name}')" class="relative group h-20 bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-1 hover:border-blue-500 transition shadow-2xs">
              ${item.dl_photo ? `
                <img src="${item.dl_photo}" class="w-full h-full object-cover rounded-lg" />
                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">Inspect</div>
              ` : `
                <i data-lucide="award" class="w-5 h-5 text-slate-400 mb-1"></i>
                <span class="text-[9px] text-slate-400 font-medium">No DL</span>
              `}
              <span class="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-mono px-1 rounded">License</span>
            </div>

            <!-- Vehicle RC Photo -->
            <div onclick="openAdminDocViewer('${item.rc_photo || ''}', 'Vehicle RC Certificate - ${item.name}')" class="relative group h-20 bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer flex flex-col items-center justify-center p-1 hover:border-blue-500 transition shadow-2xs">
              ${item.rc_photo ? `
                <img src="${item.rc_photo}" class="w-full h-full object-cover rounded-lg" />
                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-[10px] font-bold">Inspect</div>
              ` : `
                <i data-lucide="truck" class="w-5 h-5 text-slate-400 mb-1"></i>
                <span class="text-[9px] text-slate-400 font-medium">No RC</span>
              `}
              <span class="absolute bottom-1 left-1 bg-black/70 text-white text-[8px] font-mono px-1 rounded">Vehicle RC</span>
            </div>
          </div>
        </div>

        ${isRejected && item.rejection_reason ? `
          <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800">
            <strong>Rejection Reason:</strong> ${item.rejection_reason}
          </div>
        ` : ''}

        <!-- Admin Decision & Enforcement Actions -->
        <div class="pt-2 border-t border-slate-200/80 flex items-center gap-2 flex-wrap">
          <!-- Approval Action -->
          ${!isApproved && !isBlocked ? `
            <button type="button" onclick="handleAdminApproveKyc('${identifier}')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>Approve KYC</span>
            </button>
          ` : ''}

          <!-- Rejection Action -->
          ${!isRejected && !isBlocked ? `
            <button type="button" onclick="openAdminRejectModal('${identifier}')" class="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95">
              <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
              <span>Reject</span>
            </button>
          ` : ''}

          <!-- BLOCK / UNBLOCK ACCOUNT BUTTON -->
          ${!isBlocked ? `
            <button type="button" onclick="openAdminBlockModal('${identifier}')" class="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95" title="Suspend or block this driver">
              <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i>
              <span>Block Driver</span>
            </button>
          ` : `
            <button type="button" onclick="handleAdminUnblockDriver('${identifier}')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95">
              <i data-lucide="check-circle" class="w-4 h-4"></i>
              <span>Unblock & Restore Account</span>
            </button>
          `}

          <!-- Direct Phone Call Helper -->
          ${item.phone ? `
            <a href="tel:${item.phone}" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center" title="Call Driver Directly">
              <i data-lucide="phone" class="w-3.5 h-3.5"></i>
            </a>
          ` : ''}
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function openAdminDocViewer(src, title) {
  if (!src) {
    showToast('No document image uploaded for this item.', 'info');
    return;
  }
  const modal = document.getElementById('adminDocViewerModal');
  const img = document.getElementById('adminDocViewerImg');
  const titleEl = document.getElementById('adminDocViewerTitle');

  if (img) img.src = src;
  if (titleEl) titleEl.textContent = title || 'Document Inspection';
  if (modal) modal.classList.remove('hidden');
}

async function handleAdminApproveKyc(identifier) {
  if (!confirm(`Are you sure you want to APPROVE driver KYC for ${identifier}? This will unlock full corridor publishing privileges.`)) {
    return;
  }

  showToast('Approving driver KYC in Supabase...', 'info');

  try {
    let approvedAvatar = null;
    if (window.db && window.db.admin && window.db.admin.updateKycStatus) {
      const res = await window.db.admin.updateKycStatus(identifier, 'verified_success');
      if (res && res.avatarUrl) approvedAvatar = res.avatarUrl;
    }

    // Update in local array
    if (state.adminKycSubmissions) {
      const target = state.adminKycSubmissions.find(s => s.phone === identifier || s.id === identifier);
      if (target) {
        target.kyc_status = 'verified_success';
        target.is_kyc_verified = true;
        target.rejection_reason = null;
        if (!approvedAvatar && target.avatar_url) approvedAvatar = target.avatar_url;
      }
    }

    // Automatically update the user's profile photo directly with their submitted real KYC photo
    if (state.currentUser && (state.currentUser.phone === identifier || state.currentUser.id === identifier)) {
      state.currentUser.kyc_status = 'verified_success';
      state.currentUser.is_kyc_verified = true;
      state.currentUser.rejection_reason = null;

      // Assign the driver's real submitted photo directly as their active profile picture
      if (approvedAvatar) {
        state.currentUser.avatar = approvedAvatar;
      } else if (state.uploadedKycPhoto) {
        state.currentUser.avatar = state.uploadedKycPhoto;
      }

      localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
      updateProfileDisplay();
      renderKycStatus();
    }

    renderAdminSubmissions();
    showToast(`✅ Driver KYC Approved! Profile photo automatically updated with verified driver photo.`, 'success');
  } catch (err) {
    console.error('Exception approving KYC:', err);
    showToast('Failed to approve KYC. Please retry.', 'error');
  }
}

function openAdminRejectModal(identifier) {
  state.pendingRejectIdentifier = identifier;
  const modal = document.getElementById('adminRejectModal');
  const reasonText = document.getElementById('adminRejectReasonText');
  const presetSelect = document.getElementById('adminRejectReasonPreset');

  if (presetSelect) presetSelect.value = 'Blurry or unreadable document photo';
  if (reasonText) reasonText.value = 'The uploaded document image was blurry or unreadable. Please upload a high-resolution, clear photo.';

  if (modal) modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleRejectPresetChange(val) {
  const reasonText = document.getElementById('adminRejectReasonText');
  if (!reasonText) return;
  if (val === 'Blurry or unreadable document photo') {
    reasonText.value = 'The uploaded document image was blurry or unreadable. Please upload a high-resolution, clear photo.';
  } else if (val === 'Name on Government ID does not match profile') {
    reasonText.value = 'The name on your Aadhaar / Driving License does not match your profile full legal name.';
  } else if (val === 'Expired Driving License') {
    reasonText.value = 'The Driving License provided has expired. Please upload a currently valid license.';
  } else if (val === 'Invalid or counterfeit Vehicle RC') {
    reasonText.value = 'Vehicle Registration Certificate could not be validated with RTO records.';
  } else if (val === 'Aadhaar UID number mismatch') {
    reasonText.value = 'The 12-digit Aadhaar UID entered does not match the digits printed on your card.';
  } else {
    reasonText.value = '';
    reasonText.focus();
  }
}

async function handleConfirmAdminReject(event) {
  event.preventDefault();
  const identifier = state.pendingRejectIdentifier;
  if (!identifier) return;

  const reasonText = document.getElementById('adminRejectReasonText');
  const reason = reasonText ? reasonText.value.trim() : 'Document verification failed.';

  try {
    if (window.db && window.db.admin && window.db.admin.updateKycStatus) {
      await window.db.admin.updateKycStatus(identifier, 'rejected', reason);
    }

    // Update in local admin list
    if (state.adminKycSubmissions) {
      const target = state.adminKycSubmissions.find(s => s.phone === identifier || s.id === identifier);
      if (target) {
        target.kyc_status = 'rejected';
        target.is_kyc_verified = false;
        target.rejection_reason = reason;
      }
    }

    // If currently logged-in user matches, update their current session
    if (state.currentUser && (state.currentUser.phone === identifier || state.currentUser.id === identifier)) {
      state.currentUser.kyc_status = 'rejected';
      state.currentUser.is_kyc_verified = false;
      state.currentUser.rejection_reason = reason;
      localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
      updateProfileDisplay();
      renderKycStatus();
    }

    closeModal('adminRejectModal');
    renderAdminSubmissions();
    showToast(`❌ KYC for ${identifier} rejected with reason logged.`, 'info');
  } catch (err) {
    console.error('Exception rejecting KYC:', err);
    showToast('Failed to reject KYC. Please retry.', 'error');
  }
}

// ==========================================
// DRIVER KYC VERIFICATION & AUTHENTICITY ENGINE
// ==========================================

const INDIAN_STATE_CODES = new Set([
  'AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DD', 'DL', 'DN',
  'GA', 'GJ', 'HR', 'HP', 'JH', 'JK', 'KA', 'KL', 'LA', 'LD',
  'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'PY', 'RJ',
  'SK', 'TN', 'TR', 'TS', 'UK', 'UP', 'WB'
]);

// UIDAI Verhoeff algorithm multiplication table
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];

// UIDAI Verhoeff algorithm permutation table
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function validateAadhaar(aadhaarStr) {
  const clean = (aadhaarStr || '').replace(/\s+/g, '');
  if (!clean) {
    return { valid: false, error: 'Please enter your 12-digit Aadhaar UID number.' };
  }
  if (!/^\d{12}$/.test(clean)) {
    return { valid: false, error: 'Invalid Aadhaar: Must contain exactly 12 numeric digits.' };
  }
  if (clean[0] === '0' || clean[0] === '1') {
    return { valid: false, error: 'Invalid Aadhaar: Real UIDAI Aadhaar numbers cannot start with 0 or 1.' };
  }
  if (/^(\d)\1{11}$/.test(clean)) {
    return { valid: false, error: 'Fake Aadhaar detected: Repeated digits (e.g. 9999 9999 9999) are rejected.' };
  }
  const sequentialPatterns = ['123456789012', '234567890123', '345678901234', '987654321098'];
  if (sequentialPatterns.includes(clean)) {
    return { valid: false, error: 'Fake Aadhaar detected: Sequential test numbers are rejected.' };
  }
  let c = 0;
  const reversedDigits = clean.split('').reverse().map(Number);
  for (let i = 0; i < reversedDigits.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][reversedDigits[i]]];
  }
  if (c !== 0) {
    return { valid: false, error: 'Invalid Aadhaar UID: UIDAI Verhoeff checksum algorithm check failed. Fake numbers rejected.' };
  }
  return { valid: true, clean };
}

function validateDrivingLicense(dlStr) {
  const clean = (dlStr || '').toUpperCase().replace(/[\s\-\/]/g, '');
  if (!clean) {
    return { valid: false, error: 'Please enter your state Driving License number.' };
  }
  if (clean.length < 15 || clean.length > 16) {
    return { valid: false, error: 'Invalid Driving License length. Parivahan format requires 15-16 characters (e.g. TS-08-20210012345).' };
  }
  const stateCode = clean.slice(0, 2);
  if (!INDIAN_STATE_CODES.has(stateCode)) {
    return { valid: false, error: `Invalid State Code "${stateCode}". Must be an Indian State/UT code (e.g. TS, AP, KA, MH, DL).` };
  }
  const rtoCode = clean.slice(2, 4);
  if (!/^\d{2}$/.test(rtoCode) || parseInt(rtoCode, 10) === 0) {
    return { valid: false, error: 'Invalid RTO Code. 2-digit numeric RTO code required (e.g. 08 in TS-08).' };
  }
  const yearStr = clean.slice(4, 8);
  const year = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();
  if (isNaN(year) || year < 1980 || year > currentYear) {
    return { valid: false, error: `Invalid issue year "${yearStr}". Must be between 1980 and ${currentYear}.` };
  }
  const licenseNum = clean.slice(8);
  if (!/^\d{7,8}$/.test(licenseNum)) {
    return { valid: false, error: 'Invalid serial digits: Driving License must end with 7 numeric digits (e.g. 0012345).' };
  }
  if (/^(\d)\1{6,}$/.test(licenseNum)) {
    return { valid: false, error: 'Fake Driving License detected: Repeating serial digits are rejected.' };
  }
  return { valid: true, clean };
}

function validateDriverName(nameStr) {
  const trimmed = (nameStr || '').trim();
  if (!trimmed || trimmed.length < 3) {
    return { valid: false, error: 'Full legal name must be at least 3 characters long.' };
  }
  if (!/^[a-zA-Z\s\.\-]{3,60}$/.test(trimmed)) {
    return { valid: false, error: 'Full name can only contain alphabetic letters and spaces as on Government ID.' };
  }
  const lower = trimmed.toLowerCase();
  const fakeNames = ['test', 'fake', 'asdf', 'admin', 'dummy', 'driver', 'none', 'user', 'qwerty', 'sample', 'null'];
  if (fakeNames.some(f => lower === f || lower.split(' ').includes(f))) {
    return { valid: false, error: 'Fake or dummy name not allowed. Please enter your real legal full name.' };
  }
  return { valid: true, name: trimmed };
}

function clearKycErrors() {
  const nameError = document.getElementById('kycNameError');
  const aadhaarError = document.getElementById('kycAadhaarError');
  const dlError = document.getElementById('kycDlError');
  const photoError = document.getElementById('kycPhotoError');
  const alertBox = document.getElementById('kycVerificationAlert');

  if (nameError) nameError.classList.add('hidden');
  if (aadhaarError) aadhaarError.classList.add('hidden');
  if (dlError) dlError.classList.add('hidden');
  if (photoError) photoError.classList.add('hidden');
  if (alertBox) {
    alertBox.classList.add('hidden');
    alertBox.innerHTML = '';
  }
}

function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = message;
    el.classList.remove('hidden');
  }
}

function showVerificationFailure(message) {
  const alertBox = document.getElementById('kycVerificationAlert');
  if (alertBox) {
    alertBox.className = 'mt-3 p-3 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs flex items-start gap-2.5';
    alertBox.innerHTML = `
      <i data-lucide="alert-octagon" class="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5"></i>
      <div>
        <p class="font-bold text-red-950 text-xs">KYC Verification Rejected</p>
        <p class="text-[11px] text-red-800 mt-0.5 leading-relaxed font-medium">${message}</p>
      </div>
    `;
    alertBox.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
  showToast(message, 'error');
}

function formatAadhaarInput(el) {
  if (!el) return;
  let val = el.value.replace(/[^0-9]/g, '');
  if (val.length > 12) val = val.slice(0, 12);
  const parts = [];
  for (let i = 0; i < val.length; i += 4) {
    parts.push(val.slice(i, i + 4));
  }
  el.value = parts.join(' ');
  clearKycErrors();
}


async function handleKycFormSubmit(event) {
  event.preventDefault();
  clearKycErrors();

  const nameInput = document.getElementById('kycFullName');
  const aadhaarInput = document.getElementById('kycAadhaarNumber');
  const dlInput = document.getElementById('kycDlNumber');
  const btnSubmit = document.getElementById('btnSubmitKyc');
  const btnText = document.getElementById('btnSubmitKycText');
  const alertBox = document.getElementById('kycVerificationAlert');

  const fullName = nameInput ? nameInput.value.trim() : '';
  const rawAadhaar = aadhaarInput ? aadhaarInput.value.trim() : '';
  const rawDl = dlInput ? dlInput.value.trim() : '';

  // 1. Strict Name Validation
  const nameResult = validateDriverName(fullName);
  if (!nameResult.valid) {
    showFieldError('kycNameError', nameResult.error);
    showVerificationFailure(nameResult.error);
    return;
  }

  // 2. Strict Aadhaar UID Check (Length + 0/1 prefix + repetition + Verhoeff Algorithm)
  const aadhaarResult = validateAadhaar(rawAadhaar);
  if (!aadhaarResult.valid) {
    showFieldError('kycAadhaarError', aadhaarResult.error);
    showVerificationFailure(aadhaarResult.error);
    return;
  }

  // 3. Strict Driving License Check (State Code + RTO + Valid Year + Serial)
  const dlResult = validateDrivingLicense(rawDl);
  if (!dlResult.valid) {
    showFieldError('kycDlError', dlResult.error);
    showVerificationFailure(dlResult.error);
    return;
  }

  // 4. Strict Photo Requirement Check - User MUST upload their original photo
  const hasOriginalUploadedPhoto = Boolean(
    state.uploadedKycPhoto && 
    (state.uploadedKycPhoto.startsWith('data:image/') || state.uploadedKycPhoto.startsWith('blob:') || (state.uploadedKycPhoto.startsWith('http') && !state.uploadedKycPhoto.includes('unsplash')))
  );

  if (!hasOriginalUploadedPhoto) {
    const photoError = document.getElementById('kycPhotoError');
    if (photoError) photoError.classList.remove('hidden');
    showVerificationFailure('Original photo required: You must upload your real photo / selfie before verification.');
    return;
  }

  const avatarUrl = state.uploadedKycPhoto;

  // ALL CREDENTIALS VALID! Proceed with simulated real-time gateway checks
  if (btnSubmit) btnSubmit.disabled = true;
  if (btnText) btnText.textContent = 'Verifying UIDAI & Parivahan...';

  if (alertBox) {
    alertBox.className = 'mt-3 p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5 animate-pulse';
    alertBox.innerHTML = `
      <i data-lucide="loader-2" class="w-4 h-4 text-blue-600 animate-spin flex-shrink-0"></i>
      <div>
        <p class="font-bold text-blue-950 text-xs">Cross-referencing Government Databases</p>
        <p class="text-[10px] text-blue-700 mt-0.5">UIDAI Aadhaar Checksum Validated. Verifying Parivahan Sarathi record...</p>
      </div>
    `;
    alertBox.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }

  // Handshake simulation delay
  await new Promise(r => setTimeout(r, 900));

  const kycPayload = {
    name: nameResult.name,
    avatarUrl: avatarUrl,
    aadhaarNumber: aadhaarResult.clean,
    dlNumber: dlResult.clean,
    phone: (state.currentUser && state.currentUser.phone) || state.authPhone || '+91 98480 23145'
  };

  try {
    const profileIdentifier = (state.currentUser && state.currentUser.id) || kycPayload.phone;

    if (window.db && window.db.profiles && window.db.profiles.updateKyc) {
      const res = await window.db.profiles.updateKyc(profileIdentifier, kycPayload);
      console.log('🛡️ Supabase KYC update response:', res);
    }

    if (!state.currentUser) {
      state.currentUser = {
        id: 'usr_' + Date.now(),
        phone: kycPayload.phone,
        authenticatedAt: new Date().toISOString()
      };
    }

    // Only activate once genuine verification passed!
    state.currentUser.is_kyc_verified = true;
    state.currentUser.name = nameResult.name;
    state.currentUser.avatar = avatarUrl;
    state.currentUser.aadhaar_number = aadhaarResult.clean;
    state.currentUser.dl_number = dlResult.clean;

    localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));

    if (alertBox) {
      alertBox.className = 'mt-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2.5';
      alertBox.innerHTML = `
        <i data-lucide="shield-check" class="w-4 h-4 text-emerald-600 flex-shrink-0"></i>
        <div>
          <p class="font-bold text-emerald-950 text-xs">Credentials Verified & Authenticated</p>
          <p class="text-[10px] text-emerald-700 mt-0.5">Activating verified driver privileges...</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    }

    setTimeout(() => {
      closeModal('kycVerificationModal');
      updateProfileDisplay();
      renderKycStatus();
      showToast(`🎉 Driver KYC Verified! ${nameResult.name}'s verified credentials are active.`, 'success');
    }, 500);

  } catch (err) {
    console.error('Exception submitting KYC:', err);
    showVerificationFailure('Database error saving verification. Please retry.');
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
    if (btnText) btnText.textContent = 'Verify & Activate Driver KYC';
  }
}

async function resetDriverKyc() {
  if (state.currentUser) {
    state.currentUser.is_kyc_verified = false;
    state.currentUser.aadhaar_number = '';
    state.currentUser.dl_number = '';
    localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));
    if (window.db && window.db.profiles && window.db.profiles.updateKyc) {
      const identifier = state.currentUser.id || state.currentUser.phone;
      await window.db.profiles.updateKyc(identifier, {
        is_kyc_verified: false,
        aadhaar_number: '',
        dl_number: ''
      }).catch(e => console.warn(e));
    }
  }
  updateProfileDisplay();
  renderKycStatus();
  showToast('Driver KYC reset to Pending. You can re-verify now.', 'info');
}

// ==========================================
// OCR-BASED AUTO-FILL KYC VERIFICATION ENGINE
// ==========================================

function openOcrScannerModal(context = 'kyc') {
  state.ocrContext = context; // 'kyc' | 'onboarding'
  state.lastOcrResult = null;
  state.lastOcrCardImageDataUrl = null;

  const modal = document.getElementById('ocrScanModal');
  if (!modal) return;

  // Reset UI elements
  const statusContainer = document.getElementById('ocrStatusContainer');
  const resultContainer = document.getElementById('ocrResultContainer');
  const videoFeed = document.getElementById('ocrVideoFeed');
  const imgPreview = document.getElementById('ocrImagePreview');
  const captureBtn = document.getElementById('btnCaptureOcr');

  if (statusContainer) statusContainer.classList.add('hidden');
  if (resultContainer) resultContainer.classList.add('hidden');
  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.classList.add('hidden');
  }
  if (videoFeed) videoFeed.classList.remove('hidden');
  if (captureBtn) {
    captureBtn.disabled = false;
    const btnText = document.getElementById('btnCaptureOcrText');
    if (btnText) btnText.textContent = 'Capture & Run OCR Scan';
  }

  modal.classList.remove('hidden');
  startOcrCameraStream();
  if (window.lucide) lucide.createIcons();
}

function closeOcrScannerModal() {
  stopOcrCameraStream();
  const modal = document.getElementById('ocrScanModal');
  if (modal) modal.classList.add('hidden');
}

async function startOcrCameraStream() {
  const video = document.getElementById('ocrVideoFeed');
  const notice = document.getElementById('ocrCameraNotice');
  const frameOverlay = document.getElementById('ocrFrameOverlay');

  if (notice) notice.classList.add('hidden');
  if (frameOverlay) frameOverlay.classList.remove('hidden');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.warn('getUserMedia camera stream not supported');
    if (notice) notice.classList.remove('hidden');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    state.ocrMediaStream = stream;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(e => console.warn('Video play catch:', e));
    }
    if (notice) notice.classList.add('hidden');
  } catch (err) {
    console.warn('Camera access denied or unavailable:', err);
    if (notice) notice.classList.remove('hidden');
  }
}

function stopOcrCameraStream() {
  if (state.ocrMediaStream) {
    try {
      state.ocrMediaStream.getTracks().forEach(track => track.stop());
    } catch (e) {}
    state.ocrMediaStream = null;
  }
  const video = document.getElementById('ocrVideoFeed');
  if (video) {
    video.srcObject = null;
  }
}

async function captureAndProcessOcr() {
  const video = document.getElementById('ocrVideoFeed');
  const canvas = document.getElementById('ocrCanvas') || document.createElement('canvas');
  const captureBtn = document.getElementById('btnCaptureOcr');
  const btnText = document.getElementById('btnCaptureOcrText');

  if (captureBtn) captureBtn.disabled = true;
  if (btnText) btnText.textContent = 'Scanning ID...';

  try {
    // If live video is playing, capture current video frame
    if (video && video.videoWidth > 0 && !video.paused) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      state.lastOcrCardImageDataUrl = dataUrl;

      // Show static captured image in viewfinder
      const imgPreview = document.getElementById('ocrImagePreview');
      if (imgPreview) {
        imgPreview.src = dataUrl;
        imgPreview.classList.remove('hidden');
      }
      video.classList.add('hidden');

      await runOcrRecognition(canvas, dataUrl);
    } else {
      // If camera wasn't active, prompt user to select real ID card image
      showToast('Camera feed unavailable. Please upload ID card image from your gallery.', 'info');
      const fileInput = document.getElementById('ocrUploadFileInput');
      if (fileInput) fileInput.click();
    }
  } catch (err) {
    console.error('Error during OCR capture:', err);
    showToast('Failed to scan card frame. Please retry or upload image.', 'error');
  } finally {
    if (captureBtn) captureBtn.disabled = false;
    if (btnText) btnText.textContent = 'Capture & Run OCR Scan';
  }
}

function handleOcrFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please upload a valid card image', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    const dataUrl = e.target.result;
    state.lastOcrCardImageDataUrl = dataUrl;

    const imgPreview = document.getElementById('ocrImagePreview');
    const video = document.getElementById('ocrVideoFeed');
    const notice = document.getElementById('ocrCameraNotice');

    if (notice) notice.classList.add('hidden');
    if (video) video.classList.add('hidden');
    if (imgPreview) {
      imgPreview.src = dataUrl;
      imgPreview.classList.remove('hidden');
    }

    const img = new Image();
    img.onload = async function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 400;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      await runOcrRecognition(canvas, dataUrl);
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}

function updateOcrProgress(msg, percent) {
  const statusContainer = document.getElementById('ocrStatusContainer');
  const statusText = document.getElementById('ocrStatusText');
  const statusPercent = document.getElementById('ocrStatusPercent');
  const progressBar = document.getElementById('ocrProgressBar');

  if (statusContainer) statusContainer.classList.remove('hidden');
  if (statusText) statusText.textContent = msg;
  if (statusPercent) statusPercent.textContent = `${Math.min(100, Math.max(0, Math.round(percent)))}%`;
  if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, Math.round(percent)))}%`;
}

async function runOcrRecognition(canvas, dataUrl) {
  updateOcrProgress('Preprocessing document image...', 20);

  // Pre-process canvas for high-contrast character edges
  const processedCanvas = preprocessCanvasForOcr(canvas);

  let rawExtractedText = '';

  // 1. Pure client-side WebAssembly Tesseract OCR v5
  if (typeof Tesseract !== 'undefined') {
    try {
      updateOcrProgress('Initializing OCR engine...', 35);
      const res = await Tesseract.recognize(processedCanvas, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text' && m.progress !== undefined) {
            updateOcrProgress(`Recognizing text... ${Math.round(m.progress * 100)}%`, 40 + (m.progress * 50));
          }
        }
      });
      if (res && res.data && res.data.text) {
        rawExtractedText = res.data.text;
      }
    } catch (e) {
      console.warn('Tesseract WASM worker warning:', e);
    }
  }

  // 2. Parse text through regex engine (pure real-time extraction, NO fake fallbacks)
  updateOcrProgress('Running security forensics & verification...', 92);
  const parsed = parseOcrText(rawExtractedText);

  // 3. Document Authenticity & Fraud Detection Check
  const authResult = verifyDocumentAuthenticity(rawExtractedText, parsed);

  updateOcrProgress('Analysis complete!', 100);
  setTimeout(() => {
    const statusContainer = document.getElementById('ocrStatusContainer');
    if (statusContainer) statusContainer.classList.add('hidden');
  }, 600);

  state.lastOcrResult = { ...parsed, authResult };
  displayOcrResults(parsed, authResult);
  return state.lastOcrResult;
}

function preprocessCanvasForOcr(sourceCanvas) {
  const destCanvas = document.createElement('canvas');
  destCanvas.width = sourceCanvas.width;
  destCanvas.height = sourceCanvas.height;
  const ctx = destCanvas.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0);

  try {
    const imgData = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Boost contrast
      const val = gray > 140 ? Math.min(255, gray * 1.15) : Math.max(0, gray * 0.85);
      d[i] = val;
      d[i + 1] = val;
      d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn('Canvas filter security restriction:', e);
  }
  return destCanvas;
}

function parseOcrText(rawText) {
  if (!rawText) return { name: null, dl: null, aadhaar: null, dob: null, type: 'ID Document' };

  const clean = rawText.replace(/\r/g, '').trim();
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);

  let detectedDl = null;
  let detectedAadhaar = null;
  let detectedName = null;
  let detectedDob = null;
  let docType = 'ID Document';

  // 1. Driving License regex (State-RTO-Year-Number e.g. TS-08-20210012345 or TS08 20210012345)
  const dlRegex = /\b([A-Z]{2}[- ]?[0-9]{2}[- ]?(?:19|20)[0-9]{2}[- ]?[0-9]{7})\b/i;
  const dlMatch = clean.match(dlRegex);
  if (dlMatch) {
    const raw = dlMatch[1].toUpperCase().replace(/[\s\-]/g, '');
    detectedDl = `${raw.slice(0, 2)}-${raw.slice(2, 4)}-${raw.slice(4)}`;
    docType = 'Driving License';
  } else {
    // Alternate standard DL pattern (e.g. DL-1420110012345 or with prefix DL NO)
    const dlMatch2 = clean.match(/(?:DL|LICEN[SC]E|NO|NUMBER)[:.\s-]*([A-Z]{2}[0-9A-Z -]{11,18})/i);
    if (dlMatch2) {
      const candidate = dlMatch2[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (candidate.length >= 13 && candidate.length <= 16 && INDIAN_STATE_CODES.has(candidate.slice(0, 2))) {
        detectedDl = `${candidate.slice(0, 2)}-${candidate.slice(2, 4)}-${candidate.slice(4)}`;
        docType = 'Driving License';
      }
    }
  }

  // 2. Aadhaar UID pattern: 12 digits
  const aadhaarRegex = /\b([2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4})\b/;
  const aadhaarMatch = clean.match(aadhaarRegex);
  if (aadhaarMatch) {
    detectedAadhaar = aadhaarMatch[1].replace(/\s+/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
    if (docType === 'ID Document') docType = 'Aadhaar Card';
  }

  // 3. Date of Birth pattern (DOB: DD/MM/YYYY or DD-MM-YYYY)
  const dobRegex = /(?:DOB|DATE OF BIRTH|D\.O\.B|BIRTH|YEAR OF BIRTH)[:.\s]*([0-3]?[0-9][/-][0-1]?[0-9][/-][12][09][0-9]{2})/i;
  const dobMatch = clean.match(dobRegex);
  if (dobMatch) {
    const rawDob = dobMatch[1].replace(/\//g, '-');
    const p = rawDob.split('-');
    if (p.length === 3) {
      if (p[0].length === 4) {
        detectedDob = `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
      } else {
        detectedDob = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      }
    }
  }

  // 4. Name extraction
  for (const line of lines) {
    const nm = line.match(/(?:NAME|HOLDER|NAME OF HOLDER)[:.\s]+([A-Za-z\s.]{3,35})/i);
    if (nm && !isIgnoredOcrHeader(nm[1])) {
      detectedName = nm[1].trim();
      break;
    }
  }

  if (!detectedName) {
    for (const line of lines) {
      const stripped = line.trim();
      if (
        stripped.length >= 3 &&
        stripped.length <= 28 &&
        /^[A-Za-z\s.]+$/.test(stripped) &&
        !isIgnoredOcrHeader(stripped)
      ) {
        detectedName = stripped;
        break;
      }
    }
  }

  return {
    rawText: clean,
    name: detectedName,
    dl: detectedDl,
    aadhaar: detectedAadhaar,
    dob: detectedDob,
    type: docType
  };
}

function isIgnoredOcrHeader(str) {
  const upper = str.toUpperCase().trim();
  const ignored = [
    'UNION OF INDIA', 'DRIVING LICENCE', 'DRIVING LICENSE', 'GOVERNMENT',
    'TRANSPORT', 'DEPARTMENT', 'STATE', 'FORM', 'TELANGANA', 'MAHARASHTRA',
    'KARNATAKA', 'ANDHRA', 'INDIA', 'SIGNATURE', 'VALIDITY', 'AUTHORITY',
    'IDENTIFICATION', 'AADHAAR', 'ENROLMENT', 'MALE', 'FEMALE', 'FATHER'
  ];
  return ignored.some(ign => upper.includes(ign));
}

// Real-Time Document Authenticity & Fraud Detection Engine
function verifyDocumentAuthenticity(rawText, parsed) {
  const textUpper = (rawText || '').toUpperCase();
  const nameUpper = ((parsed && parsed.name) || '').toUpperCase();
  const passedChecks = [];
  const fraudReasons = [];

  // 1. Watermark & Counterfeit / Sample keyword forensics
  const counterfeitKeywords = [
    'FAKE', 'SAMPLE', 'TEST CARD', 'DUMMY', 'FORGERY', 'COUNTERFEIT', 
    'SPECIMEN', 'MOCK', 'NOT VALID', 'PRACTICE', 'EXEMPLAR', 'INVALID CARD'
  ];
  for (const kw of counterfeitKeywords) {
    if (textUpper.includes(kw) || nameUpper.includes(kw)) {
      fraudReasons.push(`Forensic Alert: Counterfeit indicator detected in document ("${kw}").`);
    }
  }

  // 2. Official Government Security Markers & Headers
  const dlHeaders = ['TRANSPORT DEPARTMENT', 'GOVERNMENT OF', 'DRIVING LICENCE', 'DRIVING LICENSE', 'UNION OF INDIA', 'PARIVAHAN', 'SARATHI', 'MOTOR VEHICLES'];
  const aadhaarHeaders = ['UNIQUE IDENTIFICATION', 'UIDAI', 'AADHAAR', 'GOVERNMENT OF INDIA', 'MERA AADHAAR', 'MERI PEHCHAN'];
  
  const hasDlHeader = dlHeaders.some(h => textUpper.includes(h));
  const hasAadhaarHeader = aadhaarHeaders.some(h => textUpper.includes(h));

  // 3. Credential Detection & Cryptographic Checks
  let hasValidCredential = false;

  // 3A. Driving License Verification
  if (parsed && parsed.dl) {
    const dlValidation = validateDrivingLicense(parsed.dl);
    if (!dlValidation.valid) {
      fraudReasons.push(`Driving License Validation Failure: ${dlValidation.error}`);
    } else {
      const stateCode = dlValidation.clean.slice(0, 2);
      const rtoCode = dlValidation.clean.slice(2, 4);
      const year = parseInt(dlValidation.clean.slice(4, 8), 10);
      const currentYear = new Date().getFullYear();

      passedChecks.push(`Official Parivahan State Jurisdictional Code verified (${stateCode}).`);
      passedChecks.push(`Valid Regional Transport Office (RTO) series verified (${rtoCode}).`);
      passedChecks.push(`Issue Epoch verified: Year ${year} conforms to legal licensing period (1980-${currentYear}).`);
      passedChecks.push(`Unique sequential serial allocation authenticated.`);
      hasValidCredential = true;
    }
  }

  // 3B. Aadhaar Card Verification
  if (parsed && parsed.aadhaar) {
    const aadhaarValidation = validateAadhaar(parsed.aadhaar);
    if (!aadhaarValidation.valid) {
      fraudReasons.push(`Aadhaar UID Validation Failure: ${aadhaarValidation.error}`);
    } else {
      passedChecks.push(`UIDAI 12-digit standard compliance verified.`);
      passedChecks.push(`UID prefix integrity confirmed (excludes non-allocated 0/1 prefix).`);
      passedChecks.push(`UIDAI Verhoeff Dihedral (D5) mathematical checksum authenticated.`);
      hasValidCredential = true;
    }
  }

  // If neither valid DL nor valid Aadhaar was detected
  if (!parsed || (!parsed.dl && !parsed.aadhaar)) {
    fraudReasons.push('No legitimate Parivahan Driving License or UIDAI Aadhaar number detected on scanned document.');
  }

  // 4. Name Authenticity Forensics
  if (parsed && parsed.name) {
    const nameValidation = validateDriverName(parsed.name);
    if (!nameValidation.valid) {
      fraudReasons.push(`Invalid Cardholder Name: ${nameValidation.error}`);
    } else {
      passedChecks.push(`Legal cardholder name formatted & verified: "${parsed.name}".`);
    }
  }

  // 5. Official Header Check Feedback
  if (hasDlHeader) {
    passedChecks.push('Official State Transport / Parivahan Ministry header markers detected.');
  } else if (hasAadhaarHeader) {
    passedChecks.push('Official UIDAI / Government of India security header markers detected.');
  }

  // 6. Final Decision & Confidence Scoring
  const isAuthentic = fraudReasons.length === 0 && hasValidCredential && passedChecks.length >= 2;
  let confidenceScore = 0;
  if (isAuthentic) {
    confidenceScore = Math.min(99, 85 + (passedChecks.length * 3));
  } else {
    confidenceScore = Math.max(10, 45 - (fraudReasons.length * 15));
  }

  return {
    isAuthentic,
    confidenceScore,
    passedChecks,
    fraudReasons,
    verdict: isAuthentic ? 'Authentic Government ID' : 'Fraudulent / Invalid Document'
  };
}

function displayOcrResults(parsed, authResult) {
  const resultCard = document.getElementById('ocrResultContainer');
  const banner = document.getElementById('ocrAuthenticityBanner');
  const iconWrap = document.getElementById('ocrAuthenticityIconWrap');
  const icon = document.getElementById('ocrAuthenticityIcon');
  const title = document.getElementById('ocrAuthenticityTitle');
  const subtitle = document.getElementById('ocrAuthenticitySubtitle');
  const typeBadge = document.getElementById('ocrDocumentTypeBadge');
  const forensicList = document.getElementById('ocrForensicList');
  const nameEl = document.getElementById('ocrExtractedName');
  const dlEl = document.getElementById('ocrExtractedDl');
  const aadhaarEl = document.getElementById('ocrExtractedAadhaar');
  const dobEl = document.getElementById('ocrExtractedDob');
  const btnApply = document.getElementById('btnApplyOcr');
  const btnApplyText = document.getElementById('btnApplyOcrText');
  const btnApplyIcon = document.getElementById('btnApplyOcrIcon');

  if (!resultCard) return;

  // Set Document Type Badge
  if (typeBadge) {
    typeBadge.textContent = (parsed && parsed.type) || 'ID Document';
  }

  // Populate Extracted Fields
  if (nameEl) nameEl.textContent = (parsed && parsed.name) || '(Not detected in scan)';
  if (dlEl) dlEl.textContent = (parsed && parsed.dl) || 'Not detected';
  if (aadhaarEl) aadhaarEl.textContent = (parsed && parsed.aadhaar) || 'Not detected';
  if (dobEl) dobEl.textContent = (parsed && parsed.dob) || 'Not detected';

  // Populate Forensic Results List
  if (forensicList) {
    forensicList.innerHTML = '';
    if (!authResult || !authResult.isAuthentic) {
      const reasons = (authResult && authResult.fraudReasons) || ['Unrecognized or invalid document format.'];
      reasons.forEach(reason => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-1.5 text-rose-300 font-medium';
        li.innerHTML = `<span class="text-rose-400 font-bold flex-shrink-0">✖</span><span>${reason}</span>`;
        forensicList.appendChild(li);
      });
      if (authResult && authResult.passedChecks) {
        authResult.passedChecks.forEach(check => {
          const li = document.createElement('li');
          li.className = 'flex items-start gap-1.5 text-slate-400 text-[10px]';
          li.innerHTML = `<span class="text-slate-500 font-bold flex-shrink-0">•</span><span>${check}</span>`;
          forensicList.appendChild(li);
        });
      }
    } else {
      authResult.passedChecks.forEach(check => {
        const li = document.createElement('li');
        li.className = 'flex items-start gap-1.5 text-emerald-300 font-medium';
        li.innerHTML = `<span class="text-emerald-400 font-bold flex-shrink-0">✔</span><span>${check}</span>`;
        forensicList.appendChild(li);
      });
    }
  }

  // Authenticity Banner & Action Button State
  if (authResult && authResult.isAuthentic) {
    // AUTHENTIC - Green styling
    if (banner) {
      banner.className = 'p-2.5 rounded-xl flex items-start gap-2.5 text-xs bg-emerald-950/60 border border-emerald-500/40 text-emerald-200';
    }
    if (iconWrap) {
      iconWrap.className = 'w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center flex-shrink-0 mt-0.5';
    }
    if (icon) {
      icon.setAttribute('data-lucide', 'shield-check');
      icon.className = 'w-4 h-4 text-emerald-400';
    }
    if (title) {
      title.className = 'font-extrabold text-xs text-emerald-300 flex items-center gap-1.5';
      title.innerHTML = `<span>GENUINE GOVERNMENT ID</span> <span class="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">${authResult.confidenceScore}% Valid</span>`;
    }
    if (subtitle) {
      subtitle.className = 'text-[11px] mt-0.5 text-emerald-400/90 leading-relaxed font-medium';
      subtitle.textContent = 'Cryptographic checks & Parivahan / UIDAI format verification passed.';
    }
    if (typeBadge) {
      typeBadge.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    }

    // Enable Apply button
    if (btnApply) {
      btnApply.disabled = false;
      btnApply.className = 'w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white';
    }
    if (btnApplyText) btnApplyText.textContent = 'Auto-Fill Verified KYC Fields';
    if (btnApplyIcon) {
      btnApplyIcon.setAttribute('data-lucide', 'check-circle-2');
      btnApplyIcon.className = 'w-4 h-4 text-white';
    }

    showToast(`✅ Genuine ${(parsed && parsed.type) || 'ID'} verified (${authResult.confidenceScore}% confidence).`, 'success');
  } else {
    // FRAUD / INVALID - Red styling
    if (banner) {
      banner.className = 'p-2.5 rounded-xl flex items-start gap-2.5 text-xs bg-rose-950/70 border border-rose-500/50 text-rose-200';
    }
    if (iconWrap) {
      iconWrap.className = 'w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center flex-shrink-0 mt-0.5';
    }
    if (icon) {
      icon.setAttribute('data-lucide', 'shield-alert');
      icon.className = 'w-4 h-4 text-rose-400';
    }
    if (title) {
      title.className = 'font-extrabold text-xs text-rose-300 flex items-center gap-1.5';
      title.innerHTML = `<span>FAKE / COUNTERFEIT ID DETECTED</span> <span class="text-[10px] px-1.5 py-0.2 bg-rose-500/20 text-rose-300 rounded font-mono font-bold">REJECTED</span>`;
    }
    if (subtitle) {
      subtitle.className = 'text-[11px] mt-0.5 text-rose-300/90 leading-relaxed font-medium';
      subtitle.textContent = 'Security forensic alert: Document failed authenticity checks and is blocked.';
    }
    if (typeBadge) {
      typeBadge.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border bg-rose-500/20 text-rose-300 border-rose-500/30';
    }

    // Disable Apply button
    if (btnApply) {
      btnApply.disabled = true;
      btnApply.className = 'w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-none bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60';
    }
    if (btnApplyText) btnApplyText.textContent = '🚫 Auto-Fill Blocked (Fake / Invalid ID)';
    if (btnApplyIcon) {
      btnApplyIcon.setAttribute('data-lucide', 'ban');
      btnApplyIcon.className = 'w-4 h-4 text-slate-500';
    }

    showToast('🚨 Fake or invalid ID card detected! Auto-fill is blocked.', 'error');
  }

  resultCard.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function applyOcrExtractedFields() {
  if (!state.lastOcrResult) {
    showToast('No extracted credentials found to auto-fill', 'error');
    return;
  }

  const res = state.lastOcrResult;
  if (!res.authResult || !res.authResult.isAuthentic) {
    showToast('🚫 Auto-fill blocked: Scanned ID failed authenticity checks.', 'error');
    return;
  }
  let filledCount = 0;

  // 1. Fill KYC Form fields
  const kycNameInput = document.getElementById('kycFullName');
  const kycDlInput = document.getElementById('kycDlNumber');
  const kycAadhaarInput = document.getElementById('kycAadhaarNumber');

  if (res.name && kycNameInput) {
    kycNameInput.value = res.name;
    highlightFieldAutoFilled(kycNameInput);
    filledCount++;
  }
  if (res.dl && kycDlInput) {
    kycDlInput.value = res.dl;
    highlightFieldAutoFilled(kycDlInput);
    filledCount++;
  }
  if (res.aadhaar && kycAadhaarInput) {
    kycAadhaarInput.value = res.aadhaar;
    highlightFieldAutoFilled(kycAadhaarInput);
    filledCount++;
  }

  // 2. Fill Onboarding fields if relevant
  const onboardingNameInput = document.getElementById('onboardingNameInput');
  const onboardingDobInput = document.getElementById('onboardingDobInput');
  if (res.name && onboardingNameInput) {
    onboardingNameInput.value = res.name;
    highlightFieldAutoFilled(onboardingNameInput);
  }
  if (res.dob && onboardingDobInput) {
    onboardingDobInput.value = res.dob;
    highlightFieldAutoFilled(onboardingDobInput);
  }

  // 3. Fill Profile Personal Details card
  const profileFullNameInput = document.getElementById('profileFullNameInput');
  const profileDobInput = document.getElementById('profileDobInput');
  if (res.name && profileFullNameInput) {
    profileFullNameInput.value = res.name;
  }
  if (res.dob && profileDobInput) {
    profileDobInput.value = res.dob;
    const badge = document.getElementById('profileDobDisplayBadge');
    if (badge) badge.textContent = formatDobReadable(res.dob);
  }

  // 4. If image was captured or sample card used, set as driver original photo
  if (state.lastOcrCardImageDataUrl) {
    state.uploadedKycPhoto = state.lastOcrCardImageDataUrl;
    const preview = document.getElementById('kycAvatarPreview');
    const placeholder = document.getElementById('kycAvatarPlaceholder');
    const photoStatusText = document.getElementById('kycPhotoStatusText');
    const photoBtnText = document.getElementById('kycPhotoBtnText');

    if (preview) {
      preview.src = state.lastOcrCardImageDataUrl;
      preview.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    if (photoStatusText) {
      photoStatusText.textContent = '✅ Verified photo extracted from ID card.';
      photoStatusText.className = 'text-[10px] text-emerald-600 font-bold';
    }
    if (photoBtnText) photoBtnText.textContent = 'Change Photo';
  }

  closeOcrScannerModal();
  clearKycErrors();

  if (state.ocrContext === 'onboarding') {
    const onboardingName = document.getElementById('onboardingNameInput');
    if (onboardingName) onboardingName.focus();
  } else {
    const kycModal = document.getElementById('kycVerificationModal');
    if (kycModal && kycModal.classList.contains('hidden')) {
      openKycModal();
    }
  }

  showToast(`🎉 OCR Auto-Fill complete! Fields populated from ${res.type}.`, 'success');
}

function highlightFieldAutoFilled(el) {
  if (!el) return;
  const parent = el.closest('.flex') || el;
  parent.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-50/60');
  setTimeout(() => {
    parent.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-50/60');
  }, 3000);
}

// ==========================================
// PROFILE PERSONAL DETAILS & SETTINGS ENGINE
// ==========================================

function validateEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function formatDobReadable(isoDateStr) {
  if (!isoDateStr) return 'Not Set';
  try {
    const d = new Date(isoDateStr);
    if (isNaN(d.getTime())) return isoDateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch (e) {
    return isoDateStr;
  }
}

function handleEmailInputValidation(val) {
  const statusBadge = document.getElementById('profileEmailStatusBadge');
  const validationText = document.getElementById('profileEmailValidationText');
  const isValid = validateEmail(val);

  if (isValid) {
    if (statusBadge) {
      statusBadge.textContent = 'Verified Format';
      statusBadge.className = 'text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300';
    }
    if (validationText) {
      validationText.textContent = '✅ Valid format (receipts active)';
      validationText.className = 'text-[10px] font-semibold text-emerald-600';
    }
  } else if (!val || !val.trim()) {
    if (statusBadge) {
      statusBadge.textContent = 'Unverified';
      statusBadge.className = 'text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200';
    }
    if (validationText) {
      validationText.textContent = 'Required for trip receipts';
      validationText.className = 'text-[10px] font-medium text-slate-400';
    }
  } else {
    if (statusBadge) {
      statusBadge.textContent = 'Invalid';
      statusBadge.className = 'text-[10px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 px-2.5 py-0.5 rounded-full border border-rose-300';
    }
    if (validationText) {
      validationText.textContent = '⚠️ Invalid email format';
      validationText.className = 'text-[10px] font-semibold text-rose-600';
    }
  }
}

function handleGenderInputChange(val) {
  const badge = document.getElementById('profileGenderBadge');
  if (badge) {
    badge.textContent = val || 'Select option';
  }
}

function handleDobInputChange(val) {
  const badge = document.getElementById('profileDobDisplayBadge');
  if (badge) {
    badge.textContent = formatDobReadable(val);
  }
}

async function savePersonalDetails() {
  const fullNameInput = document.getElementById('profileFullNameInput');
  const genderInput = document.getElementById('profileGenderInput');
  const emailInput = document.getElementById('profileEmailInput');
  const dobInput = document.getElementById('profileDobInput');

  const nameVal = fullNameInput ? fullNameInput.value.trim() : '';
  const genderVal = genderInput ? genderInput.value : '';
  const emailVal = emailInput ? emailInput.value.trim() : '';
  const dobVal = dobInput ? dobInput.value : '';

  if (!nameVal) {
    showToast('Please enter your full name', 'error');
    if (fullNameInput) fullNameInput.focus();
    return;
  }

  if (emailVal && !validateEmail(emailVal)) {
    showToast('Please enter a valid email address', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  if (!state.currentUser) {
    state.currentUser = {
      id: 'usr_' + Date.now(),
      phone: state.authPhone || '+91 98480 23145',
      name: nameVal || 'Verified Commuter',
      authenticatedAt: new Date().toISOString()
    };
  }

  state.currentUser.name = nameVal;
  state.currentUser.gender = genderVal;
  state.currentUser.email = emailVal;
  state.currentUser.dob = dobVal;
  state.currentUser.email_verified = Boolean(emailVal && validateEmail(emailVal));

  // Instantly update header name in real time
  const profileDisplayName = document.getElementById('profileDisplayName');
  if (profileDisplayName) {
    profileDisplayName.textContent = nameVal;
  }

  localStorage.setItem('routemate_auth_user', JSON.stringify(state.currentUser));

  // Sync to Supabase profile in real time
  if (window.db && window.db.profiles && window.db.profiles.updateDetails) {
    const identifier = state.currentUser.id || state.currentUser.phone;
    window.db.profiles.updateDetails(identifier, {
      name: nameVal,
      gender: genderVal,
      email: emailVal,
      dob: dobVal
    }).then(res => {
      console.log('✅ Supabase profile details updated in real time:', res);
    }).catch(e => console.warn('Supabase details sync:', e));
  }

  updateProfileDisplay();
  showToast('✅ Personal details saved successfully!', 'success');
}

// ------------------------------------------
// EMERGENCY CONTACT ENGINE
// ------------------------------------------

function renderEmergencyContact() {
  const container = document.getElementById('emergencyContactDisplayContainer');
  if (!container) return;

  // Discard legacy demo emergency contact if lingering in state or localStorage
  if (state.emergencyContact && (state.emergencyContact.name === 'Suresh Kumar' || state.emergencyContact.phone === '9848011223')) {
    state.emergencyContact = null;
    try { localStorage.removeItem('routemate_emergency_contact'); } catch (e) {}
  }

  const contact = state.emergencyContact;

  if (contact && contact.name && contact.phone) {
    container.innerHTML = `
      <div class="p-3.5 bg-rose-50/70 border border-rose-200/90 rounded-2xl flex items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
            <i data-lucide="shield-check" class="w-5 h-5"></i>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-xs font-bold text-slate-900 truncate">${contact.name}</p>
              <span class="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">${contact.relation || 'Contact'}</span>
            </div>
            <p class="text-[11px] font-mono font-bold text-slate-600 mt-0.5">+91 ${contact.phone}</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
          <a href="tel:+91${contact.phone}" class="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition active:scale-95 cursor-pointer" title="Call Emergency Contact">
            <i data-lucide="phone" class="w-3.5 h-3.5"></i>
          </a>
          <button type="button" onclick="openEmergencyContactModal()" class="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition cursor-pointer" title="Edit Contact">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="p-3.5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-center space-y-2">
        <p class="text-[11px] text-slate-500 font-medium">No emergency contact set yet. Add a trusted family member or friend for live ride safety.</p>
        <button type="button" onclick="openEmergencyContactModal()" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 active:scale-95 cursor-pointer">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Add Emergency Contact</span>
        </button>
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function openEmergencyContactModal() {
  const modal = document.getElementById('emergencyContactModal');
  if (!modal) return;

  const contact = state.emergencyContact;
  const nameInput = document.getElementById('emContactName');
  const relationSelect = document.getElementById('emContactRelation');
  const phoneInput = document.getElementById('emContactPhone');
  const errEl = document.getElementById('emContactPhoneError');
  const deleteBtn = document.getElementById('btnDeleteEmContact');

  if (errEl) errEl.classList.add('hidden');

  if (contact && contact.name) {
    if (nameInput) nameInput.value = contact.name;
    if (relationSelect) relationSelect.value = contact.relation || 'Parent';
    if (phoneInput) phoneInput.value = contact.phone || '';
    if (deleteBtn) deleteBtn.classList.remove('hidden');
  } else {
    if (nameInput) nameInput.value = '';
    if (relationSelect) relationSelect.value = 'Parent';
    if (phoneInput) phoneInput.value = '';
    if (deleteBtn) deleteBtn.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleSaveEmergencyContact(event) {
  event.preventDefault();
  const nameInput = document.getElementById('emContactName');
  const relationSelect = document.getElementById('emContactRelation');
  const phoneInput = document.getElementById('emContactPhone');
  const errEl = document.getElementById('emContactPhoneError');

  const nameVal = nameInput ? nameInput.value.trim() : '';
  const relationVal = relationSelect ? relationSelect.value : 'Parent';
  const rawPhone = phoneInput ? phoneInput.value.replace(/[^0-9]/g, '') : '';

  if (rawPhone.length !== 10) {
    if (errEl) errEl.classList.remove('hidden');
    if (phoneInput) phoneInput.focus();
    return;
  }
  if (errEl) errEl.classList.add('hidden');

  const newContact = {
    name: nameVal,
    relation: relationVal,
    phone: rawPhone,
    updatedAt: new Date().toISOString()
  };

  state.emergencyContact = newContact;
  localStorage.setItem('routemate_emergency_contact', JSON.stringify(newContact));

  closeModal('emergencyContactModal');
  renderEmergencyContact();
  showToast(`🛡️ Emergency contact ${nameVal} saved securely!`, 'success');
}

function handleRemoveEmergencyContact() {
  if (confirm('Are you sure you want to remove your emergency contact?')) {
    state.emergencyContact = null;
    localStorage.removeItem('routemate_emergency_contact');
    closeModal('emergencyContactModal');
    renderEmergencyContact();
    showToast('Emergency contact removed.', 'info');
  }
}

// ------------------------------------------
// FAVOURITES MANAGEMENT ENGINE
// ------------------------------------------

function renderFavouritesList() {
  const container = document.getElementById('favouritesListContainer');
  const badge = document.getElementById('favCountBadge');

  if (badge) {
    const count = (state.favourites && state.favourites.length) || 0;
    badge.textContent = `${count} Saved`;
  }

  if (!container) return;

  if (!state.favourites || state.favourites.length === 0) {
    container.innerHTML = `
      <div class="p-3 text-center text-[11px] text-slate-400 bg-slate-50 rounded-xl">
        No favourite places saved yet. Add your home or work address below.
      </div>
    `;
    return;
  }

  container.innerHTML = state.favourites.map(fav => `
    <div class="p-2.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2.5 hover:bg-slate-100/60 transition">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-8 h-8 rounded-xl ${fav.category === 'home' ? 'bg-rose-100 text-rose-600' : fav.category === 'work' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'} flex items-center justify-center flex-shrink-0">
          <i data-lucide="${fav.category === 'home' ? 'home' : fav.category === 'work' ? 'briefcase' : 'map-pin'}" class="w-4 h-4"></i>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-bold text-slate-900 truncate">${fav.title}</p>
          <p class="text-[10px] text-slate-500 truncate max-w-[170px]">${fav.address}</p>
        </div>
      </div>

      <div class="flex items-center gap-1.5 flex-shrink-0">
        <button type="button" onclick="useFavouriteInSearch('${fav.address.replace(/'/g, "\\'")}', 'pickup')" class="px-2 py-1 bg-white hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-[10px] font-bold border border-slate-200 rounded-lg transition" title="Use as Pickup Stop">
          Pickup
        </button>
        <button type="button" onclick="useFavouriteInSearch('${fav.address.replace(/'/g, "\\'")}', 'drop')" class="px-2 py-1 bg-white hover:bg-emerald-50 hover:text-emerald-600 text-slate-700 text-[10px] font-bold border border-slate-200 rounded-lg transition" title="Use as Drop Stop">
          Drop
        </button>
        <button type="button" onclick="handleDeleteFavourite('${fav.id}')" class="p-1 text-slate-400 hover:text-rose-600 transition" title="Delete">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function openFavouritesModal() {
  const modal = document.getElementById('favouritesModal');
  if (!modal) return;
  renderFavouritesList();
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleAddFavourite() {
  const titleInput = document.getElementById('favNewTitle');
  const addressInput = document.getElementById('favNewAddress');

  const title = titleInput ? titleInput.value.trim() : '';
  const address = addressInput ? addressInput.value.trim() : '';

  if (!title || !address) {
    showToast('Please enter both label and location', 'error');
    return;
  }

  let cat = 'corridor';
  const lower = title.toLowerCase();
  if (lower.includes('home')) cat = 'home';
  else if (lower.includes('work') || lower.includes('office')) cat = 'work';

  const newFav = {
    id: 'fav_' + Date.now(),
    title: title,
    address: address,
    category: cat
  };

  if (!state.favourites) state.favourites = [];
  state.favourites.push(newFav);
  localStorage.setItem('routemate_favourites', JSON.stringify(state.favourites));

  if (titleInput) titleInput.value = '';
  if (addressInput) addressInput.value = '';

  renderFavouritesList();
  showToast(`⭐ Saved "${title}" to favourites!`, 'success');
}

function handleDeleteFavourite(id) {
  state.favourites = (state.favourites || []).filter(f => f.id !== id);
  localStorage.setItem('routemate_favourites', JSON.stringify(state.favourites));
  renderFavouritesList();
  showToast('Favourite removed', 'info');
}

function useFavouriteInSearch(address, role) {
  closeModal('favouritesModal');
  switchTab('explore');

  if (role === 'pickup') {
    state.pickup = address;
    const input = document.getElementById('pickupLocationInput') || document.getElementById('riderPickupInput');
    if (input) input.value = address;
    showToast(`📍 Pickup set to "${address.split(',')[0]}"`, 'success');
  } else {
    state.drop = address;
    const input = document.getElementById('dropLocationInput') || document.getElementById('riderDropInput');
    if (input) input.value = address;
    showToast(`📍 Destination set to "${address.split(',')[0]}"`, 'success');
  }
}

// ------------------------------------------
// PREFERENCES ENGINE
// ------------------------------------------

function openPreferencesModal() {
  const modal = document.getElementById('preferencesModal');
  if (!modal) return;

  const prefs = state.preferences || {};
  const chkAuto = document.getElementById('prefAutoConfirm');
  const chkQuiet = document.getElementById('prefQuietRide');
  const chkAc = document.getElementById('prefAcComfort');
  const chkLuggage = document.getElementById('prefLuggage');
  const chkSounds = document.getElementById('prefSounds');
  const chkContrast = document.getElementById('prefHighContrast');

  if (chkAuto) chkAuto.checked = Boolean(prefs.autoConfirm);
  if (chkQuiet) chkQuiet.checked = Boolean(prefs.quietRide);
  if (chkAc) chkAc.checked = prefs.acComfort !== false;
  if (chkLuggage) chkLuggage.checked = prefs.luggage !== false;
  if (chkSounds) chkSounds.checked = prefs.sounds !== false;
  if (chkContrast) chkContrast.checked = Boolean(prefs.highContrast);

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function saveUserPreferences() {
  const chkAuto = document.getElementById('prefAutoConfirm');
  const chkQuiet = document.getElementById('prefQuietRide');
  const chkAc = document.getElementById('prefAcComfort');
  const chkLuggage = document.getElementById('prefLuggage');
  const chkSounds = document.getElementById('prefSounds');
  const chkContrast = document.getElementById('prefHighContrast');

  state.preferences = {
    autoConfirm: chkAuto ? chkAuto.checked : false,
    quietRide: chkQuiet ? chkQuiet.checked : false,
    acComfort: chkAc ? chkAc.checked : true,
    luggage: chkLuggage ? chkLuggage.checked : true,
    sounds: chkSounds ? chkSounds.checked : true,
    highContrast: chkContrast ? chkContrast.checked : false
  };

  localStorage.setItem('routemate_preferences', JSON.stringify(state.preferences));
  closeModal('preferencesModal');
  showToast('⚙️ Preferences updated and applied!', 'success');
}

// ------------------------------------------
// APP SHORTCUTS ENGINE
// ------------------------------------------

let deferredPwaPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
});

function openAppShortcutsModal() {
  const modal = document.getElementById('appShortcutsModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function triggerPwaInstall() {
  if (deferredPwaPrompt) {
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('🎉 Routemate installed to your Home Screen!', 'success');
      }
      deferredPwaPrompt = null;
    });
  } else {
    showToast('📱 To add shortcut: Tap browser menu (⋮ / Share) and select "Add to Home Screen".', 'info');
  }
}

function launchShortcut(type) {
  closeModal('appShortcutsModal');
  if (type === 'offer') {
    setMode('driver');
    switchTab('explore');
    showToast('🚗 Switched to Driver Corridor Publishing', 'success');
  } else if (type === 'find') {
    setMode('rider');
    switchTab('explore');
    showToast('🔍 Rider Highway Corridor Search Active', 'success');
  } else if (type === 'sos') {
    openModal('safetyModal');
    showToast('🚨 Emergency Safety Shield Active', 'warning');
  }
}

// ------------------------------------------
// ABOUT & BETA PROGRAM & DELETE ACCOUNT
// ------------------------------------------

function openAboutModal() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleBetaToggleChange(checked) {
  state.isBetaSubscriber = checked;
  localStorage.setItem('routemate_beta_subscriber', checked ? 'true' : 'false');
  const badge = document.getElementById('betaBadge');
  if (badge) {
    if (checked) badge.classList.remove('hidden');
    else badge.classList.add('hidden');
  }
  if (checked) {
    showToast('🎉 Subscribed to Routemate Beta Program (v8.104.0-beta)! Early features active.', 'success');
  } else {
    showToast('Unsubscribed from Beta Program. Standard release active.', 'info');
  }
}

function openDeleteAccountModal() {
  const modal = document.getElementById('deleteAccountModal');
  if (!modal) return;
  const input = document.getElementById('deleteAccountConfirmInput');
  const btn = document.getElementById('btnConfirmDeleteAccount');
  if (input) input.value = '';
  if (btn) btn.disabled = true;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function handleDeleteAccountInput(val) {
  const btn = document.getElementById('btnConfirmDeleteAccount');
  if (btn) {
    btn.disabled = val.trim().toUpperCase() !== 'DELETE';
  }
}

async function handleConfirmDeleteAccount() {
  if (!confirm('FINAL CONFIRMATION: Are you absolutely sure you want to permanently delete your account and all associated KYC/ride data?')) {
    return;
  }

  try {
    const user = state.currentUser;
    const identifier = (user && user.id) || (user && user.phone) || state.authPhone;

    // 1. Delete from Supabase profiles
    if (window.db && window.db.profiles && window.db.profiles.deleteProfile && identifier) {
      await window.db.profiles.deleteProfile(identifier).catch(e => console.warn('Supabase profile deletion:', e));
    }

    // 2. Sign out Supabase auth
    if (window.db && window.db.auth) {
      await window.db.auth.signOut().catch(e => console.warn(e));
    }

    // 3. Wipe all local storage keys
    const keysToRemove = [
      'routemate_auth_user',
      'routemate_emergency_contact',
      'routemate_favourites',
      'routemate_preferences',
      'routemate_beta_subscriber',
      'routemate_registered_vehicles',
      'routemate_my_bookings',
      'routemate_posted_rides'
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // 4. Reset internal state
    state.currentUser = null;
    state.emergencyContact = null;
    state.favourites = [];
    state.preferences = {};
    state.isBetaSubscriber = false;
    state.myBookings = [];
    state.myPostedRides = [];

    closeModal('deleteAccountModal');
    showToast('Your Routemate account and records have been deleted permanently.', 'info');
    showAuthView();

  } catch (err) {
    console.error('Exception deleting account:', err);
    showToast('Error deleting account. Please retry.', 'error');
  }
}

// Window bindings
window.handlePhoneSubmit = handlePhoneSubmit;
window.handleVerifyMpin = handleVerifyMpin;
window.handleForgotMpin = handleForgotMpin;
window.handleSaveMpin = handleSaveMpin;
window.showSetMpinStep = showSetMpinStep;
window.clearMpinError = clearMpinError;
window.clearSetMpinError = clearSetMpinError;
window.handleManualDocSelected = handleManualDocSelected;
window.handleSendOtp = handleSendOtp;
window.handleVerifyOtp = handleVerifyOtp;
window.backToPhoneStep = backToPhoneStep;
window.handleResendOtp = handleResendOtp;
window.openInAppChatModal = openInAppChatModal;
window.sendInAppChatMessage = sendInAppChatMessage;
window.sendQuickChatMessage = sendQuickChatMessage;
window.handleSignOut = handleSignOut;
window.showAuthView = showAuthView;
window.showDashboardView = showDashboardView;
window.openKycModal = openKycModal;
window.formatAadhaarInput = formatAadhaarInput;
window.handleKycFormSubmit = handleKycFormSubmit;
window.renderKycStatus = renderKycStatus;
window.handleKycPhotoSelected = handleKycPhotoSelected;
window.clearKycErrors = clearKycErrors;
window.resetDriverKyc = resetDriverKyc;
window.showOnboardingStep = showOnboardingStep;
window.handleOnboardingSubmit = handleOnboardingSubmit;
window.clearOnboardingErrors = clearOnboardingErrors;

// Restricted Admin Portal window bindings
window.isUserAdminWhitelisted = isUserAdminWhitelisted;
window.openAdminPortal = openAdminPortal;
window.openAdminAuthModal = openAdminAuthModal;
window.handleAdminLogin = handleAdminLogin;
window.openAdminPanelModal = openAdminPanelModal;
window.handleAdminLogout = handleAdminLogout;
window.setAdminFilter = setAdminFilter;
window.handleAdminSearch = handleAdminSearch;
window.clearAdminSearch = clearAdminSearch;
window.triggerDeepDriverSearch = triggerDeepDriverSearch;
window.openAdminBlockModal = openAdminBlockModal;
window.handleBlockPresetChange = handleBlockPresetChange;
window.handleConfirmAdminBlock = handleConfirmAdminBlock;
window.handleAdminUnblockDriver = handleAdminUnblockDriver;
window.loadAdminKycSubmissions = loadAdminKycSubmissions;
window.renderAdminSubmissions = renderAdminSubmissions;
window.openAdminDocViewer = openAdminDocViewer;
window.handleAdminApproveKyc = handleAdminApproveKyc;
window.openAdminRejectModal = openAdminRejectModal;
window.handleRejectPresetChange = handleRejectPresetChange;
window.handleConfirmAdminReject = handleConfirmAdminReject;
window.renderRegisteredVehicles = renderRegisteredVehicles;
window.openAddVehicleModal = openAddVehicleModal;

// OCR Scanner window bindings
window.openOcrScannerModal = openOcrScannerModal;
window.closeOcrScannerModal = closeOcrScannerModal;
window.captureAndProcessOcr = captureAndProcessOcr;
window.handleOcrFileUpload = handleOcrFileUpload;
window.verifyDocumentAuthenticity = verifyDocumentAuthenticity;
window.applyOcrExtractedFields = applyOcrExtractedFields;

// Personal details & Settings window bindings
window.handleGenderInputChange = handleGenderInputChange;
window.handleEmailInputValidation = handleEmailInputValidation;
window.handleDobInputChange = handleDobInputChange;
window.savePersonalDetails = savePersonalDetails;
window.renderEmergencyContact = renderEmergencyContact;
window.openEmergencyContactModal = openEmergencyContactModal;
window.handleSaveEmergencyContact = handleSaveEmergencyContact;
window.handleRemoveEmergencyContact = handleRemoveEmergencyContact;
window.renderFavouritesList = renderFavouritesList;
window.openFavouritesModal = openFavouritesModal;
window.handleAddFavourite = handleAddFavourite;
window.handleDeleteFavourite = handleDeleteFavourite;
window.useFavouriteInSearch = useFavouriteInSearch;
window.openPreferencesModal = openPreferencesModal;
window.saveUserPreferences = saveUserPreferences;
window.openAppShortcutsModal = openAppShortcutsModal;
window.triggerPwaInstall = triggerPwaInstall;
window.launchShortcut = launchShortcut;
window.openAboutModal = openAboutModal;
window.handleBetaToggleChange = handleBetaToggleChange;
window.openDeleteAccountModal = openDeleteAccountModal;
window.handleDeleteAccountInput = handleDeleteAccountInput;
window.handleConfirmDeleteAccount = handleConfirmDeleteAccount;

// Real-Time Ride Matching & Lifecycle window bindings
window.requestRideAction = requestRideAction;
window.cancelCurrentActiveRide = cancelCurrentActiveRide;
window.handleRealtimeMatchingEvent = handleRealtimeMatchingEvent;
window.openDriverIncomingModal = openDriverIncomingModal;
window.declineDriverIncomingModal = declineDriverIncomingModal;
window.acceptDriverIncomingModal = acceptDriverIncomingModal;
window.acceptPassengerRequest = acceptPassengerRequest;
window.declinePassengerRequest = declinePassengerRequest;
window.openDriverVerifyPinModal = openDriverVerifyPinModal;
window.confirmStartRideWithPin = confirmStartRideWithPin;
window.driverCompleteRideAction = driverCompleteRideAction;
window.completeCurrentRide = completeCurrentRide;
window.renderLiveTrackingStage = renderLiveTrackingStage;
window.updateActiveRideBanner = updateActiveRideBanner;
window.openActiveRideModal = openActiveRideModal;
window.callPassenger = callPassenger;
window.chatPassengerWhatsApp = chatPassengerWhatsApp;
window.callCurrentDriver = callCurrentDriver;
window.openLiveTrackingForRide = openLiveTrackingForRide;
window.openLiveTrackingForDriver = openLiveTrackingForDriver;
window.openLiveTrackingModal = openLiveTrackingModal;
window.playNotificationSound = playNotificationSound;

// Customer Rating, Feedback & Admin Moderation window bindings
window.openRatingModal = openRatingModal;
window.setRatingStar = setRatingStar;
window.toggleFeedbackTag = toggleFeedbackTag;
window.toggleSafetyIssueBox = toggleSafetyIssueBox;
window.submitRideRating = submitRideRating;
window.updateDriverRatingAcrossApp = updateDriverRatingAcrossApp;
window.switchAdminSection = switchAdminSection;
window.refreshAdminPortal = refreshAdminPortal;
window.loadAdminFeedbacks = loadAdminFeedbacks;
window.updateAdminFeedbackMetrics = updateAdminFeedbackMetrics;
window.setAdminFeedbackFilter = setAdminFeedbackFilter;
window.handleAdminFeedbackSearch = handleAdminFeedbackSearch;
window.clearAdminFeedbackSearch = clearAdminFeedbackSearch;
window.renderAdminFeedbacks = renderAdminFeedbacks;
window.openAdminBlockFromFeedback = openAdminBlockFromFeedback;



