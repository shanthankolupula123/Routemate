// Serverless Function: POST /api/verify-payment
const crypto = require('crypto');

module.exports = async (req, res) => {
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
    const order_id = body.razorpay_order_id || body.order_id;
    const payment_id = body.razorpay_payment_id || body.payment_id;
    const razorpay_signature = body.razorpay_signature || body.signature;

    // Missing fields: return 400
    if (!order_id || !payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: order_id, payment_id, and signature are required'
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'yfYWZQq3DH6bmP250AFcVoY5';
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${order_id}|${payment_id}`)
      .digest('hex');

    // Signature mismatch: return 400, do NOT mark as paid
    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature. Verification failed.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Payment signature verified successfully',
      order_id,
      payment_id
    });
  } catch (err) {
    console.error('Serverless verify-payment error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Signature verification error'
    });
  }
};
