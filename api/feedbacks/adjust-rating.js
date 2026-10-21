const { getStore, saveStore } = require('../feedbacks-store');

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
    const newRating = parseFloat(data.newRating || data.rating);
    const reason = data.reason || 'Rating moderated by administrator';
    const fb = list.find(f => f.id === feedbackId);

    if (fb) {
      fb.original_rating = fb.rating;
      fb.rating = newRating;
      fb.is_moderated = true;
      fb.moderated_at = new Date().toISOString();
      fb.moderation_reason = reason;
      saveStore(list);
      return res.status(200).json({ success: true, feedback: fb });
    }

    return res.status(404).json({ success: false, error: 'Feedback not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
