// Serverless Function: /api/driver-kyc (Production Driver KYC & Super Admin Approval)
const fs = require('fs');
const path = require('path');
const { getStore, saveStore } = require('./_kyc-store');

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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // GET: Retrieve Driver KYC Submissions or User Status
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    const { userId, email } = req.query || {};

    let allSubmissions = [];

    // 1. Try fetching directly from Supabase `driver_kyc` table
    try {
      let queryUrl = `${SUPABASE_URL}/rest/v1/driver_kyc?select=*&order=submitted_at.desc`;
      if (userId) {
        queryUrl = `${SUPABASE_URL}/rest/v1/driver_kyc?user_id=eq.${encodeURIComponent(userId)}&select=*&order=submitted_at.desc&limit=1`;
      }
      const supaRes = await fetch(queryUrl, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (supaRes.ok) {
        const rows = await supaRes.json();
        if (Array.isArray(rows)) {
          allSubmissions = rows;
        }
      }
    } catch (e) {
      console.warn('[Driver KYC API] Supabase table query notice:', e.message);
    }

    // 2. Fallback / Merge with persistent file store
    const storeSubmissions = getStore() || [];
    storeSubmissions.forEach(item => {
      const exists = allSubmissions.find(s => 
        (s.id && s.id === item.id) || 
        (s.user_id && s.user_id === item.user_id) || 
        (s.driver_email && s.driver_email === item.driver_email)
      );
      if (!exists) {
        allSubmissions.push(item);
      }
    });

    // 3. Fallback / Merge with Supabase `profiles` table
    try {
      let profileQuery = `${SUPABASE_URL}/rest/v1/profiles?select=*`;
      if (userId) {
        profileQuery = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`;
      }
      const profRes = await fetch(profileQuery, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      if (profRes.ok) {
        const pRows = await profRes.json();
        if (Array.isArray(pRows)) {
          pRows.forEach(p => {
            let extra = {};
            if (p.role && typeof p.role === 'string' && (p.role.trim().startsWith('{') || p.role.includes('kyc'))) {
              try { extra = JSON.parse(p.role); } catch (e) {}
            }
            if (extra.kyc_status || extra.dl_number) {
              const matched = allSubmissions.find(s => s.user_id === p.id || s.id === p.id);
              if (!matched) {
                allSubmissions.push({
                  id: p.id,
                  user_id: p.id,
                  driver_name: extra.driver_name || p.name,
                  driver_phone: p.phone,
                  driver_email: extra.driver_email || (p.phone && p.phone.includes('@') ? p.phone : ''),
                  driver_photo: extra.driver_photo || p.avatar_url,
                  dl_number: extra.dl_number || '',
                  dl_front_photo: extra.dl_front_photo || '',
                  dl_back_photo: extra.dl_back_photo || '',
                  aadhaar_number: extra.aadhaar_number || '',
                  aadhaar_front_photo: extra.aadhaar_front_photo || '',
                  aadhaar_back_photo: extra.aadhaar_back_photo || '',
                  vehicle_number: extra.vehicle_number || '',
                  rc_photo: extra.rc_photo || '',
                  status: extra.kyc_status || (p.is_verified ? 'approved' : 'pending'),
                  submitted_at: extra.submitted_at || p.created_at || new Date().toISOString()
                });
              }
            }
          });
        }
      }
    } catch (e) {}

    // Ensure each submission has a populated vehicles array
    allSubmissions.forEach(sub => {
      if (!sub.vehicles || !Array.isArray(sub.vehicles) || sub.vehicles.length === 0) {
        if (sub.vehicle_number) {
          sub.vehicles = [
            {
              id: 'veh_primary_' + (sub.id || sub.user_id),
              user_id: sub.user_id || sub.id,
              vehicle_number: sub.vehicle_number,
              vehicle_type: sub.vehicle_type || 'bike',
              vehicle_name: sub.vehicle_name || (sub.vehicle_type === 'car' ? 'Car Seat' : (sub.vehicle_type === 'auto' ? 'Auto' : 'Two-Wheeler / Bike')),
              rc_photo: sub.rc_photo,
              status: sub.status || 'pending',
              is_default: true,
              submitted_at: sub.submitted_at || new Date().toISOString()
            }
          ];
        } else {
          sub.vehicles = [];
        }
      }
    });

    if (userId) {
      const userSub = allSubmissions.find(s => s.user_id === userId || s.id === userId);
      return res.status(200).json({
        success: true,
        submission: userSub || null,
        vehicles: userSub ? (userSub.vehicles || []) : [],
        status: userSub ? userSub.status : 'not_submitted'
      });
    }

    return res.status(200).json({
      success: true,
      submissions: allSubmissions
    });
  }

  // -------------------------------------------------------------------------
  // POST: Submit KYC or Admin Decision (Approve / Reject)
  // -------------------------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const action = body.action || 'submit';

    // -----------------------------------------------------------------------
    // ACTION: Admin Decision (Approve or Reject)
    // -----------------------------------------------------------------------
    if (action === 'decision') {
      const { id, userId, status, rejectionReason, adminEmail } = body;

      const cleanAdmin = String(adminEmail || '').trim().toLowerCase();
      if (cleanAdmin !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only Super Admin (shanthankolupula123@gmail.com) can review driver KYC submissions.'
        });
      }

      if (!status || !['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status parameter.' });
      }

      const targetId = userId || id;
      if (!targetId) {
        return res.status(400).json({ success: false, error: 'Target driver ID is required.' });
      }

      const isApproved = status === 'approved';

      // 1. Update Supabase `driver_kyc` table
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/driver_kyc?or=(id.eq.${encodeURIComponent(targetId)},user_id.eq.${encodeURIComponent(targetId)})`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status,
            rejection_reason: isApproved ? null : (rejectionReason || 'Documents did not meet criteria'),
            reviewed_at: new Date().toISOString(),
            reviewed_by: cleanAdmin
          })
        });
      } catch (e) {}

      // 2. Update Supabase `profiles` table
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(targetId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            is_verified: isApproved,
            role: isApproved ? 'driver' : 'Daily Commuter'
          })
        });
      } catch (e) {}

      // 3. Update persistent store
      const list = getStore();
      const idx = list.findIndex(s => s.id === targetId || s.user_id === targetId || s.driver_email === body.email);
      if (idx !== -1) {
        list[idx].status = status;
        list[idx].rejection_reason = isApproved ? null : rejectionReason;
        list[idx].reviewed_at = new Date().toISOString();
        list[idx].reviewed_by = cleanAdmin;
        if (isApproved && list[idx].vehicles) {
          list[idx].vehicles.forEach(v => {
            if (v.status === 'pending') v.status = 'approved';
          });
        }
        saveStore(list);
      }

      return res.status(200).json({
        success: true,
        message: isApproved ? 'Driver successfully approved!' : 'Driver KYC rejected.',
        status,
        targetId
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: Add Another Vehicle (Secondary Vehicle KYC Submission)
    // -----------------------------------------------------------------------
    if (action === 'add_vehicle') {
      const { user_id, vehicle_number, vehicle_type, vehicle_name, rc_photo } = body;

      if (!user_id || !vehicle_number || !rc_photo) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Number and Registration Certificate (RC) photo are mandatory.'
        });
      }

      const cleanVehNum = String(vehicle_number).trim().toUpperCase();
      const list = getStore();
      let sub = list.find(s => s.user_id === user_id || s.id === user_id || s.driver_email === body.driver_email);

      if (!sub) {
        sub = {
          id: user_id,
          user_id,
          driver_name: body.driver_name || 'Driver',
          driver_email: body.driver_email || '',
          driver_phone: body.driver_phone || '',
          status: 'approved',
          vehicles: []
        };
        list.push(sub);
      }

      if (!sub.vehicles || !Array.isArray(sub.vehicles)) {
        sub.vehicles = [];
      }

      // Check for duplicate vehicle number
      const existing = sub.vehicles.find(v => v.vehicle_number === cleanVehNum);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `Vehicle ${cleanVehNum} is already registered under your account.`
        });
      }

      const newVehicle = {
        id: 'veh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        user_id,
        vehicle_number: cleanVehNum,
        vehicle_type: vehicle_type || 'bike',
        vehicle_name: vehicle_name || (vehicle_type === 'car' ? 'Car Seat' : (vehicle_type === 'auto' ? 'Auto' : 'Bike')),
        rc_photo,
        status: 'pending', // Strictly Pending Super Admin review
        is_default: sub.vehicles.length === 0,
        submitted_at: new Date().toISOString()
      };

      sub.vehicles.push(newVehicle);
      saveStore(list);

      // Best effort sync to Supabase driver_kyc notes
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/driver_kyc?or=(id.eq.${encodeURIComponent(user_id)},user_id.eq.${encodeURIComponent(user_id)})`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            notes: JSON.stringify({ vehicles: sub.vehicles })
          })
        });
      } catch (e) {}

      return res.status(200).json({
        success: true,
        message: 'New vehicle submitted successfully! Super Admin will review your RC document.',
        vehicle: newVehicle,
        vehicles: sub.vehicles
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: Switch Active Vehicle
    // -----------------------------------------------------------------------
    if (action === 'switch_vehicle') {
      const { user_id, vehicle_id } = body;
      const list = getStore();
      const sub = list.find(s => s.user_id === user_id || s.id === user_id);

      if (!sub || !sub.vehicles) {
        return res.status(404).json({ success: false, error: 'Vehicle records not found.' });
      }

      const target = sub.vehicles.find(v => v.id === vehicle_id);
      if (!target) {
        return res.status(404).json({ success: false, error: 'Vehicle not found.' });
      }

      if (target.status !== 'approved') {
        return res.status(400).json({
          success: false,
          error: 'This vehicle is pending Super Admin verification. You can only drive with approved vehicles.'
        });
      }

      sub.vehicles.forEach(v => {
        v.is_default = (v.id === vehicle_id);
      });
      sub.vehicle_number = target.vehicle_number;
      sub.vehicle_type = target.vehicle_type;
      saveStore(list);

      return res.status(200).json({
        success: true,
        message: `Switched active driving vehicle to ${target.vehicle_name || target.vehicle_number}`,
        activeVehicle: target,
        vehicles: sub.vehicles
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: Super Admin Decision for Secondary Vehicle
    // -----------------------------------------------------------------------
    if (action === 'vehicle_decision') {
      const { adminEmail, user_id, vehicle_id, status, rejectionReason } = body;
      const cleanAdmin = String(adminEmail || '').trim().toLowerCase();

      if (cleanAdmin !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
          success: false,
          error: 'Unauthorized: Only Super Admin (shanthankolupula123@gmail.com) can verify vehicles.'
        });
      }

      const list = getStore();
      const sub = list.find(s => s.user_id === user_id || s.id === user_id || (s.vehicles && s.vehicles.some(v => v.id === vehicle_id)));

      if (!sub || !sub.vehicles) {
        return res.status(404).json({ success: false, error: 'Driver vehicles not found.' });
      }

      const targetVeh = sub.vehicles.find(v => v.id === vehicle_id);
      if (!targetVeh) {
        return res.status(404).json({ success: false, error: 'Target vehicle not found.' });
      }

      targetVeh.status = status;
      targetVeh.rejection_reason = (status === 'rejected') ? (rejectionReason || 'RC document not clear') : null;
      targetVeh.reviewed_at = new Date().toISOString();
      targetVeh.reviewed_by = cleanAdmin;

      if (status === 'approved' && !sub.vehicles.some(v => v.is_default && v.status === 'approved')) {
        targetVeh.is_default = true;
        sub.vehicle_number = targetVeh.vehicle_number;
        sub.vehicle_type = targetVeh.vehicle_type;
      }

      saveStore(list);

      return res.status(200).json({
        success: true,
        message: `Vehicle ${targetVeh.vehicle_number} status updated to ${status}!`,
        vehicle: targetVeh,
        vehicles: sub.vehicles
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: Driver Document Upload & Submission
    // -----------------------------------------------------------------------
    const {
      user_id,
      driver_name,
      driver_phone,
      driver_email,
      driver_photo,
      dl_number,
      dl_front_photo,
      dl_back_photo,
      aadhaar_number,
      aadhaar_front_photo,
      aadhaar_back_photo,
      vehicle_number,
      rc_photo
    } = body;

    if (!user_id || !driver_name || !dl_number || !aadhaar_number || !vehicle_number) {
      return res.status(400).json({
        success: false,
        error: 'Missing mandatory fields: Name, DL Number, Aadhaar Number, and Vehicle Number are required.'
      });
    }

    if (!dl_front_photo || !dl_back_photo) {
      return res.status(400).json({
        success: false,
        error: 'Both front and back photos of your Driving License are mandatory.'
      });
    }

    if (!aadhaar_front_photo || !aadhaar_back_photo) {
      return res.status(400).json({
        success: false,
        error: 'Both front and back photos of your Aadhaar Card are mandatory.'
      });
    }

    if (!rc_photo) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle Registration Certificate (RC) document photo is mandatory.'
      });
    }

    const submissionRecord = {
      id: user_id,
      user_id,
      driver_name: String(driver_name).trim(),
      driver_phone: String(driver_phone || '').trim(),
      driver_email: String(driver_email || '').trim().toLowerCase(),
      driver_photo: driver_photo || null,
      dl_number: String(dl_number).trim().toUpperCase(),
      dl_front_photo,
      dl_back_photo,
      aadhaar_number: String(aadhaar_number).replace(/\s/g, '').trim(),
      aadhaar_front_photo,
      aadhaar_back_photo,
      vehicle_number: String(vehicle_number).trim().toUpperCase(),
      rc_photo,
      status: 'pending', // Strictly Pending Approval
      rejection_reason: null,
      submitted_at: new Date().toISOString()
    };

    // 1. Save to Supabase `driver_kyc` table
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/driver_kyc`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(submissionRecord)
      });
    } catch (supaErr) {
      console.warn('[Driver KYC API] driver_kyc table insert notice:', supaErr.message);
    }

    // 2. Sync to Supabase `profiles` table
    try {
      const kycRoleMetadata = JSON.stringify({
        kyc_status: 'pending',
        driver_name: submissionRecord.driver_name,
        driver_email: submissionRecord.driver_email,
        driver_photo: submissionRecord.driver_photo,
        dl_number: submissionRecord.dl_number,
        dl_front_photo: submissionRecord.dl_front_photo,
        dl_back_photo: submissionRecord.dl_back_photo,
        aadhaar_number: submissionRecord.aadhaar_number,
        aadhaar_front_photo: submissionRecord.aadhaar_front_photo,
        aadhaar_back_photo: submissionRecord.aadhaar_back_photo,
        vehicle_number: submissionRecord.vehicle_number,
        rc_photo: submissionRecord.rc_photo,
        submitted_at: submissionRecord.submitted_at
      });

      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user_id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: kycRoleMetadata,
          is_verified: false // Strictly unverified until Admin explicitly approves
        })
      });
    } catch (profErr) {
      console.warn('[Driver KYC API] profiles table sync notice:', profErr.message);
    }

    // 3. Save to persistent store
    const list = getStore();
    const existingIdx = list.findIndex(s => s.user_id === user_id || s.id === user_id);
    if (existingIdx !== -1) {
      list[existingIdx] = submissionRecord;
    } else {
      list.unshift(submissionRecord);
    }
    saveStore(list);

    return res.status(200).json({
      success: true,
      message: 'KYC documents submitted successfully. Status is Pending Admin Approval.',
      status: 'pending',
      submission: submissionRecord
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
