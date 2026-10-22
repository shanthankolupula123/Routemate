const { getStore, saveStore } = require('../_feedbacks-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    const list = getStore();
    const feedbackId = data.feedbackId || data.id;
    const fb = list.find(f => f.id === feedbackId);

    if (fb) {
      fb.is_flagged = data.isFlagged !== undefined ? Boolean(data.isFlagged) : !fb.is_flagged;
      fb.flagged_at = fb.is_flagged ? new Date().toISOString() : null;
      fb.flag_reason = data.reason || 'Flagged by supervisor for safety review';
      saveStore(list);
      return res.status(200).json({ success: true, feedback: fb });
    }

    return res.status(404).json({ success: false, error: 'Feedback not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
