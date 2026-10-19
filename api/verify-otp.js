// Serverless Function: POST /api/verify-otp (Persistent Supabase DB & HMAC Verification)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load environment variables locally if .env is present
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

const OTP_SECRET = 'routemate_unified_hmac_secret_key_2026';

function signOtp(identifier, code, expiresAt) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${identifier}:${code}:${expiresAt}`).digest('hex');
}

function verifyOtpSignature(identifier, code, expiresAt, signature) {
  if (!signature || !expiresAt) return false;
  const expNum = Number(expiresAt);
  if (Date.now() > expNum) return false;
  const expected = signOtp(identifier, code, expNum);
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
      return res.status(400).json({ success: false, error: 'Email address and verification code are required.' });
    }

    const cleanIdentifier = String(identifier).trim().toLowerCase();
    const cleanCode = String(code).replace(/\D/g, '').trim();

    if (cleanCode.length !== 6) {
      return res.status(400).json({ success: false, error: 'Please enter all 6 digits of the verification code.' });
    }

    let isVerified = false;
    let isExpired = false;

    // 1. Primary Check: Supabase Persistent Database
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
      const dbRes = await fetch(`${supabaseUrl}/rest/v1/profiles?phone=eq.${encodeURIComponent(cleanIdentifier)}&select=id,phone,avatar_url`, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      if (dbRes.ok) {
        const rows = await dbRes.json();
        if (rows && rows.length > 0 && rows[0].avatar_url && rows[0].avatar_url.startsWith('OTP:')) {
          const parts = rows[0].avatar_url.split(':');
          const storedCode = String(parts[1] || '').trim();
          const storedExpires = Number(parts[2] || 0);

          if (storedCode === cleanCode) {
            if (Date.now() <= storedExpires) {
              isVerified = true;
              console.log(`[Verify] OTP successfully verified via database for ${cleanIdentifier}`);
              // Clear stored code to prevent replay attacks
              fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${rows[0].id}`, {
                method: 'PATCH',
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ avatar_url: null, is_verified: true })
              }).catch(() => {});
            } else {
              isExpired = true;
            }
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Verify] Database verification lookup notice:', dbErr.message);
    }

    // 2. Fallback Check: Stateless HMAC Signature Verification
    if (!isVerified && !isExpired && otpToken && expiresAt) {
      const expNum = Number(expiresAt);
      if (Date.now() > expNum) {
        isExpired = true;
      } else if (verifyOtpSignature(cleanIdentifier, cleanCode, expNum, otpToken)) {
        isVerified = true;
        console.log(`[Verify] OTP successfully verified via HMAC signature for ${cleanIdentifier}`);
      }
    }

    if (isVerified) {
      return res.status(200).json({
        success: true,
        verified: true,
        status: 'approved',
        to: cleanIdentifier,
        dateUpdated: new Date().toISOString()
      });
    }

    if (isExpired) {
      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please click Resend Code to receive a fresh OTP.'
      });
    }

    return res.status(400).json({
      success: false,
      error: 'Invalid verification code. Please check the latest 6-digit code sent to your email.'
    });

  } catch (err) {
    console.error('Exception in /api/verify-otp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error verifying OTP'
    });
  }
};
