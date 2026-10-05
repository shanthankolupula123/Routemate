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

// Attach Places Autocomplete to Pickup & Drop inputs
function attachPlacesAutocomplete() {
  if (!google.maps.places) return;

  const pickupInput = document.getElementById('inputPickup');
  const dropInput = document.getElementById('inputDrop');

  const options = {
    componentRestrictions: { country: 'in' },
    fields: ['address_components', 'geometry', 'name', 'formatted_address']
  };

  if (pickupInput) {
    try {
      gPickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
      gPickupAutocomplete.addListener('place_changed', () => {
        const place = gPickupAutocomplete.getPlace();
        if (place && place.name) {
          pickupInput.value = place.formatted_address || place.name;
          if (typeof state !== 'undefined') {
            state.pickup = pickupInput.value;
          }
          const currentDrop = document.getElementById('inputDrop')?.value || 'Jangaon';
          updateRouteOnMap(pickupInput.value, currentDrop);
        }
      });
    } catch (e) {
      console.warn('Autocomplete setup for pickup input skipped:', e);
    }
  }

  if (dropInput) {
    try {
      gDropAutocomplete = new google.maps.places.Autocomplete(dropInput, options);
      gDropAutocomplete.addListener('place_changed', () => {
        const place = gDropAutocomplete.getPlace();
        if (place && place.name) {
          dropInput.value = place.formatted_address || place.name;
          if (typeof state !== 'undefined') {
            state.drop = dropInput.value;
          }
          const currentPickup = document.getElementById('inputPickup')?.value || 'Uppal, Hyderabad';
          updateRouteOnMap(currentPickup, dropInput.value);
        }
      });
    } catch (e) {
      console.warn('Autocomplete setup for drop input skipped:', e);
    }
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

// Export to window
window.initGoogleMap = initGoogleMap;
window.updateRouteOnMap = updateRouteOnMap;
window.toggleMapTraffic = toggleMapTraffic;
window.recenterMapOnCorridor = recenterMapOnCorridor;
