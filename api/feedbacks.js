const fs = require('fs');
const path = require('path');
const { getStore, saveStore } = require('./_feedbacks-store');

// Load environment variables locally if present
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
          if (!process.env[k]) process.env[k] = v;
        }
      }
    });
  } catch (e) {}
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
const SUPER_ADMIN_EMAIL = 'shanthankolupula123@gmail.com';

const SAFETY_FLAG_TAGS = ['Rash Driving', 'Over-speeding', 'Rude Behavior', 'Vehicle Not Clean', 'Wrong Route', 'Extra Cash Demand'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, x-admin-email');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';

  // -------------------------------------------------------------------------
  // GET: Fetch All Driver Feedbacks & Safety Ratings
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    let feedbacks = [];

    // Try Supabase first
    try {
      const supaRes = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?select=*&order=submitted_at.desc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (Array.isArray(rows)) {
          feedbacks = rows.map(r => ({
            id: r.id,
            rideId: r.ride_id,
            passengerName: r.passenger_name,
            passengerPhone: r.passenger_phone,
            driverId: r.driver_id,
            driverName: r.driver_name,
            rating: Number(r.rating || 5),
            safetyRating: Number(r.safety_rating || 5),
            cleanlinessRating: Number(r.cleanliness_rating || 5),
            punctualityRating: Number(r.punctuality_rating || 5),
            feedbackText: r.feedback_text || '',
            safetyTags: Array.isArray(r.safety_tags) ? r.safety_tags : [],
            compliments: Array.isArray(r.compliments) ? r.compliments : [],
            is_safety_flag: Boolean(r.is_safety_flag),
            is_flagged: Boolean(r.is_flagged || r.is_safety_flag),
            flag_reason: r.flag_reason || '',
            submittedAt: r.submitted_at,
            admin_action: r.admin_action || null,
            admin_action_at: r.admin_action_at || null,
            admin_action_by: r.admin_action_by || null
          }));
        }
      }
    } catch (e) {
      console.warn('[Feedbacks API] Supabase query notice:', e.message);
    }

    // Filter out any mock/test feedbacks so only real user ratings exist
    feedbacks = (feedbacks || []).filter(f => !f.id?.startsWith('FB-TEST') && f.driverId !== 'drv_sample_1' && f.driverId !== 'drv_sample_2');

    // Merge with persistent file store
    const localStore = (getStore() || []).filter(f => !f.id?.startsWith('FB-TEST') && f.driverId !== 'drv_sample_1' && f.driverId !== 'drv_sample_2');
    localStore.forEach(localItem => {
      const exists = feedbacks.find(f => f.id === localItem.id);
      if (!exists) {
        feedbacks.push(localItem);
      }
    });

    return res.status(200).json({ success: true, feedbacks });
  }

  // -------------------------------------------------------------------------
  // POST: Submit Feedback or Trigger Admin Safety Actions
  // -------------------------------------------------------------------------
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
      else if (url.includes('/safety-action')) action = 'safety_action';
    }

    const list = getStore();

    // 1. Super Admin Safety Actions (Warning, Block / Suspend, Resolve)
    if (action === 'safety_action') {
      const { feedbackId, driverId, actionType, notes } = data;
      const cleanAdmin = String(data.adminEmail || data.admin_email || req.headers['x-admin-email'] || '').trim().toLowerCase();

      if (cleanAdmin !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only authorized compliance management team can execute driver safety actions.'
        });
      }

      const fb = list.find(f => f.id === feedbackId);
      if (fb) {
        fb.admin_action = actionType;
        fb.admin_action_at = new Date().toISOString();
        fb.admin_action_by = cleanAdmin;
        fb.admin_notes = notes || '';
      }

      // Update Supabase feedback row if exists
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?id=eq.${encodeURIComponent(feedbackId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            admin_action: actionType,
            admin_action_at: new Date().toISOString(),
            admin_action_by: cleanAdmin
          })
        });
      } catch (e) {}

      // Update target driver in Supabase `profiles` table and local KYC store
      const targetDriverId = driverId || (fb && fb.driverId);
      if (targetDriverId) {
        try {
          const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?or=(id.eq.${encodeURIComponent(targetDriverId)},phone.eq.${encodeURIComponent(targetDriverId)},role.ilike.*${encodeURIComponent(targetDriverId)}*)&select=*&limit=1`, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`
            }
          });
          if (profRes.ok) {
            const rows = await profRes.json();
            if (rows && rows.length > 0) {
              const pRow = rows[0];
              let meta = {};
              try {
                if (typeof pRow.role === 'string' && (pRow.role.startsWith('{') || pRow.role.includes('{'))) {
                  meta = JSON.parse(pRow.role);
                }
              } catch (e) {}

              if (actionType === 'block' || actionType === 'suspend') {
                meta.kyc_status = 'suspended';
                meta.is_suspended = true;
                meta.suspension_reason = notes || `Driver account suspended by Super Admin due to safety report #${feedbackId || 'ALERT'}`;
                meta.suspended_at = new Date().toISOString();
                meta.suspended_by = cleanAdmin;
                if (meta.vehicles && Array.isArray(meta.vehicles)) {
                  meta.vehicles.forEach(v => { v.status = 'suspended'; });
                }

                await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(pRow.id)}`, {
                  method: 'PATCH',
                  headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    role: JSON.stringify(meta),
                    is_verified: false
                  })
                });
              } else if (actionType === 'warning') {
                const warningObj = {
                  id: 'warn_' + Date.now().toString(36),
                  feedbackId: feedbackId || null,
                  notes: notes || 'Official Compliance Warning: Please strictly follow safety and community guidelines.',
                  issuedAt: new Date().toISOString(),
                  issuedBy: cleanAdmin
                };
                if (!Array.isArray(meta.warnings)) meta.warnings = [];
                meta.warnings.unshift(warningObj);
                meta.warning_count = meta.warnings.length;
                meta.warning_alert = warningObj;

                await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(pRow.id)}`, {
                  method: 'PATCH',
                  headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    role: JSON.stringify(meta)
                  })
                });
              } else if (actionType === 'unsuspend' || actionType === 'resolve') {
                if (meta.kyc_status === 'suspended') {
                  meta.kyc_status = 'approved';
                  meta.is_suspended = false;
                  meta.suspension_reason = null;
                }
                meta.warning_alert = null;

                await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(pRow.id)}`, {
                  method: 'PATCH',
                  headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    role: JSON.stringify(meta),
                    is_verified: meta.kyc_status === 'approved'
                  })
                });
              }
            }
          }
        } catch (e) {
          console.warn('[feedbacks.js safety_action] Error updating driver profile:', e.message);
        }

        // Also update local kyc store if driver exists there
        try {
          const { getStore: getKycStore, saveStore: saveKycStore } = require('./_kyc-store');
          const kycList = getKycStore();
          const kIdx = kycList.findIndex(s => s.id === targetDriverId || s.user_id === targetDriverId);
          if (kIdx !== -1) {
            if (actionType === 'block' || actionType === 'suspend') {
              kycList[kIdx].status = 'suspended';
              kycList[kIdx].rejection_reason = notes || 'Driver account suspended by Super Admin due to safety report';
            } else if (actionType === 'warning') {
              kycList[kIdx].warning_count = (kycList[kIdx].warning_count || 0) + 1;
              kycList[kIdx].warning_alert = { notes, issuedAt: new Date().toISOString() };
            } else if (actionType === 'unsuspend') {
              kycList[kIdx].status = 'approved';
              kycList[kIdx].rejection_reason = null;
            }
            saveKycStore(kycList);
          }
        } catch (e) {}
      }

      saveStore(list);
      return res.status(200).json({
        success: true,
        message: `Safety action '${actionType}' recorded successfully.`,
        actionType,
        feedback: fb
      });
    }

    // 2. Action: Flag / Unflag Feedback Review
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

    // 3. New Passenger Post-Ride Rating & Safety Feedback Submission
    const rawRating = parseFloat(data.rating) || 5;
    const safetyTags = Array.isArray(data.safetyTags) ? data.safetyTags : (Array.isArray(data.tags) ? data.tags : []);
    const compliments = Array.isArray(data.compliments) ? data.compliments : [];

    // Automatically detect safety violation
    const hasSafetyViolation = rawRating <= 3 || safetyTags.some(t => SAFETY_FLAG_TAGS.includes(t));

    const feedback = {
      id: data.id || ('FB-' + Date.now().toString(36).toUpperCase()),
      rideId: data.rideId || ('RIDE-' + Date.now().toString(36).toUpperCase()),
      passengerName: data.passengerName || 'Verified Commuter',
      passengerPhone: data.passengerPhone || '',
      driverId: data.driverId || 'DRV-UNKNOWN',
      driverName: data.driverName || 'Verified Driver',
      rating: rawRating,
      cleanlinessRating: parseInt(data.cleanlinessRating, 10) || (rawRating >= 4 ? 5 : 3),
      punctualityRating: parseInt(data.punctualityRating, 10) || (rawRating >= 4 ? 5 : 3),
      safetyRating: parseInt(data.safetyRating, 10) || (rawRating >= 4 ? 5 : 2),
      feedbackText: data.feedbackText || data.comments || '',
      safetyTags: safetyTags,
      compliments: compliments,
      is_safety_flag: hasSafetyViolation,
      is_flagged: hasSafetyViolation,
      flag_reason: hasSafetyViolation ? (safetyTags.join(', ') || 'Low rider safety rating') : null,
      submittedAt: data.submittedAt || new Date().toISOString(),
      admin_action: null,
      admin_action_at: null,
      admin_action_by: null
    };

    // Save to Supabase `feedbacks` table
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/feedbacks`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: feedback.id,
          ride_id: feedback.rideId,
          passenger_name: feedback.passengerName,
          passenger_phone: feedback.passengerPhone,
          driver_id: feedback.driverId,
          driver_name: feedback.driverName,
          rating: feedback.rating,
          cleanliness_rating: feedback.cleanlinessRating,
          punctuality_rating: feedback.punctualityRating,
          safety_rating: feedback.safetyRating,
          feedback_text: feedback.feedbackText,
          safety_tags: feedback.safetyTags,
          compliments: feedback.compliments,
          is_safety_flag: feedback.is_safety_flag,
          is_flagged: feedback.is_flagged,
          flag_reason: feedback.flag_reason,
          submitted_at: feedback.submittedAt
        })
      });
    } catch (e) {
      console.warn('[Feedbacks API] Supabase insert notice:', e.message);
    }

    list.unshift(feedback);
    saveStore(list);

    return res.status(200).json({ success: true, feedback });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
