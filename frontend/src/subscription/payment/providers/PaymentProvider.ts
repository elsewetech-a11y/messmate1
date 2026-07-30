export interface PaymentProvider {
  /**
   * Initializes the payment flow and returns a Promise that resolves 
   * with the payment details or rejects if failed.
   */
  processPayment(options: {
    orderId: string;
    amount: number;
    currency: string;
    institutionName: string;
    email: string;
    contact: string;
  }): Promise<{ paymentId: string; signature: string }>;
}

export class MockPaymentProvider implements PaymentProvider {
  processPayment(options: {
    orderId: string;
    amount: number;
    currency: string;
    institutionName: string;
    email: string;
    contact: string;
  }): Promise<{ paymentId: string; signature: string }> {
    return new Promise((resolve, reject) => {
      // Simulate network/gateway delay
      setTimeout(() => {
        // Mock a 90% success rate
        if (Math.random() > 0.1) {
          resolve({
            paymentId: `pay_${Math.random().toString(36).substring(7)}`,
            signature: "mock_signature"
          });
        } else {
          reject(new Error("Mock Payment failed or cancelled by user"));
        }
      }, 2000);
    });
  }
}

import RazorpayCheckout from 'react-native-razorpay';

export class RazorpayProvider implements PaymentProvider {
  processPayment(options: {
    orderId: string;
    amount: number;
    currency: string;
    institutionName: string;
    email: string;
    contact: string;
  }): Promise<{ paymentId: string; signature: string }> {
    return new Promise((resolve, reject) => {
      const checkoutOptions = {
        description: 'MessMate Subscription',
        image: 'https://messmate.app/logo.png', // Optional, replace with actual logo
        currency: options.currency,
        key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || '', // Will require env var
        amount: options.amount * 100, // Amount in paise
        name: 'MessMate',
        order_id: options.orderId,
        prefill: {
          email: options.email,
          contact: options.contact || '9999999999',
          name: options.institutionName
        },
        theme: { color: '#1a73e8' }
      };

      RazorpayCheckout.open(checkoutOptions).then((data: any) => {
        resolve({
          paymentId: data.razorpay_payment_id,
          signature: data.razorpay_signature
        });
      }).catch((error: any) => {
        console.error("Razorpay error detailed:", error);
        // Error codes:
        // 0 - Network Error
        // 1 - Initialization Error
        // 2 - Payment Cancelled
        reject(new Error(error.description || 'Payment failed or cancelled by user'));
      });
    });
  }
}
