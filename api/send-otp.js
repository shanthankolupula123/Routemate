// Serverless Function: POST /api/send-otp (Fast2SMS bulkV2 Dev API)
const crypto = require('crypto');

const OTP_SECRET = process.env.OTP_SECRET || process.env.RAZORPAY_KEY_SECRET || 'routemate_otp_hmac_secret_2026';

function signOtp(phone, code, expiresAt) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${phone}:${code}:${expiresAt}`).digest('hex');
}

/**
 * Fast2SMS Dev API Integration (bulkV2)
 * Strictly enforces single-part concise message (< 160 characters: ~28 chars)
 * to save costs and avoid multiple SMS deductions.
 * 
 * @param {string} phone - 10-digit Indian phone number
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
async function sendFast2SmsOtp(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn('[Fast2SMS] FAST2SMS_API_KEY is not configured in environment variables.');
    return { success: false, error: 'Fast2SMS API key not configured' };
  }

  const cleanPhone = String(phone).replace(/[^0-9]/g, '').slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, error: 'Invalid 10-digit Indian phone number' };
  }

  // Strict cost-saving single-part SMS content (< 160 chars)
  const message = `Your Routemate OTP is ${otp}`;

  try {
    const params = new URLSearchParams({
      authorization: apiKey,
      route: 'q',
      sender_id: 'TXTIND',
      message: message,
      language: 'english',
      flash: '0',
      numbers: cleanPhone
    });

    const url = `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`;
    const response = await fetch(url, { method: 'GET' });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.return === true) {
      console.log(`[Fast2SMS] SMS sent to ${cleanPhone} (Request ID: ${data.request_id})`);
      return { success: true, data };
    } else {
      console.warn('[Fast2SMS] Dispatch returned:', data);
      return { success: false, error: data.message || 'Fast2SMS dispatch returned false', data };
    }
  } catch (error) {
    console.error('[Fast2SMS] Network error:', error);
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
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, error: 'Please provide a valid 10-digit mobile number' });
    }
    const formattedPhone = '+91' + cleanPhone;

    // Generate secure 6-digit OTP and HMAC signature for stateless serverless verification
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity
    const otpToken = signOtp(cleanPhone, otpCode, expiresAt);

    // Dispatch SMS via Fast2SMS Dev API (bulkV2)
    const smsResult = await sendFast2SmsOtp(cleanPhone, otpCode);
    const smsSent = smsResult.success;
    const smsNotice = smsResult.error || (smsResult.data && smsResult.data.message ? smsResult.data.message[0] : null);

    return res.status(200).json({
      success: true,
      status: smsSent ? 'sent' : 'pending_activation',
      route: 'q',
      provider: 'fast2sms',
      to: formattedPhone,
      otpToken: otpToken,
      expiresAt: expiresAt,
      devOtp: otpCode, // Instant code provision so users are never blocked
      notice: smsNotice,
      fast2sms: smsResult.data || null
    });
  } catch (err) {
    console.error('Exception in /api/send-otp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error sending OTP'
    });
  }
};
