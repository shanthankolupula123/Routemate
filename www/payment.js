// Routemate - Razorpay Payment Gateway Integration
// Test Key ID: rzp_test_TkI3sJX6AyUs5l

const RAZORPAY_CONFIG = {
  keyId: 'rzp_test_TkI3sJX6AyUs5l',
  currency: 'INR',
  brandName: 'Routemate P2P Ride-Sharing',
  brandColor: '#2563EB'
};

const routematePayment = {
  // Check if Razorpay Checkout script is loaded
  isAvailable() {
    return typeof window !== 'undefined' && typeof window.Razorpay === 'function';
  },

  // Open Razorpay Standard Checkout Modal
  initiatePayment(ride, onSuccess, onFailure) {
    if (!this.isAvailable()) {
      alert('Razorpay Checkout SDK is still loading. Please check your internet connection.');
      if (onFailure) onFailure(new Error('Razorpay SDK not loaded'));
      return;
    }

    const amountInPaise = Math.round((ride.perSeatPrice || 108) * 100);

    const options = {
      key: RAZORPAY_CONFIG.keyId,
      amount: amountInPaise,
      currency: RAZORPAY_CONFIG.currency,
      name: RAZORPAY_CONFIG.brandName,
      description: `Fuel Share • ${ride.pickup} ➔ ${ride.drop || ride.drop_location}`,
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=128&h=128&q=80',
      prefill: {
        name: 'Verified Commuter',
        email: 'commuter@routemate.in',
        contact: '+919848023145'
      },
      notes: {
        ride_id: String(ride.id),
        driver: ride.driverName || ride.driver_name,
        pickup: ride.pickup,
        drop: ride.drop || ride.drop_location,
        purpose: 'Peer-to-peer fuel split contribution'
      },
      theme: {
        color: RAZORPAY_CONFIG.brandColor
      },
      handler: function (response) {
        console.log('✅ Razorpay Payment Succeeded:', response);
        // response.razorpay_payment_id is the verified transaction ID (e.g., pay_H5ABC123)
        if (onSuccess) {
          onSuccess({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
            amount: ride.perSeatPrice,
            currency: 'INR',
            method: 'razorpay'
          });
        }
      },
      modal: {
        ondismiss: function () {
          console.log('ℹ️ Razorpay modal dismissed by user');
          if (onFailure) onFailure(new Error('Payment cancelled by user'));
        }
      }
    };

    try {
      const rzpInstance = new window.Razorpay(options);
      rzpInstance.on('payment.failed', function (response) {
        console.error('❌ Razorpay Payment Failed:', response.error);
        if (onFailure) onFailure(response.error);
      });
      rzpInstance.open();
    } catch (err) {
      console.error('Error launching Razorpay Checkout:', err);
      if (onFailure) onFailure(err);
    }
  }
};

window.routematePayment = routematePayment;
window.RAZORPAY_CONFIG = RAZORPAY_CONFIG;
