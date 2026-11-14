// Routemate - Razorpay Standard Web Checkout Integration
// Standard Web Integration with Order Creation & HMAC-SHA256 Signature Verification

const RAZORPAY_CONFIG = {
  // Public Key ID only (Key Secret NEVER reaches client code)
  keyId: (typeof window !== 'undefined' && (window.NEXT_PUBLIC_RAZORPAY_KEY_ID || window.RAZORPAY_KEY_ID)) || 'rzp_live_TpL2XODEcrhI1P',
  currency: 'INR',
  brandName: 'Routemate P2P Ride-Sharing',
  brandColor: '#0052CC',
  createOrderEndpoint: '/api/create-order',
  verifyPaymentEndpoint: '/api/verify-payment'
};

const routematePayment = {
  // Check if Razorpay Checkout script is loaded
  isAvailable() {
    return typeof window !== 'undefined' && typeof window.Razorpay === 'function';
  },

  // Ensure Razorpay SDK is loaded dynamically if not yet on page
  async ensureSdkLoaded() {
    if (this.isAvailable()) return true;
    if (typeof window === 'undefined') return false;

    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[src*="checkout.razorpay.com"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay SDK.')));
        setTimeout(() => resolve(this.isAvailable()), 1500);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Unable to connect to Razorpay payment gateway SDK.'));
      document.head.appendChild(script);
    });
  },

  // Initialize config from backend if available
  async initConfig() {
    try {
      let resp = await fetch('/api/config');
      if (!resp.ok) resp = await fetch('/api/razorpay/config');
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

  // -------------------------------------------------------------------------
  // DRIVER WALLET RECHARGE VIA RAZORPAY CHECKOUT
  // -------------------------------------------------------------------------
  async initiateWalletRecharge({ amount, user }, onSuccess, onFailure) {
    try {
      await this.ensureSdkLoaded();
    } catch (e) {
      const errMsg = 'Razorpay Checkout SDK is still loading. Please check your internet connection.';
      if (typeof showToast === 'function') showToast(errMsg, 'danger');
      if (onFailure) onFailure(new Error(errMsg));
      return;
    }

    if (!this.isAvailable()) {
      const errMsg = 'Razorpay Checkout SDK could not be loaded. Please refresh the page.';
      if (typeof showToast === 'function') showToast(errMsg, 'danger');
      if (onFailure) onFailure(new Error(errMsg));
      return;
    }

    const rechargeAmount = parseFloat(amount);
    if (isNaN(rechargeAmount) || rechargeAmount < 10) {
      const errMsg = 'Minimum recharge amount is ₹10.';
      if (typeof showToast === 'function') showToast(errMsg, 'warning');
      if (onFailure) onFailure(new Error(errMsg));
      return;
    }

    const amountInPaise = Math.round(rechargeAmount * 100);

    try {
      // STEP 1: BACKEND - Call /api/create-order
      const orderPayload = {
        amount: amountInPaise,
        currency: RAZORPAY_CONFIG.currency,
        receipt: `rcpt_wallet_${(user && user.id) ? String(user.id).slice(0, 8) : Date.now()}_${Date.now()}`,
        notes: {
          user_id: String((user && user.id) || ''),
          driver_name: String((user && user.name) || 'Driver'),
          driver_phone: String((user && user.phone) || ''),
          purpose: 'Routemate Driver Wallet Online Recharge'
        }
      };

      const createOrderRes = await fetch(RAZORPAY_CONFIG.createOrderEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const orderData = await createOrderRes.json();

      if (!createOrderRes.ok || !orderData.order_id) {
        const errMessage = orderData.error || 'Failed to initialize Razorpay payment order';
        console.error('❌ Razorpay create-order failed:', errMessage);
        if (typeof showToast === 'function') showToast(`Payment Gateway Error: ${errMessage}`, 'danger');
        if (onFailure) onFailure(new Error(errMessage));
        return;
      }

      console.log('✅ Razorpay order created for wallet recharge:', orderData.order_id);

      // STEP 2: FRONTEND - Open Razorpay Modal with order_id
      const options = {
        key: RAZORPAY_CONFIG.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        order_id: orderData.order_id,
        name: 'Routemate Driver Wallet',
        description: `Wallet Top-Up (+₹${rechargeAmount})`,
        image: 'app-logo.png',
        prefill: {
          name: (user && user.name) || (window.state?.currentUser?.name) || 'Verified Driver',
          email: (user && user.email) || (window.state?.currentUser?.email) || 'driver@routemate.pro',
          contact: (user && user.phone) || (window.state?.currentUser?.phone) || '+919848012345'
        },
        notes: orderPayload.notes,
        theme: {
          color: RAZORPAY_CONFIG.brandColor
        },
        handler: async function (response) {
          console.log('💳 Razorpay wallet recharge response:', response);
          try {
            // STEP 3: BACKEND - HMAC Signature Verification
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
              if (typeof showToast === 'function') showToast('⚠️ Security Alert: Payment signature verification failed.', 'danger');
              if (onFailure) onFailure(new Error(verifyErr));
              return;
            }

            console.log('✅ Payment signature verified successfully:', verifyData);

            // STEP 4: BACKEND - Credit Driver Wallet
            if (window.db?.kyc?.rechargeDriverWallet) {
              const creditRes = await window.db.kyc.rechargeDriverWallet({
                userId: user?.id || window.state?.currentUser?.id,
                amount: rechargeAmount,
                paymentId: response.razorpay_payment_id
              });

              if (onSuccess) {
                onSuccess({
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id,
                  signature: response.razorpay_signature,
                  amount: rechargeAmount,
                  creditResult: creditRes
                });
              }
            } else {
              if (onSuccess) {
                onSuccess({
                  paymentId: response.razorpay_payment_id,
                  orderId: response.razorpay_order_id,
                  amount: rechargeAmount
                });
              }
            }
          } catch (vErr) {
            console.error('Signature verification / credit error:', vErr);
            if (typeof showToast === 'function') showToast('Payment verification error: ' + vErr.message, 'danger');
            if (onFailure) onFailure(vErr);
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

      rzpInstance.on('payment.failed', function (failResponse) {
        console.error('❌ Razorpay Payment Failed:', failResponse.error);
        const failMessage = (failResponse.error && failResponse.error.description) || 'Payment failed. Please retry.';
        if (typeof showToast === 'function') showToast(`Payment Failed: ${failMessage}`, 'danger');
        if (onFailure) onFailure(failResponse.error);
      });

      rzpInstance.open();
    } catch (err) {
      console.error('Error launching Razorpay wallet recharge:', err);
      if (typeof showToast === 'function') showToast(`Could not open payment checkout: ${err.message}`, 'danger');
      if (onFailure) onFailure(err);
    }
  },

  // -------------------------------------------------------------------------
  // RIDE BOOKING PAYMENT FLOW
  // -------------------------------------------------------------------------
  async initiatePayment(ride, onSuccess, onFailure) {
    try {
      await this.ensureSdkLoaded();
    } catch (e) {
      const errMsg = 'Razorpay Checkout SDK is still loading. Please check your internet connection.';
      alert(errMsg);
      if (onFailure) onFailure(new Error(errMsg));
      return;
    }

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
        image: 'app-logo.png',
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
