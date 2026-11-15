const fs = require('fs');
const path = require('path');

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

const STORE_PATH = path.join('/tmp', 'routemate_broadcasts_store.json');

function getBroadcastStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, 'utf8');
      const data = JSON.parse(content || '[]');
      if (Array.isArray(data)) return data;
    }
  } catch (e) {}
  return [];
}

function saveBroadcastStore(list) {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(list || []), 'utf8');
  } catch (e) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // -------------------------------------------------------------------------
  // GET: Fetch Active Broadcast Announcements & Admin Dispatch History
  // -------------------------------------------------------------------------
  if (req.method === 'GET') {
    const broadcasts = getBroadcastStore();
    return res.status(200).json({
      success: true,
      broadcasts
    });
  }

  // -------------------------------------------------------------------------
  // POST: Dispatch New Broadcast Notice to Targeted Users with DB Fan-Out
  // -------------------------------------------------------------------------
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) { body = {}; }
    }
    body = body || {};

    const adminEmail = String(body.adminEmail || body.admin_email || '').trim().toLowerCase();
    if (adminEmail !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Only Super Admin (shanthankolupula123@gmail.com) can broadcast notifications.'
      });
    }

    const title = String(body.title || '').trim();
    const message = String(body.message || '').trim();
    const audience = String(body.audience || 'all').toLowerCase(); // 'all' | 'drivers' | 'commuters'
    const category = String(body.category || 'promo').toLowerCase(); // 'promo' | 'update' | 'safety' | 'corridor'
    const actionTab = body.actionTab || null;
    const actionLabel = body.actionLabel || (actionTab === 'drive' ? 'Open Driver Radar' : (actionTab === 'rider' ? 'Book Ride' : 'View Details'));

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Both notification Title and Message Body are required.'
      });
    }

    const iconMap = {
      safety: 'shield-alert',
      corridor: 'map-pin',
      update: 'sparkles',
      promo: 'megaphone'
    };

    const iconBgMap = {
      safety: 'bg-amber-100 text-amber-800',
      corridor: 'bg-indigo-100 text-indigo-800',
      update: 'bg-blue-100 text-blue-800',
      promo: 'bg-purple-100 text-purple-800'
    };

    const broadcastRecord = {
      id: 'bc_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
      title,
      message,
      audience,
      category,
      actionTab,
      actionLabel,
      icon: iconMap[category] || 'megaphone',
      iconBg: iconBgMap[category] || 'bg-purple-100 text-purple-800',
      sentAt: new Date().toISOString(),
      sentBy: adminEmail,
      deliveredCount: 0
    };

    // -----------------------------------------------------------------------
    // DATABASE FAN-OUT: Write to Supabase `profiles` table for target audience
    // -----------------------------------------------------------------------
    let deliveredCount = 0;
    try {
      const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=*`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });

      if (profRes.ok) {
        const allProfiles = await profRes.json();
        if (Array.isArray(allProfiles) && allProfiles.length > 0) {
          const updatePromises = allProfiles.map(async (prof) => {
            let meta = {};
            try {
              if (typeof prof.role === 'string' && prof.role.includes('{')) {
                meta = JSON.parse(prof.role);
              }
            } catch (e) {}

            const isDriver = meta.kyc_status === 'approved' || !!meta.vehicle_number || (Array.isArray(meta.vehicles) && meta.vehicles.length > 0);

            // Filter by audience
            if (audience === 'drivers' && !isDriver) return;
            if (audience === 'commuters' && isDriver && !meta.commute_active) return;

            const notifItem = {
              id: broadcastRecord.id,
              broadcastId: broadcastRecord.id,
              type: broadcastRecord.category,
              title: broadcastRecord.title,
              message: broadcastRecord.message,
              timestamp: broadcastRecord.sentAt,
              icon: broadcastRecord.icon,
              iconBg: broadcastRecord.iconBg,
              action: broadcastRecord.actionTab ? { label: broadcastRecord.actionLabel, tab: broadcastRecord.actionTab } : null
            };

            const existingNotifs = Array.isArray(meta.broadcast_notifications) ? meta.broadcast_notifications : [];
            const filteredNotifs = existingNotifs.filter(n => n.id !== notifItem.id);
            filteredNotifs.unshift(notifItem);
            meta.broadcast_notifications = filteredNotifs.slice(0, 30);

            try {
              await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(prof.id)}`, {
                method: 'PATCH',
                headers: {
                  'apikey': SUPABASE_KEY,
                  'Authorization': `Bearer ${SUPABASE_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: JSON.stringify(meta) })
              });
              deliveredCount++;
            } catch (pErr) {
              console.warn('[Broadcast Fan-Out] Profile patch error for', prof.id, pErr.message);
            }
          });

          await Promise.allSettled(updatePromises);
        }
      }
    } catch (dbErr) {
      console.warn('[Broadcast DB Error]:', dbErr.message);
    }

    broadcastRecord.deliveredCount = Math.max(deliveredCount, 1);

    // Save to persistent memory store
    const store = getBroadcastStore();
    store.unshift(broadcastRecord);
    saveBroadcastStore(store.slice(0, 50));

    return res.status(200).json({
      success: true,
      broadcast: broadcastRecord,
      deliveredCount: broadcastRecord.deliveredCount
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
