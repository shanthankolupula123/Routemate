const { getStore, saveStore } = require('../kyc-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }
  data = data || {};

  const list = getStore();
  const idx = list.findIndex(s => 
    (data.id && s.id === data.id) || 
    (data.phone && s.phone === data.phone) ||
    (data.email && s.email && s.email === data.email)
  );

  if (idx >= 0) {
    list[idx] = { ...list[idx], ...data };
  } else {
    list.unshift(data);
  }
  saveStore(list);

  return res.status(200).json({ success: true, count: list.length });
};
