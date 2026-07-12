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

// In the future:
// export class RazorpayProvider implements PaymentProvider { ... }
// export class CashfreeProvider implements PaymentProvider { ... }
