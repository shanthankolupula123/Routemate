const { getStore, saveStore } = require('../kyc-store');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch (e) { data = {}; }
  }
  data = data || {};

  const list = getStore();
  const target = list.find(s => 
    s.id === data.id || 
    (s.phone && s.phone === data.id) || 
    (s.email && s.email === data.id)
  );

  const isApproved = data.status === 'verified_success';
  if (target) {
    target.kyc_status = data.status;
    target.is_kyc_verified = isApproved;
    if (data.updateData) {
      Object.assign(target, data.updateData);
    }
    saveStore(list);
  }

  // Sync decision to Supabase profiles
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
    const profileId = data.id;
    if (profileId) {
      const queryParam = profileId.includes('@') || profileId.startsWith('+') || /^\d{10,}$/.test(profileId.replace(/[\s+-]/g, ''))
        ? `phone=eq.${encodeURIComponent(profileId)}`
        : `id=eq.${encodeURIComponent(profileId)}`;
      
      const getRes = await fetch(`${supabaseUrl}/rest/v1/profiles?${queryParam}&select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      if (getRes.ok) {
        const rows = await getRes.json();
        if (rows && rows[0]) {
          let roleObj = {};
          if (rows[0].role && rows[0].role.trim().startsWith('{')) {
            try { roleObj = JSON.parse(rows[0].role); } catch (e) {}
          }
          roleObj.kyc_status = data.status;
          roleObj.is_kyc_verified = isApproved;
          if (data.updateData) Object.assign(roleObj, data.updateData);

          const patchPayload = {
            is_verified: isApproved,
            role: JSON.stringify(roleObj)
          };
          if (isApproved && (data.updateData?.avatar_url || rows[0].avatar_url)) {
            patchPayload.avatar_url = data.updateData?.avatar_url || rows[0].avatar_url;
          }

          await fetch(`${supabaseUrl}/rest/v1/profiles?${queryParam}`, {
            method: 'PATCH',
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(patchPayload)
          });
        }
      }
    }
  } catch (e) {}

  return res.status(200).json({ success: true });
};
