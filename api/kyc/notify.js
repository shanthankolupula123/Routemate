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

  // Sync to Supabase profiles cloud store
  try {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
    const target = data.phone || data.email;
    if (target) {
      await fetch(`${supabaseUrl}/rest/v1/profiles?phone=eq.${encodeURIComponent(target)}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: data.name || undefined,
          avatar_url: data.avatar_url || undefined,
          role: JSON.stringify(data),
          is_verified: false
        })
      });
    }
  } catch (e) {}

  return res.status(200).json({ success: true, count: list.length });
};
