declare module 'react-native-razorpay' {
  interface RazorpaySuccessResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }

  interface RazorpayErrorResponse {
    code: number;
    description: string;
    error: {
      reason: string;
      field: string;
      step: string;
      source: string;
      description: string;
    };
  }

  interface RazorpayCheckout {
    open(
      options: any,
      successCallback?: (data: RazorpaySuccessResponse) => void,
      errorCallback?: (data: RazorpayErrorResponse) => void
    ): Promise<RazorpaySuccessResponse>;
  }

  const RazorpayCheckout: RazorpayCheckout;
  export default RazorpayCheckout;
}
