import { api, type SubscriptionPublic } from "@/src/api/client";

export const subscriptionService = {
  checkSubscriptionStatus: async (token: string, role?: string): Promise<SubscriptionPublic> => {
    if (role === "student") {
      return await api.getStudentSubscriptionStatus(token);
    }
    return await api.getSubscriptionStatus(token);
  },
  renewSubscription: async (token: string): Promise<{ success: boolean; message: string }> => {
    return await api.renewSubscription(token);
  }
};
