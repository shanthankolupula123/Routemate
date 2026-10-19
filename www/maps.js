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
          const fullAddress = parts.slice(0, 4).join(', ');
          if (!suggestions.some(s => s.title.toLowerCase() === mainTitle.toLowerCase())) {
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

  if (suggestions.length === 0) {
    container.innerHTML = `
      <div class="p-3 text-center text-xs text-slate-500">
        <p class="font-medium">No exact area found for "${query}"</p>
        <button type="button" class="mt-1 text-blue-600 font-bold hover:underline" onclick="selectTelanganaLocation('${query.replace(/'/g, "\\'")}', ${isPickup})">Use "${query}" anyway</button>
      </div>
    `;
    container.classList.remove('hidden');
    return;
  }

  container.innerHTML = suggestions.map(s => `
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

  if (isPickup) {
    if (pickupInput) pickupInput.value = fullLocation;
    if (typeof state !== 'undefined') {
      state.pickup = fullLocation;
      if (typeof estimateDistance === 'function') {
        state.distance = estimateDistance(state.pickup, state.drop);
      }
      if (typeof updateUI === 'function') updateUI();
    }
    const currentDrop = (dropInput && dropInput.value) || (typeof state !== 'undefined' ? state.drop : 'Jangaon');
    updateRouteOnMap(fullLocation, currentDrop);
  } else {
    if (dropInput) dropInput.value = fullLocation;
    if (typeof state !== 'undefined') {
      state.drop = fullLocation;
      if (typeof estimateDistance === 'function') {
        state.distance = estimateDistance(state.pickup, state.drop);
      }
      if (typeof updateUI === 'function') updateUI();
    }
    const currentPickup = (pickupInput && pickupInput.value) || (typeof state !== 'undefined' ? state.pickup : 'Uppal, Hyderabad');
    updateRouteOnMap(currentPickup, fullLocation);
  }

  if (typeof showToast === 'function') {
    showToast(`📍 ${isPickup ? 'Pickup' : 'Destination'} set: ${fullLocation.split(',')[0]}`, 'success');
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
  if (dropInput) {
    dropInput.value = destinationName;
    if (typeof state !== 'undefined') {
      state.drop = destinationName;
      if (typeof estimateDistance === 'function') {
        state.distance = estimateDistance(state.pickup, state.drop);
      }
      if (typeof updateUI === 'function') updateUI();
    }
    const currentPickup = document.getElementById('inputPickup')?.value || (typeof state !== 'undefined' ? state.pickup : 'Uppal, Hyderabad');
    updateRouteOnMap(currentPickup, destinationName);
  }
  const menu = document.getElementById('dropQuickSelectMenu');
  if (menu) menu.remove();
  if (typeof showToast === 'function') {
    showToast(`📍 Destination set: ${destinationName.split(',')[0]}`, 'success');
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

          // Update UI Floating Map Banner
          updateMapInfoPill(leg.distance.text, durationStr, route.summary || 'NH 163 Corridor');

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
        // Fallback info update
        updateMapInfoPill(`${typeof state !== 'undefined' ? state.distance : 84} km`, '~1h 35m', 'NH 163 Corridor');
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

      let resolvedAreaName = '';

      // Tier 1: Try Google Maps Geocoder if available
      try {
        if (window.google && google.maps && google.maps.Geocoder) {
          const geocoder = new google.maps.Geocoder();
          const googleResult = await new Promise((resolve) => {
            geocoder.geocode({ location: latLng }, (results, status) => {
              if (status === 'OK' && results && results.length > 0) {
                // Use formatted address or meaningful locality/sublocality
                const formatted = results[0].formatted_address;
                const components = results[0].address_components || [];
                const sublocality = components.find(c => c.types.includes('sublocality') || c.types.includes('neighborhood'))?.long_name;
                const locality = components.find(c => c.types.includes('locality'))?.long_name;
                
                if (sublocality && locality) {
                  resolve(`${sublocality}, ${locality}`);
                } else if (formatted) {
                  resolve(formatted);
                } else {
                  resolve(null);
                }
              } else {
                resolve(null);
              }
            });
          });
          if (googleResult) {
            resolvedAreaName = googleResult;
          }
        }
      } catch (e) {
        console.warn('Google geocoder lookup notice:', e);
      }

      // Tier 2: Reverse Geocode via OpenStreetMap Nominatim for exact locality & area name
      if (!resolvedAreaName) {
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
            headers: { 'Accept': 'application/json' }
          });
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              const placeOrColony = addr.suburb || addr.neighbourhood || addr.residential || addr.road || addr.village || addr.town || addr.hamlet || '';
              const talukOrCity = addr.town || addr.city || addr.state_district || 'Hyderabad';
              if (placeOrColony) {
                resolvedAreaName = `${placeOrColony}, ${talukOrCity}`;
              } else if (data.display_name) {
                const parts = data.display_name.split(',').map(s => s.trim());
                resolvedAreaName = parts.slice(0, 3).join(', ');
              }
            }
          }
        } catch (fetchErr) {
          console.warn('Nominatim reverse geocode notice:', fetchErr);
        }
      }

      // Tier 3: Corridor Proximity Matrix (Guarantees real landmark / area name, never raw coordinates)
      if (!resolvedAreaName) {
        resolvedAreaName = resolveCorridorProximityArea(lat, lng);
      }

      // Update Pickup Input and Global State
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

      const currentDrop = document.getElementById('inputDrop')?.value || 'Jangaon Bus Depot / Chowrasta';
      updateRouteOnMap(resolvedAreaName, currentDrop);

      if (typeof showToast === 'function') {
        showToast(`Area detected: ${resolvedAreaName}`, 'success');
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
