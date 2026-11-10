const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_PATH = path.join(os.tmpdir() || '/tmp', 'routemate_feedbacks_store.json');

const INITIAL_SEEDS = [];

function getStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data)) {
        // Strip out any legacy test/mock seed data
        return data.filter(item => !item.id?.startsWith('FB-TEST') && item.driverId !== 'drv_sample_1' && item.driverId !== 'drv_sample_2');
      }
    }
  } catch (e) {}
  return [];
}

function saveStore(list) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

module.exports = { getStore, saveStore, INITIAL_SEEDS };
