// Serverless Function: POST /api/send-otp (Twilio Verify)
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

    // Ensure E.164 format (e.g. +91...)
    let formattedPhone = phone.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+91' + formattedPhone.replace(/[^0-9]/g, '');
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !serviceSid) {
      return res.status(500).json({
        success: false,
        error: 'Twilio Verify service credentials are not configured in environment variables'
      });
    }

    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', formattedPhone);
    params.append('Channel', 'sms');

    const twilioRes = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error('Twilio Verify Send Error:', data);
      return res.status(twilioRes.status || 400).json({
        success: false,
        error: data.message || 'Failed to send OTP through Twilio'
      });
    }

    return res.status(200).json({
      success: true,
      status: data.status,
      to: data.to,
      serviceSid: data.service_sid
    });
  } catch (err) {
    console.error('Exception in /api/send-otp:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error sending OTP'
    });
  }
};
