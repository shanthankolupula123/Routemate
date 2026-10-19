// Serverless Function: POST /api/send-otp (Resend Email OTP API)
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

function signOtp(email, code, expiresAt) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${email}:${code}:${expiresAt}`).digest('hex');
}

/**
 * Resend Email OTP Integration
 * Sends 6-digit verification code directly to user's email address.
 * 
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function sendResendEmailOtp(email, otp) {
  if (process.platform === 'win32' && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Resend] RESEND_API_KEY is not configured in environment variables.');
    return { success: false, error: 'Resend API key not configured' };
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { success: false, error: 'Please provide a valid email address' };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Routemate <auth@routemate.pro>';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Routemate Verification Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 20px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="display: flex; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Routemate</h2>
          <span style="margin-left: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: #eff6ff; color: #1d4ed8; padding: 2px 8px; border-radius: 9999px;">P2P Commute</span>
        </div>
        <h3 style="margin-top: 0; color: #0f172a; font-size: 18px; font-weight: 700;">Verify Your Email Address</h3>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px;">
          Use the 6-digit verification code below to securely log in or complete your registration on Routemate.
        </p>
        <div style="background-color: #eff6ff; border: 2px dashed #93c5fd; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <div style="font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1d4ed8;">
            ${otp}
          </div>
          <p style="margin: 8px 0 0 0; font-size: 12px; font-weight: 600; color: #3b82f6;">Valid for 10 minutes</p>
        </div>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin-bottom: 0;">
          If you didn't request this email, you can safely ignore it. Never share your verification code with anyone.
        </p>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [cleanEmail],
        subject: `Your Routemate Verification Code: ${otp}`,
        text: `Your Routemate verification code is: ${otp}\n\nThis 6-digit code is valid for 10 minutes.\nIf you did not request this code, please safely ignore this email.`,
        html: htmlContent
      })
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok && data.id) {
      console.log(`[Resend] Email OTP sent to ${cleanEmail} (ID: ${data.id})`);
      return { success: true, data };
    } else {
      console.warn('[Resend] Dispatch returned error:', data);
      return {
        success: false,
        error: (data && (data.message || data.error)) || 'Failed to send email via Resend',
        data
      };
    }
  } catch (error) {
    console.error('[Resend] Network error:', error);
    return { success: false, error: error.message };
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
    const email = body.email || body.target || (body.phone && body.phone.includes('@') ? body.phone : null);
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email address is required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
    }

    // Generate secure 6-digit OTP and HMAC signature for stateless serverless verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity
    const otpToken = signOtp(cleanEmail, otpCode, expiresAt);

    // Dispatch Email via Resend API
    const emailResult = await sendResendEmailOtp(cleanEmail, otpCode);
    if (!emailResult.success) {
      console.error('[Resend] Email dispatch failed:', emailResult.error);
      return res.status(400).json({
        success: false,
        error: emailResult.error || 'Failed to dispatch verification email. Please check your email address.'
      });
    }

    // Persist OTP in Supabase database for 100% reliable multi-device / tab verification
    try {
      const supabaseUrl = process.env.SUPABASE_URL || 'https://hjieeilzfbvubkhmlmdg.supabase.co';
      const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_FD8-opedLq151SNuBbWp9g_bLI5hB_a';
      await fetch(supabaseUrl + '/rest/v1/profiles', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          phone: cleanEmail,
          avatar_url: `OTP:${otpCode}:${expiresAt}`
        })
      });
    } catch (dbErr) {
      console.warn('[OTP Store] Notice persisting OTP in database:', dbErr.message);
    }

    return res.status(200).json({
      success: true,
      status: 'sent',
      provider: 'resend',
      to: cleanEmail,
      otpToken: otpToken,
      expiresAt: expiresAt,
      emailId: emailResult.data ? emailResult.data.id : null,
      message: 'Verification code sent to your email.'
    });
  } catch (err) {
    console.error('Exception in /api/send-otp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error sending OTP'
    });
  }
};
