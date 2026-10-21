const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_PATH = path.join(os.tmpdir(), 'routemate_active_ride.json');
let inMemoryActive = null;

function getActiveRide() {
  if (inMemoryActive) return inMemoryActive;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(content || 'null');
      if (data && data.id) {
        // Expire requests older than 15 minutes
        const createdAt = new Date(data.createdAt || data.created_at || 0).getTime();
        if (Date.now() - createdAt < 15 * 60 * 1000) {
          inMemoryActive = data;
          return data;
        }
      }
    }
  } catch (e) {}
  return null;
}

function saveActiveRide(ride) {
  inMemoryActive = ride;
  try {
    if (ride) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(ride), 'utf8');
    } else if (fs.existsSync(STORE_PATH)) {
      fs.unlinkSync(STORE_PATH);
    }
  } catch (e) {}
}

function clearActiveRide() {
  inMemoryActive = null;
  try {
    if (fs.existsSync(STORE_PATH)) {
      fs.unlinkSync(STORE_PATH);
    }
  } catch (e) {}
}

module.exports = {
  getActiveRide,
  saveActiveRide,
  clearActiveRide
};
