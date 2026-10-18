// Routemate - Razorpay Standard Web Checkout Integration
// Standard Web Integration with Order Creation & HMAC-SHA256 Signature Verification

const RAZORPAY_CONFIG = {
  // Public Key ID only (Key Secret NEVER reaches client code)
  keyId: (typeof window !== 'undefined' && window.NEXT_PUBLIC_RAZORPAY_KEY_ID) || 'rzp_test_TpKUL3fUrtbbP4',
  currency: 'INR',
  brandName: 'Routemate P2P Ride-Sharing',
  brandColor: '#2563EB',
  createOrderEndpoint: '/api/create-order',
  verifyPaymentEndpoint: '/api/verify-payment'
};

const routematePayment = {
  // Check if Razorpay Checkout script is loaded
  isAvailable() {
    return typeof window !== 'undefined' && typeof window.Razorpay === 'function';
  },

  // Initialize config from backend if available
  async initConfig() {
    try {
      const resp = await fetch('/api/razorpay/config');
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.key_id) {
          RAZORPAY_CONFIG.keyId = data.key_id;
        }
      }
    } catch (e) {
      // Fallback to configured key
    }
  },

  // STEP 1, 2, 3: Full Standard Web Checkout Flow
  async initiatePayment(ride, onSuccess, onFailure) {
    if (!this.isAvailable()) {
      const errMsg = 'Razorpay Checkout SDK is still loading. Please check your internet connection.';
      alert(errMsg);
      if (onFailure) onFailure(new Error(errMsg));
      return;
    }

    // Amount in paise (minimum 100 paise = ₹1.00)
    const rawFare = (ride && (ride.perSeatPrice || ride.fare)) || 108;
    const amountInPaise = Math.max(100, Math.round(rawFare * 100));

    try {
      // STEP 1: BACKEND - Call /api/create-order
      const orderPayload = {
        amount: amountInPaise,
        currency: RAZORPAY_CONFIG.currency,
        receipt: `rcpt_${(ride && ride.id) || Date.now()}`,
        notes: {
          ride_id: String((ride && ride.id) || ''),
          driver: String((ride && (ride.driverName || ride.driver_name)) || 'Driver'),
          pickup: String((ride && ride.pickup) || ''),
          drop: String((ride && (ride.drop || ride.drop_location)) || ''),
          purpose: 'Routemate Ride Booking Payment'
        }
      };

      const createOrderRes = await fetch(RAZORPAY_CONFIG.createOrderEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const orderData = await createOrderRes.json();

      if (!createOrderRes.ok || !orderData.order_id) {
        const errMessage = orderData.error || 'Failed to create Razorpay payment order';
        console.error('❌ Razorpay create-order failed:', errMessage);
        alert(`Payment Error: ${errMessage}`);
        if (onFailure) onFailure(new Error(errMessage));
        return;
      }

      console.log('✅ Razorpay order created successfully:', orderData.order_id);

      // STEP 2: FRONTEND - Open Razorpay Modal with order_id
      const options = {
        key: RAZORPAY_CONFIG.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: RAZORPAY_CONFIG.brandName,
        description: `Fuel Share • ${(ride && ride.pickup) || 'Pickup'} ➔ ${(ride && (ride.drop || ride.drop_location)) || 'Destination'}`,
        image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80',
        prefill: {
          name: (window.state && window.state.currentUser && window.state.currentUser.name) || 'Verified Commuter',
          email: 'commuter@routemate.in',
          contact: (window.state && window.state.currentUser && window.state.currentUser.phone) || '+919848023145'
        },
        notes: orderPayload.notes,
        theme: {
          color: RAZORPAY_CONFIG.brandColor
        },
        handler: async function (response) {
          console.log('💳 Razorpay popup response received:', response);
          try {
            // STEP 3: BACKEND - Send razorpay_payment_id, razorpay_order_id, razorpay_signature to verify endpoint
            const verifyRes = await fetch(RAZORPAY_CONFIG.verifyPaymentEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              const verifyErr = verifyData.error || 'Payment signature verification failed';
              console.error('❌ Verification Error:', verifyErr);
              alert('⚠️ Security Alert: Payment signature verification failed. The transaction was not marked as paid.');
              if (onFailure) onFailure(new Error(verifyErr));
              return;
            }

            console.log('✅ Payment signature verified successfully:', verifyData);
            if (onSuccess) {
              onSuccess({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                amount: amountInPaise / 100,
                currency: RAZORPAY_CONFIG.currency,
                method: 'razorpay'
              });
            }
          } catch (verifyErr) {
            console.error('Error during signature verification:', verifyErr);
            alert('Payment verification connection error. Please contact support.');
            if (onFailure) onFailure(verifyErr);
          }
        },
        modal: {
          ondismiss: function () {
            console.log('ℹ️ Razorpay checkout modal dismissed by user');
            if (onFailure) onFailure(new Error('Payment cancelled by user'));
          }
        }
      };

      const rzpInstance = new window.Razorpay(options);

      // Handle payment.failed event
      rzpInstance.on('payment.failed', function (failResponse) {
        console.error('❌ Razorpay Payment Failed:', failResponse.error);
        const failMessage = (failResponse.error && failResponse.error.description) || 'Payment failed. Please retry.';
        alert(`Payment Failed: ${failMessage}`);
        if (onFailure) onFailure(failResponse.error);
      });

      rzpInstance.open();
    } catch (err) {
      console.error('Error launching Razorpay checkout:', err);
      alert(`Could not open payment checkout: ${err.message}`);
      if (onFailure) onFailure(err);
    }
  }
};

// Initialize config on load
if (typeof window !== 'undefined') {
  routematePayment.initConfig();
  window.routematePayment = routematePayment;
  window.RAZORPAY_CONFIG = RAZORPAY_CONFIG;
}
