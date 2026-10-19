// Serverless Function: POST /api/verify-otp (Resend Email OTP Verification with Supabase DB & HMAC fallback)
const crypto = require('crypto');

const OTP_SECRET = 'routemate_unified_hmac_secret_key_2026';

function signOtp(identifier, code, expiresAt) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${identifier}:${code}:${expiresAt}`).digest('hex');
}

function verifyOtpSignature(identifier, code, expiresAt, signature) {
  if (!signature || !expiresAt || Date.now() > Number(expiresAt)) return false;
  const expected = signOtp(identifier, code, expiresAt);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const { email, phone, target, code, otpToken, expiresAt } = body;
    const identifier = email || target || phone;
    if (!identifier || !code) {
      return res.status(400).json({ success: false, error: 'Email address and OTP code are required' });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();
    const cleanCode = String(code).trim();
    let isVerified = false;

    // 1. Primary: Verify against Supabase persistent database
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?phone=eq.${encodeURIComponent(cleanIdentifier)}&select=id,phone,avatar_url`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey
        }
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        if (rows && rows.length > 0 && rows[0].avatar_url && rows[0].avatar_url.startsWith('OTP:')) {
          const parts = rows[0].avatar_url.split(':');
          const storedCode = parts[1];
          const storedExpires = Number(parts[2]);
          if (storedCode === cleanCode && Date.now() <= storedExpires) {
            isVerified = true;
            console.log(`[Verify] OTP verified via database for ${cleanIdentifier}`);
            // Clear temporary OTP code from profile
            fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${rows[0].id}`, {
              method: 'PATCH',
              headers: {
                'apikey': supabaseKey,
                'Authorization': 'Bearer ' + supabaseKey,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ avatar_url: null, is_verified: true })
            }).catch(() => {});
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Verify] Database verification lookup notice:', dbErr.message);
    }

    // 2. Fallback: Verify stateless HMAC signature
    if (!isVerified && otpToken && expiresAt && verifyOtpSignature(cleanIdentifier, cleanCode, expiresAt, otpToken)) {
      isVerified = true;
      console.log(`[Verify] OTP verified via HMAC signature for ${cleanIdentifier}`);
    }

    if (isVerified) {
      return res.status(200).json({
        success: true,
        verified: true,
        status: 'approved',
        to: cleanIdentifier,
        dateUpdated: new Date().toISOString()
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code. Please check your email and try again.'
      });
    }
  } catch (err) {
    console.error('Exception in /api/verify-otp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error verifying OTP'
    });
  }
};
