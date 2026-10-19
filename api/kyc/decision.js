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
  const target = list.find(s => 
    s.id === data.id || 
    (s.phone && s.phone === data.id) || 
    (s.email && s.email === data.id)
  );

  if (target) {
    target.kyc_status = data.status;
    target.is_kyc_verified = data.status === 'verified_success';
    if (data.updateData) {
      Object.assign(target, data.updateData);
    }
    saveStore(list);
  }

  return res.status(200).json({ success: true });
};
