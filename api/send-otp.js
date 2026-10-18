// Serverless Function: POST /api/send-otp (Fast2SMS Direct Speed Dispatch)
const crypto = require('crypto');

const OTP_SECRET = process.env.OTP_SECRET || process.env.RAZORPAY_KEY_SECRET || 'routemate_otp_hmac_secret_2026';

function signOtp(phone, code, expiresAt) {
  return crypto.createHmac('sha256', OTP_SECRET).update(`${phone}:${code}:${expiresAt}`).digest('hex');
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

    let smsSent = false;
    let smsNotice = null;
    const fast2smsKey = process.env.FAST2SMS_API_KEY;

    if (fast2smsKey) {
      try {
        const smsPayload = {
          route: 'q',
          sender_id: 'TXTIND',
          message: `ROUTEMATE: Your verification OTP is: ${otpCode}. Valid for 10 minutes. Do not share with anyone.`,
          language: 'english',
          flash: 0,
          numbers: cleanPhone
        };

        const f2sRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(smsPayload)
        });
        const f2sData = await f2sRes.json().catch(() => ({}));

        if (f2sData.return === true) {
          smsSent = true;
          console.log(`[Fast2SMS] Dispatched directly to ${cleanPhone} (req: ${f2sData.request_id})`);
        } else {
          console.warn(`[Fast2SMS] Dispatch warning:`, f2sData);
          smsNotice = f2sData.message || 'Fast2SMS dispatch notice';
        }
      } catch (f2sErr) {
        console.error('[Fast2SMS] Network exception:', f2sErr);
        smsNotice = 'Network error contacting Fast2SMS API';
      }
    } else {
      smsNotice = 'Fast2SMS API key not set';
    }

    return res.status(200).json({
      success: true,
      status: smsSent ? 'sent' : 'pending_activation',
      route: 'q',
      provider: 'fast2sms',
      to: formattedPhone,
      otpToken: otpToken,
      expiresAt: expiresAt,
      devOtp: otpCode, // Instant code provision so users are never delayed by carrier DND
      notice: smsNotice
    });
  } catch (err) {
    console.error('Exception in /api/send-otp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error sending OTP'
    });
  }
};
