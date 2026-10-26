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

    // Ensure each submission has normalized photos, vehicle details, and populated vehicles array
    allSubmissions.forEach(sub => {
      let notesData = {};
      if (sub.notes && typeof sub.notes === 'string' && sub.notes.trim().startsWith('{')) {
        try { notesData = JSON.parse(sub.notes); } catch (e) {}
      }

      sub.dl_front_photo = sub.dl_front_photo || sub.dlFrontPhoto || sub.dl_front || notesData.dl_front_photo || '';
      sub.dl_back_photo = sub.dl_back_photo || sub.dlBackPhoto || sub.dl_back || notesData.dl_back_photo || '';
      sub.aadhaar_front_photo = sub.aadhaar_front_photo || sub.aadhaarFrontPhoto || sub.aadhaar_front || notesData.aadhaar_front_photo || '';
      sub.aadhaar_back_photo = sub.aadhaar_back_photo || sub.aadhaarBackPhoto || sub.aadhaar_back || notesData.aadhaar_back_photo || '';
      sub.rc_photo = sub.rc_photo || sub.rcPhoto || (sub.vehicles && sub.vehicles[0]?.rc_photo) || notesData.rc_photo || '';
      sub.driver_photo = sub.driver_photo || sub.driverPhoto || sub.avatar_url || notesData.driver_photo || '';
      sub.vehicle_name = sub.vehicle_name || sub.vehicleName || notesData.vehicle_name || (sub.vehicles && sub.vehicles[0]?.vehicle_name) || (sub.vehicle_type === 'car' ? 'Car Seat' : (sub.vehicle_type === 'auto' ? 'Auto' : 'Two-Wheeler / Bike'));
      sub.vehicle_color = sub.vehicle_color || sub.vehicleColor || notesData.vehicle_color || (sub.vehicles && sub.vehicles[0]?.vehicle_color) || 'Standard';

      if (!sub.vehicles || !Array.isArray(sub.vehicles) || sub.vehicles.length === 0) {
        if (notesData.vehicles && Array.isArray(notesData.vehicles) && notesData.vehicles.length > 0) {
          sub.vehicles = notesData.vehicles;
        } else if (sub.vehicle_number) {
          sub.vehicles = [
            {
              id: 'veh_primary_' + (sub.id || sub.user_id),
              user_id: sub.user_id || sub.id,
              vehicle_number: sub.vehicle_number,
              vehicle_type: sub.vehicle_type || 'bike',
              vehicle_name: sub.vehicle_name,
              vehicle_color: sub.vehicle_color,
              rc_photo: sub.rc_photo,
              status: sub.status || 'pending',
              is_default: true,
              submitted_at: sub.submitted_at || new Date().toISOString()
            }
          ];
        } else {
          sub.vehicles = [];
        }
      } else {
        sub.vehicles.forEach(v => {
          if (!v.vehicle_color && sub.vehicle_color) v.vehicle_color = sub.vehicle_color;
          if (!v.vehicle_name && sub.vehicle_name) v.vehicle_name = sub.vehicle_name;
        });
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
      const cleanUserId = body.user_id || body.userId;
      const cleanVehNum = String(body.vehicle_number || body.vehicleNumber || '').trim().toUpperCase();
      const cleanVehType = body.vehicle_type || body.vehicleType || 'bike';
      const cleanVehName = body.vehicle_name || body.vehicleName || (cleanVehType === 'car' ? 'Car Seat' : (cleanVehType === 'auto' ? 'Auto' : 'Bike'));
      const cleanVehColor = body.vehicle_color || body.vehicleColor || body.vehicle_colour || body.vehicleColour || 'Standard';
      const cleanRcPhoto = body.rc_photo || body.rcPhoto;

      if (!cleanUserId || !cleanVehNum || !cleanRcPhoto) {
        return res.status(400).json({
          success: false,
          error: 'Vehicle Number and Registration Certificate (RC) photo are mandatory.'
        });
      }

      const list = getStore();
      let sub = list.find(s => s.user_id === cleanUserId || s.id === cleanUserId || s.driver_email === body.driver_email);

      if (!sub) {
        sub = {
          id: cleanUserId,
          user_id: cleanUserId,
          driver_name: body.driver_name || body.driverName || 'Driver',
          driver_email: body.driver_email || body.driverEmail || '',
          driver_phone: body.driver_phone || body.driverPhone || '',
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
        user_id: cleanUserId,
        vehicle_number: cleanVehNum,
        vehicle_type: cleanVehType,
        vehicle_name: cleanVehName,
        vehicle_color: cleanVehColor,
        rc_photo: cleanRcPhoto,
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
    const cleanUserId = body.user_id || body.userId;
    const cleanDriverName = body.driver_name || body.driverName;
    const cleanDriverPhone = body.driver_phone || body.driverPhone || '';
    const cleanDriverEmail = body.driver_email || body.driverEmail || '';
    const cleanDriverPhoto = body.driver_photo || body.driverPhoto || null;
    const cleanDlNumber = body.dl_number || body.dlNumber;
    const cleanDlFront = body.dl_front_photo || body.dlFrontPhoto || body.dl_front;
    const cleanDlBack = body.dl_back_photo || body.dlBackPhoto || body.dl_back;
    const cleanAadhaarNumber = body.aadhaar_number || body.aadhaarNumber;
    const cleanAadhaarFront = body.aadhaar_front_photo || body.aadhaarFrontPhoto || body.aadhaar_front;
    const cleanAadhaarBack = body.aadhaar_back_photo || body.aadhaarBackPhoto || body.aadhaar_back;
    const cleanVehicleNumber = body.vehicle_number || body.vehicleNumber;
    const cleanVehicleType = body.vehicle_type || body.vehicleType || 'bike';
    const cleanVehicleName = body.vehicle_name || body.vehicleName || (cleanVehicleType === 'car' ? 'Car Seat' : (cleanVehicleType === 'auto' ? 'Auto' : 'Two-Wheeler / Bike'));
    const cleanVehicleColor = body.vehicle_color || body.vehicleColor || body.vehicle_colour || body.vehicleColour || 'Standard';
    const cleanRcPhoto = body.rc_photo || body.rcPhoto;

    if (!cleanUserId || !cleanDriverName || !cleanDlNumber || !cleanAadhaarNumber || !cleanVehicleNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing mandatory fields: Name, DL Number, Aadhaar Number, and Vehicle Number are required.'
      });
    }

    if (!cleanDlFront || !cleanDlBack) {
      return res.status(400).json({
        success: false,
        error: 'Both front and back photos of your Driving License are mandatory.'
      });
    }

    if (!cleanAadhaarFront || !cleanAadhaarBack) {
      return res.status(400).json({
        success: false,
        error: 'Both front and back photos of your Aadhaar Card are mandatory.'
      });
    }

    if (!cleanRcPhoto) {
      return res.status(400).json({
        success: false,
        error: 'Vehicle Registration Certificate (RC) document photo is mandatory.'
      });
    }

    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

    const submissionRecord = {
      id: cleanUserId,
      user_id: cleanUserId,
      driver_name: String(cleanDriverName).trim(),
      driver_phone: String(cleanDriverPhone).trim(),
      driver_email: String(cleanDriverEmail).trim().toLowerCase(),
      driver_photo: cleanDriverPhoto,
      dl_number: String(cleanDlNumber).trim().toUpperCase(),
      dl_front_photo: cleanDlFront,
      dl_back_photo: cleanDlBack,
      aadhaar_number: String(cleanAadhaarNumber).replace(/\s/g, '').trim(),
      aadhaar_front_photo: cleanAadhaarFront,
      aadhaar_back_photo: cleanAadhaarBack,
      vehicle_number: String(cleanVehicleNumber).trim().toUpperCase(),
      vehicle_type: cleanVehicleType,
      vehicle_name: cleanVehicleName,
      vehicle_color: cleanVehicleColor,
      rc_photo: cleanRcPhoto,
      status: 'pending', // Strictly Pending Approval
      rejection_reason: null,
      submitted_at: new Date().toISOString(),
      vehicles: [
        {
          id: 'veh_primary_' + cleanUserId,
          user_id: cleanUserId,
          vehicle_number: String(cleanVehicleNumber).trim().toUpperCase(),
          vehicle_type: cleanVehicleType,
          vehicle_name: cleanVehicleName,
          vehicle_color: cleanVehicleColor,
          rc_photo: cleanRcPhoto,
          status: 'pending',
          is_default: true,
          submitted_at: new Date().toISOString()
        }
      ]
    };

    // 1. Save / Upsert to Supabase `driver_kyc` table
    try {
      // Check if row exists for user_id
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/driver_kyc?user_id=eq.${encodeURIComponent(cleanUserId)}&select=id`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      let existingRows = [];
      if (checkRes.ok) existingRows = await checkRes.json();

      const supaPayload = {
        user_id: cleanUserId,
        driver_name: submissionRecord.driver_name,
        driver_phone: submissionRecord.driver_phone,
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
        status: 'pending',
        submitted_at: submissionRecord.submitted_at
      };

      if (existingRows && Array.isArray(existingRows) && existingRows.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/driver_kyc?user_id=eq.${encodeURIComponent(cleanUserId)}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(supaPayload)
        });
      } else {
        if (isUUID(cleanUserId)) supaPayload.id = cleanUserId;
        await fetch(`${SUPABASE_URL}/rest/v1/driver_kyc`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(supaPayload)
        });
      }
    } catch (supaErr) {
      console.warn('[Driver KYC API] driver_kyc table insert notice:', supaErr.message);
    }

    // 2. Sync to Supabase `profiles` table
    try {
      const kycRoleMetadata = JSON.stringify({
        kyc_status: 'pending',
        driver_name: submissionRecord.driver_name,
        driver_email: submissionRecord.driver_email,
        driver_phone: submissionRecord.driver_phone,
        driver_photo: submissionRecord.driver_photo,
        dl_number: submissionRecord.dl_number,
        dl_front_photo: submissionRecord.dl_front_photo,
        dl_back_photo: submissionRecord.dl_back_photo,
        aadhaar_number: submissionRecord.aadhaar_number,
        aadhaar_front_photo: submissionRecord.aadhaar_front_photo,
        aadhaar_back_photo: submissionRecord.aadhaar_back_photo,
        vehicle_number: submissionRecord.vehicle_number,
        vehicle_name: submissionRecord.vehicle_name,
        vehicle_color: submissionRecord.vehicle_color,
        vehicle_type: submissionRecord.vehicle_type,
        rc_photo: submissionRecord.rc_photo,
        submitted_at: submissionRecord.submitted_at,
        vehicles: submissionRecord.vehicles
      });

      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(cleanUserId)}`, {
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
    const existingIdx = list.findIndex(s => s.user_id === cleanUserId || s.id === cleanUserId);
    if (existingIdx !== -1) {
      list[existingIdx] = submissionRecord;
    } else {
      list.unshift(submissionRecord);
    }
    saveStore(list);

    return res.status(200).json({
      success: true,
      message: 'Documents Under Review - Pending Verification. Your account will be verified and approved within 24 to 48 hours.',
      status: 'pending',
      submission: submissionRecord
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
