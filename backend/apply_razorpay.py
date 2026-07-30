import re
import os

with open("server.py", "r") as f:
    code = f.read()

imports = """
import razorpay
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None
"""
if "import razorpay" not in code:
    code = code.replace("import uuid", "import uuid\n" + imports)

# Replace create_subscription_order
new_create_order = """async def create_subscription_order(
        payload: OrderCreateRequest,
        u: dict = Depends(require_admin)):
    try:
        amount_in_inr = payload.student_count * 3.0 if payload.plan_type == "monthly" else payload.student_count * 2.50
        amount_in_paise = int(amount_in_inr * 100)
        
        if razorpay_client:
            rp_order = razorpay_client.order.create({
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": f"receipt_{uuid.uuid4().hex[:8]}"
            })
            order_id = rp_order["id"]
        else:
            order_id = f"MM_ORDER_{uuid.uuid4().hex[:8].upper()}"

        doc = {
            "id": str(uuid.uuid4()),
            "institution_or_hostel_name": u["institution_or_hostel_name"],
            "admin_id": u.get("id"),
            "order_id": order_id,
            "payment_id": None,
            "provider": "razorpay" if razorpay_client else "mock",
            "amount": amount_in_inr,
            "currency": "INR",
            "status": "PENDING",
            "transaction_date": None,
            "plan_type": payload.plan_type,
            "student_count": payload.student_count,
            "action": "SUBSCRIPTION_PURCHASE",
            "created_at": now_iso()
        }
        await transactions_col.insert_one(doc)
        # Note: Frontend needs order_id (from razorpay) and amount for checkout
        return {"order_id": order_id, "amount": amount_in_inr, "currency": "INR"}
    except Exception as e:
        logger.error(f"Error in create_subscription_order: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal Server Error")"""

code = re.sub(r'async def create_subscription_order\(.*?raise HTTPException\(status_code=500, detail="Internal Server Error"\)', new_create_order, code, flags=re.DOTALL)

# Replace verify_payment
new_verify = """async def verify_payment(
        payload: PaymentVerifyRequest,
        u: dict = Depends(require_admin)):
    try:
        from datetime import datetime, timedelta, timezone

        order = await transactions_col.find_one({"order_id": payload.order_id, "institution_or_hostel_name": u["institution_or_hostel_name"]})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        if order["status"] == "SUCCESS":
            return {"success": True, "message": "Already verified"}

        if razorpay_client and order["provider"] == "razorpay":
            try:
                razorpay_client.utility.verify_payment_signature({
                    'razorpay_order_id': payload.order_id,
                    'razorpay_payment_id': payload.payment_id,
                    'razorpay_signature': payload.signature
                })
            except Exception as e:
                await transactions_col.update_one({"id": order["id"]}, {"$set": {"status": "FAILED", "error_message": "Invalid signature"}})
                raise HTTPException(status_code=400, detail="Invalid signature")
        else:
            if payload.signature != "mock_signature":
                await transactions_col.update_one({"id": order["id"]}, {"$set": {"status": "FAILED", "error_message": "Invalid signature"}})
                raise HTTPException(status_code=400, detail="Invalid signature")

        now_dt = datetime.now(IST)"""

code = re.sub(r'async def verify_payment\(.*?now_dt = datetime\.now\(IST\)', new_verify, code, flags=re.DOTALL)

with open("server.py", "w") as f:
    f.write(code)
print("Applied Razorpay changes to server.py")
