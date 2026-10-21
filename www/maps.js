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

// Leaflet instances for seamless OpenStreetMap interactive maps
let lMap = null;
let lRouteLayer = null;
let lStartMarker = null;
let lEndMarker = null;

// Initialize Leaflet Live Map on #googleMapContainer
function initLeafletMap() {
  const container = document.getElementById('googleMapContainer');
  if (!container || !window.L) return;

  if (lMap) {
    try {
      lMap.invalidateSize();
      return;
    } catch (e) {}
  }

  container.innerHTML = '';

  try {
    lMap = L.map(container, {
      center: [17.5500, 78.8500],
      zoom: 10,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(lMap);

    // Click on map to set destination
    lMap.on('click', async (e) => {
      if (e && e.latlng) {
        if (typeof showToast === 'function') {
          showToast('Resolving map location...', 'info');
        }
        const resolved = await reverseGeocodeLatLng(e.latlng.lat, e.latlng.lng);
        if (resolved) {
          selectTelanganaLocation(resolved, false);
        }
      }
    });

    // Check if initial pickup and drop exist
    const p = document.getElementById('inputPickup')?.value;
    const d = document.getElementById('inputDrop')?.value;
    if (p && d && p.trim() && d.trim()) {
      updateRouteOnMap(p, d);
    } else {
      updateMapInfoPill('', '', '');
    }

    console.log('✅ Leaflet OpenStreetMap initialized successfully!');
  } catch (err) {
    console.warn('Leaflet map initialization error:', err);
  }
}

// Callback called automatically by Google Maps script (or Leaflet fallback)
function initGoogleMap() {
  // Prefer Leaflet for 100% reliable, zero-error interactive mapping
  if (window.L) {
    initLeafletMap();
    return;
  }

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
        strokeColor: '#2563EB',
        strokeWeight: 5,
        strokeOpacity: 0.85
      }
    });

    // 3. Traffic Layer
    gTrafficLayer = new google.maps.TrafficLayer();

    // 4. Attach Universal Telangana Auto-Suggest to inputs
    attachPlacesAutocomplete();

    // 5. Render route if pickup & drop are present
    const pickupVal = document.getElementById('inputPickup')?.value;
    const dropVal = document.getElementById('inputDrop')?.value;
    if (pickupVal && dropVal && pickupVal.trim() && dropVal.trim()) {
      updateRouteOnMap(pickupVal, dropVal);
    } else {
      updateMapInfoPill('', '', '');
    }

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

    console.log('✅ Google Maps initialized!');
  } catch (err) {
    console.error('Error in initGoogleMap, activating Leaflet fallback:', err);
    if (window.L) {
      initLeafletMap();
    } else {
      displayMapFallback(err.message);
    }
  }
}

// Auto-initialize Leaflet on page load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => { if (window.L && !lMap) initLeafletMap(); }, 200);
      attachPlacesAutocomplete();
    });
  } else {
    setTimeout(() => { if (window.L && !lMap) initLeafletMap(); }, 200);
    attachPlacesAutocomplete();
  }
}

// Attach Universal Telangana Auto-Suggest to Pickup & Drop inputs (No Google Places API dependency)
function attachPlacesAutocomplete() {
  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');

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
        <input id="quickDestSearchInput" type="text" oninput="filterQuickDestinations(this.value)" placeholder="Search destination area, street, landmark..." class="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition" />
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
    const currentPickup = document.getElementById('inputPickup')?.value;
    if (currentPickup && currentPickup.trim()) {
      updateRouteOnMap(currentPickup, exactAddress);
    }
  }
  const menu = document.getElementById('dropQuickSelectMenu');
  if (menu) menu.remove();
  if (typeof showToast === 'function') {
    showToast(`📍 Destination set: ${exactAddress}`, 'success');
  }
}

// Geocode location string to {lat, lng} coordinates
async function geocodeAddressToCoords(address) {
  if (!address || !address.trim()) return null;
  const q = address.trim();

  // 1. Check local curated hubs first for instant 0ms lookup
  const cleanQ = q.toLowerCase();
  for (const hub of TELANGANA_HUBS) {
    if (hub.name.toLowerCase().includes(cleanQ) || cleanQ.includes(hub.name.toLowerCase())) {
      const wp = resolveCorridorProximityAreaCoords(hub.name);
      if (wp) return wp;
    }
  }

  // 2. Nominatim search
  try {
    const query = q.toLowerCase().includes('telangana') || q.toLowerCase().includes('hyderabad')
      ? q
      : `${q}, Telangana, India`;
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch (err) {
    console.warn('Geocoding query failed:', err);
  }

  return null;
}

function resolveCorridorProximityAreaCoords(name) {
  const corridorAreas = [
    { name: 'Uppal', lat: 17.4024, lng: 78.5604 },
    { name: 'Boduppal', lat: 17.4168, lng: 78.5832 },
    { name: 'Ghatkesar', lat: 17.4526, lng: 78.6821 },
    { name: 'Bibinagar', lat: 17.4725, lng: 78.7915 },
    { name: 'Bhongir', lat: 17.5126, lng: 78.8912 },
    { name: 'Aler', lat: 17.6534, lng: 79.0512 },
    { name: 'Raghunathapally', lat: 17.7010, lng: 79.1377 },
    { name: 'Jangaon', lat: 17.7241, lng: 79.1623 },
    { name: 'Station Ghanpur', lat: 17.8421, lng: 79.3218 },
    { name: 'Kazipet', lat: 17.9734, lng: 79.5218 },
    { name: 'Hanamkonda', lat: 18.0125, lng: 79.5621 },
    { name: 'Warangal', lat: 17.9784, lng: 79.6008 }
  ];
  const cleanName = (name || '').toLowerCase();
  const found = corridorAreas.find(c => cleanName.includes(c.name.toLowerCase()));
  return found ? { lat: found.lat, lng: found.lng } : null;
}

// Calculate and render route line on Leaflet / Google Map
async function updateRouteOnMap(origin, destination) {
  // If either origin or destination is empty, do not render a dummy route
  if (!origin || !origin.trim() || !destination || !destination.trim()) {
    updateMapInfoPill('', '', '');
    if (lRouteLayer && lMap) {
      try { lMap.removeLayer(lRouteLayer); } catch(e) {}
      lRouteLayer = null;
    }
    if (lStartMarker && lMap) {
      try { lMap.removeLayer(lStartMarker); } catch(e) {}
      lStartMarker = null;
    }
    if (lEndMarker && lMap) {
      try { lMap.removeLayer(lEndMarker); } catch(e) {}
      lEndMarker = null;
    }
    return;
  }

  // 1. Render route on Leaflet Map via OSRM Driving Engine
  if (lMap && window.L) {
    try {
      const pCoords = await geocodeAddressToCoords(origin);
      const dCoords = await geocodeAddressToCoords(destination);

      if (pCoords && dCoords) {
        let coordsList = [];
        let distKm = 0;
        let durationMin = 0;

        try {
          const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pCoords.lng},${pCoords.lat};${dCoords.lng},${dCoords.lat}?overview=full&geometries=geojson`;
          const res = await fetch(osrmUrl);
          if (res.ok) {
            const data = await res.json();
            if (data && data.routes && data.routes[0]) {
              const r = data.routes[0];
              distKm = Math.round(r.distance / 1000);
              durationMin = Math.round(r.duration / 60);
              coordsList = r.geometry.coordinates.map(c => [c[1], c[0]]);
            }
          }
        } catch (e) {
          console.warn('OSRM request error:', e);
        }

        if (coordsList.length === 0) {
          coordsList = [[pCoords.lat, pCoords.lng], [dCoords.lat, dCoords.lng]];
          const diffKm = Math.round(Math.hypot(pCoords.lat - dCoords.lat, pCoords.lng - dCoords.lng) * 111);
          distKm = Math.max(12, diffKm);
          durationMin = Math.round(distKm * 1.25);
        }

        if (lRouteLayer) lMap.removeLayer(lRouteLayer);
        if (lStartMarker) lMap.removeLayer(lStartMarker);
        if (lEndMarker) lMap.removeLayer(lEndMarker);

        lRouteLayer = L.polyline(coordsList, {
          color: '#2563EB',
          weight: 5,
          opacity: 0.85
        }).addTo(lMap);

        lStartMarker = L.circleMarker([pCoords.lat, pCoords.lng], {
          radius: 7,
          fillColor: '#10B981',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).addTo(lMap);

        lEndMarker = L.circleMarker([dCoords.lat, dCoords.lng], {
          radius: 7,
          fillColor: '#2563EB',
          color: '#ffffff',
          weight: 2,
          fillOpacity: 1
        }).addTo(lMap);

        lMap.fitBounds(lRouteLayer.getBounds(), { padding: [30, 30] });

        const pShort = origin.split(',')[0].trim();
        const dShort = destination.split(',')[0].trim();
        const durationText = durationMin >= 60
          ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m`
          : `${durationMin} mins`;

        updateMapInfoPill(`${distKm} km`, durationText, `${pShort} ➔ ${dShort}`);

        if (typeof state !== 'undefined' && distKm > 0) {
          state.distance = distKm;
          if (typeof updateUI === 'function') updateUI();
        }
        return;
      }
    } catch (err) {
      console.warn('Leaflet routing error:', err);
    }
  }

  // 2. Google Directions Fallback
  if (gDirectionsService && gDirectionsRenderer) {
    try {
      const cleanOrigin = origin.toLowerCase().includes('telangana') ? origin : `${origin}, Telangana, India`;
      const cleanDest = destination.toLowerCase().includes('telangana') ? destination : `${destination}, Telangana, India`;

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
              const pShort = (origin || '').split(',')[0].trim();
              const dShort = (destination || '').split(',')[0].trim();
              const summaryStr = route.summary || `${pShort} ➔ ${dShort}`;
              updateMapInfoPill(leg.distance.text, durationStr, summaryStr);

              if (typeof state !== 'undefined' && distKm > 0) {
                state.distance = distKm;
                if (typeof updateUI === 'function') updateUI();
              }
            }
          }
        }
      );
    } catch (err) {
      console.warn('Google route error:', err);
    }
  }
}

// Update floating badge over the map
function updateMapInfoPill(distanceText, durationText, summaryText) {
  const pill = document.getElementById('mapRouteInfoPill');
  if (!pill) return;

  if (!distanceText) {
    pill.innerHTML = `
      <div class="flex items-center gap-1.5 text-slate-500">
        <span class="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
        <span class="font-bold text-slate-700 text-xs">Live Map</span>
        <span class="text-slate-300">•</span>
        <span class="text-slate-400 text-xs">Select Route</span>
      </div>
    `;
    return;
  }

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
  if (lMap) {
    if (typeof showToast === 'function') {
      showToast('Live Traffic layer is active on Telangana Highway', 'info');
    }
    return;
  }
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
  if (lMap) {
    lMap.setView([17.5500, 78.8500], 10);
    if (typeof showToast === 'function') {
      showToast('Map centered on Telangana corridor', 'info');
    }
    return;
  }
  if (!gMap) return;
  const pickupVal = document.getElementById('inputPickup')?.value;
  const dropVal = document.getElementById('inputDrop')?.value;
  if (pickupVal && dropVal) {
    updateRouteOnMap(pickupVal, dropVal);
  } else {
    gMap.setCenter(MAPS_CONFIG.defaultCenter);
    gMap.setZoom(10);
  }
  if (typeof showToast === 'function') {
    showToast('Map centered on corridor route', 'info');
  }
}

// Fallback message if map fails
function displayMapFallback(errorMsg = '') {
  if (window.L) {
    initLeafletMap();
    return;
  }
  const container = document.getElementById('googleMapContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
      <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
        <i data-lucide="map-pin" class="w-5 h-5"></i>
      </div>
      <p class="text-xs font-bold text-slate-800">Live Highway Map</p>
      <p class="text-[11px] text-slate-500 mt-0.5">Select pickup and destination to view live route</p>
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
  // 1. OpenStreetMap Nominatim reverse geocoding (fast, detailed, zero API key errors)
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

  // 2. Google Maps Geocoder fallback if active
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
        addr = addr.replace(/, India$/, '').replace(/, Telangana \d{6}$/, ', Telangana');
        return addr.trim();
      }
    } catch (err) {
      console.warn('Google reverse geocoding fallback failed:', err);
    }
  }

  // 3. Fallback to corridor proximity
  return resolveCorridorProximityArea(lat, lng);
}

// ==========================================
// INTERACTIVE SELECT ON MAP CONTROLLER
// ==========================================

let lPickerMap = null;
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

  // Initialize or resize Leaflet Picker Map
  setTimeout(() => {
    initOrUpdatePickerMap(isPickup);
  }, 150);
}

function initOrUpdatePickerMap(isPickup) {
  const container = document.getElementById('pickerMapCanvas');
  if (!container) return;

  const centerLatLng = [17.5500, 78.8500];

  // 1. Prefer Leaflet for 100% reliable interactive pin-drop
  if (window.L) {
    try {
      if (!lPickerMap) {
        container.innerHTML = '';
        lPickerMap = L.map(container, {
          center: centerLatLng,
          zoom: 15,
          zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(lPickerMap);

        lPickerMap.on('move', () => {
          onPickerCenterChanged();
        });

        lPickerMap.on('moveend', () => {
          onPickerCenterChanged(true);
        });
      } else {
        setTimeout(() => {
          try { lPickerMap.invalidateSize(); } catch(e) {}
        }, 120);
      }

      const existingVal = isPickup 
        ? document.getElementById('inputPickup')?.value 
        : document.getElementById('inputDrop')?.value;

      if (existingVal && existingVal.trim()) {
        geocodeAddressToCoords(existingVal).then(coords => {
          if (coords && lPickerMap) {
            lPickerMap.setView([coords.lat, coords.lng], 16);
            onPickerCenterChanged(true);
          } else {
            onPickerCenterChanged(true);
          }
        });
      } else {
        onPickerCenterChanged(true);
      }
      return;
    } catch (err) {
      console.warn('Leaflet picker initialization failed:', err);
    }
  }

  // 2. Google Maps fallback only if Leaflet not present
  try {
    if (!gPickerMap && window.google && google.maps) {
      gPickerMap = new google.maps.Map(container, {
        center: { lat: centerLatLng[0], lng: centerLatLng[1] },
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
      gPickerMap.setCenter({ lat: centerLatLng[0], lng: centerLatLng[1] });
    }

    onPickerCenterChanged(true);
  } catch (err) {
    console.warn('Google picker map error:', err);
  }
}

function onPickerCenterChanged(immediate = false) {
  if (!lPickerMap && !gPickerMap) return;

  const statusEl = document.getElementById('pickerGeocodingStatus');
  if (statusEl) {
    statusEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Locating...`;
  }

  if (gPickerDebounceTimer) clearTimeout(gPickerDebounceTimer);

  const delay = immediate ? 100 : 350;
  gPickerDebounceTimer = setTimeout(async () => {
    let lat, lng;
    if (lPickerMap) {
      const center = lPickerMap.getCenter();
      lat = center.lat;
      lng = center.lng;
    } else if (gPickerMap) {
      const center = gPickerMap.getCenter();
      lat = center.lat();
      lng = center.lng();
    }
    if (!lat || !lng) return;

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
      if (lPickerMap) {
        lPickerMap.setView([lat, lng], 17);
        onPickerCenterChanged(true);
      } else if (gPickerMap) {
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
    pickup: (typeof state !== 'undefined' && state.pickup) || 'Uppal Ring Road Metro',
    drop: (typeof state !== 'undefined' && state.drop) || 'Jangaon Bus Depot',
    vehicle: 'Verified Vehicle',
    plate: 'TS 08 -- ----',
    driver: 'Verified Commuter',
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
window.initLeafletMap = initLeafletMap;
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
