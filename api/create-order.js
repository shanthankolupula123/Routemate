// Serverless Function: POST /api/create-order
let Razorpay;
try {
  Razorpay = require('razorpay');
} catch (e) {
  console.warn('Razorpay package load warning:', e.message);
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const amount = parseInt(body.amount, 10);
    const currency = body.currency || 'INR';
    const receipt = body.receipt || `rcpt_${Date.now()}`;
    const notes = body.notes || {};

    // Validate amount >= 100 paise
    if (isNaN(amount) || amount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be at least 100 paise (₹1.00)'
      });
    }

    const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_live_TpL2XODEcrhI1P';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'yfYWZQq3DH6bmP250AFcVoY5';

    if (!keyId || !keySecret) {
      return res.status(401).json({
        success: false,
        error: 'Razorpay API credentials not configured'
      });
    }

    let orderId = null;
    let orderAmount = amount;
    let orderCurrency = currency;

    try {
      if (!Razorpay) Razorpay = require('razorpay');
      const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
      const order = await instance.orders.create({ amount, currency, receipt, notes });
      orderId = order.id;
      orderAmount = order.amount;
      orderCurrency = order.currency;
    } catch (sdkErr) {
      // Direct call fallback
      const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
      const apiRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, currency, receipt, notes })
      });
      const apiData = await apiRes.json();
      if (!apiRes.ok || !apiData.id) {
        throw new Error((apiData.error && apiData.error.description) || 'Failed to create Razorpay order');
      }
      orderId = apiData.id;
      orderAmount = apiData.amount;
      orderCurrency = apiData.currency;
    }

    return res.status(200).json({
      success: true,
      order_id: orderId,
      amount: orderAmount,
      currency: orderCurrency
    });
  } catch (err) {
    console.error('Serverless create-order error:', err);
    const statusCode = (err && (err.statusCode || err.status)) || 500;
    return res.status(statusCode).json({
      success: false,
      error: (err.error && err.error.description) || err.message || 'Failed to create Razorpay order'
    });
  }
};
