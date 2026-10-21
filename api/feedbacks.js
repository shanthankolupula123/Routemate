const { getStore, saveStore } = require('./feedbacks-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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

    const list = getStore();

    // 1. Action: Flag / Unflag Feedback Review
    if (data.action === 'flag') {
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
    if (data.action === 'adjust-rating') {
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
      rideId: data.rideId || data.ride_id || null,
      driverId: data.driverId || data.driver_id || null,
      driverName: data.driverName || data.driver_name || 'Verified Commuter',
      driverPhone: data.driverPhone || data.driver_phone || null,
      driverAvatar: data.driverAvatar || data.driver_avatar || null,
      driverVehicle: data.driverVehicle || data.driver_vehicle || 'Commuter Vehicle',
      riderId: data.riderId || data.rider_id || null,
      riderName: data.riderName || data.rider_name || 'Commuter',
      riderPhone: data.riderPhone || data.rider_phone || null,
      rating: parseFloat(data.rating || 5.0),
      tags: Array.isArray(data.tags) ? data.tags : [],
      feedbackText: data.feedbackText || data.feedback_text || '',
      hasSafetyConcern: Boolean(data.hasSafetyConcern || data.has_safety_concern),
      route: data.route || 'Uppal ➔ Jangaon',
      createdAt: data.createdAt || data.created_at || new Date().toISOString()
    };

    list.unshift(feedback);
    saveStore(list);

    return res.status(200).json({ success: true, feedback });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
