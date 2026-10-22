const { getStore } = require('../_kyc-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const submissions = getStore();

  let dbError = null;
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
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
          if (p.role && typeof p.role === 'string' && (p.role.trim().startsWith('{') || p.role.includes('kyc_status') || p.role.includes('dl_number'))) {
            try { extra = JSON.parse(p.role); } catch(e) {}
          }
          if (extra.kyc_status || extra.aadhaar_number || extra.dl_number || extra.rc_number) {
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
    } else {
      dbError = 'Supabase HTTP ' + resp.status;
    }
  } catch (e) {
    dbError = e.message;
  }

  return res.status(200).json({ success: true, submissions, dbError });
};
