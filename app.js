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
  mode: 'rider', // 'rider' | 'driver'
  activeTab: 'explore', // 'explore' | 'myrides' | 'profile'
  vehicleType: 'bike', // 'bike' | 'car'
  pickup: 'Uppal, Hyderabad',
  drop: 'Jangaon',
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
  registeredVehicles: [
    {
      id: 1,
      type: 'bike',
      name: 'Honda CB Hornet 160R',
      plate: 'TS 08 HG 8421',
      isPrimary: true,
      rcVerified: true
    }
  ],
  driverOnline: true,
  driverPayPreference: 'either', // 'upi' | 'cash' | 'either'
  activeDriverTrip: null,
  incomingRequest: {
    id: 'REQ-9102',
    name: 'Ananya Verma',
    role: 'TCS Adibatla Commuter',
    rating: 4.9,
    totalCommutes: 14,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    pickup: 'Uppal Ring Road Metro (Gate 2)',
    drop: 'Jangaon Chowrasta',
    time: 'Ready in 10 mins (06:45 PM)',
    distance: 84,
    seatCount: 1,
    fareOffer: 108,
    paymentMethod: 'Direct UPI',
    pin: '4821',
    phone: '+91 98480 23145'
  }
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
  const carCalc = calculateFuelShare(state.distance, 'car');

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
  const carCardPrice = document.getElementById('carCardCost');
  if (bikeCardPrice) bikeCardPrice.textContent = `₹${bikeCalc.perSeat}`;
  if (carCardPrice) carCardPrice.textContent = `₹${carCalc.perSeat}`;

  // Vehicle Selection Card Highlight
  const bikeCard = document.getElementById('vehicleCardBike');
  const carCard = document.getElementById('vehicleCardCar');
  if (bikeCard && carCard) {
    if (state.vehicleType === 'bike') {
      bikeCard.classList.add('selected');
      carCard.classList.remove('selected');
    } else {
      carCard.classList.add('selected');
      bikeCard.classList.remove('selected');
    }
  }

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
            <i data-lucide="${ride.vehicleType === 'bike' ? 'bike' : 'car'}" class="w-3.5 h-3.5 text-slate-400"></i>
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
    showToast('Driver Mode active. Live corridor listening enabled.', 'info');
  }
}

// Vehicle Selection Handler (Bike / Car)
function selectVehicle(type) {
  state.vehicleType = type;
  updateUI();
  syncDriverVehicleCards(type);
  showToast(`Showing ${type === 'bike' ? 'Bikes (1 Rider Seat)' : 'Cars (Multi-Passenger)'}`, 'info');
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

      <!-- Cost Breakdown -->
      <div class="mt-4 bg-blue-50/70 rounded-2xl p-4 border border-blue-100">
        <div class="flex items-center justify-between text-xs text-slate-600 mb-1">
          <span>Fuel Contribution (${state.distance} km)</span>
          <span class="font-semibold text-slate-900">₹${ride.perSeatPrice}</span>
        </div>
        <div class="flex items-center justify-between text-xs text-slate-600 mb-2">
          <span>Routemate Platform Fee</span>
          <span class="font-bold text-emerald-600">₹0 (Free P2P)</span>
        </div>
        <div class="pt-2 border-t border-blue-200/70 flex items-center justify-between">
          <span class="text-sm font-bold text-slate-900">Total Contribution</span>
          <span class="text-lg font-black text-blue-700">₹${ride.perSeatPrice}</span>
        </div>
      </div>

      <!-- Payment Method -->
      <div class="mt-4">
        <label class="block text-xs font-bold text-slate-700 mb-2">Select Payment Method:</label>
        <div class="space-y-2 text-xs">
          <!-- Option 1: Razorpay Instant Online Pay (UPI, Cards, Netbanking) -->
          <label class="flex items-center justify-between p-3 border-2 border-blue-600 bg-blue-50/70 rounded-2xl cursor-pointer transition hover:bg-blue-50/90 shadow-xs">
            <div class="flex items-center gap-2.5">
              <input type="radio" name="payMethod" value="razorpay" checked class="text-blue-600 w-4 h-4" />
              <div>
                <div class="flex items-center gap-1.5">
                  <p class="font-extrabold text-slate-900">Razorpay Instant Pay</p>
                  <span class="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider">Fast & Secure</span>
                </div>
                <p class="text-[11px] text-slate-500 mt-0.5">UPI (GPay / PhonePe / Paytm), Debit/Credit Cards</p>
              </div>
            </div>
            <div class="text-right">
              <span class="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">0% Fee</span>
            </div>
          </label>

          <!-- Option 2: Direct UPI to Driver -->
          <label class="flex items-center justify-between p-3 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
            <div class="flex items-center gap-2.5">
              <input type="radio" name="payMethod" value="upi" class="text-blue-600 w-4 h-4" />
              <div>
                <p class="font-bold text-slate-900">Direct Driver UPI</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Scan driver's personal QR code upon boarding</p>
              </div>
            </div>
            <span class="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">P2P Scan</span>
          </label>

          <!-- Option 3: Cash on Board -->
          <label class="flex items-center justify-between p-3 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition">
            <div class="flex items-center gap-2.5">
              <input type="radio" name="payMethod" value="cash" class="text-blue-600 w-4 h-4" />
              <div>
                <p class="font-bold text-slate-900">Cash on Board</p>
                <p class="text-[11px] text-slate-500 mt-0.5">Hand physical cash to driver inside vehicle</p>
              </div>
            </div>
            <span class="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">Hand-to-Hand</span>
          </label>
        </div>
      </div>

      <!-- Action Button -->
      <div class="mt-6 flex items-center gap-3">
        <button onclick="closeModal('bookingModal')" class="w-1/3 py-3.5 border border-slate-200 hover:bg-slate-50 rounded-2xl text-xs font-bold text-slate-600">
          Cancel
        </button>
        <button onclick="confirmBooking(${ride.id})" class="w-2/3 py-3.5 gradient-brand text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          <span>Pay & Confirm Seat (₹${ride.perSeatPrice})</span>
        </button>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

// Confirm Booking logic with Razorpay Gateway Integration
function confirmBooking(rideId) {
  const ride = availableRides.find(r => r.id === rideId);
  if (!ride) return;

  const selectedMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'razorpay';

  // 1. If Razorpay is chosen, launch the Razorpay Checkout gateway
  if (selectedMethod === 'razorpay' && window.routematePayment) {
    window.routematePayment.initiatePayment(
      ride,
      // On Payment Success
      function onPaymentSuccess(paymentData) {
        processSuccessfulBooking(ride, {
          method: 'razorpay',
          label: 'Paid via Razorpay',
          paymentId: paymentData.paymentId,
          isPaid: true
        });
      },
      // On Payment Cancel / Error
      function onPaymentError(err) {
        showToast(err.message || 'Payment was not completed', 'info');
      }
    );
    return;
  }

  // 2. Direct UPI or Cash
  const isUpi = (selectedMethod === 'upi');
  processSuccessfulBooking(ride, {
    method: selectedMethod,
    label: isUpi ? 'Direct UPI upon boarding' : 'Cash inside vehicle',
    paymentId: null,
    isPaid: false
  });
}

// Helper to record successful booking across local state & Supabase
function processSuccessfulBooking(ride, paymentInfo) {
  ride.seatsAvailable = Math.max(0, ride.seatsAvailable - 1);
  const bookingPin = Math.floor(1000 + Math.random() * 9000).toString();
  const bookingId = `RM-${Math.floor(1000 + Math.random() * 9000)}`;

  // Add to user bookings state
  state.myBookings.unshift({
    id: bookingId,
    driver: ride.driverName,
    vehicle: `${ride.vehicleName} (${ride.vehicleNumber})`,
    route: `${ride.pickup} ➔ ${ride.drop || ride.drop_location}`,
    time: ride.departureTime,
    seats: 1,
    fare: ride.perSeatPrice,
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
      seats: 1,
      fare: ride.perSeatPrice,
      paymentMethod: paymentInfo.method,
      pin: bookingPin
    }).then(res => {
      if (res && res.success) {
        console.log('✅ Booking successfully stored in Supabase with method:', paymentInfo.method);
      }
    }).catch(err => console.warn('Supabase booking sync warning:', err));
  }

  showToast(`Seat Confirmed! ${paymentInfo.isPaid ? 'Payment Received via Razorpay' : 'Pay on boarding'}`, 'success');
  openTicketModal(ride, paymentInfo, bookingId, bookingPin);
}

// Open Booking Ticket confirmation modal
function openTicketModal(ride, paymentInfo = {}, bookingId = null, pin = null) {
  const modal = document.getElementById('ticketModal');
  const content = document.getElementById('ticketModalContent');
  const bid = bookingId || `RM-${Math.floor(1000 + Math.random() * 9000)}`;
  const ticketPin = pin || '4821';
  const isRazorpay = paymentInfo.method === 'razorpay';

  content.innerHTML = `
    <div class="p-6 text-center">
      <div class="w-14 h-14 ${isRazorpay ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'} rounded-full flex items-center justify-center mx-auto mb-3">
        <i data-lucide="${isRazorpay ? 'check-check' : 'check'}" class="w-7 h-7 stroke-[3]"></i>
      </div>
      <h3 class="text-lg font-extrabold text-slate-900">${isRazorpay ? 'Payment & Seat Confirmed!' : 'Seat Reserved!'}</h3>
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
          <span class="text-slate-500">Pickup</span>
          <span class="font-semibold text-slate-800">${ride.pickup}</span>
        </div>
        <div class="flex justify-between items-center pb-2 border-b border-slate-200">
          <span class="text-slate-500">Departure</span>
          <span class="font-bold text-emerald-600">${ride.departureTime}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-slate-500">Fare Split</span>
          <div class="text-right">
            <span class="text-sm font-black text-slate-900">₹${ride.perSeatPrice}</span>
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
              <p class="text-[11px] text-slate-600">Please keep exact change of ₹${ride.perSeatPrice} ready upon boarding.</p>
            </div>
          </div>
        </div>
      ` : `
        <!-- Driver Direct Payment QR Simulation -->
        <div class="mt-3.5 p-3.5 bg-purple-50/90 rounded-2xl border border-purple-200 flex items-center gap-3 text-left">
          <div class="w-16 h-16 bg-white p-1 rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 border border-purple-200">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&data=${encodeURIComponent('upi://pay?pa=' + ride.driverName.toLowerCase().replace(/[^a-z]/g, '') + '@oksbi&pn=' + encodeURIComponent(ride.driverName) + '&am=' + ride.perSeatPrice + '&cu=INR')}" alt="UPI QR" class="w-full h-full object-contain rounded" />
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

      <!-- Quick Actions: Call & WhatsApp Share -->
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <button onclick="showToast('Calling driver ' + '${ride.driverName}' + ' (+91 98480 23145)...', 'info')" class="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition flex items-center justify-center gap-1.5">
          <i data-lucide="phone" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Call Driver</span>
        </button>
        <button onclick="shareTripWithFamily()" class="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition flex items-center justify-center gap-1.5">
          <i data-lucide="share-2" class="w-3.5 h-3.5 text-emerald-600"></i>
          <span>Share Trip</span>
        </button>
      </div>

      <div class="mt-4 flex gap-2">
        <button onclick="closeModal('ticketModal'); switchTab('myrides');" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition shadow-sm">
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

// Render Incoming Request Card or Active Trip in Driver Mode
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
    lucide.createIcons();
    return;
  }

  // Active Accepted Trip Dashboard
  if (state.activeDriverTrip) {
    const trip = state.activeDriverTrip;
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-5 border-2 border-emerald-500 shadow-lg relative overflow-hidden animate-in fade-in duration-200">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse"></span>
            <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Ride Active • In Progress</span>
          </div>
          <span class="text-xs font-mono font-bold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg">
            PIN: ${trip.pin}
          </span>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img src="${trip.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-emerald-500 shadow-sm" />
            <div>
              <h4 class="font-bold text-slate-900 text-sm">${trip.name}</h4>
              <p class="text-xs text-slate-500">${trip.role}</p>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-400">Receiving</p>
            <p class="text-xl font-black text-emerald-600">₹${trip.fareOffer}</p>
          </div>
        </div>

        <div class="mt-3.5 bg-slate-50 rounded-2xl p-3.5 border border-slate-100 space-y-2 text-xs">
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 mt-1 flex-shrink-0"></span>
            <p class="font-medium text-slate-800"><strong class="text-slate-900">Pickup:</strong> ${trip.pickup}</p>
          </div>
          <div class="flex items-start gap-2">
            <span class="w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0"></span>
            <p class="font-medium text-slate-800"><strong class="text-slate-900">Drop:</strong> ${trip.drop}</p>
          </div>
        </div>

        <!-- Contact & Actions -->
        <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
          <button onclick="callPassenger()" class="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl flex items-center justify-center gap-1.5 transition">
            <i data-lucide="phone" class="w-4 h-4 text-blue-600"></i>
            <span>Call Passenger</span>
          </button>
          <button onclick="chatPassengerWhatsApp()" class="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 flex items-center justify-center gap-1.5 transition">
            <i data-lucide="message-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>WhatsApp Chat</span>
          </button>
        </div>

        <!-- Complete Ride Action -->
        <button onclick="completeCurrentRide()" class="mt-3 w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2">
          <i data-lucide="check-check" class="w-4 h-4 stroke-[3]"></i>
          <span>Complete Commute & Settle ₹${trip.fareOffer}</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  // Active Incoming Passenger Request Card
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
          <img src="${req.avatar}" class="w-12 h-12 rounded-full object-cover border-2 border-blue-600 shadow-xs" />
          <div>
            <div class="flex items-center gap-1.5">
              <h4 class="font-bold text-slate-900 text-sm">${req.name}</h4>
              <span class="text-[11px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">★ ${req.rating}</span>
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5">${req.role} • ${req.totalCommutes} rides</p>
          </div>
        </div>

        <div class="text-right">
          <div class="flex items-baseline justify-end gap-0.5">
            <span class="text-xs font-semibold text-slate-400">₹</span>
            <span class="text-2xl font-black text-blue-700">${req.fareOffer}</span>
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
            <p class="font-bold text-slate-900">${req.drop} (${req.distance} km)</p>
          </div>
        </div>
        <div class="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
          <span class="font-semibold text-slate-800">${req.time}</span>
          <span class="font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">${req.paymentMethod}</span>
        </div>
      </div>

      <!-- Action Buttons: Accept Ride -->
      <div class="mt-4 grid grid-cols-3 gap-2.5">
        <button onclick="declinePassengerRequest()" class="py-3.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl text-xs font-bold transition active:scale-95">
          Decline
        </button>
        <button onclick="acceptPassengerRequest()" class="col-span-2 py-3.5 gradient-brand text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-500/25 active:scale-95 transition-all flex items-center justify-center gap-2">
          <i data-lucide="check-circle" class="w-4 h-4"></i>
          <span>Accept Ride (₹${req.fareOffer})</span>
        </button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

// Accept Passenger Request Action
function acceptPassengerRequest() {
  state.activeDriverTrip = state.incomingRequest;
  showToast(`Ride Accepted! Navigating to ${state.incomingRequest.pickup}`, 'success');
  renderDriverIncomingRequest();

  // Persist accepted incoming request to Supabase bookings
  if (window.db && window.db.bookings && state.incomingRequest) {
    window.db.bookings.create({
      rideId: state.incomingRequest.id,
      riderName: state.incomingRequest.name,
      riderPhone: state.incomingRequest.phone,
      seats: state.incomingRequest.seatCount || 1,
      fare: state.incomingRequest.fareOffer || 108,
      paymentMethod: state.incomingRequest.paymentMethod === 'Direct UPI' ? 'upi' : 'cash',
      pin: state.incomingRequest.pin
    }).catch(e => console.warn('Supabase booking sync warning:', e));
  }
}

// Decline Passenger Request Action
function declinePassengerRequest() {
  showToast('Request declined. Waiting for next commuter request...', 'info');
  state.incomingRequest = {
    id: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
    name: 'Karthik Rao',
    role: 'Tech Mahindra Commuter',
    rating: 4.8,
    totalCommutes: 9,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    pickup: 'Uppal X Roads (Beside HP Petrol Bunk)',
    drop: 'Jangaon Railway Station',
    time: 'Ready in 5 mins (06:40 PM)',
    distance: 84,
    seatCount: 1,
    fareOffer: 108,
    paymentMethod: 'Direct UPI',
    pin: `${Math.floor(1000 + Math.random() * 9000)}`,
    phone: '+91 98765 43210'
  };
  renderDriverIncomingRequest();
}

// Complete Current Active Commute
function completeCurrentRide() {
  const fare = state.activeDriverTrip ? state.activeDriverTrip.fareOffer : 108;
  state.activeDriverTrip = null;
  showToast(`Commute completed! ₹${fare} fuel contribution settled via Direct UPI.`, 'success');
  renderDriverIncomingRequest();
}

function callPassenger() {
  const phone = state.activeDriverTrip ? state.activeDriverTrip.phone : '+91 98480 23145';
  showToast(`Calling passenger at ${phone}...`, 'info');
}

function chatPassengerWhatsApp() {
  showToast('Opening WhatsApp chat with passenger...', 'success');
  window.open('https://api.whatsapp.com/send?text=Hi%20there,%20I%20am%20your%20Routemate%20driver.%20Arriving%20at%20pickup%20point.', '_blank');
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

  // Hide all screens
  mainView.classList.add('hidden');
  myRidesView.classList.add('hidden');
  profileView.classList.add('hidden');

  if (tabName === 'explore') {
    mainView.classList.remove('hidden');
  } else if (tabName === 'myrides') {
    renderMyRides();
    myRidesView.classList.remove('hidden');
  } else if (tabName === 'profile') {
    profileView.classList.remove('hidden');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (modal) modal.classList.add('hidden');
}



// Render Registered Vehicles in Profile Tab
function renderRegisteredVehicles() {
  const container = document.getElementById('registeredVehiclesContainer');
  if (!container) return;

  if (state.registeredVehicles.length === 0) {
    container.innerHTML = `
      <p class="text-xs text-slate-400 text-center py-3">No vehicles added yet.</p>
    `;
    return;
  }

  container.innerHTML = state.registeredVehicles.map(veh => `
    <div class="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl ${veh.type === 'bike' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'} flex items-center justify-center">
          <i data-lucide="${veh.type === 'bike' ? 'bike' : 'car'}" class="w-5 h-5"></i>
        </div>
        <div>
          <p class="text-xs font-bold text-slate-900">${veh.name}</p>
          <p class="text-[11px] font-mono text-slate-500">${veh.plate} • RC Active</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        ${veh.isPrimary ? `
          <span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Primary</span>
        ` : `
          <button onclick="setPrimaryVehicle(${veh.id})" class="text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition">Make Primary</button>
        `}
      </div>
    </div>
  `).join('');

  lucide.createIcons();
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
  lucide.createIcons();

  // Load from Supabase Database
  syncRidesFromDatabase();
});
