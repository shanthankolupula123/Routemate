const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join('/tmp', 'routemate_feedbacks_store.json');

const INITIAL_SEEDS = [];

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
