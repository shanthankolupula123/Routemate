// Routemate - Google Maps JavaScript API Integration
// API Key: AIzaSyCpZp3uUEEPF5ZJeVuuQRSGZxBDIgPuMqA

const MAPS_CONFIG = {
  apiKey: 'AIzaSyCpZp3uUEEPF5ZJeVuuQRSGZxBDIgPuMqA',
  defaultCenter: { lat: 17.5500, lng: 78.8500 }, // Midpoint between Uppal & Jangaon (NH 163)
  defaultZoom: 10
};

// Global map instances
let gMap = null;
let gDirectionsService = null;
let gDirectionsRenderer = null;
let gTrafficLayer = null;
let gTrafficActive = false;
let gPickupAutocomplete = null;
let gDropAutocomplete = null;

// Clean startup blue map styling
const ROUTEMATE_MAP_STYLES = [
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#e9eef8' }, { lightness: 17 }]
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f5f7fb' }, { lightness: 20 }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [{ color: '#cbd5e1' }, { lightness: 17 }]
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#94a3b8' }, { lightness: 29 }, { weight: 0.2 }]
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }, { lightness: 18 }]
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }, { lightness: 16 }]
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#f1f5f9' }, { lightness: 21 }]
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#e2e8f0' }, { lightness: 21 }]
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ visibility: 'on' }, { color: '#ffffff' }, { lightness: 16 }]
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ saturation: 36 }, { color: '#334155' }, { lightness: 20 }]
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }, { lightness: 17 }, { weight: 1.2 }]
  }
];

// Callback called automatically by Google Maps script
function initGoogleMap() {
  const mapElement = document.getElementById('googleMapContainer');
  if (!mapElement) {
    console.warn('Map container #googleMapContainer not found yet.');
    return;
  }

  try {
    // 1. Initialize Map
    gMap = new google.maps.Map(mapElement, {
      center: MAPS_CONFIG.defaultCenter,
      zoom: MAPS_CONFIG.defaultZoom,
      styles: ROUTEMATE_MAP_STYLES,
      disableDefaultUI: true,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_BOTTOM
      },
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });

    // 2. Initialize Directions Service & Renderer
    gDirectionsService = new google.maps.DirectionsService();
    gDirectionsRenderer = new google.maps.DirectionsRenderer({
      map: gMap,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: '#2563EB', // Startup Blue
        strokeWeight: 5,
        strokeOpacity: 0.85
      }
    });

    // 3. Traffic Layer
    gTrafficLayer = new google.maps.TrafficLayer();

    // 4. Attach Google Places Autocomplete if available
    attachPlacesAutocomplete();

    // 5. Render default corridor route (Uppal ➔ Jangaon)
    const pickupVal = document.getElementById('inputPickup')?.value || 'Uppal, Hyderabad';
    const dropVal = document.getElementById('inputDrop')?.value || 'Jangaon';
    updateRouteOnMap(pickupVal, dropVal);

    // 6. Direct click on Live Map to set destination with exact address
    gMap.addListener('click', async (e) => {
      if (e && e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        if (typeof showToast === 'function') {
          showToast('Resolving clicked map location...', 'info');
        }
        const resolved = await reverseGeocodeLatLng(lat, lng);
        if (resolved) {
          selectTelanganaLocation(resolved, false);
        }
      }
    });

    console.log('✅ Google Maps successfully initialized with API Key!');
  } catch (err) {
    console.error('Error in initGoogleMap:', err);
    displayMapFallback(err.message);
  }
}

// Attach Places Autocomplete & Universal Telangana Auto-Suggest to Pickup & Drop inputs
function attachPlacesAutocomplete() {
  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');

  // Telangana LatLng Bounds (SW: 15.80, 77.20 -> NE: 19.90, 81.80)
  const telanganaBounds = (window.google && google.maps && google.maps.LatLngBounds) ? new google.maps.LatLngBounds(
    new google.maps.LatLng(15.80, 77.20),
    new google.maps.LatLng(19.90, 81.80)
  ) : null;

  const options = {
    componentRestrictions: { country: 'in' },
    fields: ['address_components', 'geometry', 'name', 'formatted_address', 'vicinity'],
    bounds: telanganaBounds,
    strictBounds: false
  };

  if (pickupInput && window.google && google.maps && google.maps.places) {
    try {
      gPickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
      gPickupAutocomplete.addListener('place_changed', () => {
        const place = gPickupAutocomplete.getPlace();
        if (place) {
          let fullLocation = place.formatted_address || place.name || '';
          if (place.name && place.formatted_address && !place.formatted_address.toLowerCase().includes(place.name.toLowerCase())) {
            fullLocation = `${place.name}, ${place.formatted_address}`;
          }
          pickupInput.value = fullLocation;
          if (typeof state !== 'undefined') {
            state.pickup = fullLocation;
            if (typeof estimateDistance === 'function') {
              state.distance = estimateDistance(state.pickup, state.drop);
              if (typeof updateUI === 'function') updateUI();
            }
          }
          const currentDrop = document.getElementById('inputDrop')?.value || (typeof state !== 'undefined' ? state.drop : 'Jangaon');
          updateRouteOnMap(fullLocation, currentDrop);
        }
      });
    } catch (e) {
      console.warn('Google autocomplete pickup setup skipped:', e);
    }
  }

  if (dropInput && window.google && google.maps && google.maps.places) {
    try {
      gDropAutocomplete = new google.maps.places.Autocomplete(dropInput, options);
      gDropAutocomplete.addListener('place_changed', () => {
        const place = gDropAutocomplete.getPlace();
        if (place) {
          let fullLocation = place.formatted_address || place.name || '';
          if (place.name && place.formatted_address && !place.formatted_address.toLowerCase().includes(place.name.toLowerCase())) {
            fullLocation = `${place.name}, ${place.formatted_address}`;
          }
          dropInput.value = fullLocation;
          if (typeof state !== 'undefined') {
            state.drop = fullLocation;
            if (typeof estimateDistance === 'function') {
              state.distance = estimateDistance(state.pickup, state.drop);
              if (typeof updateUI === 'function') updateUI();
            }
          }
          const currentPickup = document.getElementById('inputPickup')?.value || (typeof state !== 'undefined' ? state.pickup : 'Uppal, Hyderabad');
          updateRouteOnMap(currentPickup, fullLocation);
        }
      });
    } catch (e) {
      console.warn('Google autocomplete drop setup skipped:', e);
    }
  }

  // Attach Rapido-Style Universal Real-Time Search across Telangana
  if (pickupInput) attachTelanganaSearchSuggest(pickupInput, true);
  if (dropInput) attachTelanganaSearchSuggest(dropInput, false);
}

// Universal Telangana Search & Geocoding Suggestion Engine (Rapido / Uber Style)
function attachTelanganaSearchSuggest(inputEl, isPickup) {
  if (!inputEl) return;

  const wrapper = inputEl.closest('.relative') || inputEl.parentElement;
  if (!wrapper) return;

  let suggestBox = document.getElementById(isPickup ? 'pickupSuggestBox' : 'dropSuggestBox');
  if (!suggestBox) {
    suggestBox = document.createElement('div');
    suggestBox.id = isPickup ? 'pickupSuggestBox' : 'dropSuggestBox';
    suggestBox.className = 'hidden absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xl z-50 overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100 text-left';
    wrapper.appendChild(suggestBox);
  }

  let debounceTimer = null;

  inputEl.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (debounceTimer) clearTimeout(debounceTimer);

    if (query.length < 2) {
      suggestBox.innerHTML = '';
      suggestBox.classList.add('hidden');
      return;
    }

    debounceTimer = setTimeout(() => {
      fetchTelanganaPredictions(query, suggestBox, inputEl, isPickup);
    }, 220);
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      suggestBox.classList.add('hidden');
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) {
      suggestBox.classList.add('hidden');
    }
  });
}

// Fetch predictions combining Google Places & Telangana OSM Geocoding
async function fetchTelanganaPredictions(query, container, inputEl, isPickup) {
  const suggestions = [];

  // 1. Google Places AutocompleteService
  if (window.google && google.maps && google.maps.places && google.maps.places.AutocompleteService) {
    try {
      const service = new google.maps.places.AutocompleteService();
      const googlePreds = await new Promise((resolve) => {
        service.getPlacePredictions(
          {
            input: query,
            componentRestrictions: { country: 'in' },
            locationBias: {
              center: { lat: 17.5500, lng: 78.8500 },
              radius: 120000 // 120 km around Telangana hub
            }
          },
          (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else {
              resolve([]);
            }
          }
        );
      });

      googlePreds.slice(0, 5).forEach(p => {
        suggestions.push({
          title: p.structured_formatting ? p.structured_formatting.main_text : p.description.split(',')[0],
          subtitle: p.structured_formatting ? p.structured_formatting.secondary_text : p.description,
          fullText: p.description
        });
      });
    } catch (e) {}
  }

  // 2. High-speed OpenStreetMap Telangana Geocoding (Photon / Nominatim)
  if (suggestions.length < 4) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Telangana')}&format=jsonv2&countrycodes=in&viewbox=77.2,19.9,81.8,15.8&bounded=0&limit=5`;
      const res = await fetch(geoUrl, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const osmData = await res.json();
        osmData.forEach(item => {
          const parts = (item.display_name || '').split(',').map(s => s.trim());
          const mainTitle = parts[0] || item.name || query;
          const subTitle = parts.slice(1, 4).join(', ');
          const fullAddress = (item.display_name || '').replace(/, India$/, '').trim();
          if (!suggestions.some(s => s.fullText.toLowerCase() === fullAddress.toLowerCase())) {
            suggestions.push({
              title: mainTitle,
              subtitle: subTitle || 'Telangana, India',
              fullText: fullAddress
            });
          }
        });
      }
    } catch (e) {}
  }

  const mapOptionHtml = `
    <button type="button" onclick="openSelectOnMapModal(${isPickup})" class="w-full text-left p-2.5 bg-blue-50/80 hover:bg-blue-100/90 border-b border-blue-100 transition flex items-center gap-2.5 text-blue-900 font-bold text-xs cursor-pointer group">
      <div class="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition shadow-xs">
        <i data-lucide="map" class="w-3.5 h-3.5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <span class="block text-xs font-bold text-blue-700">Select on Map</span>
        <span class="block text-[10px] text-blue-600/80 truncate">Pinpoint exact house number, street, or landmark</span>
      </div>
      <i data-lucide="chevron-right" class="w-4 h-4 text-blue-400"></i>
    </button>
  `;

  if (suggestions.length === 0) {
    container.innerHTML = `
      ${mapOptionHtml}
      <div class="p-3 text-center text-xs text-slate-500">
        <p class="font-medium">No direct address match for "${query}"</p>
        <button type="button" class="mt-1 text-blue-600 font-bold hover:underline" onclick="selectTelanganaLocation('${query.replace(/'/g, "\\'")}', ${isPickup})">Use "${query}" anyway</button>
      </div>
    `;
    container.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = mapOptionHtml + suggestions.map(s => `
    <button type="button" onclick="selectTelanganaLocation('${s.fullText.replace(/'/g, "\\'")}', ${isPickup})" class="w-full text-left p-3 hover:bg-blue-50/70 transition flex items-center gap-3 group cursor-pointer">
      <div class="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center flex-shrink-0 transition">
        <i data-lucide="map-pin" class="w-3.5 h-3.5"></i>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate">${s.title}</p>
        <p class="text-[10px] text-slate-500 truncate">${s.subtitle}</p>
      </div>
      <i data-lucide="arrow-up-right" class="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition flex-shrink-0"></i>
    </button>
  `).join('');

  container.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function selectTelanganaLocation(fullLocation, isPickup) {
  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');
  const suggestBox = document.getElementById(isPickup ? 'pickupSuggestBox' : 'dropSuggestBox');
  if (suggestBox) suggestBox.classList.add('hidden');

  const exactAddress = String(fullLocation || '').trim();

  if (isPickup) {
    if (pickupInput) pickupInput.value = exactAddress;
    if (typeof state !== 'undefined') {
      state.pickup = exactAddress;
      if (typeof estimateDistance === 'function') {
        state.distance = estimateDistance(state.pickup, state.drop);
      }
      if (typeof updateUI === 'function') updateUI();
    }
    const currentDrop = (dropInput && dropInput.value) || (typeof state !== 'undefined' ? state.drop : 'Jangaon');
    updateRouteOnMap(exactAddress, currentDrop);
  } else {
    if (dropInput) dropInput.value = exactAddress;
    if (typeof state !== 'undefined') {
      state.drop = exactAddress;
      if (typeof estimateDistance === 'function') {
        state.distance = estimateDistance(state.pickup, state.drop);
      }
      if (typeof updateUI === 'function') updateUI();
    }
    const currentPickup = (pickupInput && pickupInput.value) || (typeof state !== 'undefined' ? state.pickup : 'Uppal, Hyderabad');
    updateRouteOnMap(currentPickup, exactAddress);
  }

  if (typeof showToast === 'function') {
    showToast(`📍 ${isPickup ? 'Pickup' : 'Destination'} set: ${exactAddress}`, 'success');
  }
}

const TELANGANA_HUBS = [
  { name: 'Raghunathapally Bus Stop / Chowrasta', district: 'Jangaon District', tag: 'Town Hub' },
  { name: 'Jangaon Bus Depot / Chowrasta', district: 'Jangaon District', tag: 'Major Hub' },
  { name: 'Hanamkonda Bus Stand', district: 'Warangal District', tag: 'City Terminal' },
  { name: 'Warangal Railway Station', district: 'Warangal District', tag: 'Transit Hub' },
  { name: 'Kazipet Junction Railway Station', district: 'Warangal District', tag: 'Railway Junction' },
  { name: 'Station Ghanpur Highway Cross', district: 'Jangaon District', tag: 'Highway Cross' },
  { name: 'Aler Highway Junction', district: 'Yadadri Bhuvanagiri', tag: 'Highway Cross' },
  { name: 'Yadagirigutta Temple Arch', district: 'Yadadri Bhuvanagiri', tag: 'Pilgrimage' },
  { name: 'Bhongir Fort Chowrasta', district: 'Yadadri Bhuvanagiri', tag: 'District Hub' },
  { name: 'Bibinagar AIIMS Highway Junction', district: 'Yadadri Bhuvanagiri', tag: 'AIIMS / Transit' },
  { name: 'Ghatkesar Town / ORR Exit 9', district: 'Medchal-Malkajgiri', tag: 'ORR Exit' },
  { name: 'Uppal Ring Road Metro', district: 'Hyderabad', tag: 'Metro Station' },
  { name: 'Secunderabad Railway Station', district: 'Hyderabad', tag: 'Major Junction' },
  { name: 'Hitec City / Cyber Towers', district: 'Hyderabad', tag: 'IT Corridor' },
  { name: 'Gachibowli Financial District', district: 'Hyderabad', tag: 'Tech Hub' },
  { name: 'Kukatpally Housing Board (KPHB)', district: 'Hyderabad', tag: 'Metro / Suburb' },
  { name: 'LB Nagar Ring Road Metro', district: 'Hyderabad', tag: 'Highway Terminal' },
  { name: 'Shamshabad RGI Airport', district: 'Hyderabad', tag: 'Airport' },
  { name: 'Siddipet New Bus Stand', district: 'Siddipet District', tag: 'District Center' },
  { name: 'Karimnagar Bus Station / Collectorate', district: 'Karimnagar', tag: 'Smart City' },
  { name: 'Suryapet Hi-Tech Bus Stand', district: 'Suryapet District', tag: 'NH 65 Hub' },
  { name: 'Nalgonda Clock Tower Chowrasta', district: 'Nalgonda District', tag: 'District Center' },
  { name: 'Khammam New Bus Station', district: 'Khammam District', tag: 'District Center' },
  { name: 'Mahbubnagar Bus Station', district: 'Mahbubnagar', tag: 'District Center' }
];

// Quick modal selector for destination hubs with complete area names
function promptDropQuickSelect() {
  let dropdownMenu = document.getElementById('dropQuickSelectMenu');
  if (dropdownMenu) dropdownMenu.remove();

  dropdownMenu = document.createElement('div');
  dropdownMenu.id = 'dropQuickSelectMenu';
  dropdownMenu.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs';
  
  dropdownMenu.innerHTML = `
    <div class="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-3 animate-in fade-in zoom-in duration-200">
      <div class="flex items-center justify-between pb-2 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
            <i data-lucide="map-pin" class="w-4 h-4"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-900 text-sm">Select Destination</h4>
            <p class="text-[10px] text-slate-500">Search any Telangana address or landmark</p>
          </div>
        </div>
        <button onclick="document.getElementById('dropQuickSelectMenu').remove()" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Select on Map Shortcut Button -->
      <button type="button" onclick="document.getElementById('dropQuickSelectMenu').remove(); openSelectOnMapModal(false);" class="w-full text-left p-3 bg-blue-50/90 hover:bg-blue-100 border border-blue-200 rounded-2xl transition flex items-center gap-2.5 text-blue-900 font-bold text-xs cursor-pointer group shadow-xs">
        <div class="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition shadow-xs">
          <i data-lucide="map" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 min-w-0">
          <span class="block text-xs font-bold text-blue-700">Select Destination on Map</span>
          <span class="block text-[10px] text-blue-600/80 truncate">Pinpoint exact house number, street, or town</span>
        </div>
        <i data-lucide="arrow-right" class="w-4 h-4 text-blue-400"></i>
      </button>

      <div class="relative">
        <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"></i>
        <input id="quickDestSearchInput" type="text" oninput="filterQuickDestinations(this.value)" placeholder="Search Raghunathapally, street, town..." class="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition" />
      </div>

      <div id="quickDestOptionsList" class="space-y-1.5 max-h-64 overflow-y-auto pt-1">
        ${renderQuickDestOptions(TELANGANA_HUBS)}
      </div>
    </div>
  `;
  document.body.appendChild(dropdownMenu);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => {
    const input = document.getElementById('quickDestSearchInput');
    if (input) input.focus();
  }, 100);
}

function renderQuickDestOptions(list) {
  return list.map(item => `
    <button type="button" onclick="selectDestinationArea('${item.name.replace(/'/g, "\\'")}')" class="w-full text-left p-2.5 rounded-2xl hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition flex items-center justify-between group cursor-pointer">
      <div>
        <p class="text-xs font-bold text-slate-800 group-hover:text-blue-700">${item.name}</p>
        <p class="text-[10px] text-slate-400">${item.district || 'Telangana'}</p>
      </div>
      <span class="text-[9px] font-bold bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700 px-2 py-0.5 rounded-full">${item.tag || 'Hub'}</span>
    </button>
  `).join('');
}

function filterQuickDestinations(query) {
  const q = String(query || '').toLowerCase().trim();
  const listContainer = document.getElementById('quickDestOptionsList');
  if (!listContainer) return;

  if (!q) {
    listContainer.innerHTML = renderQuickDestOptions(TELANGANA_HUBS);
    if (window.lucide) lucide.createIcons();
    return;
  }

  const filtered = TELANGANA_HUBS.filter(h => h.name.toLowerCase().includes(q) || (h.district && h.district.toLowerCase().includes(q)));
  if (filtered.length > 0) {
    listContainer.innerHTML = renderQuickDestOptions(filtered);
  } else {
    listContainer.innerHTML = `
      <div class="p-3 text-center text-xs text-slate-600">
        <p class="font-bold text-slate-800">Custom Destination: "${query}"</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Click below to search & apply exact Telangana address</p>
        <button type="button" onclick="selectDestinationArea('${query.replace(/'/g, "\\'")}')" class="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition">
          Set Destination to "${query}"
        </button>
      </div>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

function selectDestinationArea(destinationName) {
  const dropInput = document.getElementById('inputDrop');
  const exactAddress = String(destinationName || '').trim();
  if (dropInput) {
    dropInput.value = exactAddress;
    if (typeof state !== 'undefined') {
      state.drop = exactAddress;
      if (typeof estimateDistance === 'function') {
        state.distance = estimateDistance(state.pickup, state.drop);
      }
      if (typeof updateUI === 'function') updateUI();
    }
    const currentPickup = document.getElementById('inputPickup')?.value || (typeof state !== 'undefined' ? state.pickup : 'Uppal, Hyderabad');
    updateRouteOnMap(currentPickup, exactAddress);
  }
  const menu = document.getElementById('dropQuickSelectMenu');
  if (menu) menu.remove();
  if (typeof showToast === 'function') {
    showToast(`📍 Destination set: ${exactAddress}`, 'success');
  }
}

// Calculate and render route line on Google Map
function updateRouteOnMap(origin, destination) {
  if (!gDirectionsService || !gDirectionsRenderer) return;

  // Add Hyderabad/Telangana bias for accurate Indian highway routing
  const cleanOrigin = origin.toLowerCase().includes('hyderabad') || origin.toLowerCase().includes('telangana') 
    ? origin 
    : `${origin}, Telangana, India`;
  const cleanDest = destination.toLowerCase().includes('telangana') || destination.toLowerCase().includes('india') 
    ? destination 
    : `${destination}, Telangana, India`;

  gDirectionsService.route(
    {
      origin: cleanOrigin,
      destination: cleanDest,
      travelMode: google.maps.TravelMode.DRIVING
    },
    (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result.routes && result.routes.length > 0) {
        gDirectionsRenderer.setDirections(result);

        const route = result.routes[0];
        if (route.legs && route.legs.length > 0) {
          const leg = route.legs[0];
          const distKm = Math.round(leg.distance.value / 1000);
          const durationStr = leg.duration.text;

          // Update UI Floating Map Banner with real route endpoints
          const pShort = (origin || '').split(',')[0].trim();
          const dShort = (destination || '').split(',')[0].trim();
          const summaryStr = route.summary || `${pShort} ➔ ${dShort}`;
          updateMapInfoPill(leg.distance.text, durationStr, summaryStr);

          // Sync with state distance if state exists
          if (typeof state !== 'undefined' && distKm > 0) {
            state.distance = distKm;
            if (typeof updateUI === 'function') {
              updateUI();
            }
          }
        }
      } else {
        console.warn('Directions request returned status:', status);
        const pShort = (origin || 'Pickup').split(',')[0].trim();
        const dShort = (destination || 'Destination').split(',')[0].trim();
        updateMapInfoPill(`${typeof state !== 'undefined' ? state.distance : 84} km`, '~1h 35m', `${pShort} ➔ ${dShort}`);
      }
    }
  );
}

// Update floating badge over the map
function updateMapInfoPill(distanceText, durationText, summaryText) {
  const pill = document.getElementById('mapRouteInfoPill');
  if (!pill) return;

  pill.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-emerald-500 live-pulse"></div>
      <span class="font-extrabold text-slate-900">${distanceText}</span>
      <span class="text-slate-300">•</span>
      <span class="font-semibold text-blue-700">${durationText}</span>
      <span class="text-slate-300">•</span>
      <span class="text-slate-500 truncate max-w-[120px]">${summaryText}</span>
    </div>
  `;
}

// Toggle Live Traffic Layer
function toggleMapTraffic() {
  if (!gMap || !gTrafficLayer) return;

  gTrafficActive = !gTrafficActive;
  gTrafficLayer.setMap(gTrafficActive ? gMap : null);

  const btn = document.getElementById('btnToggleTraffic');
  if (btn) {
    if (gTrafficActive) {
      btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 transition flex items-center gap-1';
      btn.innerHTML = `<i data-lucide="zap" class="w-3 h-3 text-emerald-600"></i> Traffic On`;
    } else {
      btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/90 hover:bg-white text-slate-700 border border-slate-200 shadow-xs transition flex items-center gap-1';
      btn.innerHTML = `<i data-lucide="zap-off" class="w-3 h-3 text-slate-400"></i> Traffic`;
    }
    if (window.lucide) lucide.createIcons();
  }

  if (typeof showToast === 'function') {
    showToast(gTrafficActive ? 'Live Traffic overlay enabled' : 'Live Traffic overlay hidden', 'info');
  }
}

// Recenter Map on Corridor
function recenterMapOnCorridor() {
  if (!gMap) return;
  const pickupVal = document.getElementById('inputPickup')?.value || 'Uppal, Hyderabad';
  const dropVal = document.getElementById('inputDrop')?.value || 'Jangaon';
  updateRouteOnMap(pickupVal, dropVal);
  if (typeof showToast === 'function') {
    showToast('Map centered on corridor route', 'info');
  }
}

// Fallback message if Google Maps fails to load
function displayMapFallback(errorMsg = '') {
  const container = document.getElementById('googleMapContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
      <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
        <i data-lucide="map-pin" class="w-5 h-5"></i>
      </div>
      <p class="text-xs font-bold text-slate-800">Highway Corridor Route (NH 163)</p>
      <p class="text-[11px] text-slate-500 mt-0.5">Uppal ➔ Bhongir ➔ Aler ➔ Jangaon (84 km)</p>
      <button onclick="recenterMapOnCorridor()" class="mt-2 text-[10px] font-bold text-blue-600 hover:underline">Retry Loading Map</button>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

// ==========================================
// BROWSER GEOLOCATION & REVERSE GEOCODING
// ==========================================

function detectCurrentLocation() {
  const locateBtn = document.getElementById('btnLocateMe');
  const pickupInput = document.getElementById('inputPickup');

  if (!navigator.geolocation) {
    if (typeof showToast === 'function') {
      showToast('Geolocation is not supported by your browser', 'error');
    }
    return;
  }

  // Visual loading feedback on locate button
  if (locateBtn) {
    locateBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 text-blue-600 animate-spin"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  if (typeof showToast === 'function') {
    showToast('Detecting your current area...', 'info');
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const latLng = { lat, lng };

      const resolvedAreaName = await reverseGeocodeLatLng(lat, lng);

      // Update Pickup Input and Global State with exact detailed address
      if (pickupInput) {
        pickupInput.value = resolvedAreaName;
      }
      if (typeof state !== 'undefined') {
        state.pickup = resolvedAreaName;
        if (typeof estimateDistance === 'function') {
          state.distance = estimateDistance(state.pickup, state.drop);
        }
        if (typeof updateUI === 'function') updateUI();
      }

      const currentDrop = document.getElementById('inputDrop')?.value || (typeof state !== 'undefined' ? state.drop : 'Jangaon Bus Depot / Chowrasta');
      updateRouteOnMap(resolvedAreaName, currentDrop);

      if (typeof showToast === 'function') {
        showToast(`📍 Current location detected: ${resolvedAreaName}`, 'success');
      }

      resetLocateBtn();
    },
    (err) => {
      console.warn('Geolocation error:', err);
      resetLocateBtn();
      let msg = 'Unable to detect location. Please check browser permissions.';
      if (err.code === err.PERMISSION_DENIED) {
        msg = 'Location permission was denied. Please allow location access in your browser.';
      }
      if (typeof showToast === 'function') {
        showToast(msg, 'error');
      }
    },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 0 }
  );

  function resetLocateBtn() {
    if (locateBtn) {
      locateBtn.innerHTML = `<i data-lucide="locate-fixed" class="w-4 h-4"></i>`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

// Landmark and area resolution along Hyderabad - Warangal Corridor
function resolveCorridorProximityArea(lat, lng) {
  const corridorAreas = [
    { name: 'Uppal Ring Road Metro, Hyderabad', lat: 17.4024, lng: 78.5604 },
    { name: 'Boduppal / Peerzadiguda, Hyderabad', lat: 17.4168, lng: 78.5832 },
    { name: 'Swarnagiri Colony, Ghatkesar, Medchal', lat: 17.4221, lng: 78.6507 },
    { name: 'Ghatkesar Town / ORR Exit 9', lat: 17.4526, lng: 78.6821 },
    { name: 'Bibinagar AIIMS Highway Junction', lat: 17.4725, lng: 78.7915 },
    { name: 'Bhongir Fort Chowrasta, Yadadri', lat: 17.5126, lng: 78.8912 },
    { name: 'Aler Highway Junction', lat: 17.6534, lng: 79.0512 },
    { name: 'Jangaon Bus Depot / Chowrasta', lat: 17.7241, lng: 79.1623 },
    { name: 'Kazipet Junction, Warangal', lat: 17.9734, lng: 79.5218 },
    { name: 'Hanamkonda Bus Stand, Warangal', lat: 18.0125, lng: 79.5621 }
  ];

  let closest = corridorAreas[0];
  let minDiff = Infinity;

  corridorAreas.forEach(wp => {
    const diff = Math.hypot(lat - wp.lat, lng - wp.lng);
    if (diff < minDiff) {
      minDiff = diff;
      closest = wp;
    }
  });

  return closest.name;
}

// Reverse geocode latitude and longitude to exact detailed address (Door number, Street, Village, Mandal, District)
async function reverseGeocodeLatLng(lat, lng) {
  // 1. Try Google Maps Geocoder if available
  if (window.google && google.maps && google.maps.Geocoder) {
    try {
      const geocoder = new google.maps.Geocoder();
      const response = await new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results[0]);
          } else {
            resolve(null);
          }
        });
      });

      if (response && response.formatted_address) {
        let addr = response.formatted_address;
        // Clean trailing postal code / country if present to keep it clean, but retain full street/colony/village
        addr = addr.replace(/, India$/, '').replace(/, Telangana \d{6}$/, ', Telangana');
        return addr.trim();
      }
    } catch (err) {
      console.warn('Google reverse geocoding failed, trying OSM fallback:', err);
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim reverse geocoding
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        let osmAddr = data.display_name;
        osmAddr = osmAddr.replace(/, India$/, '').replace(/, \d{6}$/, '');
        return osmAddr.trim();
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocoding failed:', err);
  }

  // 3. Fallback to corridor proximity
  return resolveCorridorProximityArea(lat, lng);
}

// ==========================================
// INTERACTIVE SELECT ON MAP CONTROLLER
// ==========================================

let gPickerMap = null;
let gPickerIsPickup = false;
let gPickerCurrentAddress = '';
let gPickerDebounceTimer = null;

function openSelectOnMapModal(isPickup = false) {
  gPickerIsPickup = isPickup;

  const modal = document.getElementById('selectOnMapModal');
  if (!modal) return;

  const titleEl = document.getElementById('pickerModalTitle');
  const badgeEl = document.getElementById('pickerTargetBadge');
  const iconEl = document.getElementById('pickerHeaderIcon');
  const addressTextEl = document.getElementById('pickerAddressText');
  const statusEl = document.getElementById('pickerGeocodingStatus');

  if (titleEl) {
    titleEl.textContent = isPickup ? 'Select Pickup Location' : 'Select Destination Location';
  }
  if (badgeEl) {
    badgeEl.textContent = isPickup ? 'Pickup Address' : 'Destination Address';
    badgeEl.className = isPickup
      ? 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800'
      : 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800';
  }
  if (iconEl) {
    iconEl.className = isPickup
      ? 'w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold'
      : 'w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold';
  }
  if (addressTextEl) {
    addressTextEl.textContent = 'Drag map to position pin on exact location...';
  }
  if (statusEl) {
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Locating...`;
  }

  if (typeof openModal === 'function') {
    openModal('selectOnMapModal');
  } else {
    modal.classList.remove('hidden');
  }

  if (window.lucide) lucide.createIcons();

  // Initialize or resize Picker Google Map
  setTimeout(() => {
    initOrUpdatePickerMap(isPickup);
  }, 150);
}

function initOrUpdatePickerMap(isPickup) {
  const container = document.getElementById('pickerMapCanvas');
  if (!container) return;

  // Initial center based on current pickup/drop or default corridor
  let centerLatLng = { lat: 17.5500, lng: 78.8500 };

  try {
    if (!gPickerMap && window.google && google.maps) {
      gPickerMap = new google.maps.Map(container, {
        center: centerLatLng,
        zoom: 15,
        styles: ROUTEMATE_MAP_STYLES,
        disableDefaultUI: true,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER
        }
      });

      gPickerMap.addListener('center_changed', () => {
        onPickerCenterChanged();
      });

      gPickerMap.addListener('idle', () => {
        onPickerCenterChanged(true);
      });
    } else if (gPickerMap) {
      google.maps.event.trigger(gPickerMap, 'resize');
      gPickerMap.setCenter(centerLatLng);
    }

    // Try to center near user or current selected location if available
    const existingVal = isPickup 
      ? document.getElementById('inputPickup')?.value 
      : document.getElementById('inputDrop')?.value;

    if (existingVal && window.google && google.maps && google.maps.Geocoder) {
      const geocoder = new google.maps.Geocoder();
      const query = existingVal.includes('Telangana') ? existingVal : `${existingVal}, Telangana, India`;
      geocoder.geocode({ address: query }, (results, status) => {
        if (status === 'OK' && results && results[0] && gPickerMap) {
          gPickerMap.setCenter(results[0].geometry.location);
          gPickerMap.setZoom(16);
          onPickerCenterChanged(true);
        } else {
          onPickerCenterChanged(true);
        }
      });
    } else {
      onPickerCenterChanged(true);
    }
  } catch (err) {
    console.warn('Picker map initialization error:', err);
  }
}

function onPickerCenterChanged(immediate = false) {
  if (!gPickerMap) return;

  const statusEl = document.getElementById('pickerGeocodingStatus');
  if (statusEl) {
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Locating...`;
  }

  if (gPickerDebounceTimer) clearTimeout(gPickerDebounceTimer);

  const delay = immediate ? 100 : 350;
  gPickerDebounceTimer = setTimeout(async () => {
    if (!gPickerMap) return;
    const center = gPickerMap.getCenter();
    if (!center) return;

    const lat = center.lat();
    const lng = center.lng();

    const resolvedAddress = await reverseGeocodeLatLng(lat, lng);
    gPickerCurrentAddress = resolvedAddress;

    const addressTextEl = document.getElementById('pickerAddressText');
    if (addressTextEl) {
      addressTextEl.textContent = resolvedAddress || 'Selected Location';
    }

    if (statusEl) {
      statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Precise Location`;
    }
  }, delay);
}

function locatePickerToCurrentGps() {
  if (!navigator.geolocation) {
    if (typeof showToast === 'function') showToast('Geolocation is not supported', 'error');
    return;
  }

  if (typeof showToast === 'function') showToast('Moving map to current GPS position...', 'info');

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      if (gPickerMap) {
        gPickerMap.panTo({ lat, lng });
        gPickerMap.setZoom(17);
        onPickerCenterChanged(true);
      }
    },
    (err) => {
      console.warn('Picker GPS location failed:', err);
      if (typeof showToast === 'function') showToast('Unable to get GPS location', 'error');
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

function confirmPickerAddress() {
  if (!gPickerCurrentAddress) {
    if (typeof showToast === 'function') showToast('Please select a valid location on the map', 'warning');
    return;
  }

  selectTelanganaLocation(gPickerCurrentAddress, gPickerIsPickup);

  if (typeof closeModal === 'function') {
    closeModal('selectOnMapModal');
  } else {
    document.getElementById('selectOnMapModal')?.classList.add('hidden');
  }
}

// ==========================================
// LIVE TRIP TRACKING ENGINE (MAP & ANIMATION)
// ==========================================

let gTrackingMap = null;
let gTrackingDirectionsRenderer = null;
let gVehicleMarker = null;
let gTrackingAnimId = null;

function initTrackingMap(tripData) {
  const container = document.getElementById('trackingMapCanvas');
  if (!container) return;

  const defaultTrip = tripData || {
    pickup: 'Uppal Ring Road Metro',
    drop: 'Jangaon Chowrasta',
    vehicle: 'Bajaj Pulsar 150',
    plate: 'TS 08 EK 4321',
    driver: 'Ramesh Kumar',
    vehicleType: 'bike'
  };

  try {
    if (!gTrackingMap) {
      gTrackingMap = new google.maps.Map(container, {
        center: { lat: 17.5500, lng: 78.8500 },
        zoom: 11,
        styles: ROUTEMATE_MAP_STYLES,
        disableDefaultUI: true,
        zoomControl: true
      });
      gTrackingDirectionsRenderer = new google.maps.DirectionsRenderer({
        map: gTrackingMap,
        suppressMarkers: false,
        polylineOptions: {
          strokeColor: '#2563EB',
          strokeWeight: 6,
          strokeOpacity: 0.9
        }
      });
    }

    // Request route directions
    const dirService = new google.maps.DirectionsService();
    const originStr = defaultTrip.pickup.includes('India') ? defaultTrip.pickup : `${defaultTrip.pickup}, Telangana, India`;
    const destStr = defaultTrip.drop.includes('India') ? defaultTrip.drop : `${defaultTrip.drop}, Telangana, India`;

    dirService.route(
      {
        origin: originStr,
        destination: destStr,
        travelMode: google.maps.TravelMode.DRIVING
      },
      (res, status) => {
        if (status === google.maps.DirectionsStatus.OK && res.routes && res.routes[0]) {
          gTrackingDirectionsRenderer.setDirections(res);

          const route = res.routes[0];
          const leg = route.legs[0];
          const pathPoints = route.overview_path;

          // Update HUD
          const etaEl = document.getElementById('trackingLiveEta');
          const distEl = document.getElementById('trackingLiveDist');
          const progressEl = document.getElementById('trackingProgressBar');

          if (etaEl) etaEl.textContent = leg.duration.text || '18 mins';
          if (distEl) distEl.textContent = leg.distance.text || '84 km';
          if (progressEl) progressEl.style.width = '35%';

          // Animate simulated vehicle along corridor
          animateVehicleOnPath(pathPoints, defaultTrip.vehicleType);
        } else {
          console.warn('Tracking directions route failed:', status);
        }
      }
    );
  } catch (err) {
    console.error('Tracking map initialization failed:', err);
  }
}

// Animate vehicle marker along polyline coordinates
function animateVehicleOnPath(points, vehicleType) {
  if (!points || points.length === 0 || !gTrackingMap) return;

  if (gVehicleMarker) {
    gVehicleMarker.setMap(null);
  }

  // Start at 30% of route
  let step = Math.floor(points.length * 0.28);
  const startPos = points[step] || points[0];

  const iconUrl = vehicleType === 'car'
    ? 'https://maps.google.com/mapfiles/kml/shapes/cabs.png'
    : 'https://maps.google.com/mapfiles/kml/shapes/motorcycling.png';

  gVehicleMarker = new google.maps.Marker({
    position: startPos,
    map: gTrackingMap,
    title: 'Live Vehicle',
    icon: {
      url: iconUrl,
      scaledSize: new google.maps.Size(32, 32)
    }
  });

  // Simulated live movement
  if (gTrackingAnimId) clearInterval(gTrackingAnimId);
  gTrackingAnimId = setInterval(() => {
    if (step < points.length - 1) {
      step += 1;
      const nextPos = points[step];
      if (gVehicleMarker && nextPos) {
        gVehicleMarker.setPosition(nextPos);
      }
    } else {
      clearInterval(gTrackingAnimId);
    }
  }, 4000);
}

// Export to window
window.initGoogleMap = initGoogleMap;
window.updateRouteOnMap = updateRouteOnMap;
window.toggleMapTraffic = toggleMapTraffic;
window.recenterMapOnCorridor = recenterMapOnCorridor;
window.detectCurrentLocation = detectCurrentLocation;
window.initTrackingMap = initTrackingMap;
window.openSelectOnMapModal = openSelectOnMapModal;
window.confirmPickerAddress = confirmPickerAddress;
window.locatePickerToCurrentGps = locatePickerToCurrentGps;
window.reverseGeocodeLatLng = reverseGeocodeLatLng;
window.selectTelanganaLocation = selectTelanganaLocation;
window.promptDropQuickSelect = promptDropQuickSelect;
window.filterQuickDestinations = filterQuickDestinations;
window.selectDestinationArea = selectDestinationArea;
