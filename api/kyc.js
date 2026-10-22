const { getStore, saveStore } = require('./_kyc-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = req.url || '';

  if (req.method === 'GET') {
    const submissions = getStore();
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
      const resp = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        if (Array.isArray(rows)) {
          rows.forEach(p => {
            let extra = {};
            if (p.role && typeof p.role === 'string' && (p.role.trim().startsWith('{') || p.role.includes('"kyc_status"'))) {
              try { extra = JSON.parse(p.role); } catch(e) {}
            }
            if (extra.kyc_status || extra.aadhaar_number || extra.dl_number) {
              const item = {
                id: p.id,
                name: extra.name || p.name || 'Commuter',
                phone: p.phone,
                email: extra.email || (p.phone && p.phone.includes('@') ? p.phone : ''),
                avatar_url: p.avatar_url || extra.avatar_url || null,
                aadhaar_number: extra.aadhaar_number || '',
                aadhaar_card_photo: extra.aadhaar_card_photo || '',
                dl_number: extra.dl_number || '',
                dl_expiry: extra.dl_expiry || '',
                dl_photo: extra.dl_photo || '',
                rc_number: extra.rc_number || '',
                rc_vehicle_name: extra.rc_vehicle_name || '',
                rc_chassis_number: extra.rc_chassis_number || '',
                rc_photo: extra.rc_photo || '',
                kyc_status: extra.kyc_status || (p.is_verified ? 'verified_success' : 'verification_pending'),
                is_kyc_verified: Boolean(p.is_verified || extra.is_kyc_verified),
                kyc_submitted_at: extra.kyc_submitted_at || p.created_at || new Date().toISOString()
              };
              const exists = submissions.find(s => (s.phone && s.phone === item.phone) || (s.id && s.id === item.id));
              if (!exists) {
                submissions.push(item);
              } else {
                Object.assign(exists, item);
              }
            }
          });
        }
      }
    } catch (e) {}

    return res.status(200).json({ success: true, submissions });
  }

  if (req.method === 'POST') {
    let data = req.body;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch (e) { data = {}; }
    }
    data = data || {};

    let action = data.action;
    if (!action) {
      if (url.includes('/decision')) action = 'decision';
      else if (url.includes('/notify')) action = 'notify';
    }

    const list = getStore();
    if (action === 'decision') {
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
