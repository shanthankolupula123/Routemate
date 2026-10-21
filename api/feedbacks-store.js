const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join('/tmp', 'routemate_feedbacks_store.json');

const INITIAL_SEEDS = [
  {
    id: 'FB-SEED-01',
    rideId: 'RIDE-101',
    driverId: 'DRV-1',
    driverName: 'Ramesh Kumar',
    driverPhone: '+91 94942 85249',
    driverAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    driverVehicle: 'Bajaj Pulsar 150 (TS 08 EK 4321)',
    riderId: 'USR-881',
    riderName: 'Ananya Verma',
    riderPhone: '+91 98480 23145',
    rating: 5.0,
    tags: ['Safe Driving', 'On Time', 'Clean Vehicle'],
    feedbackText: 'Very smooth highway ride, followed speed limits and wore helmet. Highly recommended!',
    hasSafetyConcern: false,
    route: 'Uppal Ring Road Metro ➔ Jangaon Railway Station',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  },
  {
    id: 'FB-SEED-02',
    rideId: 'RIDE-102',
    driverId: 'DRV-2',
    driverName: 'Suresh Varma',
    driverPhone: '+91 91234 56780',
    driverAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    driverVehicle: 'Hero Splendor Plus (TS 08 AB 9812)',
    riderId: 'USR-902',
    riderName: 'Kavitha Reddy',
    riderPhone: '+91 99887 76655',
    rating: 2.0,
    tags: ['Rash Driving'],
    feedbackText: 'Driver was speeding aggressively on the highway corridor and taking continuous phone calls. Passenger safety was neglected.',
    hasSafetyConcern: true,
    route: 'Uppal X Roads ➔ Bhongir Bypass',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'FB-SEED-03',
    rideId: 'RIDE-103',
    driverId: 'DRV-3',
    driverName: 'Priya Sharma',
    driverPhone: '+91 79890 31924',
    driverAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&h=120&q=80',
    driverVehicle: 'Maruti Suzuki Swift VXi (TS 09 FH 9182)',
    riderId: 'USR-773',
    riderName: 'Rahul Mehra',
    riderPhone: '+91 98490 11223',
    rating: 4.0,
    tags: ['Clean Vehicle', 'Polite & Friendly'],
    feedbackText: 'Comfortable AC car ride from Uppal to Jangaon. Punctual departure and polite driver.',
    hasSafetyConcern: false,
    route: 'Uppal X Roads ➔ Jangaon Court Chowrasta',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

function getStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {}
  return INITIAL_SEEDS.slice();
}

function saveStore(list) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

module.exports = { getStore, saveStore, INITIAL_SEEDS };
