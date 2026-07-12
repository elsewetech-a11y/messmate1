import { api, type SubscriptionPublic } from "@/src/api/client";

export const subscriptionService = {
  checkSubscriptionStatus: async (token: string): Promise<SubscriptionPublic> => {
    return await api.getSubscriptionStatus(token);
  },
  renewSubscription: async (token: string): Promise<{ success: boolean; message: string }> => {
    return await api.renewSubscription(token);
  }
};
