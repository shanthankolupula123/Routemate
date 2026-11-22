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

const NEGATIVE_KEYWORDS = [
  'rash', 'overspeed', 'speeding', 'fast', 'dangerous', 'danger', 'unsafe', 'accident', 'brake',
  'rude', 'abusive', 'abuse', 'misbehave', 'misbehavior', 'harass', 'harassment', 'shouted', 'yelled', 'threat', 'unprofessional',
  'dirty', 'smelly', 'stink', 'stinky', 'unclean', 'filthy', 'smoke', 'smoking', 'cigarette',
  'extra cash', 'overcharge', 'bribe', 'scam', 'cheat', 'demand', 'demanded money',
  'drunk', 'alcohol', 'wrong route', 'lost', 'phone while driving', 'no helmet', 'reckless', 'bad driving'
];

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
            riderId: r.rider_id || r.passenger_id || '',
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
            severity: r.severity || (r.is_safety_flag ? 'high' : 'low'),
            targetUserId: r.target_user_id || r.driver_id,
            targetUserRole: r.target_user_role || 'driver',
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
                const now = new Date();
                const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
                const warningObj = {
                  id: 'warn_' + Date.now().toString(36),
                  feedbackId: feedbackId || null,
                  notes: notes || 'Official Compliance Warning: Please strictly follow safety and community guidelines.',
                  issuedAt: now.toISOString(),
                  expires_at: expiresAt,
                  expiresAt: expiresAt,
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
              const now = new Date();
              const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
              kycList[kIdx].warning_count = (kycList[kIdx].warning_count || 0) + 1;
              kycList[kIdx].warning_alert = {
                notes,
                issuedAt: now.toISOString(),
                expires_at: expiresAt,
                expiresAt: expiresAt
              };
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

    // 3. New Passenger / Driver Post-Ride Rating & Safety Feedback Submission
    const rawRating = parseFloat(data.rating) || 5;
    const safetyTags = Array.isArray(data.safetyTags) ? data.safetyTags : (Array.isArray(data.tags) ? data.tags : []);
    const compliments = Array.isArray(data.compliments) ? data.compliments : [];
    const feedbackComment = String(data.feedbackText || data.comments || '').trim();
    const commentLower = feedbackComment.toLowerCase();

    // Smart Issue-Based Detection: scan for negative issue keywords in feedback body
    const matchedIssueKeywords = NEGATIVE_KEYWORDS.filter(kw => {
      return commentLower.includes(kw);
    });

    const isLowRating = rawRating <= 3;
    const hasSafetyTags = safetyTags.some(t => SAFETY_FLAG_TAGS.includes(t));
    const hasIssueKeywords = matchedIssueKeywords.length > 0;
    const isSafetyAlert = isLowRating || hasSafetyTags || hasIssueKeywords;

    let flagReasons = [];
    if (isLowRating) flagReasons.push(`Low Rating (${rawRating.toFixed(1)}★)`);
    if (hasSafetyTags) flagReasons.push(`Safety Tags: ${safetyTags.join(', ')}`);
    if (hasIssueKeywords) flagReasons.push(`Detected Issues: "${matchedIssueKeywords.join(', ')}"`);
    const flagReasonStr = isSafetyAlert ? flagReasons.join(' • ') : null;

    const severity = (rawRating <= 2 || matchedIssueKeywords.some(k => ['rash', 'drunk', 'abuse', 'harass', 'threat', 'accident'].includes(k)))
      ? 'high'
      : (isSafetyAlert ? 'medium' : 'low');

    const targetUserId = data.targetUserId || data.driverId || 'DRV-UNKNOWN';
    const targetUserRole = data.targetUserRole || 'driver';
    const reviewerId = data.reviewerId || data.riderId || '';
    const reviewerRole = data.reviewerRole || 'rider';

    const feedback = {
      id: data.id || ('FB-' + Date.now().toString(36).toUpperCase()),
      rideId: data.rideId || ('RIDE-' + Date.now().toString(36).toUpperCase()),
      passengerName: data.passengerName || 'Verified Commuter',
      passengerPhone: data.passengerPhone || '',
      riderId: reviewerId,
      driverId: targetUserRole === 'driver' ? targetUserId : (data.driverId || 'DRV-UNKNOWN'),
      driverName: data.driverName || 'Verified Driver',
      rating: rawRating,
      cleanlinessRating: parseInt(data.cleanlinessRating, 10) || (rawRating >= 4 ? 5 : 3),
      punctualityRating: parseInt(data.punctualityRating, 10) || (rawRating >= 4 ? 5 : 3),
      safetyRating: parseInt(data.safetyRating, 10) || (rawRating >= 4 ? 5 : 2),
      feedbackText: feedbackComment,
      safetyTags: safetyTags,
      compliments: compliments,
      is_safety_flag: isSafetyAlert,
      is_flagged: isSafetyAlert,
      flag_reason: flagReasonStr,
      severity: severity,
      targetUserId: targetUserId,
      targetUserRole: targetUserRole,
      reviewerId: reviewerId,
      reviewerRole: reviewerRole,
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
          rider_id: feedback.riderId,
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
          severity: feedback.severity,
          target_user_id: feedback.targetUserId,
          target_user_role: feedback.targetUserRole,
          reviewer_id: feedback.reviewerId,
          reviewer_role: feedback.reviewerRole,
          submitted_at: feedback.submittedAt
        })
      });
    } catch (e) {
      console.warn('[Feedbacks API] Supabase insert notice:', e.message);
    }

    // Dynamic Star Rating Calculation Engine: fetch all historical reviews and calculate real average
    let allRatings = [rawRating];
    try {
      const pastRes = await fetch(`${SUPABASE_URL}/rest/v1/feedbacks?${targetUserRole === 'driver' ? 'driver_id' : 'rider_id'}=eq.${encodeURIComponent(targetUserId)}&select=rating`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (pastRes.ok) {
        const pastRows = await pastRes.json();
        if (Array.isArray(pastRows)) {
          pastRows.forEach(r => {
            const v = parseFloat(r.rating);
            if (!isNaN(v) && v >= 1 && v <= 5) allRatings.push(v);
          });
        }
      }
    } catch (dbQueryErr) {
      console.warn('[Feedbacks API] Historical ratings query notice:', dbQueryErr.message);
    }

    const ratingsSum = allRatings.reduce((sum, r) => sum + r, 0);
    const avgRating = Number((ratingsSum / allRatings.length).toFixed(2));
    const totalReviews = allRatings.length;

    // Update target user's `profiles` record with dynamically computed rating
    try {
      const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?or=(id.eq.${encodeURIComponent(targetUserId)},phone.eq.${encodeURIComponent(targetUserId)})`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (pRes.ok) {
        const pRows = await pRes.json();
        if (pRows && pRows.length > 0) {
          const pRow = pRows[0];
          let meta = {};
          try {
            if (typeof pRow.role === 'string' && pRow.role.includes('{')) {
              meta = JSON.parse(pRow.role);
            }
          } catch (e) {}

          meta.rating = avgRating;
          meta.total_reviews = totalReviews;

          await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(pRow.id)}`, {
            method: 'PATCH',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              rating: avgRating,
              total_reviews: totalReviews,
              role: JSON.stringify(meta)
            })
          });
        }
      }
    } catch (pErr) {
      console.warn('[Feedbacks API] Profile rating update notice:', pErr.message);
    }

    // Also update local KYC store if target is driver
    if (targetUserRole === 'driver') {
      try {
        const { getStore: getKycStore, saveStore: saveKycStore } = require('./_kyc-store');
        const kycList = getKycStore();
        const kIdx = kycList.findIndex(s => s.id === targetUserId || s.user_id === targetUserId);
        if (kIdx !== -1) {
          kycList[kIdx].rating = avgRating;
          kycList[kIdx].total_reviews = totalReviews;
          saveKycStore(kycList);
        }
      } catch (e) {}
    }

    // If flagged as a Safety/Performance Alert, dispatch a push alert to Super Admin
    if (isSafetyAlert) {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipient_role: 'admin',
            type: 'safety',
            title: `🚨 Safety/Performance Alert: ${feedback.driverName}`,
            message: `Trip review #${feedback.id} flagged: ${feedback.flag_reason}. Immediate compliance review required.`,
            data: {
              feedbackId: feedback.id,
              driverId: feedback.driverId,
              driverName: feedback.driverName,
              rating: feedback.rating,
              flag_reason: feedback.flag_reason,
              severity: feedback.severity
            }
          })
        });
      } catch (nErr) {
        console.warn('[Feedbacks API] Notification insert notice:', nErr.message);
      }
    }

    list.unshift(feedback);
    saveStore(list);

    return res.status(200).json({
      success: true,
      feedback,
      updatedRating: avgRating,
      totalReviews: totalReviews
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
