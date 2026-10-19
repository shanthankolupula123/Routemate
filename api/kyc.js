const { getStore, saveStore } = require('./kyc-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const submissions = getStore();
    return res.status(200).json({ success: true, submissions });
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    const list = getStore();
    if (data.action === 'decision') {
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
    }

    // Default: Notify / Submit
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
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
