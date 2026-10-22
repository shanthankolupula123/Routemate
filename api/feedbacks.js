const { getStore, saveStore } = require('./_feedbacks-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';

  if (req.method === 'GET') {
    const feedbacks = getStore();
    return res.status(200).json({ success: true, feedbacks });
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    let action = data.action;
    if (!action) {
      if (url.includes('/flag')) action = 'flag';
      else if (url.includes('/adjust-rating')) action = 'adjust-rating';
    }

    const list = getStore();

    // 1. Action: Flag / Unflag Feedback Review
    if (action === 'flag') {
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

    // 2. Action: Adjust Driver Rating
    if (action === 'adjust-rating') {
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

    // 3. New Customer Rating & Feedback Submission
    const feedback = {
      id: data.id || ('FB-' + Date.now().toString(36).toUpperCase()),
      rideId: data.rideId || ('RIDE-' + Date.now().toString(36).toUpperCase()),
      passengerName: data.passengerName || 'Passenger',
      passengerAvatar: data.passengerAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
      driverId: data.driverId || 'DRV-UNKNOWN',
      driverName: data.driverName || 'Verified Commuter',
      rating: parseFloat(data.rating) || 5,
      cleanlinessRating: parseInt(data.cleanlinessRating, 10) || 5,
      punctualityRating: parseInt(data.punctualityRating, 10) || 5,
      safetyRating: parseInt(data.safetyRating, 10) || 5,
      feedbackText: data.feedbackText || '',
      compliments: Array.isArray(data.compliments) ? data.compliments : [],
      submittedAt: data.submittedAt || new Date().toISOString(),
      is_flagged: false,
      flagged_at: null,
      flag_reason: null,
      is_moderated: false,
      moderated_at: null,
      moderation_reason: null
    };

    list.unshift(feedback);
    saveStore(list);

    return res.status(200).json({ success: true, feedback });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
