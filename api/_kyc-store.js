const fs = require('fs');
const path = require('path');
const os = require('os');

const STORE_PATH = path.join(os.tmpdir() || '/tmp', 'routemate_kyc_store.json');

function getStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function saveStore(list) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

module.exports = { getStore, saveStore };
