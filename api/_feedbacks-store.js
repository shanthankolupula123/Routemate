const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_PATH = path.join(os.tmpdir() || '/tmp', 'routemate_feedbacks_store.json');

const INITIAL_SEEDS = [
  {
    id: 'FB-TEST-001',
    rideId: 'RIDE-UPPAL-01',
    passengerName: 'Ananya Sharma',
    passengerPhone: '+91 98480 87654',
    driverId: 'drv_sample_1',
    driverName: 'Vikram Reddy',
    rating: 2.0,
    cleanlinessRating: 4,
    punctualityRating: 3,
    safetyRating: 1,
    feedbackText: 'Driver was cutting lanes very aggressively on the NH163 highway near Ghatkesar and overtaking heavy trucks at high speed.',
    safetyTags: ['Rash Driving', 'Over-speeding'],
    compliments: [],
    is_safety_flag: true,
    is_flagged: true,
    flag_reason: 'Rider reported rash driving and unsafe highway overtaking',
    submittedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    admin_action: null,
    admin_action_at: null,
    admin_action_by: null
  },
  {
    id: 'FB-TEST-002',
    rideId: 'RIDE-UPPAL-02',
    passengerName: 'Rahul Verma',
    passengerPhone: '+91 97000 12345',
    driverId: 'drv_sample_2',
    driverName: 'Ramesh Kumar',
    rating: 5.0,
    cleanlinessRating: 5,
    punctualityRating: 5,
    safetyRating: 5,
    feedbackText: 'Very calm and smooth ride. Reached Jangaon station on time. Provided extra helmet as promised.',
    safetyTags: [],
    compliments: ['Smooth & Safe Ride', 'Polite Driver', 'On Time'],
    is_safety_flag: false,
    is_flagged: false,
    flag_reason: null,
    submittedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    admin_action: null,
    admin_action_at: null,
    admin_action_by: null
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
