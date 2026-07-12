import { api, type OrderCreateRequest, type OrderCreateResponse, type PaymentVerifyRequest, type TransactionPublic, type InvoicePublic } from "@/src/api/client";
import { MockPaymentProvider, type PaymentProvider } from "../providers/PaymentProvider";

// Use mock provider for now
const provider: PaymentProvider = new MockPaymentProvider();

export const paymentService = {
  async createOrder(token: string, payload: OrderCreateRequest): Promise<OrderCreateResponse> {
    return await api.createSubscriptionOrder(token, payload);
  },

  async processPayment(
    order: OrderCreateResponse, 
    userEmail: string, 
    institutionName: string
  ): Promise<{ paymentId: string; signature: string }> {
    return await provider.processPayment({
      orderId: order.order_id,
      amount: order.amount,
      currency: order.currency,
      institutionName,
      email: userEmail,
      contact: "0000000000" // Can be fetched from user if mobile exists
    });
  },

  async verifyPayment(token: string, payload: PaymentVerifyRequest): Promise<{ success: boolean; message: string }> {
    return await api.verifyPayment(token, payload);
  },

  async reportPaymentFailed(token: string, orderId: string, errorMessage: string, paymentId?: string): Promise<void> {
    await api.reportPaymentFailed(token, { order_id: orderId, error_message: errorMessage, payment_id: paymentId });
  },

  async getPaymentHistory(token: string): Promise<TransactionPublic[]> {
    return await api.getPaymentHistory(token);
  },

  async getInvoices(token: string): Promise<InvoicePublic[]> {
    return await api.getInvoices(token);
  }
};
